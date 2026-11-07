import Matter from 'matter-js';
import { getBoard } from './boards';
import { STATIC_OPTS } from './boards/builders';
import { beltDir, flipperAngle, MECHANISM_IDS, WELL_CHARGE, WELL_COOLDOWN, windDir, windGust } from './boards/mechanisms';
import type { Board, BoardId } from './boards/types';
import {
  BUMPER_KICK,
  MAX_MARBLES_PER_ENTRY,
  MAX_MARBLES_PER_PERSON,
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

/** 起跑區放得下的排數（再往下就是台面障礙物），超出的排改往世界上方堆疊 */
const START_ROWS = 9;


/** 遊戲模式：race 競速（最先抵達者得獎）、survival 生存（最後抵達者得獎） */
export type GameMode = 'race' | 'survival';

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
  /** 遊戲模式，預設競速 */
  mode?: GameMode;
  /** 每人固定的彈珠數（1 到 MAX_MARBLES_PER_PERSON），預設 1；有 counts 時以 counts 為準 */
  perPerson?: number;
  /** 依名單 *X 設定的每人彈珠數（1 到 MAX_MARBLES_PER_ENTRY），順序同 names；省略時每人使用 perPerson */
  counts?: readonly number[];
  /** 重抽彈珠數，預設 0。重抽彈珠拿到第一名時本場作廢（isRedraw 為 true） */
  redraw?: number;
  /** 啟用的可選機關，預設全部 */
  mechanisms?: readonly string[];
}

/** 吹風區的水平與向上風力（乘上彈珠質量）；向上分力小於重力，彈珠只會被吹慢、吹偏，不會懸停 */
const WIND_X = 0.002;
const WIND_UP = 0.0009;
/** 吹風區：離牆多近時不再把彈珠往牆上吹 */
const WIND_WALL_GAP = 70;
/** 輸送帶的運送速度與帶動比例 */
const BELT_SPEED = 3.4;
const BELT_GRIP = 0.12;
/** 翻板角速度超過此值（弧度／步）才算翻起，翻起時把板上的彈珠拋出 */
const FLIP_KICK_OMEGA = 0.05;
/** 翻板拋出彈珠的速度倍率（相對於板面該點的移動速度） */
const FLIP_KICK_GAIN = 1.2;
/** 重力井的吸力與繞圈力（乘上彈珠質量）；吸力約為重力的 4.5 倍，範圍內的彈珠逃不掉 */
const WELL_PULL = 0.0045;
const WELL_SWIRL = 0.0012;
/** 集結池漏斗本身約可容納的彈珠數；超過時彈珠會往上堆，計數範圍跟著往上延伸 */
const POOL_CAP = 160;
/** 每多堆一顆彈珠，堆疊往上增加的高度（彈珠面積 ÷ 堆積密度約 0.6 ÷ 台面寬） */
const POOL_STACK_PX = (Math.PI * MARBLE_R * MARBLE_R) / 0.6 / WORLD_W;
/** 集結池：保險時限，第一顆進池後最多等多少步就開閘（約 60 秒），只在上方有彈珠卡死時才會用到 */
const POOL_WAIT = 3600;
/** 可重複吸引的重力井（終點池）：放開後多少步內不會再吸住同一顆彈珠（約 1.5 秒） */
const WELL_REGRAB = 90;
/** 彈射點：彈出後閃光持續的步數（只影響畫面） */
const PAD_FLASH = 20;
/** 彈射點：噴發後多少步內同一個彈射點不再噴（約 0.3 秒） */
const PAD_REFIRE = 20;
/** 彈射點：噴發通道的長度（沿彈出方向）與半寬 */
const PAD_LANE_LEN = 240;
const PAD_LANE_HALF = 40;
/** 彈射點：彈出後多少步內不會再被彈（避免離開範圍前連續觸發） */
const PAD_COOLDOWN = 30;
/** 彈射點：彈出的速度，高於一般速度上限 */
const PAD_SPEED = 17;
/** 彈射點：彈出後多少步內不受速度上限限制，讓高速彈出不會立刻被削弱 */
const PAD_BOOST = 24;
/** 閘門打開時移到的 X（台面外） */
const GATE_AWAY_X = -1000;
/** 重力井範圍內每步保留的速度比例，讓彈珠聚在井心附近而不是高速繞圈 */
const WELL_DAMP = 0.93;
/** 重力井噴發時把彈珠沿井心往外彈出的速度 */
const WELL_BURST = MAX_SPEED;

