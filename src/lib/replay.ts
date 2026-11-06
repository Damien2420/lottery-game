import { getBoard } from '@/lib/pinball/boards';
import { ENGINE_VERSION } from '@/lib/pinball/physics';
import type { DrawRecord } from '@/lib/storage/schema';

/** 重播可行性檢查結果 */
export type ReplayCheck = { ok: true } | { ok: false; message: string };

/** 台面或引擎版本不符時的提示 */
const OUTDATED_MESSAGE = '台面或引擎已更新，無法精確重播';

/**
 * 檢查一筆紀錄是否能以目前的台面與引擎精確重播。
 * @param r 抽獎紀錄
 * @returns 可重播為 { ok: true }；台面不存在、台面版本或引擎版本不符時為 { ok: false, message }
 */
export function checkReplayable(r: DrawRecord): ReplayCheck {
  const board = getBoard(r.boardId);
  if (!board || board.version !== r.boardVersion || r.engineVersion !== ENGINE_VERSION) {
    return { ok: false, message: OUTDATED_MESSAGE };
  }
  return { ok: true };
}

/**
 * 比對兩份得獎者名次是否完全一致（長度與順序皆須相同）。
 * @param a 得獎者索引陣列
 * @param b 另一份得獎者索引陣列
 * @returns 一致為 true
 */
export function sameWinners(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
