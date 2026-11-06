import type Matter from 'matter-js';

/** 所有已知台面識別碼（不含 matter-js 執行期相依，供儲存層驗證） */
export const BOARD_IDS = ['classic', 'zigzag', 'cascade'] as const;

/** 台面識別碼 */
export type BoardId = (typeof BOARD_IDS)[number];

/** 旋轉擋板 */
export interface Spinner {
  /** 擋板剛體 */
  body: Matter.Body;
  /** 每個物理步進旋轉的弧度，正值順時針 */
  speed: number;
}

/** 一次建構出的台面實體（每場模擬都必須重新建構） */
export interface Board {
  /** 所有固定物件 */
  statics: Matter.Body[];
  /** 旋轉擋板 */
  spinners: Spinner[];
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
   * @returns 台面實體，旋轉擋板位於初始角度
   */
  build(): Board;
}