/**
 * 取得每人實際的彈珠數（競速與生存相同）。
 * @param cfg 模擬輸入
 * @returns 1 到 MAX_MARBLES_PER_PERSON
 */
export function marblesPerPerson(cfg: Pick<SimConfig, 'perPerson'>): number {
  return Math.min(MAX_MARBLES_PER_PERSON, Math.max(1, Math.floor(cfg.perPerson ?? 1)));
}

/** 重抽彈珠的色相標記：不是真正的色相，畫面看到這個值改用中性灰 */
export const REDRAW_HUE = -1;
/** 重抽彈珠在台面與名次上顯示的名字 */
export const REDRAW_NAME = '再抽一次';

/** 參加者的一顆彈珠（每人可有多顆，以 index 對應參加者） */
export interface SimMarble {
  /** 彈珠序號（0 起，同場不重複） */
  id: number;
  /** 所屬參加者在 names 中的索引；重抽彈珠為 names.length 起的編號 */
  index: number;
  /** 是否為重抽彈珠 */
  redraw: boolean;
  /** 參加者名稱 */
  name: string;
  /** 顯示色相（0-360），依參加者洗牌後順序以黃金角分散，同一人的彈珠同色 */
  hue: number;
  /** 彈珠剛體 */
  body: Matter.Body;
  /** 是否已越過終點線 */
  finished: boolean;
}

/** 單一步進的輸出事件 */
export interface StepResult {
  /** 本步產生名次的參加者（含名額以外的名次），依抵達先後排列；同一人的第二顆以後不列入 */
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
  /** 目前被哪座重力井吸住（索引）與開始的步數 */
  well: { i: number; since: number } | null;
  /** 被吸過並放出的重力井索引 → 可以再被吸住的步數；一般重力井為 Infinity（不會再被同一座吸住） */
  wellAgain: Map<number, number>;
  /** 可以再被彈射點彈出的步數 */
  padReady: number;
  /** 彈射點高速彈出、暫時不受速度上限限制到的步數 */
  boostUntil: number;
}

