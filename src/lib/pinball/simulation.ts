import Matter from 'matter-js';
import { getBoard } from './boards';
import type { Board, BoardId } from './boards/types';
import {
  BUMPER_KICK,
  MARBLE_OPTS,
  MARBLE_R,
  MAX_SPEED,
  NO_PROGRESS_MS,
  PROGRESS_MIN_Y,
  STEP_MS,
  STUCK_MS,
  STUCK_SPEED,
  WORLD_W,
} from './physics';
import { createRng } from './rng';

const { Engine, Composite, Bodies, Body, Events, Vector } = Matter;

/** 一場模擬的輸入，相同輸入必定產生相同結果 */
export interface SimConfig {
  /** 參加者名單（允許重複名稱，以索引區分） */
  names: string[];
  /** 台面識別碼 */
  boardId: BoardId;
  /** 物理亂數種子 */
  seed: number;
  /** 要抽出的名額 */
  winnerCount: number;
}

/** 參加者對應的彈珠 */
export interface SimMarble {
  /** 在 names 中的索引 */
  index: number;
  /** 參加者名稱 */
  name: string;
  /** 顯示顏色 */
  color: string;
  /** 彈珠剛體 */
  body: Matter.Body;
  /** 是否已越過終點線 */
  finished: boolean;
}

/** 單一步進的輸出事件 */
export interface StepResult {
  /** 本步抵達終點的彈珠（含名額以外的名次），依名次排列 */
  arrivals: { index: number; rank: number }[];
  /** 本步彈珠與非彈珠物件的碰撞，供呼叫者決定是否播放音效 */
  hits: { speed: number; bumper: boolean }[];
}

/** 內部使用的彈珠狀態 */
interface MarbleState extends SimMarble {
  /** 洗牌後的位置，作為同步抵達時的次要排序鍵 */
  order: number;
  /** 開始靜止的物理時間戳，未靜止為 null */
  stillSince: number | null;
  /** 目前為止到達過的最大 y（越大越接近終點） */
  bestY: number;
  /** bestY 最近一次前進至少 PROGRESS_MIN_Y 的物理時間戳 */
  bestSince: number;
}

/**
 * 同一步內越過終點的彈珠排序：y 由大到小，相同時依洗牌後的順序由小到大。
 * @param c 候選彈珠（names 索引、洗牌順序、y 座標）
 * @returns 依名次排列的 names 索引
 */
export function orderArrivals(c: { index: number; order: number; y: number }[]): number[] {
  return c
    .slice()
    .sort((a, b) => b.y - a.y || a.order - b.order)
    .map((x) => x.index);
}

/**
 * 可決定性的彈珠台模擬（無畫面）。
 * 每個實例建立全新的 Engine 與台面；物理亂數只來自 createRng(seed)，
 * 進度只以物理步數推進，因此相同 SimConfig 的第 k 步狀態必定相同。
 */
export class Simulation {
  /** 本場台面實體 */
  readonly board: Board;
  /** 依洗牌後順序排列的彈珠 */
  readonly marbles: readonly SimMarble[];
  /** 依名次排列的得獎者 names 索引（最多 winnerCount 個） */
  readonly winners: number[] = [];
  /** 各高度區間（每 100 單位一格）被推動的次數 */
  readonly stuckAt: Record<number, number> = {};

  private readonly engine: Matter.Engine;
  private readonly states: MarbleState[];
  private readonly rng: () => number;
  private readonly target: number;
  private finishedCount = 0;
  private steps = 0;
  private nudgeCount = 0;
  private pendingKicks: [Matter.Body, Matter.Body][] = [];
  private hits: StepResult['hits'] = [];

