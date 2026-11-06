import { cascade } from './cascade';
import { classic } from './classic';
import type { BoardDef, BoardId } from './types';
import { zigzag } from './zigzag';

export type { Board, BoardDef, BoardId, Spinner } from './types';

/** 所有台面定義，以識別碼索引 */
export const BOARDS: Record<BoardId, BoardDef> = { classic, zigzag, cascade };

/** 依顯示順序排列的台面清單 */
export const BOARD_LIST: BoardDef[] = Object.values(BOARDS);

/**
 * 依識別碼取得台面定義。
 * @param id 台面識別碼（可能來自網址或儲存資料，未經驗證）
 * @returns 台面定義，找不到時為 undefined
 */
export function getBoard(id: string): BoardDef | undefined {
  return Object.prototype.hasOwnProperty.call(BOARDS, id) ? BOARDS[id as BoardId] : undefined;
}
