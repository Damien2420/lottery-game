import type Matter from 'matter-js';
import type { Sfx } from './audio';
import { getBoard } from './boards';
import { beltDir, GATE_H, WIND_PERIOD, windDir, windGust } from './boards/mechanisms';
import type { Board, BoardId, Spinner } from './boards/types';
import { MARBLE_R, STEP_MS, WORLD_W } from './physics';
import * as piece from './pieces';
import { REDRAW_HUE, Simulation, type SimConfig, type SimMarble } from './simulation';

/** 畫面至少要顯示的世界高度，決定縮放比例 */
const MIN_VIEW_H = 720;
/** 鏡頭平滑跟隨的係數 */
const CAMERA_EASE = 0.08;
/** 點擊判定的半徑（世界座標） */
const PICK_R = 20;
/** 名字標籤的行高（世界座標），用於判斷標籤是否重疊 */
const LABEL_H = 14;
/** 進度軌寬度（CSS 像素） */
const RAIL_W = 10;
/** 進度軌上方留白 */
const RAIL_PAD_TOP = 8;
/** 進度軌下方留白（放已抵達人數） */
const RAIL_PAD_BOTTOM = 26;
/** 密度統計每格的高度（CSS 像素） */
const RAIL_BIN = 3;
/** 第一名特寫：候選彈珠離終點線多近（世界座標）開始，約為漏斗頸的長度 */
const CLIMAX_RANGE = 100;
/** 第一名特寫的放大倍率與慢動作倍率 */
const CLIMAX_ZOOM = 1.9;
const CLIMAX_SLOW = 0.25;
/** 第一名特寫：等不到抵達時最多維持的毫秒數，避免彈珠在漏斗口來回時一直慢動作 */
const CLIMAX_MAX_MS = 5000;
/** 第一名特寫：抵達後停留的毫秒數 */
const CLIMAX_HOLD_MS = 1600;
/** 放大與時間倍率每個畫面（約 16.7 毫秒）趨近目標的比例 */
const CLIMAX_EASE = 0.12;

/**
 * 淺色畫面配色，與網站設計 token 一致；ink 為對比色、white 為紙色，inkRgb 給半透明疊色用。
 * 其餘為機關（pieces.ts）的頂面／側面色：側面一律比頂面深、硬邊不模糊。
 */
const LIGHT = {
  ground: '#e4e7ec',
  board: '#eceef2',
  ink: '#0b0c0f',
  gold: '#f2a100',
  live: '#ff3b30',
  white: '#ffffff',
  inkRgb: '11 12 15',
  lightTop: '#ffffff',
  lightSide: '#aab1bd',
  darkTop: '#2c3038',
  darkSide: '#0b0c0f',
  pegTop: '#ffffff',
  pegSide: '#b4bbc6',
  railTop: '#a4abb7',
  railSide: '#666e7b',
  railLine: '#d9dde3',
  print: 'rgb(11 12 15 / 0.045)',
};

/** 深色畫面配色：台面為深石墨，對比色與紙色互換；機關頂面壓暗但仍比台面亮 */
const DARK: typeof LIGHT = {
  ground: '#0b0d10',
  board: '#15181d',
  ink: '#eef1f5',
  gold: '#f2a100',
  live: '#ff453a',
  white: '#0e1014',
  inkRgb: '238 241 245',
  lightTop: '#d9dde3',
  lightSide: '#6f7784',
  darkTop: '#4a515e',
  darkSide: '#0b0c0f',
  pegTop: '#6f7784',
  pegSide: '#2a2f37',
  railTop: '#363c46',
  railSide: '#0b0c0f',
  railLine: '#5d6573',
  print: 'rgb(238 241 245 / 0.05)',
};

/** 保險桿被撞後亮起、頂面下壓的持續步數（約 0.25 秒） */
const BUMP_FLASH = 15;
/** 集結池閘門滑開或關上的動畫步數（約 0.15 秒，物理上閘門是瞬間移開的） */
const GATE_SLIDE = 9;
/** 重力井蓄力外觀的過渡時間（秒） */
const WELL_EASE = 0.4;
/** 重力井噴發時水流被衝散的時間、冷卻後重新吸回的時間（秒） */
const WELL_BURST = 0.12;
const WELL_RETURN = 0.7;

/** 目前使用的配色，每次繪製前依頁面的深淺色模式更新 */
let C = LIGHT;

/** 第一名特寫的階段：等待觸發、特寫中、抵達後停留、已結束 */
type ClimaxPhase = 'idle' | 'on' | 'hold' | 'done';

/** 鏡頭模式：跟隨第一名、跟隨最後一名、跟隨指定彈珠、自由視角 */
export type CameraMode = 'leader' | 'last' | 'marble' | 'free';

/** 即時名次的一列 */
export interface RankRow {
  /** 參加者在名單中的索引 */
  index: number;
  /** 參加者名稱 */
  name: string;
  /** 彈珠色相；重抽彈珠為 REDRAW_HUE */
  hue: number;
  /** 已抵達時的名次，未抵達為 null */
  rank: number | null;
}

/** 提供給 HUD 的即時狀態 */
export interface RaceSnapshot {
  /** 是否有進行中（或已結束但仍顯示）的場次 */
  active: boolean;
  /** 經過秒數；持續計時到全部彈珠抵達才停 */
  elapsed: number;
  /** 得獎者全部產生時的秒數，尚未產生為 null */
  decidedAt: number | null;
  /** 前幾名（已抵達者依名次，其餘依位置） */
  top: RankRow[];
  /** 全部參加者（依名單順序），已抵達者帶名次 */
  roster: RankRow[];
  /** 目前鏡頭模式 */
  mode: CameraMode;
  /** 跟隨中的參加者索引 */
  follow: number | null;
}