  /**
   * @param cfg 模擬輸入
   * @throws 台面識別碼不存在時
   */
  constructor(cfg: SimConfig) {
    const def = getBoard(cfg.boardId);
    if (!def) throw new Error(`未知的台面：${cfg.boardId}`);
    this.rng = createRng(cfg.seed);
    // 名額超過人數時以人數為上限，避免 isDone 永遠不成立
    this.target = Math.min(cfg.winnerCount, cfg.names.length);

    this.engine = Engine.create({ positionIterations: 10, velocityIterations: 8 });
    this.board = def.build();
    Composite.add(this.engine.world, [...this.board.statics, ...this.board.spinners.map((s) => s.body)]);
    Events.on(this.engine, 'collisionStart', (e) => this.handleCollisions(e));

    // 亂數呼叫順序固定：先洗牌，再依序產生每顆彈珠的 x、y 偏移，之後才是卡住推動
    const order = shuffle(cfg.names.map((_, i) => i), this.rng);
    const gap = MARBLE_R * 2 + 6;
    const perRow = Math.floor((WORLD_W - 40) / gap);
    this.states = order.map((index, i) => {
      const x = 20 + gap / 2 + (i % perRow) * gap + (this.rng() - 0.5) * 4;
      const y = 30 + Math.floor(i / perRow) * gap + (this.rng() - 0.5) * 4;
      return {
        index,
        name: cfg.names[index],
        color: `hsl(${(i * 137.5) % 360} 80% 60%)`,
        body: Bodies.circle(x, y, MARBLE_R, { ...MARBLE_OPTS }),
        finished: false,
        order: i,
        stillSince: null,
        bestY: y,
        bestSince: 0,
      };
    });
    this.marbles = this.states;
    Composite.add(this.engine.world, this.states.map((m) => m.body));
  }

  /** 已推進的物理步數 */
  get stepCount(): number {
    return this.steps;
  }

  /** 卡住推動的總次數 */
  get nudges(): number {
    return this.nudgeCount;
  }

  /**
   * 前 winnerCount 名是否都已抵達。
   * @returns 已產生全部得獎者時為 true
   */
  isDone(): boolean {
    return this.winners.length >= this.target;
  }

  /**
   * 是否所有彈珠都已抵達。
   * @returns 全部抵達時為 true
   */
  allFinished(): boolean {
    return this.finishedCount === this.states.length;
  }

  /**
   * 推進一個物理步長：轉擋板 → Engine.update → 保險桿彈射 → 逐顆處理終點、限速、拉回牆內、卡住判定。
   * @returns 本步的抵達與碰撞事件
   */
  step(): StepResult {
    for (const s of this.board.spinners) Body.setAngle(s.body, s.body.angle + s.speed);
    this.hits = [];
    Engine.update(this.engine, STEP_MS);
    this.steps++;

    // 保險桿：沿圓心→彈珠方向彈開
    for (const [marble, bumper] of this.pendingKicks) {
      const dir = Vector.normalise(Vector.sub(marble.position, bumper.position));
      Body.setVelocity(marble, Vector.mult(dir, BUMPER_KICK));
    }
    this.pendingKicks = [];

    const now = this.engine.timing.timestamp;
    const crossed: MarbleState[] = [];
    for (const m of this.states) {
      if (m.finished) continue;
      const b = m.body;
      if (b.position.y > this.board.finishY) {
        crossed.push(m);
        continue;
      }
      if (b.speed > MAX_SPEED) Body.setVelocity(b, Vector.mult(b.velocity, MAX_SPEED / b.speed));
      // 萬一穿出左右牆，拉回台面內
      if (b.position.x < 0 || b.position.x > WORLD_W) {
        Body.setPosition(b, { x: Math.min(Math.max(b.position.x, MARBLE_R), WORLD_W - MARBLE_R), y: b.position.y });
      }
      // 卡住判定一：低速靜止超過 STUCK_MS（常見情況，反應快）
      if (b.speed < STUCK_SPEED) {
        m.stillSince ??= now;
        if (now - m.stillSince > STUCK_MS) this.nudge(m, now);
      } else {
        m.stillSince = null;
      }
      // 卡住判定二（看門狗）：不論速度，NO_PROGRESS_MS 內 y 沒有前進 PROGRESS_MIN_Y 就推一把，
      // 處理被夾在保險桿與牆面之間反覆彈射、速度始終高於門檻的彈珠
      if (b.position.y >= m.bestY + PROGRESS_MIN_Y) {
        m.bestY = b.position.y;
        m.bestSince = now;
      } else if (now - m.bestSince > NO_PROGRESS_MS) {
        this.nudge(m, now);
      }
    }

    return { arrivals: this.arrive(crossed), hits: this.hits };
  }

