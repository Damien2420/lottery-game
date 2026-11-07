import { describe, expect, it } from 'vitest';
import { BOARD_LIST } from '@/lib/pinball/boards';
import { runHeadless, Simulation, type SimConfig } from '@/lib/pinball/simulation';

// 慢速測試：每個案例都要把一場（或多場）模擬跑到結束，只在 npm run test:slow 執行

/**
 * 跑到 isDone，記錄彈珠抵達的先後順序（同一步內依 marbles 順序）。
 * @param cfg 模擬輸入
 * @returns 模擬與抵達順序（彈珠）
 */
function runTracked(cfg: SimConfig) {
  const sim = new Simulation(cfg);
  const order: (typeof sim.marbles)[number][] = [];
  const seen = new Set<number>();
  while (!sim.isDone() && sim.stepCount < 60 * 900) {
    sim.step();
    for (const m of sim.marbles) {
      if (!m.finished || seen.has(m.id)) continue;
      seen.add(m.id);
      order.push(m);
    }
  }
  return { sim, order };
}

const names = (n: number) => Array.from({ length: n }, (_, i) => `P${i}`);

describe('Simulation 完整跑場', () => {
  it.each(BOARD_LIST)('同一種子跑兩次得獎者與步數相同：$id', ({ id }) => {
    const cfg = { names: names(30), boardId: id, seed: 12345, winnerCount: 5 };
    const a = runHeadless(cfg), b = runHeadless(cfg);
    expect(a.winners).toHaveLength(5);
    expect(a.winners).toEqual(b.winners);
    expect(a.steps).toBe(b.steps);
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

  it('isDone 後 winners 長度等於名額，且索引不重複', () => {
    const sim = new Simulation({ names: names(20), boardId: 'classic', seed: 99, winnerCount: 4 });
    // 步數上限避免回歸時測試卡死
    while (!sim.isDone() && sim.stepCount < 60 * 300) sim.step();
    expect(sim.isDone()).toBe(true);
    expect(new Set(sim.winners).size).toBe(4);
  });

  it('生存模式：最後抵達的人是第一名，所有人抵達才結束', () => {
    const cfg = { names: names(12), boardId: 'cascade' as const, seed: 3, winnerCount: 3, mode: 'survival' as const };
    const sim = new Simulation(cfg);
    const order: number[] = [];
    const ranks: number[] = [];
    while (!sim.isDone() && sim.stepCount < 60 * 900) {
      for (const a of sim.step().arrivals) {
        order.push(a.index);
        ranks.push(a.rank);
      }
    }
    expect(sim.allFinished()).toBe(true);
    expect(ranks).toEqual(Array.from({ length: 12 }, (_, i) => 12 - i));
    expect(sim.winners).toEqual(order.slice(-3).reverse());
  });

  it('競速模式每人多顆：彈珠數為人數乘以顆數，同一人只會得一次名次且同色', () => {
    const sim = new Simulation({ names: names(5), boardId: 'zigzag', seed: 9, winnerCount: 5, perPerson: 4 });
    expect(sim.marbles).toHaveLength(20);
    for (let i = 0; i < 5; i++) {
      const mine = sim.marbles.filter((m) => m.index === i);
      expect(mine).toHaveLength(4);
      expect(new Set(mine.map((m) => m.hue)).size).toBe(1);
    }
    while (!sim.isDone() && sim.stepCount < 60 * 600) sim.step();
    expect([...sim.winners].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('生存模式每人可多顆，以每人最後抵達的那顆決定名次', () => {
    const sim = new Simulation({ names: names(5), boardId: 'zigzag', seed: 9, winnerCount: 1, perPerson: 3, mode: 'survival' });
    expect(sim.marbles).toHaveLength(15);
    const lastArrival = new Map<number, number>();
    const rankStep = new Map<number, number>();
    while (!sim.isDone() && sim.stepCount < 60 * 900) {
      const { arrivals } = sim.step();
      for (const m of sim.marbles) if (m.finished && !lastArrival.has(m.id)) lastArrival.set(m.id, sim.stepCount);
      for (const a of arrivals) rankStep.set(a.index, sim.stepCount);
    }
    expect(sim.allFinished()).toBe(true);
    // 每人產生名次的那一步，就是他最後一顆抵達的那一步
    for (const [index, step] of rankStep) {
      const mine = sim.marbles.filter((m) => m.index === index).map((m) => lastArrival.get(m.id)!);
      expect(step).toBe(Math.max(...mine));
    }
    expect(rankStep.size).toBe(5);
  });

  it('競速：重抽彈珠第一個抵達才算抽到重抽，其餘時候不佔名次', () => {
    let hit = 0;
    let miss = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { sim, order } = runTracked({ names: names(3), boardId: 'cascade', seed, winnerCount: 2, redraw: 3 });
      if (sim.isRedraw()) {
        hit++;
        expect(order[0].redraw).toBe(true);
        expect(sim.winners).toEqual([]);
      } else {
        miss++;
        // 第一個抵達的參加者是第一名；重抽彈珠不在得獎者裡
        expect(sim.winners[0]).toBe(order.find((m) => !m.redraw)!.index);
        expect(sim.winners).toHaveLength(2);
        expect(sim.winners.every((w) => w < 3)).toBe(true);
      }
    }
    expect(hit + miss).toBe(6);
  });

  it('生存：重抽彈珠最後一個抵達才算抽到重抽，否則要等它抵達才結束', () => {
    for (const seed of [1, 2, 3]) {
      const { sim, order } = runTracked({ names: names(3), boardId: 'cascade', seed, winnerCount: 1, mode: 'survival', redraw: 2 });
      expect(sim.allFinished()).toBe(true);
      const last = order[order.length - 1];
      expect(sim.isRedraw()).toBe(last.redraw);
      if (!last.redraw) expect(sim.winners).toEqual([last.index]);
    }
  });

  it('同一組設定（含機關與模式）重播結果相同，機關設定不同結果不同', () => {
    const base = { names: names(20), boardId: 'zigzag' as const, seed: 77, winnerCount: 3 };
    const a = runHeadless({ ...base, mechanisms: ['splitter', 'wind'] });
    const b = runHeadless({ ...base, mechanisms: ['splitter', 'wind'] });
    const c = runHeadless({ ...base, mechanisms: [] });
    expect(a.winners).toEqual(b.winners);
    expect(a.steps).toBe(b.steps);
    expect(a.steps === c.steps && a.winners.join() === c.winners.join()).toBe(false);
  });

  it.each(BOARD_LIST)('500 顆彈珠全部抵達終點：$id', ({ id }) => {
    const r = runHeadless({ names: names(500), boardId: id, seed: 8, winnerCount: 1 }, { untilAllFinished: true, maxSteps: 60 * 1200 });
    expect(r.finished).toBe(500);
  }, 120_000);
});
