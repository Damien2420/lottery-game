import type Matter from 'matter-js';
import type { Sfx } from './audio';
import { getBoard } from './boards';
import type { Board, BoardId } from './boards/types';
import { MARBLE_R, STEP_MS, WORLD_W } from './physics';
import { Simulation, type SimConfig } from './simulation';

/** 畫面至少要顯示的世界高度，決定縮放比例 */
const MIN_VIEW_H = 720;

/** 遊戲對外通知的事件 */
export interface GameEvents {
  /**
   * 得獎名額內的某顆彈珠抵達終點。
   * @param index 參加者在名單中的索引
   * @param rank 名次（從 1 開始）
   */
  onArrive(index: number, rank: number): void;
  /**
   * 所有得獎者已產生（每場只觸發一次）。
   * @param winners 依名次排列的得獎者索引
   */
  onDone(winners: number[]): void;
}

const BODY_COLORS: Record<string, string> = {
  wall: '#3b4a7a',
  peg: '#9fb3ff',
  bumper: '#ff5c8a',
  spinner: '#ffd166',
};

/**
 * 彈珠台繪製層：以固定步長驅動 Simulation，負責音效、鏡頭跟隨與 Canvas 繪製。
 * 物理與名次判定全部在 Simulation，這裡不含任何物理邏輯。
 */