/** 全部彈珠抵達時的最終結果 */
export interface FinalResult {
  /** 依名次排列的得獎者索引 */
  winners: number[];
  /** 每位得獎者抵達終點的秒數，順序同 winners */
  times: number[];
  /** 全部彈珠抵達的總秒數 */
  total: number;
}

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
  /**
   * 所有彈珠都已抵達（每場只觸發一次，在 onDone 之後）。
   * @param result 得獎者、各自的抵達秒數與總秒數
   */
  onAllArrived?(result: FinalResult): void;
  /** 抽到重抽（重抽彈珠拿到第一名）：本場作廢，不會再觸發 onDone 與 onAllArrived */
  onRedraw?(): void;
}

/**
 * 彈珠台繪製層：以固定步長驅動 Simulation，負責音效、鏡頭（三種模式）、全場進度軌與 Canvas 繪製。
 * 物理與名次判定全部在 Simulation，這裡不含任何物理邏輯，鏡頭操作也不影響模擬結果。
 */
export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  /** 目前顯示的台面（閒置時為 showBoard 建構的靜態台面，進行中為模擬的台面） */
  private board: Board | null = null;
  private sim: Simulation | null = null;
  private winnerCount = 1;
  private doneFired = false;
  /** 得獎者全部產生時的步數 */
  private doneStep = 0;
  private allFired = false;
  /** 全部彈珠抵達時的步數，用來凍結計時器 */
  private allStep = 0;
  /** 參加者產生名次時的步數 */
  private arrivedStep = new Map<number, number>();
  /** 依抵達順序排列、已產生名次的參加者索引（含名額以外） */
  private arrived: number[] = [];
  /** 已產生名次的參加者與名次 */
  private arrivedRank = new Map<number, number>();

  private mode: CameraMode = 'leader';
  private followIndex: number | null = null;
  private camY = 0;
  /** 自由視角或跳轉時的鏡頭目標 */
  private freeY = 0;
  private scale = 1;
  private offsetX = 0;
  /** 第一名特寫：階段、開始時間、鏡頭焦點（世界座標） */
  private climax: { phase: ClimaxPhase; since: number; x: number; y: number } = { phase: 'idle', since: 0, x: 0, y: 0 };
  /** 第一名是否已抵達 */
  private firstIn = false;
  /** 目前的額外放大倍率與模擬時間倍率（特寫時放大、變慢） */
  private zoom = 1;
  private timeScale = 1;
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;
  private acc = 0;
  private lastTime = 0;
  private rafId = 0;
  private destroyed = false;

  /** 進度軌畫布與版面 */
  private mini: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: number; h: number } | null = null;
  /** 進度軌在畫布中的位置（CSS 像素），供點擊換算高度 */
  private rail: { top: number; h: number } | null = null;
  /** 畫布文字使用的字體（沿用網頁字體，載入前以系統字體替代） */
  private readonly font: string;
  /** 彈珠圖片快取，鍵為色相 */
  private sprites = new Map<number, HTMLCanvasElement>();
  /** 以下為只影響外觀的繪製狀態，換台面時重設：保險桿最近一次被撞的步數 */
  private bumperHit = new Map<Matter.Body, number>();
  /** 各集結池閘門目前開或關，以及切換時的步數（滑門動畫用） */
  private gateAnim: { open: boolean; at: number }[] = [];
  /** 各彈射點所在斜坡的角度（第一次繪製時由台面物件算出） */
  private padSlopes: number[] = [];
  /** 各重力井水流的相位、蓄力外觀程度與可見程度（逐格累加，速度與狀態改變時不跳動） */
  private wellAnim: { step: number; flow: number; spin: number; k: number; vis: number }[] = [];

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
    this.font = getComputedStyle(canvas).fontFamily || 'system-ui, sans-serif';
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
    this.resetDecor();
    this.camY = this.freeY = 0;
  }

  /** 換台面時清掉只影響外觀的繪製狀態 */
  private resetDecor(): void {
    this.bumperHit.clear();
    this.gateAnim = [];
    this.wellAnim = [];
    this.padSlopes = [];
  }

  /**
   * 彈射點所在斜坡的角度：找正下方最近、水平範圍涵蓋彈射點的牆，取其角度（收斂到 ±90 度內）。
   * @param board 台面
   * @param i 彈射點索引
   * @returns 弧度；找不到牆時為 0（水平）
   */
  private padSlope(board: Board, i: number): number {
    const cached = this.padSlopes[i];
    if (cached !== undefined) return cached;
    const p = board.mechs.pads[i];
    let best: Matter.Body | null = null;
    for (const b of board.statics) {
      if (b.label !== 'wall' || b.bounds.min.x > p.x || b.bounds.max.x < p.x || b.position.y < p.y - 40) continue;
      if (!best || Math.abs(b.position.y - p.y) < Math.abs(best.position.y - p.y)) best = b;
    }
    let ang = best ? best.angle % Math.PI : 0;
    if (ang > Math.PI / 2) ang -= Math.PI;
    if (ang <= -Math.PI / 2) ang += Math.PI;
    this.padSlopes[i] = ang;
    return ang;
  }

  /**
   * 開始新一場，會中止並丟棄上一場；鏡頭回到跟隨第一名。需由使用者操作觸發，以便解鎖音效。
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
    this.resetDecor();
    this.winnerCount = cfg.winnerCount;
    this.doneFired = false;
    this.doneStep = 0;
    this.allFired = false;
    this.allStep = 0;
    this.arrivedStep = new Map();
    this.resetClimax();
    this.arrived = [];
    this.arrivedRank = new Map();
    this.mode = 'leader';
    this.followIndex = null;
    this.camY = this.freeY = 0;
    this.acc = 0;
  }

  /** 中止目前這場並丟棄模擬，不觸發 onDone。台面仍會顯示。 */
  stop(): void {
    this.sim = null;
    this.doneFired = false;
    this.allFired = false;
    this.resetClimax();
    this.arrived = [];
    this.arrivedRank = new Map();
    this.followIndex = null;
    if (this.mode === 'marble') this.mode = 'leader';
  }

  /** 停止畫面迴圈並解除尺寸監聽，可重複呼叫。 */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.sim = null;
    this.mini = null;
    this.sfx.dispose();
  }

  /**
   * 指定全場進度軌的畫布（傳 null 取消）。尺寸跟隨畫布父元素的內容區。
   * @param canvas 進度軌畫布
   */
  attachMinimap(canvas: HTMLCanvasElement | null): void {
    this.mini = canvas ? { canvas, ctx: canvas.getContext('2d')!, w: 0, h: 0 } : null;
  }

  /**
   * 切換鏡頭模式。切到自由視角時從目前畫面開始；切到跟隨指定但尚未指定彈珠時維持原模式。
   * @param mode 鏡頭模式
   */
  setCameraMode(mode: CameraMode): void {
    if (mode === 'marble' && this.followIndex === null) return;
    if (mode === 'free') this.freeY = this.camY;
    this.mode = mode;
  }

  /**
   * 跟隨指定的參加者。
   * @param index 參加者在名單中的索引
   * @returns 進行中且找得到該彈珠時為 true
   */
  follow(index: number): boolean {
    if (!this.sim?.marbles.some((m) => m.index === index)) return false;
    this.followIndex = index;
    this.mode = 'marble';
    return true;
  }

  /**
   * 拖曳或滾輪移動鏡頭，並切換為自由視角。
   * @param dyCss 垂直位移（CSS 像素，正值往下看）
   */
  panBy(dyCss: number): void {
    if (this.mode !== 'free') this.freeY = this.camY;
    this.mode = 'free';
    this.freeY = this.clampCam(this.freeY + dyCss / this.viewScale());
    // 拖曳要跟手，不做平滑
    this.camY = this.freeY;
  }

  /**
   * 點擊或拖曳進度軌：鏡頭中心移到該高度並切換為自由視角。
   * @param my 進度軌畫布內的 Y（CSS 像素）
   */
  jumpMinimap(my: number): void {
    if (!this.rail || !this.board) return;
    const t = Math.min(1, Math.max(0, (my - this.rail.top) / this.rail.h));
    this.mode = 'free';
    this.freeY = this.clampCam(t * this.board.finishY - this.viewH() / 2);
  }

  /**
   * 找出畫面座標附近的彈珠。
   * @param x 畫布內的 X（CSS 像素）
   * @param y 畫布內的 Y（CSS 像素）
   * @returns 最近彈珠的參加者索引，沒有時為 null
   */
  pick(x: number, y: number): number | null {
    if (!this.sim) return null;
    const wx = (x - this.viewOffsetX()) / this.viewScale();
    const wy = y / this.viewScale() + this.camY;
    let best: SimMarble | null = null;
    let bestD = PICK_R;
    for (const m of this.sim.marbles) {
      if (m.finished) continue;
      const d = Math.hypot(m.body.position.x - wx, m.body.position.y - wy);
      if (d < bestD) {
        best = m;
        bestD = d;
      }
    }
    return best?.index ?? null;
  }

  /**
   * 取得 HUD 所需的即時狀態。
   * @param count 要列出的名次數
   * @returns 即時狀態
   */
  snapshot(count = 5): RaceSnapshot {
    const sim = this.sim;
    if (!sim) return { active: false, elapsed: 0, decidedAt: null, top: [], roster: [], mode: this.mode, follow: null };
    const survival = sim.mode === 'survival';
    // 每位參加者取第一顆彈珠的名字與顏色；尚未抵達者以最接近終點的那顆代表位置
    const first = new Map<number, SimMarble>();
    const best = new Map<number, SimMarble>();
    for (const m of sim.marbles) {
      if (!first.has(m.index)) first.set(m.index, m);
      if (m.finished || this.arrivedRank.has(m.index)) continue;
      const p = best.get(m.index);
      // 競速取每人最前面那顆，生存取每人最後面那顆（要等最後一顆抵達才算）
      if (!p || (survival ? m.body.position.y < p.body.position.y : m.body.position.y > p.body.position.y)) best.set(m.index, m);
    }
    const row = (index: number, rank: number | null): RankRow => {
      const m = first.get(index)!;
      return { index, name: m.name, hue: m.hue, rank };
    };
    const done = this.arrived.map((i) => row(i, this.arrivedRank.get(i)!)).sort((x, y) => x.rank! - y.rank!);
    // 競速：越接近終點越前面；生存：越落後越前面
    const racing = [...best.values()]
      .sort((x, y) => (survival ? x.body.position.y - y.body.position.y : y.body.position.y - x.body.position.y))
      .map((m) => row(m.index, null));
    const top = (survival ? [...racing, ...done] : [...done, ...racing]).slice(0, count);
    // 參加名單不列重抽彈珠
    const roster = [...first.keys()].filter((i) => !first.get(i)!.redraw).sort((x, y) => x - y).map((i) => row(i, this.arrivedRank.get(i) ?? null));
    const steps = this.allFired ? this.allStep : sim.stepCount;
    const decidedAt = this.doneFired ? (this.doneStep * STEP_MS) / 1000 : null;
    return { active: true, elapsed: (steps * STEP_MS) / 1000, decidedAt, top, roster, mode: this.mode, follow: this.followIndex };
  }

  /** 每個畫面更新：以固定步長推進模擬，再更新鏡頭並繪製。 */
  private frame(time: number): void {
    if (this.destroyed) return;
    const dt = this.lastTime ? Math.min(time - this.lastTime, 100) : 0;
    this.lastTime = time;
    this.updateClimax(time, dt);
    if (this.sim) {
      // 特寫時模擬變慢：只改變推進的節奏，模擬本身與結果不受影響
      this.acc += dt * this.timeScale;
      // 全部抵達後不再推進，畫面停在最後一刻
      while (this.sim && !this.allFired && this.acc >= STEP_MS) {
        this.advance(this.sim);
        this.acc -= STEP_MS;
      }
    }
    this.updateCamera();
    this.render();
    this.renderMinimap();
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
      this.arrived.push(a.index);
      this.arrivedRank.set(a.index, a.rank);
      this.arrivedStep.set(a.index, sim.stepCount);
      // 名額以外的抵達者不通知、不出聲
      if (a.rank > this.winnerCount) continue;
      if (a.rank === 1) {
        this.firstIn = true;
        this.sfx.win();
      } else {
        this.sfx.finish();
      }
      this.events.onArrive(a.index, a.rank);
    }
    // 抽到重抽：停在這一刻，不產生得獎者
    if (!this.allFired && sim.isRedraw()) {
      this.allFired = true;
      this.allStep = sim.stepCount;
      this.firstIn = true;
      this.events.onRedraw?.();
      return;
    }
    if (!this.doneFired && sim.isDone()) {
      this.doneFired = true;
      this.doneStep = sim.stepCount;
      this.events.onDone(sim.winners.slice());
    }
    if (!this.allFired && sim.allFinished()) {
      this.allFired = true;
      this.allStep = sim.stepCount;
      const winners = sim.winners.slice();
      const sec = (step: number): number => (step * STEP_MS) / 1000;
      this.events.onAllArrived?.({
        winners,
        times: winners.map((i) => sec(this.arrivedStep.get(i) ?? this.allStep)),
        total: sec(this.allStep),
      });
    }
  }

  /** 目前的繪製縮放（含特寫放大） */
  private viewScale(): number {
    return this.scale * this.zoom;
  }

  /** 目前台面左緣的畫面 X：特寫放大時以焦點 X 為中心放大 */
  private viewOffsetX(): number {
    return this.offsetX + this.climax.x * this.scale * (1 - this.zoom);
  }

  /** 可視範圍的世界高度 */
  private viewH(): number {
    return this.cssH / this.viewScale();
  }

  /** 重設第一名特寫（新的一場或中止時） */
  private resetClimax(): void {
    this.climax = { phase: 'idle', since: 0, x: WORLD_W / 2, y: 0 };
    this.firstIn = false;
  }

  /**
   * 第一名的候選彈珠：競速是最接近終點的那顆；生存要等只剩最後一顆時，那顆就是第一名。
   * @param sim 目前的模擬
   * @returns 候選彈珠，還無法確定時為 null
   */
  private climaxMarble(sim: Simulation): SimMarble | null {
    if (sim.mode !== 'survival') return sim.leader();
    let left: SimMarble | null = null;
    for (const m of sim.marbles) {
      if (m.finished) continue;
      if (left) return null;
      left = m;
    }
    return left;
  }

  /**
   * 第一名特寫：候選彈珠進入漏斗頸時放大並慢動作，抵達後停留片刻再恢復。競速與生存模式都有。
   * @param time 目前時間（毫秒）
   * @param dt 距上一個畫面的毫秒數
   */
  private updateClimax(time: number, dt: number): void {
    const sim = this.sim;
    const c = this.climax;
    if (sim && this.board && c.phase !== 'done') {
      const m = c.phase === 'hold' ? null : this.climaxMarble(sim);
      if (m) {
        c.x = m.body.position.x;
        c.y = Math.min(m.body.position.y, this.board.finishY);
      }
      if (c.phase === 'idle' && m && m.body.position.y > this.board.finishY - CLIMAX_RANGE) {
        c.phase = 'on';
        c.since = time;
      } else if (c.phase === 'on' && this.firstIn) {
        c.phase = 'hold';
        c.since = time;
        c.y = this.board.finishY;
      } else if (c.phase === 'on' && time - c.since > CLIMAX_MAX_MS) {
        c.phase = 'done';
      } else if (c.phase === 'hold' && time - c.since > CLIMAX_HOLD_MS) {
        c.phase = 'done';
      }
    }
    const active = c.phase === 'on' || c.phase === 'hold';
    // 依經過時間換算平滑係數，畫面更新率不同時速度一致
    const k = 1 - Math.pow(1 - CLIMAX_EASE, dt / 16.7);
    this.zoom += ((active ? CLIMAX_ZOOM : 1) - this.zoom) * k;
    this.timeScale += ((active ? CLIMAX_SLOW : 1) - this.timeScale) * k;
    if (Math.abs(this.zoom - 1) < 0.002) this.zoom = 1;
    if (Math.abs(this.timeScale - 1) < 0.002) this.timeScale = 1;
  }

  /** 把鏡頭位置限制在台面範圍內 */
  private clampCam(y: number): number {
    const max = Math.max(0, (this.board?.worldH ?? 0) - this.viewH());
    return Math.min(Math.max(y, 0), max);
  }

  /** 依鏡頭模式決定目標位置並平滑移動；跟隨的彈珠位於畫面約 55% 高度處。 */
  private updateCamera(): void {
    if (!this.board) return;
    let target: number;
    let ease = CAMERA_EASE;
    if (this.climax.phase === 'on' || this.climax.phase === 'hold') {
      // 第一名特寫時不論鏡頭模式都對準候選彈珠，置於畫面中央
      target = this.clampCam(this.climax.y - this.viewH() * 0.5);
      ease = 0.2;
    } else if (this.mode === 'free') {
      target = this.freeY;
    } else {
      const sim = this.sim;
      const m = sim ? (this.mode === 'leader' ? this.focusMarble(sim) : this.followedMarble(sim)) : null;
      if (!m) return;
      target = this.clampCam(m.body.position.y - this.viewH() * 0.55);
    }
    this.camY += (target - this.camY) * ease;
  }

  /**
   * 目前的第一名彈珠：競速模式是最接近終點的那顆，生存模式是最落後的那顆。
   * @param sim 目前的模擬
   * @returns 彈珠，全部抵達時為 null
   */
  private focusMarble(sim: Simulation): SimMarble | null {
    return sim.mode === 'survival' ? sim.trailer() : sim.leader();
  }

  /**
   * 目前的最後一名彈珠（與 focusMarble 的第一名相反）：
   * 競速是台上離終點最遠的那顆，生存是台上最靠近終點的那顆。
   * @param sim 目前的模擬
   * @returns 彈珠，全部抵達時為 null
   */
  private lastMarble(sim: Simulation): SimMarble | null {
    return sim.mode === 'survival' ? sim.leader() : sim.trailer();
  }

  /**
   * 跟隨中的參加者還在台上、最接近終點的那顆彈珠（每人可能有多顆）；跟隨最後一名時為最後一名的彈珠。
   * @param sim 目前的模擬
   * @returns 彈珠；不是跟隨指定或跟隨最後一名模式、或已全部抵達時為 undefined
   */
  private followedMarble(sim: Simulation): SimMarble | undefined {
    if (this.mode === 'last') return this.lastMarble(sim) ?? undefined;
    if (this.mode !== 'marble') return undefined;
    let best: SimMarble | undefined;
    for (const m of sim.marbles) {
      if (m.index !== this.followIndex || m.finished) continue;
      if (!best || m.body.position.y > best.body.position.y) best = m;
    }
    return best;
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
    // 舞台兩側被 HUD 面板占用的寬度由 CSS 變數決定（窄螢幕時為 0），台面置中於剩餘空間
    const style = getComputedStyle(parent);
    let left = parseFloat(style.getPropertyValue('--board-left')) || 0;
    let right = parseFloat(style.getPropertyValue('--board-right')) || 0;
    // 剩餘空間不到一半時寧可讓面板蓋住台面邊緣，也不要把台面縮得太小
    if (this.cssW - left - right < this.cssW / 2) left = right = 0;
    const room = this.cssW - left - right;
    this.scale = Math.min(room / WORLD_W, this.cssH / MIN_VIEW_H);
    this.offsetX = left + (room - WORLD_W * this.scale) / 2;
    this.sprites.clear();
  }

  /** 繪製整個畫面（只畫出可視範圍內的物件）。 */
  private render(): void {
    C = document.documentElement.dataset.theme === 'dark' ? DARK : LIGHT;
    const { ctx, board } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    if (!board) return;

    ctx.save();
    const vs = this.viewScale();
    ctx.translate(this.viewOffsetX(), -this.camY * vs);
    ctx.scale(vs, vs);

    ctx.fillStyle = C.board;
    ctx.fillRect(0, 0, WORLD_W, board.worldH);
    this.drawFinishLine(board);

    const top = this.camY - 40;
    const bottom = this.camY + this.viewH() + 40;
    const visible = (b: Matter.Body) => b.bounds.max.y >= top && b.bounds.min.y <= bottom;

    const step = this.sim?.stepCount ?? 0;
    this.drawMechsUnder(board, top, bottom, step);
    for (const b of board.statics) if (b.label !== 'frame' && visible(b)) this.drawStatic(b, step);
    this.drawMechsOver(board, top, bottom, step);
    // 集結池的延長臂（白色伸縮段）先畫，主臂疊在上面，只露出臂尖
    const ext = new Set(board.mechs.pools.flatMap((p) => p.arms));
    for (const s of board.spinners) if (ext.has(s.body) && visible(s.body)) this.drawSpinner(s, true);
    for (const s of board.spinners) if (!ext.has(s.body) && visible(s.body)) this.drawSpinner(s, false);

    const sim = this.sim;
    if (sim) {
      const lead = this.doneFired ? null : this.focusMarble(sim);
      const followed = this.followedMarble(sim);
      for (const m of sim.marbles) {
        if (!m.finished && visible(m.body)) this.drawMarble(m);
      }
      // 名字標籤畫在所有彈珠之上，領先者與跟隨對象另外加強
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.font = `700 12px ${this.font}`;
      // 由領先者往後依序放標籤，與已放置的標籤重疊就略過，避免兩百個名字疊成一團
      const placed: { x: number; y: number; w: number }[] = [];
      const order = sim.marbles
        .filter((m) => !m.finished && visible(m.body))
        .sort((a, b) => b.body.position.y - a.body.position.y);
      for (const m of order) {
        const x = m.body.position.x;
        const y = m.body.position.y - MARBLE_R - 5;
        if (m === lead || m === followed) {
          placed.push({ x, y: y - 12, w: 90 });
          continue;
        }
        const w = Math.min(m.name.length, 6) * 12 + 6;
        if (placed.some((p) => Math.abs(p.x - x) < (p.w + w) / 2 && Math.abs(p.y - y) < LABEL_H)) continue;
        placed.push({ x, y, w });
        this.drawLabel(m.name, x, y);
      }
      if (lead) this.drawHighlight(lead, C.ink);
      if (followed && !followed.finished) this.drawHighlight(followed, C.gold);
    }
    ctx.restore();
  }

  /**
   * 牆與斜坡、釘子、保險桿、翻板、重力井核心（輸送帶與集結池閘門另外畫）。
   * @param b 靜態剛體
   * @param step 物理步數（保險桿撞擊閃光用）
   */
  private drawStatic(b: Matter.Body, step: number): void {
    const { ctx } = this;
    const { x, y } = b.position;
    switch (b.label) {
      case 'bumper':
        piece.bumper(ctx, C, x, y, b.circleRadius ?? 18, this.bumperFlash(b, step));
        return;
      case 'peg':
        piece.peg(ctx, C, x, y, b.circleRadius ?? 5);
        return;
      case 'core':
        piece.core(ctx, C, x, y, b.circleRadius ?? 16);
        return;
      case 'belt':
      case 'gate':
        return;
      case 'paddle': {
        const [len, th] = this.rectSize(b);
        // 未啟用翻板時保留為固定斜坡，不畫轉軸
        const active = this.board?.mechs.flippers.some((f) => f.body === b) ?? false;
        piece.plank(ctx, C, x, y, b.angle, len, th, active);
        return;
      }
      default: {
        const [len, th] = this.rectSize(b);
        piece.rail(ctx, C, x, y, b.angle, len, th);
      }
    }
  }

  /**
   * 矩形剛體的長與厚（頂點依 matter-js 順序：0→1 沿寬、1→2 沿高）。
   * @param b 矩形剛體
   * @returns [長, 厚]
   */
  private rectSize(b: Matter.Body): [number, number] {
    const [v0, v1, v2] = b.vertices;
    return [Math.hypot(v1.x - v0.x, v1.y - v0.y), Math.hypot(v2.x - v1.x, v2.y - v1.y)];
  }

  /**
   * 保險桿的撞擊閃光：有彈珠貼著保險桿就記下步數，之後 BUMP_FLASH 步內由 1 衰減到 0。
   * 只在畫面端判斷，不影響模擬。
   * @param b 保險桿
   * @param step 物理步數
   * @returns 0 到 1
   */
  private bumperFlash(b: Matter.Body, step: number): number {
    const sim = this.sim;
    if (!sim) return 0;
    const reach = (b.circleRadius ?? 18) + MARBLE_R + 1.5;
    for (const m of sim.marbles) {
      if (m.finished) continue;
      const dx = m.body.position.x - b.position.x;
      const dy = m.body.position.y - b.position.y;
      if (dx * dx + dy * dy <= reach * reach) {
        this.bumperHit.set(b, step);
        break;
      }
    }
    const hit = this.bumperHit.get(b);
    return hit === undefined ? 0 : Math.max(0, 1 - (step - hit) / BUMP_FLASH);
  }

  /**
   * 機關的底層（畫在台面物件之下）：印在台面上的吹風區、重力井、彈射點，以及集結池閘門
   * （閘門先畫，滑開時兩扇門收到斜牆底下）。
   * @param board 台面
   * @param top 可視範圍頂端
   * @param bottom 可視範圍底端
   * @param step 物理步數，決定風向、風力與動畫進度
   */
  private drawMechsUnder(board: Board, top: number, bottom: number, step: number): void {
    const { ctx } = this;
    for (const w of board.mechs.winds) {
      if (w.y + w.h < top || w.y > bottom) continue;
      const ts = ((step + w.phase) % WIND_PERIOD) * STEP_MS;
      piece.windZone(ctx, C, w, ts, WIND_PERIOD * STEP_MS, windDir(step, w.phase), windGust(step, w.phase));
    }
    board.mechs.wells.forEach((w, i) => {
      // 水流相位逐格累加：蓄力時只小幅加速，外觀程度在 WELL_EASE 秒內平順過渡
      const { charge, cooling } = this.sim?.wellPhase(i) ?? { charge: 0, cooling: 0 };
      const st = (this.wellAnim[i] ??= { step, flow: 0, spin: 0, k: 0, vis: 1 });
      const dt = Math.max(0, Math.min(5, step - st.step)) * (STEP_MS / 1000);
      st.step = step;
      st.k += ((charge > 0 ? 1 : 0) - st.k) * Math.min(1, dt / WELL_EASE);
      // 噴發時水流在 WELL_BURST 秒內被衝散，冷卻結束後在 WELL_RETURN 秒內重新吸回
      const target = cooling > 0 ? 0 : 1;
      st.vis += (target - st.vis) * Math.min(1, dt / (target < st.vis ? WELL_BURST : WELL_RETURN));
      st.flow += dt * (0.16 + 0.08 * st.k);
      st.spin += dt * (0.7 + 0.35 * st.k);
      if (w.y + w.r * 1.4 < top || w.y - w.r * 1.4 > bottom) return;
      piece.wellFlow(ctx, C, w, w.r * 0.17, st.k, st.flow, st.spin, st.vis);
      if (cooling > 0) piece.shockwave(ctx, w, cooling);
    });
    // 只剩最後一顆彈珠時彈射點停用，不再畫出
    if (!this.sim?.padsOff()) board.mechs.pads.forEach((p, i) => {
      if (p.y + p.r < top || p.y - p.r > bottom) return;
      piece.padPrint(ctx, C, p, this.sim?.padFlash(i) ?? 0, this.padSlope(board, i));
    });
    // 集結池雙開閘門：燈號依開閘進度亮起，開閘時兩扇門往左右滑開
    board.mechs.pools.forEach((p, i) => {
      if (p.closed.y + GATE_H < top || p.closed.y - GATE_H > bottom) return;
      const { open, fill } = this.sim?.poolPhase(i) ?? { open: false, fill: 0 };
      const st = (this.gateAnim[i] ??= { open, at: -GATE_SLIDE });
      if (st.open !== open) {
        st.open = open;
        st.at = step;
      }
      const k = Math.min(1, Math.max(0, (step - st.at) / GATE_SLIDE));
      const lit = open ? 6 : Math.floor(fill * 6 + 1e-6);
      const [w] = this.rectSize(p.gate);
      piece.gateDoors(ctx, C, p.closed.x, p.closed.y, w, GATE_H, lit, open ? k : 1 - k);
    });
  }

  /**
   * 機關的上層：輸送帶（帶身、流動的履帶紋與滾輪）。
   * @param board 台面
   * @param top 可視範圍頂端
   * @param bottom 可視範圍底端
   * @param step 物理步數
   */
  private drawMechsOver(board: Board, top: number, bottom: number, step: number): void {
    for (const t of board.mechs.belts) {
      if (t.y + 40 < top || t.y - 40 > bottom) continue;
      piece.belt(this.ctx, C, t.x, t.y, t.w, t.h, beltDir(step, t.phase), step);
    }
  }

  /**
   * 旋轉擋板：墨黑長條加金色轉軸；集結池延長臂畫成白色伸縮段；終點的勺形攪拌棒畫成勺形轉子。
   * @param s 擋板
   * @param ext 是否為集結池的延長臂
   */
  private drawSpinner(s: Spinner, ext: boolean): void {
    const { ctx } = this;
    const b = s.body;
    const { x, y } = b.position;
    if (b.parts.length > 1) {
      // 複合剛體（勺形攪拌棒）：最外緣半徑由各段頂點算出，parts[0] 是父剛體本身
      let reach = 0;
      for (const part of b.parts.slice(1)) {
        for (const v of part.vertices) reach = Math.max(reach, Math.hypot(v.x - x, v.y - y));
      }
      piece.scoopRotor(ctx, C, x, y, reach, b.angle, s.speed >= 0 ? 1 : -1);
      return;
    }
    const [len, th] = this.rectSize(b);
    piece.spinnerBar(ctx, C, x, y, b.angle, len, th, ext);
  }

  /** 以快取的立體玻璃珠圖片繪製彈珠 */
  private drawMarble(m: SimMarble): void {
    const sprite = this.sprite(m.hue);
    const d = MARBLE_R * 2;
    this.ctx.drawImage(sprite, m.body.position.x - MARBLE_R, m.body.position.y - MARBLE_R, d, d);
  }

  /**
   * 取得（必要時建立）指定色相的彈珠圖片，解析度依目前縮放與像素密度。
   * @param hue 色相
   * @returns 離屏畫布
   */
  private sprite(hue: number): HTMLCanvasElement {
    const cached = this.sprites.get(hue);
    if (cached) return cached;
    // 以特寫的放大倍率建立，放大時彈珠仍然清晰
    const px = Math.max(8, Math.ceil(MARBLE_R * 2 * this.scale * CLIMAX_ZOOM * this.dpr));
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d');
    if (g) {
      const r = px / 2;
      const gr = g.createRadialGradient(r * 0.65, r * 0.6, r * 0.1, r, r, r);
      gr.addColorStop(0, '#fff');
      // 重抽彈珠是中性灰，與所有參加者的彩色彈珠區分
      gr.addColorStop(0.2, hue === REDRAW_HUE ? '#d3d8e0' : `hsl(${hue} 90% 66%)`);
      gr.addColorStop(1, hue === REDRAW_HUE ? '#4f5561' : `hsl(${hue} 75% 38%)`);
      g.fillStyle = gr;
      g.beginPath();
      g.arc(r, r, r, 0, Math.PI * 2);
      g.fill();
    }
    this.sprites.set(hue, c);
    return c;
  }

  /** 一般名字標籤：墨色字加白色描邊，在淺灰台面上也清楚 */
  private drawLabel(text: string, x: number, y: number): void {
    const { ctx } = this;
    const label = text.length > 6 ? `${text.slice(0, 6)}…` : text;
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.white;
    ctx.strokeText(label, x, y);
    ctx.fillStyle = C.ink;
    ctx.fillText(label, x, y);
  }

  /**
   * 領先者或跟隨對象：外圈加粗，名字放在實心膠囊裡，直播縮小後仍可辨識。
   * @param m 彈珠
   * @param color 外圈與膠囊顏色
   */
  private drawHighlight(m: SimMarble, color: string): void {
    const { ctx } = this;
    const { x, y } = m.body.position;
    ctx.beginPath();
    ctx.arc(x, y, MARBLE_R + 4, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.stroke();
    const label = m.name.length > 8 ? `${m.name.slice(0, 8)}…` : m.name;
    ctx.font = `900 14px ${this.font}`;
    const w = ctx.measureText(label).width + 16;
    const ty = y - MARBLE_R - 26;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, ty, w, 22, 11);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = color === C.gold ? C.ink : C.white;
    ctx.fillText(label, x, ty + 16);
    ctx.font = `700 12px ${this.font}`;
  }

  /**
   * 繪製黑白棋盤格終點線。
   * @param board 目前的台面（取得 finishY）
   */
  private drawFinishLine(board: Board): void {
    const { ctx } = this;
    const size = 20;
    for (let x = 0, i = 0; x < WORLD_W; x += size, i++) {
      for (let row = 0; row < 2; row++) {
        ctx.fillStyle = (i + row) % 2 ? C.white : C.ink;
        ctx.fillRect(x, board.finishY + row * size, size, size);
      }
    }
  }

  /**
   * 繪製全場進度軌：由上（起點）到下（終點）的直條，底層以深淺表示各高度的人數密度，
   * 上層只放大第一名、第二名與跟隨中的彈珠與鏡頭範圍，
   * 底部顯示已抵達人數。畫布尺寸跟隨父元素的內容區。
   */
  private renderMinimap(): void {
    const mini = this.mini;
    const board = this.board;
    if (!mini || !board) return;
    const parent = mini.canvas.parentElement;
    if (!parent) return;
    // clientWidth/Height 含內距，扣掉後才是畫布可用的範圍，否則畫布會超出面板
    const style = getComputedStyle(parent);
    const w = Math.floor(parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
    const h = Math.floor(parent.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom));
    if (!(w > 0 && h > RAIL_PAD_TOP + RAIL_PAD_BOTTOM)) return;
    if (w !== mini.w || h !== mini.h) {
      mini.w = w;
      mini.h = h;
      mini.canvas.width = w * this.dpr;
      mini.canvas.height = h * this.dpr;
      mini.canvas.style.width = `${w}px`;
      mini.canvas.style.height = `${h}px`;
    }
    const g = mini.ctx;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    const trackH = h - RAIL_PAD_TOP - RAIL_PAD_BOTTOM;
    this.rail = { top: RAIL_PAD_TOP, h: trackH };
    const cx = Math.round(w / 2);
    const ry = (wy: number): number => RAIL_PAD_TOP + Math.min(1, Math.max(0, wy / board.finishY)) * trackH;

    // 軌道底色與終點線
    g.fillStyle = C.board;
    g.beginPath();
    g.roundRect(cx - RAIL_W / 2, RAIL_PAD_TOP, RAIL_W, trackH, RAIL_W / 2);
    g.fill();
    g.fillStyle = C.ink;
    g.fillRect(cx - RAIL_W, RAIL_PAD_TOP + trackH + 2, RAIL_W * 2, 3);

    const sim = this.sim;
    const running = sim ? sim.marbles.filter((m) => !m.finished) : [];
    // 人數密度：每 RAIL_BIN 像素一格，平方根換算讓零星幾顆也看得到
    if (running.length) {
      const bins = new Array<number>(Math.ceil(trackH / RAIL_BIN)).fill(0);
      for (const m of running) {
        const i = Math.min(bins.length - 1, Math.floor((ry(m.body.position.y) - RAIL_PAD_TOP) / RAIL_BIN));
        bins[i]++;
      }
      const max = Math.max(...bins);
      g.save();
      g.beginPath();
      g.roundRect(cx - RAIL_W / 2, RAIL_PAD_TOP, RAIL_W, trackH, RAIL_W / 2);
      g.clip();
      bins.forEach((c, i) => {
        if (!c) return;
        g.fillStyle = `rgb(${C.inkRgb} / ${(0.18 + 0.82 * Math.sqrt(c / max)).toFixed(2)})`;
        g.fillRect(cx - RAIL_W / 2, RAIL_PAD_TOP + i * RAIL_BIN, RAIL_W, RAIL_BIN);
      });
      g.restore();
    }

    // 鏡頭範圍
    const camTop = ry(this.camY);
    const camBottom = ry(this.camY + this.viewH());
    g.strokeStyle = C.ink;
    g.lineWidth = 1.5;
    g.beginPath();
    g.roundRect(cx - RAIL_W / 2 - 4, camTop - 2, RAIL_W + 8, Math.max(6, camBottom - camTop + 4), 4);
    g.stroke();

    // 重點彈珠：第二名、第一名、跟隨中（後畫的在上層）；生存模式越落後名次越前面
    const survival = sim?.mode === 'survival';
    const ranked = [...running].sort((a, b) => (survival ? a.body.position.y - b.body.position.y : b.body.position.y - a.body.position.y));
    const dot = (m: SimMarble, r: number, ring: string): void => {
      g.beginPath();
      g.arc(cx, ry(m.body.position.y), r, 0, Math.PI * 2);
      g.fillStyle = m.hue === REDRAW_HUE ? '#8a909b' : `hsl(${m.hue} 80% 52%)`;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = ring;
      g.stroke();
    };
    if (ranked[1]) dot(ranked[1], 4, C.white);
    if (ranked[0]) dot(ranked[0], 5.5, C.white);
    const followed = sim ? this.followedMarble(sim) : undefined;
    if (followed) dot(followed, 5.5, C.gold);

    // 已抵達人數
    if (sim) {
      g.fillStyle = C.ink;
      g.font = `700 11px ${this.font}`;
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillText(`抵達 ${sim.marbles.length - running.length}`, cx, h - 2);
    }
  }

}