  /**
   * 推動卡住的彈珠：給一個隨機水平、向上的速度，並重設兩種卡住判定的計時。
   * 亂數取自同一個種子亂數流，呼叫順序由 step 內固定的彈珠迭代順序決定。
   * @param m 要推動的彈珠
   * @param now 目前的物理時間戳
   */
  private nudge(m: MarbleState, now: number): void {
    const b = m.body;
    Body.setVelocity(b, { x: (this.rng() - 0.5) * 8, y: -5 });
    m.stillSince = null;
    m.bestY = b.position.y;
    m.bestSince = now;
    this.nudgeCount++;
    const bucket = Math.floor(b.position.y / 100) * 100;
    this.stuckAt[bucket] = (this.stuckAt[bucket] ?? 0) + 1;
  }

  /**
   * 尚未抵達且位置最低（最接近終點）的彈珠。
   * @returns 領先的彈珠，全部抵達時為 null
   */
  leader(): SimMarble | null {
    let best: SimMarble | null = null;
    for (const m of this.states) {
      if (!m.finished && (!best || m.body.position.y > best.body.position.y)) best = m;
    }
    return best;
  }

  /**
   * 將本步越過終點的彈珠依規則排序後給名次，並移出物理世界。
   * @param crossed 本步越過終點的彈珠
   * @returns 依名次排列的抵達事件
   */
  private arrive(crossed: MarbleState[]): StepResult['arrivals'] {
    if (!crossed.length) return [];
    const byIndex = new Map(crossed.map((m) => [m.index, m]));
    const ranked = orderArrivals(crossed.map((m) => ({ index: m.index, order: m.order, y: m.body.position.y })));
    return ranked.map((index) => {
      const m = byIndex.get(index)!;
      m.finished = true;
      Composite.remove(this.engine.world, m.body);
      const rank = ++this.finishedCount;
      if (rank <= this.target) this.winners.push(index);
      return { index, rank };
    });
  }

  /** 碰撞事件：記錄碰撞並登記保險桿彈射（於本步 Engine.update 結束後套用）。 */
  private handleCollisions(e: Matter.IEventCollision<Matter.Engine>): void {
    for (const { bodyA, bodyB } of e.pairs) {
      const marble = bodyA.label === 'marble' ? bodyA : bodyB.label === 'marble' ? bodyB : null;
      if (!marble) continue;
      const other = marble === bodyA ? bodyB : bodyA;
      // 彈珠互撞不列入，避免音效過於吵雜
      if (other.label === 'marble') continue;
      const isBumper = other.label === 'bumper';
      if (isBumper) this.pendingKicks.push([marble, other]);
      this.hits.push({ speed: marble.speed, bumper: isBumper });
    }
  }
}

/** 無頭模擬的彙總結果 */
export interface HeadlessResult {
  /** 依名次排列的得獎者 names 索引 */
  winners: number[];
  /** 實際推進的步數 */
  steps: number;
  /** 抵達終點的彈珠數 */
  finished: number;
  /** 卡住推動的總次數 */
  nudges: number;
  /** 各高度區間（每 100 單位一格）被推動的次數 */
  stuckAt: Record<number, number>;
}

/**
 * 不經畫面直接跑完一場模擬。
 * @param cfg 模擬輸入
 * @param opts untilAllFinished：跑到全部抵達才停（預設只跑到得獎者產生）；maxSteps：步數上限（預設 60 * 300）
 * @returns 彙總結果
 */
export function runHeadless(
  cfg: SimConfig,
  opts: { untilAllFinished?: boolean; maxSteps?: number } = {},
): HeadlessResult {
  const { untilAllFinished = false, maxSteps = 60 * 300 } = opts;
  const sim = new Simulation(cfg);
  const finished = () => (untilAllFinished ? sim.allFinished() : sim.isDone());
  while (!finished() && sim.stepCount < maxSteps) sim.step();
  return {
    winners: sim.winners.slice(),
    steps: sim.stepCount,
    finished: sim.marbles.filter((m) => m.finished).length,
    nudges: sim.nudges,
    stuckAt: { ...sim.stuckAt },
  };
}

/**
 * Fisher-Yates 洗牌，回傳新陣列不修改原陣列。
 * @param items 原始陣列
 * @param rng 亂數來源
 * @returns 洗牌後的新陣列
 */
function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
