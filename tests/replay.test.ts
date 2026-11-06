import { describe, expect, it } from 'vitest';
import { checkReplayable, sameWinners } from '@/lib/replay';
import { ENGINE_VERSION } from '@/lib/pinball/physics';
import type { DrawRecord } from '@/lib/storage/schema';

/** 建立一筆有效紀錄，可覆寫欄位 */
function rec(over: Partial<DrawRecord> = {}): DrawRecord {
  return {
    id: 'r1',
    createdAt: '2026-01-01T00:00:00.000Z',
    listId: null,
    listTitle: '測試',
    names: ['a', 'b', 'c'],
    boardId: 'classic',
    boardVersion: 1,
    engineVersion: ENGINE_VERSION,
    winnerCount: 1,
    seed: 1,
    winners: [0],
    ...over,
  };
}

const MSG = '台面或引擎已更新，無法精確重播';

describe('checkReplayable', () => {
  it('版本相同可重播', () => expect(checkReplayable(rec({ boardVersion: 1, engineVersion: ENGINE_VERSION }))).toEqual({ ok: true }));
  it('台面版本不同', () => expect(checkReplayable(rec({ boardVersion: 0 }))).toEqual({ ok: false, message: MSG }));
  it('引擎版本不同', () => expect(checkReplayable(rec({ engineVersion: 0 }))).toEqual({ ok: false, message: MSG }));
  it('台面已不存在', () => expect(checkReplayable(rec({ boardId: 'gone' }))).toEqual({ ok: false, message: MSG }));
});

describe('sameWinners', () => {
  it('名次順序不同即不一致', () => expect(sameWinners([1, 2], [2, 1])).toBe(false));
  it('完全相同為一致', () => expect(sameWinners([1, 2], [1, 2])).toBe(true));
  it('長度不同為不一致', () => expect(sameWinners([1], [1, 2])).toBe(false));
});
