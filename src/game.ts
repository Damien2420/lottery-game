import Matter from 'matter-js';
import type { Sfx } from './audio';
import { buildBoard, FINISH_Y, MARBLE_R, WORLD_H, WORLD_W, type Board } from './board';

const { Engine, Composite, Bodies, Body, Events, Vector } = Matter;

/** 固定物理步長（毫秒），與畫面更新率脫鉤，確保不同裝置結果一致 */
const STEP_MS = 1000 / 60;
/** 彈珠最高速度，避免高速穿透釘子 */
const MAX_SPEED = 16;
/** 低於此速度視為靜止 */
const STUCK_SPEED = 0.2;
/** 靜止超過此時間即推一把 */
const STUCK_MS = 1500;
/** 保險桿彈開速度 */
const BUMPER_KICK = 9;
/** 畫面至少要顯示的世界高度，決定縮放比例 */
const MIN_VIEW_H = 720;

/** 參加者對應的彈珠 */
export interface Marble {
  body: Matter.Body;
  name: string;
  color: string;
  finished: boolean;
  /** 開始靜止的物理時間戳，未靜止為 null */
  stillSince: number | null;
}

/** 遊戲對外通知的事件 */
export interface GameEvents {
  /** 前 N 名中的某顆彈珠抵達終點 */
  onArrive(marble: Marble, rank: number): void;
  /** 所有得獎者已產生 */
  onDone(winners: Marble[]): void;
}

const BODY_COLORS: Record<string, string> = {
  wall: '#3b4a7a',
  peg: '#9fb3ff',
  bumper: '#ff5c8a',
  spinner: '#ffd166',
};

/**
 * 彈珠台抽獎主體：負責物理模擬、終點判定、鏡頭跟隨與 Canvas 繪製。
 */
