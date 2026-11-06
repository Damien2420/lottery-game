import { describe, expect, it } from 'vitest';
import { BOARD_LIST } from '../../src/lib/pinball/boards';
import { runHeadless } from '../../src/lib/pinball/simulation';

describe('台面', () => {
  it.each(BOARD_LIST.map((b) => b.id))('%s：30 人可在時限內全部抵達', (id) => {
    const r = runHeadless(
      { names: Array.from({ length: 30 }, (_, i) => `P${i}`), boardId: id, seed: 1, winnerCount: 1 },
      { untilAllFinished: true },
    );
    expect(r.finished).toBe(30);
  });

  it('共有 3 種台面且 id 不重複', () => expect(new Set(BOARD_LIST.map((b) => b.id)).size).toBe(3));
});
