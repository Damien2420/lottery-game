import type Matter from 'matter-js';

/** 所有已知台面識別碼（不含 matter-js 執行期相依，供儲存層驗證） */
export const BOARD_IDS = ['classic', 'zigzag', 'cascade'] as const;

/** 台面識別碼 */
export type BoardId = (typeof BOARD_IDS)[number];

/** 可選機關的識別碼（保險桿與集結池是固定配置，不在此列；不含 matter-js 執行期相依，供儲存層驗證） */
export const MECHANISM_IDS = ['wind', 'splitter', 'flipper', 'conveyor', 'well'] as const;

/** 可選機關識別碼 */
export type MechanismId = (typeof MECHANISM_IDS)[number];

/** 可選機關的顯示名稱與簡短說明（設定頁使用） */
export const MECHANISM_INFO: Record<MechanismId, { name: string; desc: string }> = {
  wind: { name: '吹風區', desc: '風一陣一陣往左上或右上吹' },
  // 識別碼沿用 splitter（原本的分流閘），讓舊紀錄與偏好仍可讀取
  splitter: { name: '輸送帶群', desc: '數條短輸送帶各自往不同方向送' },
  flipper: { name: '翻板', desc: '定時翻起，把彈珠拋回去' },
  conveyor: { name: '輸送帶', desc: '把彈珠往一側送，定時反轉' },
  well: { name: '重力井', desc: '吸住約 3 秒後噴發，彈向四方' },
};


/** 旋轉擋板 */
export interface Spinner {
  /** 擋板剛體 */
  body: Matter.Body;
  /** 每個物理步進旋轉的弧度，正值順時針 */
  speed: number;
}

/** 吹風區：矩形範圍內的彈珠受風力推動，風向往左上或右上，依物理步數切換 */
export interface WindZone {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 節奏相位（步數） */
  phase: number;
}

/** 輸送帶：落在帶面上的彈珠被往一側運送，依物理步數反轉 */
export interface Belt {
  x: number;
  /** 帶面頂端 Y */
  y: number;
  w: number;
  h: number;
  /** 節奏相位（步數） */
  phase: number;
}

/** 翻板：定時快速翻起再放下 */
export interface Flipper {
  /** 翻板剛體（靜態，由模擬轉動） */
  body: Matter.Body;
  /** 翻板長度 */
  len: number;
  /** 靜止角度 */
  rest: number;
  /** 翻起角度 */
  up: number;
  /** 節奏相位（步數） */
  phase: number;
}

/** 彈射點：彈珠滾進圓形範圍會被吸住片刻，再朝目標（通常是重力井）彈出 */
export interface Pad {
  x: number;
  y: number;
  r: number;
  /** 彈出的瞄準點 */
  target: { x: number; y: number };
}

/**
 * 集結池：漏斗底部以閘門封住，閘門關著時彈珠在池內被攪拌；
 * 池內收到約八成仍在上方的彈珠、或第一顆進池後滿時限時整個打開，放出後再關上。
 */
export interface Pool {
  /** 閘門剛體（靜態，打開時由模擬移到台面外） */
  gate: Matter.Body;
  /** 閘門關閉時的位置 */
  closed: { x: number; y: number };
  /** 計算池內彈珠數的範圍（Y） */
  top: number;
  bottom: number;
  /** 攪拌棒的延長臂：閘門關著時在池中央，掃到閘門上的彈珠；開閘時跟閘門一起移到台面外，不擋出口 */
  arms: Matter.Body[];
  /** 延長臂的中心位置 */
  armsAt: { x: number; y: number };
}

/** 重力井：圓形範圍把彈珠往中心吸住，蓄力滿約 3 秒後一起噴出 */
export interface Well {
  x: number;
  y: number;
  r: number;
  /** 是否可重複吸引同一顆彈珠（終點池的重力井）；未設定時每顆彈珠只會被吸一次 */
  repeat?: boolean;
}

/** 台面上的可選機關 */
export interface Mechs {
  winds: WindZone[];
  belts: Belt[];
  flippers: Flipper[];
  wells: Well[];
  /** 集結池（固定配置，不受可選機關開關影響） */
  pools: Pool[];
  /** 彈射點（終點池池底，固定配置） */
  pads: Pad[];
  /** 終點出口上方的大十字；台上只剩最後一顆彈珠時由模擬移走，讓最後一顆直接落下 */
  finishCross: Matter.Body[];
}

/** 一次建構出的台面實體（每場模擬都必須重新建構） */
export interface Board {
  /** 所有固定物件 */
  statics: Matter.Body[];
  /** 旋轉擋板 */
  spinners: Spinner[];
  /** 可選機關（未啟用的種類為空陣列） */
  mechs: Mechs;
  /** 世界高度 */
  worldH: number;
  /** 終點線 Y 座標，彈珠中心越過即算抵達 */
  finishY: number;
}

/** 台面定義：描述資訊與建構函式 */
export interface BoardDef {
  /** 台面識別碼 */
  id: BoardId;
  /** 顯示名稱 */
  name: string;
  /** 台面版本，配置變動時調升 */
  version: number;
  /**
   * 建立全新的台面剛體。
   * @param mechanisms 要啟用的可選機關；省略時全部啟用。未啟用的機關位置改放同高的釘陣
   * @returns 台面實體，旋轉擋板位於初始角度
   */
  build(mechanisms?: readonly string[]): Board;
}