export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  /** 目前顯示的台面（閒置時為 showBoard 建構的靜態台面，進行中為模擬的台面） */
  private board: Board | null = null;
  private sim: Simulation | null = null;
  private winnerCount = 1;
  private doneFired = false;

  private camY = 0;
  private scale = 1;
  private offsetX = 0;
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;
  private acc = 0;
  private lastTime = 0;
  private rafId = 0;
  private destroyed = false;

  /**
   * @param canvas 繪製用的畫布，尺寸跟隨其父元素
   * @param events 抵達與完成事件的回呼
   * @param sfx 音效播放器
   */
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly events: GameEvents,
    private readonly sfx: Sfx,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement!);
    this.resize();
    this.rafId = requestAnimationFrame((t) => this.frame(t));
  }

  /**
   * 閒置時顯示指定台面（擋板停在初始角度，不會轉動）。進行中的場次會被中止。
   * @param boardId 台面識別碼
   */
  showBoard(boardId: BoardId): void {
    this.stop();
    this.board = getBoard(boardId)?.build() ?? null;
  }

  /**
   * 開始新一場，會中止並丟棄上一場。需由使用者操作觸發，以便解鎖音效。
   * @param cfg 模擬輸入
   */
  start(cfg: SimConfig): void {
    try {
      // 音效關閉時不建立 AudioContext（如首頁示範沒有使用者操作）；之後開啟音效，下一次使用者啟動時才解鎖
      if (this.sfx.enabled) this.sfx.unlock();
    } catch {
      // 音效無法啟用（例如瀏覽器不支援）不應影響抽獎本身
    }
    this.sim = new Simulation(cfg);
    this.board = this.sim.board;
    this.winnerCount = cfg.winnerCount;
    this.doneFired = false;
    this.camY = 0;
    this.acc = 0;
  }

  /** 中止目前這場並丟棄模擬，不觸發 onDone。台面仍會顯示。 */
  stop(): void {
    this.sim = null;
    this.doneFired = false;
    this.camY = 0;
  }

  /** 停止畫面迴圈並解除尺寸監聽，可重複呼叫。 */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.sim = null;
    this.sfx.dispose();
  }

  /** 每個畫面更新：以固定步長推進模擬，再更新鏡頭並繪製。 */
  private frame(time: number): void {
    if (this.destroyed) return;
    const dt = this.lastTime ? Math.min(time - this.lastTime, 100) : 0;
    this.lastTime = time;
    if (this.sim) {
      this.acc += dt;
      while (this.sim && this.acc >= STEP_MS) {
        this.advance(this.sim);
        this.acc -= STEP_MS;
      }
    }
    this.updateCamera();
    this.render();
    this.rafId = requestAnimationFrame((t) => this.frame(t));
  }

  /**
   * 推進模擬一步，並依結果播放音效、通知抵達與完成。
   * @param sim 目前的模擬
   */
  private advance(sim: Simulation): void {
    const { arrivals, hits } = sim.step();
    for (const h of hits) this.sfx.hit(h.speed, h.bumper);
    for (const a of arrivals) {
      // 名額以外的抵達者不通知、不出聲
      if (a.rank > this.winnerCount) continue;
      if (a.rank === 1) this.sfx.win();
      else this.sfx.finish();
      this.events.onArrive(a.index, a.rank);
    }
    if (!this.doneFired && sim.isDone()) {
      this.doneFired = true;
      this.events.onDone(sim.winners.slice());
    }
  }

  /** 鏡頭平滑跟隨領先者，讓領先者位於畫面約 55% 高度處。 */
  private updateCamera(): void {
    const lead = this.sim?.leader();
    if (!lead || !this.board) return;
    const viewH = this.cssH / this.scale;
    const target = Math.min(Math.max(lead.body.position.y - viewH * 0.55, 0), Math.max(0, this.board.worldH - viewH));
    this.camY += (target - this.camY) * 0.08;
  }

  /** 依父元素大小調整畫布解析度與縮放比例。 */
  private resize(): void {
    const parent = this.canvas.parentElement!;
    this.cssW = parent.clientWidth;
    this.cssH = parent.clientHeight;
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.cssW * this.dpr;
    this.canvas.height = this.cssH * this.dpr;
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    this.scale = Math.min(this.cssW / WORLD_W, this.cssH / MIN_VIEW_H);
    this.offsetX = (this.cssW - WORLD_W * this.scale) / 2;
  }

  /** 繪製整個畫面（只畫出可視範圍內的物件）。 */
  private render(): void {
    const { ctx, board } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    if (!board) return;

    ctx.save();
    ctx.translate(this.offsetX, -this.camY * this.scale);
    ctx.scale(this.scale, this.scale);

    ctx.fillStyle = '#141b33';
    ctx.fillRect(0, 0, WORLD_W, board.worldH);
    this.drawFinishLine(board);

    const top = this.camY;
    const bottom = this.camY + this.cssH / this.scale;
    const visible = (b: Matter.Body) => b.bounds.max.y >= top && b.bounds.min.y <= bottom;

    for (const b of board.statics) if (visible(b)) this.drawBody(b);
    for (const s of board.spinners) if (visible(s.body)) this.drawBody(s.body);

    const sim = this.sim;
    if (sim) {
      const lead = this.doneFired ? null : sim.leader();
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      for (const m of sim.marbles) {
        if (m.finished || !visible(m.body)) continue;
        const { x, y } = m.body.position;
        ctx.beginPath();
        ctx.arc(x, y, MARBLE_R, 0, Math.PI * 2);
        ctx.fillStyle = m.color;
        ctx.fill();
        if (m === lead) {
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#fff';
          ctx.stroke();
        }
        const label = m.name.length > 6 ? `${m.name.slice(0, 6)}…` : m.name;
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000';
        ctx.strokeText(label, x, y - MARBLE_R - 4);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, x, y - MARBLE_R - 4);
      }
    }
    ctx.restore();
  }

  /** 依剛體類型著色，圓形畫圓、其餘依頂點畫多邊形。 */
  private drawBody(b: Matter.Body): void {
    const { ctx } = this;
    ctx.fillStyle = BODY_COLORS[b.label] ?? BODY_COLORS.wall;
    ctx.beginPath();
    if (b.circleRadius) {
      ctx.arc(b.position.x, b.position.y, b.circleRadius, 0, Math.PI * 2);
    } else {
      ctx.moveTo(b.vertices[0].x, b.vertices[0].y);
      for (const v of b.vertices.slice(1)) ctx.lineTo(v.x, v.y);
      ctx.closePath();
    }
    ctx.fill();
  }

  /**
   * 繪製黑白棋盤格終點線。
   * @param board 目前的台面（取得 finishY）
   */
  private drawFinishLine(board: Board): void {
    const { ctx } = this;
    const size = 12;
    for (let x = 0, i = 0; x < WORLD_W; x += size, i++) {
      for (let row = 0; row < 2; row++) {
        ctx.fillStyle = (i + row) % 2 ? '#fff' : '#111';
        ctx.fillRect(x, board.finishY + row * size, size, size);
      }
    }
    ctx.fillStyle = '#ffd166';
    ctx.font = '700 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FINISH', WORLD_W / 2, board.finishY + 70);
  }
}