export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly engine = Engine.create({ positionIterations: 10, velocityIterations: 8 });
  private readonly board: Board = buildBoard();
  private marbles: Marble[] = [];
  private byBodyId = new Map<number, Marble>();
  private arrived: Marble[] = [];
  private pendingKicks: [Matter.Body, Matter.Body][] = [];
  private winnerCount = 1;
  private done = true;

  private camY = 0;
  private scale = 1;
  private offsetX = 0;
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;
  private acc = 0;
  private lastTime = 0;

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
    Composite.add(this.engine.world, [...this.board.statics, ...this.board.spinners.map((s) => s.body)]);
    Events.on(this.engine, 'collisionStart', (e) => this.handleCollisions(e));
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement!);
    this.resize();
    requestAnimationFrame((t) => this.frame(t));
  }

  /**
   * 開始新一輪抽獎，會清除上一輪殘留的彈珠。
   * @param names 參加者名單
   * @param winnerCount 要抽出的名額
   */
  start(names: string[], winnerCount: number): void {
    Composite.remove(
      this.engine.world,
      this.marbles.filter((m) => !m.finished).map((m) => m.body),
    );
    this.marbles = [];
    this.byBodyId.clear();
    this.arrived = [];
    this.pendingKicks = [];
    this.winnerCount = winnerCount;
    this.done = false;
    this.camY = 0;

    // 洗牌後才分配起始位置，避免名單順序影響起跑點
    const gap = MARBLE_R * 2 + 6;
    const perRow = Math.floor((WORLD_W - 40) / gap);
    shuffle(names).forEach((name, i) => {
      const x = 20 + gap / 2 + (i % perRow) * gap + (Math.random() - 0.5) * 4;
      const y = 30 + Math.floor(i / perRow) * gap + (Math.random() - 0.5) * 4;
      const body = Bodies.circle(x, y, MARBLE_R, {
        restitution: 0.5,
        friction: 0.01,
        // 預設靜摩擦 0.5 會讓低速彈珠黏在斜坡上
        frictionStatic: 0,
        frictionAir: 0.005,
        density: 0.002,
        label: 'marble',
      });
      const marble: Marble = { body, name, color: `hsl(${(i * 137.5) % 360} 80% 60%)`, finished: false, stillSince: null };
      this.marbles.push(marble);
      this.byBodyId.set(body.id, marble);
    });
    Composite.add(this.engine.world, this.marbles.map((m) => m.body));
  }

  /** 每個畫面更新：以固定步長推進物理，再更新鏡頭並繪製。 */
  private frame(time: number): void {
    const dt = this.lastTime ? Math.min(time - this.lastTime, 100) : 0;
    this.lastTime = time;
    this.acc += dt;
    while (this.acc >= STEP_MS) {
      this.step();
      this.acc -= STEP_MS;
    }
    this.updateCamera();
    this.render();
    requestAnimationFrame((t) => this.frame(t));
  }

  /** 推進一個物理步長並處理終點、限速、防卡死。 */
  private step(): void {
    for (const s of this.board.spinners) Body.setAngle(s.body, s.body.angle + s.speed);
    Engine.update(this.engine, STEP_MS);

    // 保險桿：沿圓心→彈珠方向彈開
    for (const [marble, bumper] of this.pendingKicks) {
      const dir = Vector.normalise(Vector.sub(marble.position, bumper.position));
      Body.setVelocity(marble, Vector.mult(dir, BUMPER_KICK));
    }
    this.pendingKicks = [];

    const now = this.engine.timing.timestamp;
    for (const m of this.marbles) {
      if (m.finished) continue;
      const b = m.body;
      if (b.position.y > FINISH_Y) {
        this.arrive(m);
        continue;
      }
      if (b.speed > MAX_SPEED) Body.setVelocity(b, Vector.mult(b.velocity, MAX_SPEED / b.speed));
      // 萬一穿出左右牆，拉回台面內
      if (b.position.x < 0 || b.position.x > WORLD_W) {
        Body.setPosition(b, { x: Math.min(Math.max(b.position.x, MARBLE_R), WORLD_W - MARBLE_R), y: b.position.y });
      }
      if (b.speed < STUCK_SPEED) {
        m.stillSince ??= now;
        if (now - m.stillSince > STUCK_MS) {
          Body.setVelocity(b, { x: (Math.random() - 0.5) * 8, y: -5 });
          m.stillSince = null;
        }
      } else {
        m.stillSince = null;
      }
    }
  }

  /** 彈珠越過終點線：移出物理世界並記錄名次。 */
  private arrive(m: Marble): void {
    m.finished = true;
    Composite.remove(this.engine.world, m.body);
    this.arrived.push(m);
    const rank = this.arrived.length;
    if (rank > this.winnerCount) return;
    // 第一名抵達即播放勝利旋律，其餘得獎者播放提示音
    if (rank === 1) this.sfx.win();
    else this.sfx.finish();
    this.events.onArrive(m, rank);
    if (rank === this.winnerCount) {
      this.done = true;
      this.events.onDone(this.arrived.slice());
    }
  }

  /** 碰撞事件：播放音效並登記保險桿彈射（於本步長結束後套用）。 */
  private handleCollisions(e: Matter.IEventCollision<Matter.Engine>): void {
    for (const { bodyA, bodyB } of e.pairs) {
      const marble = bodyA.label === 'marble' ? bodyA : bodyB.label === 'marble' ? bodyB : null;
      if (!marble) continue;
      const other = marble === bodyA ? bodyB : bodyA;
      // 彈珠互撞不出聲，避免過於吵雜
      if (other.label === 'marble') continue;
      const isBumper = other.label === 'bumper';
      if (isBumper) this.pendingKicks.push([marble, other]);
      this.sfx.hit(marble.speed, isBumper);
    }
  }

  /** 尚未抵達且位置最低（最接近終點）的彈珠。 */
  private leader(): Marble | null {
    let best: Marble | null = null;
    for (const m of this.marbles) {
      if (!m.finished && (!best || m.body.position.y > best.body.position.y)) best = m;
    }
    return best;
  }

  /** 鏡頭平滑跟隨領先者，讓領先者位於畫面約 55% 高度處。 */
  private updateCamera(): void {
    const lead = this.leader();
    if (!lead) return;
    const viewH = this.cssH / this.scale;
    const target = Math.min(Math.max(lead.body.position.y - viewH * 0.55, 0), Math.max(0, WORLD_H - viewH));
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
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, this.cssW, this.cssH);

    ctx.save();
    ctx.translate(this.offsetX, -this.camY * this.scale);
    ctx.scale(this.scale, this.scale);

    ctx.fillStyle = '#141b33';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    this.drawFinishLine();

    const top = this.camY;
    const bottom = this.camY + this.cssH / this.scale;
    const visible = (b: Matter.Body) => b.bounds.max.y >= top && b.bounds.min.y <= bottom;

    for (const b of this.board.statics) if (visible(b)) this.drawBody(b);
    for (const s of this.board.spinners) if (visible(s.body)) this.drawBody(s.body);

    const lead = this.done ? null : this.leader();
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const m of this.marbles) {
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

  /** 繪製黑白棋盤格終點線。 */
  private drawFinishLine(): void {
    const { ctx } = this;
    const size = 12;
    for (let x = 0, i = 0; x < WORLD_W; x += size, i++) {
      for (let row = 0; row < 2; row++) {
        ctx.fillStyle = (i + row) % 2 ? '#fff' : '#111';
        ctx.fillRect(x, FINISH_Y + row * size, size, size);
      }
    }
    ctx.fillStyle = '#ffd166';
    ctx.font = '700 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FINISH', WORLD_W / 2, FINISH_Y + 70);
  }
}

/**
 * Fisher-Yates 洗牌，回傳新陣列不修改原陣列。
 * @param items 原始陣列
 * @returns 洗牌後的新陣列
 */
function shuffle<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
