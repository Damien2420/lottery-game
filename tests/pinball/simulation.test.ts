import { describe, expect, it } from 'vitest';
import { orderArrivals, runHeadless, Simulation } from '@/lib/pinball/simulation';

const names = (n: number) => Array.from({ length: n }, (_, i) => `P${i}`);

describe('Simulation', () => {
  it('同一種子跑兩次得獎者相同', () => {
    const cfg = { names: names(30), boardId: 'classic' as const, seed: 12345, winnerCount: 5 };
    const a = runHeadless(cfg), b = runHeadless(cfg);
    expect(a.winners).toHaveLength(5);
    expect(a.winners).toEqual(b.winners);
  });
  it('不同種子會產生不同結果', () => {
    const results = [1, 2, 3, 4, 5].map((seed) =>
      runHeadless({ names: names(30), boardId: 'classic', seed, winnerCount: 3 }).winners.join(','));
    expect(new Set(results).size).toBeGreaterThan(1);
  });
  it('同名參加者以索引區分', () => {
    const r = runHeadless({ names: ['A', 'A', 'B'], boardId: 'classic', seed: 7, winnerCount: 3 });
    expect([...r.winners].sort()).toEqual([0, 1, 2]);
  });
  it('同一步抵達者依 y 由大到小，再依洗牌順序排序', () => {
    expect(orderArrivals([{ index: 4, order: 1, y: 10 }, { index: 2, order: 0, y: 10 }, { index: 9, order: 5, y: 20 }]))
      .toEqual([9, 2, 4]);
  });
  it('isDone 後 winners 長度等於名額，且索引不重複', () => {
    const sim = new Simulation({ names: names(20), boardId: 'classic', seed: 99, winnerCount: 4 });
    while (!sim.isDone()) sim.step();
    expect(new Set(sim.winners).size).toBe(4);
  });
});