/**
 * 同一步內越過終點的彈珠排序：y 由大到小，相同時依洗牌後的順序由小到大。
 * @param c 候選彈珠（識別索引、洗牌順序、y 座標）
 * @returns 依抵達先後排列的識別索引
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
  /** 遊戲模式 */
  readonly mode: GameMode;
  /** 參加人數 */
  readonly players: number;
  /** 各高度區間（每 100 單位一格）被推動的次數 */
  readonly stuckAt: Record<number, number> = {};

  private readonly engine: Matter.Engine;
  private readonly states: MarbleState[];
  private readonly rng: () => number;
  private readonly target: number;
  private finishedCount = 0;
  /** 已產生名次的參加者數 */
  private rankedCount = 0;
  /** 已產生名次的參加者 */
  private readonly ranked = new Set<number>();
  /** 每位參加者還在台上的彈珠數（生存模式要等最後一顆抵達才產生名次） */
  private readonly onBoard = new Map<number, number>();
  /** 還在台上的重抽彈珠數 */
  private redrawLeft = 0;
  /** 終點大十字是否已移走（台上只剩最後一顆時） */
  private crossGone = false;
  private redrawHit = false;
  /** 各重力井的狀態：since 為開始蓄力（第一顆被吸住）的步數，coolUntil 為噴發後恢復吸引的步數 */
  private readonly wellState: { since: number | null; coolUntil: number }[];
  /**
   * 各集結池的狀態：since 為第一顆進池的步數、openUntil 為集結池維持打開到的步數、
   * open 為閘門目前是否打開、fill 為開閘條件的進度（0 到 1，供畫面顯示）
   */
  private readonly poolState: { since: number | null; openUntil: number; open: boolean; fill: number }[];
  private steps = 0;
  private nudgeCount = 0;
  private pendingKicks: [Matter.Body, Matter.Body][] = [];
  /** 各彈射點最近一次彈出彈珠的步數 */
  private readonly padFired: number[] = [];
  private hits: StepResult['hits'] = [];

  /**
   * @param cfg 模擬輸入
   * @throws 台面識別碼不存在時
   */
  constructor(cfg: SimConfig) {
    const def = getBoard(cfg.boardId);
    if (!def) throw new Error(`未知的台面：${cfg.boardId}`);
    this.rng = createRng(cfg.seed);
    this.mode = cfg.mode ?? 'race';
    this.players = cfg.names.length;
    // 名額超過人數時以人數為上限，避免 isDone 永遠不成立
    this.target = Math.min(cfg.winnerCount, cfg.names.length);

    this.engine = Engine.create({ positionIterations: 10, velocityIterations: 8 });
    this.board = def.build(cfg.mechanisms ?? MECHANISM_IDS);
    Composite.add(this.engine.world, [...this.board.statics, ...this.board.spinners.map((s) => s.body)]);
    Events.on(this.engine, 'collisionStart', (e) => this.handleCollisions(e));
    this.wellState = this.board.mechs.wells.map(() => ({ since: null, coolUntil: 0 }));
    this.poolState = this.board.mechs.pools.map(() => ({ since: null, openUntil: 0, open: false, fill: 0 }));

    // 亂數呼叫順序固定：先洗牌參加者（決定顏色），再洗牌所有彈珠（決定起跑位置），
    // 再依序產生每顆彈珠的 x、y 偏移，之後才是卡住推動
    const people = shuffle(cfg.names.map((_, i) => i), this.rng);
    const hueOf = new Map(people.map((index, i) => [index, (i * 137.5) % 360]));
    const copies = marblesPerPerson(cfg);
    const countOf = (index: number): number =>
      cfg.counts ? Math.min(MAX_MARBLES_PER_ENTRY, Math.max(1, Math.floor(cfg.counts[index] ?? 1))) : copies;
    // 重抽彈珠的 index 接在參加者後面；沒有多顆也沒有重抽時維持原本的順序（舊紀錄重播結果不變）
    const redraws = Math.max(0, Math.floor(cfg.redraw ?? 0));
    const pool = people.flatMap((index) => Array.from({ length: countOf(index) }, () => index));
    for (let k = 0; k < redraws; k++) pool.push(cfg.names.length + k);
    const order = pool.length === people.length ? people : shuffle(pool, this.rng);
    const gap = MARBLE_R * 2 + 6;
    const perRow = Math.floor((WORLD_W - 40) / gap);
    // 前 START_ROWS 排維持原本由上往下的排法；超出的排往世界上方（負 Y）堆疊，避免生在台面障礙物裡
    const rowY = (row: number) => 30 + (row < START_ROWS ? row : START_ROWS - 1 - row) * gap;
    this.states = order.map((index, i) => {
      const x = 20 + gap / 2 + (i % perRow) * gap + (this.rng() - 0.5) * 4;
      const y = rowY(Math.floor(i / perRow)) + (this.rng() - 0.5) * 4;
      const redraw = index >= cfg.names.length;
      return {
        id: i,
        index,
        redraw,
        name: redraw ? REDRAW_NAME : cfg.names[index],
        hue: redraw ? REDRAW_HUE : hueOf.get(index)!,
        body: Bodies.circle(x, y, MARBLE_R, { ...MARBLE_OPTS }),
        finished: false,
        order: i,
        stillSince: null,
        bestY: y,
        bestSince: 0,
        well: null,
        wellAgain: new Map(),
        padReady: 0,
        boostUntil: 0,
      };
    });
    this.marbles = this.states;
    for (const m of this.states) {
      if (m.redraw) this.redrawLeft++;
      else this.onBoard.set(m.index, (this.onBoard.get(m.index) ?? 0) + 1);
    }
    const rows = Math.ceil(order.length / perRow);
    if (rows > START_ROWS) this.raiseCeiling(rowY(rows - 1) - MARBLE_R - gap);
    Composite.add(this.engine.world, this.states.map((m) => m.body));
  }

  /**
   * 彈珠超出起跑區時，把外框天花板移到更高處，並補上左右牆延伸段。
   * 只在超出時呼叫，起跑區放得下的場次物理完全不變。
   * @param top 新天花板的下緣 Y（負值）
   */
  private raiseCeiling(top: number): void {
    const world = this.engine.world;
    const ceiling = this.board.statics.find((b) => b.label === 'frame' && b.position.y < 0);
    if (ceiling) Composite.remove(world, ceiling);
    const opts = { ...STATIC_OPTS, label: 'frame' };
    const h = -top + 140;
    Composite.add(world, [
      Bodies.rectangle(WORLD_W / 2, top - 20, WORLD_W + 80, 40, opts),
      Bodies.rectangle(-20, top + h / 2 - 40, 40, h, opts),
      Bodies.rectangle(WORLD_W + 20, top + h / 2 - 40, 40, h, opts),
    ]);
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
   * 全部得獎者是否都已產生。競速模式為前 winnerCount 名抵達；生存模式要等最後一位抵達才確定。
   * @returns 已產生全部得獎者時為 true
   */
  isDone(): boolean {
    if (this.redrawHit) return true;
    // 生存模式：還有重抽彈珠在台上時，它仍可能最後抵達，要等它
    if (this.mode === 'survival' && this.redrawLeft > 0) return false;
    return this.winners.length >= this.target;
  }

  /**
   * 是否抽到重抽：競速為重抽彈珠第一個抵達；生存為重抽彈珠最後一個抵達。抽到時 isDone 也為 true，winners 不完整。
   * @returns 抽到重抽時為 true
   */
  isRedraw(): boolean {
    return this.redrawHit;
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
    this.moveMechs();
    this.applyFields();
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
      if (b.speed > MAX_SPEED && this.steps >= m.boostUntil) Body.setVelocity(b, Vector.mult(b.velocity, MAX_SPEED / b.speed));
      // 萬一穿出左右牆，拉回台面內
      if (b.position.x < 0 || b.position.x > WORLD_W) {
        Body.setPosition(b, { x: Math.min(Math.max(b.position.x, MARBLE_R), WORLD_W - MARBLE_R), y: b.position.y });
      }
      // 被重力井吸住或在關著的集結池裡等待是刻意的停留，不算卡住
      if (m.well || this.inClosedPool(b.position.y)) {
        m.stillSince = null;
        m.bestSince = now;
        continue;
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

  /** 轉動翻板：依步數節奏翻起與放下 */
  private moveMechs(): void {
    const { flippers } = this.board.mechs;
    for (const f of flippers) {
      const prev = f.body.angle;
      const next = flipperAngle(f, this.steps);
      Body.setAngle(f.body, next);
      if (Math.abs(next - prev) > FLIP_KICK_OMEGA) this.flipKick(f.body, f.len, next - prev);
    }
    this.movePools();
    // 台上只剩最後一顆彈珠時，終點出口上方的勺形攪拌棒移走、彈射點停用，不再擋住最後一顆
    if (!this.crossGone && this.states.length - this.finishedCount <= 1) {
      this.crossGone = true;
      for (const b of this.board.mechs.finishCross) Body.setPosition(b, { x: GATE_AWAY_X, y: b.position.y });
    }
  }

  /**
   * 集結池開關閘：閘門上方離終點最遠的那顆彈珠也到了池子（上方的彈珠全部到齊）時打開，打開後就不再關上；
   * 第一顆進池後滿 POOL_WAIT 步仍未到齊（例如上方有彈珠卡死）也會打開。
   * 彈珠多到超過漏斗容量時會往上堆，池子的範圍依堆疊高度往上延伸。
   */
  private movePools(): void {
    this.board.mechs.pools.forEach((p, i) => {
      const st = this.poolState[i];
      if (this.steps >= st.openUntil) {
        // 閘門上方還沒過池的彈珠
        let above = 0;
        for (const m of this.states) if (!m.finished && m.body.position.y < p.bottom) above++;
        const countTop = p.top - Math.max(0, above - POOL_CAP) * POOL_STACK_PX;
        let inPool = 0;
        for (const m of this.states) {
          if (m.finished) continue;
          const y = m.body.position.y;
          if (y >= countTop && y < p.bottom) inPool++;
        }
        if (inPool > 0) {
          st.since ??= this.steps;
          // 進度條顯示到齊的比例；全部到齊代表離終點最遠的那顆也進池了
          st.fill = Math.min(1, Math.max(inPool / above, (this.steps - st.since) / POOL_WAIT));
          if (st.fill >= 1) {
            st.since = null;
            st.fill = 0;
            // 開閘後不再關上
            st.openUntil = Infinity;
          }
        } else {
          st.fill = 0;
        }
      }
      const open = this.steps < st.openUntil;
      if (open !== st.open) {
        st.open = open;
        Body.setPosition(p.gate, open ? { x: GATE_AWAY_X, y: p.closed.y } : p.closed);
        // 延長臂跟著閘門：開閘時移走，關閘時回到池中央（角度持續轉動，與主臂保持同步）
        for (const a of p.arms) Body.setPosition(a, open ? { x: GATE_AWAY_X, y: p.armsAt.y } : p.armsAt);
      }
    });
  }

  /**
   * 判斷某個高度是否位於閘門關著的集結池內（在池裡等待不算卡住）。
   * @param y 彈珠 Y
   * @returns 位於關著的池內時為 true
   */
  private inClosedPool(y: number): boolean {
    return this.board.mechs.pools.some((p, i) => !this.poolState[i].open && y >= p.top && y < p.bottom);
  }

  /**
   * 彈射點是否已停用（台上只剩最後一顆彈珠時），供畫面隱藏彈射點。
   * @returns 已停用時為 true
   */
  padsOff(): boolean {
    return this.crossGone;
  }

  /**
   * 彈射點剛彈出彈珠的閃光強度，供畫面繪製。
   * @param i 彈射點索引（對應 board.mechs.pads）
   * @returns 剛彈出為 1，PAD_FLASH 步內遞減到 0
   */
  padFlash(i: number): number {
    const at = this.padFired[i];
    return at === undefined ? 0 : Math.max(0, 1 - (this.steps - at) / PAD_FLASH);
  }

  /**
   * 集結池目前的狀態，供畫面繪製開閘進度。
   * @param i 集結池索引（對應 board.mechs.pools）
   * @returns open：閘門是否打開；fill：開閘條件的進度 0 到 1
   */
  poolPhase(i: number): { open: boolean; fill: number } {
    const st = this.poolState[i];
    return st ? { open: st.open, fill: st.fill } : { open: false, fill: 0 };
  }

  /**
   * 翻板快速翻起時，把板面上的彈珠依該點的移動速度拋出。
   * 靜態剛體轉動時 Matter 只會把彈珠推開、不會給速度，所以這裡直接換算：
   * 板面上距離中心 d 的點，每步移動 ω·d，往上掃到的彈珠得到同方向的速度（上限 MAX_SPEED）。
   * @param body 翻板剛體（已轉到新角度）
   * @param len 翻板長度
   * @param omega 本步轉動的弧度（正值為順時針）
   */
  private flipKick(body: Matter.Body, len: number, omega: number): void {
    const cos = Math.cos(body.angle);
    const sin = Math.sin(body.angle);
    for (const m of this.states) {
      if (m.finished) continue;
      const b = m.body;
      const dx = b.position.x - body.position.x;
      const dy = b.position.y - body.position.y;
      // 換到翻板座標：along 沿板面，across 垂直板面（負值在板面上方）
      const along = dx * cos + dy * sin;
      const across = -dx * sin + dy * cos;
      if (Math.abs(along) > len / 2 + MARBLE_R || across > 0 || across < -(MARBLE_R + 14)) continue;
      // 該點垂直板面的移動速度；負值代表往上掃向彈珠
      const v = omega * along;
      if (v >= 0) continue;
      const speed = Math.min(MAX_SPEED, -v * FLIP_KICK_GAIN);
      // 板面法線（指向上方）為 (sin, -cos)
      Body.setVelocity(b, { x: b.velocity.x * 0.3 + sin * speed, y: -cos * speed });
    }
  }

  /**
   * 對範圍內的彈珠施加吹風區風力、重力井吸力（含噴發）與輸送帶帶動，於 Engine.update 之前呼叫。
   * 全部只依位置與步數決定，不使用亂數。
   */
  private applyFields(): void {
    const { winds, belts, wells, pads } = this.board.mechs;
    if (!winds.length && !belts.length && !wells.length && !pads.length) return;
    this.burstWells();
    this.firePads();
    // 台上只剩最後一顆時，終點池的重力井不再吸引，讓最後一顆直接落向終點
    const lastOne = this.states.length - this.finishedCount === 1;
    for (const m of this.states) {
      if (m.finished) continue;
      const b = m.body;
      const { x, y } = b.position;
      for (const w of winds) {
        if (x < w.x || x > w.x + w.w || y < w.y || y > w.y + w.h) continue;
        const k = windGust(this.steps, w.phase);
        const dir = windDir(this.steps, w.phase);
        // 靠牆且風正往那面牆吹時不給水平風力，避免彈珠被壓在牆邊下不來
        const pinned = dir < 0 ? x < WIND_WALL_GAP : x > WORLD_W - WIND_WALL_GAP;
        Body.applyForce(b, b.position, { x: pinned ? 0 : dir * WIND_X * b.mass * k, y: -WIND_UP * b.mass * k });
      }
      for (const t of belts) {
        if (x > t.x && x < t.x + t.w && y > t.y - MARBLE_R - 4 && y < t.y + 2) {
          const v = b.velocity;
          Body.setVelocity(b, { x: v.x * (1 - BELT_GRIP) + beltDir(this.steps, t.phase) * BELT_SPEED * BELT_GRIP, y: v.y });
        }
      }
      wells.forEach((w, i) => {
        if (lastOne && w.repeat) {
          // 正被這座井吸住就放開
          if (m.well?.i === i) m.well = null;
          return;
        }
        if (this.steps < (m.wellAgain.get(i) ?? 0) || this.steps < this.wellState[i].coolUntil) return;
        const dx = w.x - x;
        const dy = w.y - y;
        const dist = Math.hypot(dx, dy);
        if (dist > w.r) {
          // 離開範圍：放開彈珠（一般重力井不會再吸同一顆，終點池的重力井隔一段時間可以再吸）
          if (m.well?.i === i) this.releaseWell(m, i);
          return;
        }
        if (m.well?.i !== i) m.well = { i, since: this.steps };
        this.wellState[i].since ??= this.steps;
        const ux = dx / dist;
        const uy = dy / dist;
        const pull = WELL_PULL * b.mass * Math.min(1, dist / 30);
        const swirl = WELL_SWIRL * b.mass;
        Body.setVelocity(b, Vector.mult(b.velocity, WELL_DAMP));
        Body.applyForce(b, b.position, { x: ux * pull - uy * swirl, y: uy * pull + ux * swirl });
      });
    }
  }

  /**
   * 彈射點（噴泉）：有可彈的彈珠碰到彈射點時，把從彈射點往瞄準點方向整條通道上的彈珠一起以 PAD_SPEED 彈出，
   * 讓整排球同時移動，不會被壓在上面的彈珠擋住。每個彈射點噴發後 PAD_REFIRE 步內不再噴，
   * 每顆彈珠被彈後 PAD_COOLDOWN 步內不會再被彈；彈出後短暫不受速度上限限制。
   */
  private firePads(): void {
    if (this.crossGone) return;
    this.board.mechs.pads.forEach((p, i) => {
      const last = this.padFired[i];
      if (last !== undefined && this.steps - last < PAD_REFIRE) return;
      const ready = (m: MarbleState) => !m.finished && this.steps >= m.padReady;
      const touched = this.states.some((m) => ready(m) && Math.hypot(p.x - m.body.position.x, p.y - m.body.position.y) <= p.r);
      if (!touched) return;
      const dx = p.target.x - p.x;
      const dy = p.target.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      for (const m of this.states) {
        if (!ready(m)) continue;
        const rx = m.body.position.x - p.x;
        const ry = m.body.position.y - p.y;
        // 換到通道座標：along 沿彈出方向、across 垂直彈出方向
        const along = rx * ux + ry * uy;
        const across = Math.abs(rx * uy - ry * ux);
        if (along < -p.r || along > PAD_LANE_LEN || across > PAD_LANE_HALF) continue;
        Body.setVelocity(m.body, { x: ux * PAD_SPEED, y: uy * PAD_SPEED });
        m.padReady = this.steps + PAD_COOLDOWN;
        m.boostUntil = this.steps + PAD_BOOST;
      }
      this.padFired[i] = this.steps;
    });
  }

  /**
   * 重力井噴發：蓄力滿 WELL_CHARGE 步的井，把範圍內被吸住的彈珠全部沿井心往外以 WELL_BURST 彈出，
   * 之後 WELL_COOLDOWN 步內不吸引；被噴出的彈珠不會再被同一座一般重力井吸住。
   */
  private burstWells(): void {
    this.board.mechs.wells.forEach((w, i) => {
      const st = this.wellState[i];
      if (st.since === null || this.steps - st.since < WELL_CHARGE) return;
      for (const m of this.states) {
        if (m.well?.i !== i) continue;
        const b = m.body;
        const dx = b.position.x - w.x;
        const dy = b.position.y - w.y;
        const dist = Math.hypot(dx, dy) || 1;
        Body.setVelocity(b, { x: (dx / dist) * WELL_BURST, y: (dy / dist) * WELL_BURST });
        this.releaseWell(m, i);
      }
      st.since = null;
      st.coolUntil = this.steps + WELL_COOLDOWN;
    });
  }

  /**
   * 放開被某座重力井吸住的彈珠：一般重力井之後不再吸它；可重複吸引的井（終點池）WELL_REGRAB 步後可以再吸。
   * @param m 彈珠
   * @param i 重力井索引
   */
  private releaseWell(m: MarbleState, i: number): void {
    m.wellAgain.set(i, this.board.mechs.wells[i].repeat ? this.steps + WELL_REGRAB : Infinity);
    m.well = null;
  }

  /**
   * 重力井目前的狀態，供畫面繪製蓄力與噴發效果。
   * @param i 重力井索引（對應 board.mechs.wells）
   * @returns charge：蓄力進度 0 到 1（未蓄力為 0）；cooling：噴發後的冷卻進度 1 到 0（未冷卻為 0）
   */
  wellPhase(i: number): { charge: number; cooling: number } {
    const st = this.wellState[i];
    if (!st) return { charge: 0, cooling: 0 };
    const charge = st.since === null ? 0 : Math.min(1, (this.steps - st.since) / WELL_CHARGE);
    const cooling = Math.max(0, (st.coolUntil - this.steps) / WELL_COOLDOWN);
    return { charge, cooling };
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
   * 尚未抵達且位置最高（離終點最遠）的彈珠，生存模式下就是目前的第一名。
   * @returns 最落後的彈珠，全部抵達時為 null
   */
  trailer(): SimMarble | null {
    let best: SimMarble | null = null;
    for (const m of this.states) {
      if (!m.finished && (!best || m.body.position.y < best.body.position.y)) best = m;
    }
    return best;
  }

  /**
   * 將本步越過終點的彈珠依規則排序後移出物理世界，並給參加者名次。
   * 競速：每人最先抵達的那顆決定名次，第 1 個抵達的人是第 1 名；之後同一人的彈珠不再計名次。
   * 生存：每人最後抵達的那顆決定名次，越晚抵達名次越好，最後抵達的人是第 1 名（名次 = 人數 - 抵達順序 + 1）。
   * @param crossed 本步越過終點的彈珠
   * @returns 依抵達先後排列的名次事件
   */
  private arrive(crossed: MarbleState[]): StepResult['arrivals'] {
    if (!crossed.length) return [];
    const byId = new Map(crossed.map((m) => [m.id, m]));
    const sorted = orderArrivals(crossed.map((m) => ({ index: m.id, order: m.order, y: m.body.position.y })));
    const out: StepResult['arrivals'] = [];
    for (const id of sorted) {
      const m = byId.get(id)!;
      m.finished = true;
      this.finishedCount++;
      Composite.remove(this.engine.world, m.body);
      if (m.redraw) {
        this.redrawLeft--;
        // 競速：還沒有人產生名次就是重抽彈珠拿第一；生存：它是最後一顆。其餘情況不佔名次
        const first = this.mode === 'survival' ? this.finishedCount === this.states.length : this.rankedCount === 0;
        if (first) this.redrawHit = true;
        continue;
      }
      const left = this.onBoard.get(m.index)! - 1;
      this.onBoard.set(m.index, left);
      // 生存：還有彈珠在台上就還沒抵達
      if (this.mode === 'survival' && left > 0) continue;
      if (this.ranked.has(m.index)) continue;
      this.ranked.add(m.index);
      const n = ++this.rankedCount;
      const rank = this.mode === 'survival' ? this.players - n + 1 : n;
      if (rank <= this.target) {
        // 生存模式的名次由大到小產生，插在最前面讓 winners 保持依名次排列
        if (this.mode === 'survival') this.winners.unshift(m.index);
        else this.winners.push(m.index);
      }
      out.push({ index: m.index, rank });
    }
    return out;
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
 * @param opts untilAllFinished：跑到全部抵達才停（預設只跑到得獎者產生）；maxSteps：步數上限（預設 60 * 900）
 * @returns 彙總結果
 */
export function runHeadless(
  cfg: SimConfig,
  opts: { untilAllFinished?: boolean; maxSteps?: number } = {},
): HeadlessResult {
  const { untilAllFinished = false, maxSteps = 60 * 900 } = opts;
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
