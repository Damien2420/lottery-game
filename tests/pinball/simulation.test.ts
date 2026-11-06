import Matter from 'matter-js';
import { describe, expect, it } from 'vitest';
import { BOARD_LIST } from '@/lib/pinball/boards';
import { NO_PROGRESS_MS, STEP_MS, STUCK_SPEED } from '@/lib/pinball/physics';
import { orderArrivals, runHeadless, Simulation } from '@/lib/pinball/simulation';

const names = (n: number) => Array.from({ length: n }, (_, i) => `P${i}`);

describe('Simulation', () => {
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
  it('同一步抵達者依 y 由大到小，再依洗牌順序排序', () => {
    expect(orderArrivals([{ index: 4, order: 1, y: 10 }, { index: 2, order: 0, y: 10 }, { index: 9, order: 5, y: 20 }]))
      .toEqual([9, 2, 4]);
  });
  it('isDone 後 winners 長度等於名額，且索引不重複', () => {
    const sim = new Simulation({ names: names(20), boardId: 'classic', seed: 99, winnerCount: 4 });
    // 步數上限避免回歸時測試卡死
    while (!sim.isDone() && sim.stepCount < 60 * 300) sim.step();
    expect(sim.isDone()).toBe(true);
    expect(new Set(sim.winners).size).toBe(4);
  });
  it('看門狗：高速但 y 沒有進度的彈珠也會被推動', () => {
    const sim = new Simulation({ names: ['A'], boardId: 'classic', seed: 1, winnerCount: 1 });
    const b = sim.marbles[0].body;
    // 模擬被夾住反覆彈射：每步都拉回原位並給水平高速，速度遠高於靜止門檻、y 永遠不前進
    const limit = Math.ceil((NO_PROGRESS_MS + 1000) / STEP_MS);
    while (sim.nudges === 0 && sim.stepCount < limit) {
      Matter.Body.setPosition(b, { x: 300, y: 150 });
      Matter.Body.setVelocity(b, { x: 4, y: 0 });
      sim.step();
      expect(b.speed).toBeGreaterThan(STUCK_SPEED);
    }
    expect(sim.nudges).toBe(1);
    expect(sim.stuckAt[100]).toBe(1);
  });
});
