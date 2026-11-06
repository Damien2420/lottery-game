import { classic } from './classic';
import type { BoardDef, BoardId } from './types';

export type { Board, BoardDef, BoardId, Spinner } from './types';

/**
 * 所有台面定義，以識別碼索引。
 * 目前只有 classic；zigzag、cascade 加入前先以型別斷言宣告為完整 Record，
 * 外部請透過 getBoard 取得，避免存取到尚未實作的台面。
 */
export const BOARDS = { classic } as Record<BoardId, BoardDef>;

/** 依顯示順序排列的台面清單（只含已實作的台面） */
export const BOARD_LIST: BoardDef[] = Object.values(BOARDS);

/**
 * 依識別碼取得台面定義。
 * @param id 台面識別碼（可能來自網址或儲存資料，未經驗證）
 * @returns 台面定義，找不到時為 undefined
 */
export function getBoard(id: string): BoardDef | undefined {
  return Object.prototype.hasOwnProperty.call(BOARDS, id) ? BOARDS[id as BoardId] : undefined;
}
