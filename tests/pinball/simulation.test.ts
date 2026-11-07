import Matter from 'matter-js';
import { describe, expect, it } from 'vitest';
import { NO_PROGRESS_MS, STEP_MS, STUCK_SPEED } from '@/lib/pinball/physics';
import { orderArrivals, REDRAW_NAME, Simulation, type SimConfig } from '@/lib/pinball/simulation';

const names = (n: number) => Array.from({ length: n }, (_, i) => `P${i}`);

describe('Simulation', () => {
  it('同一步抵達者依 y 由大到小，再依洗牌順序排序', () => {
    expect(orderArrivals([{ index: 4, order: 1, y: 10 }, { index: 2, order: 0, y: 10 }, { index: 9, order: 5, y: 20 }]))
      .toEqual([9, 2, 4]);
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

  it('counts 依名單設定每人彈珠數；全部 1 顆時與沒有 counts 的起跑位置完全相同', () => {
    const sim = new Simulation({ names: names(3), boardId: 'classic', seed: 5, winnerCount: 1, counts: [1, 3, 2] });
    expect([0, 1, 2].map((i) => sim.marbles.filter((m) => m.index === i).length)).toEqual([1, 3, 2]);
    // 名單 *X 最多 500 顆
    const big = new Simulation({ names: names(2), boardId: 'classic', seed: 5, winnerCount: 1, counts: [1, 500] });
    expect(big.marbles.filter((m) => m.index === 1)).toHaveLength(500);
    const pos = (c: SimConfig) => new Simulation(c).marbles.map((m) => [m.index, m.body.position.x, m.body.position.y]);
    const base = { names: names(8), boardId: 'classic' as const, seed: 5, winnerCount: 1 };
    expect(pos({ ...base, counts: Array(8).fill(1) })).toEqual(pos(base));
  });

  it('重抽彈珠是灰色的「再抽一次」，不在參加者之列', () => {
    const sim = new Simulation({ names: names(3), boardId: 'classic', seed: 5, winnerCount: 1, redraw: 2 });
    const redraws = sim.marbles.filter((m) => m.redraw);
    expect(redraws).toHaveLength(2);
    expect(redraws.every((m) => m.name === REDRAW_NAME && m.index >= 3)).toBe(true);
  });

  it('集結池：上方的彈珠全部進池（最落後的也到了）就開閘，開閘前不算卡住', () => {
    const sim = new Simulation({ names: names(10), boardId: 'classic', seed: 5, winnerCount: 1 });
    const pool = sim.board.mechs.pools[0];
    // 把全部彈珠放進池內閘門上方
    sim.marbles.forEach((m, i) => Matter.Body.setPosition(m.body, { x: 260 + (i % 5) * 20, y: pool.closed.y - 30 - Math.floor(i / 5) * 20 }));
    expect(sim.poolPhase(0).open).toBe(false);
    for (let i = 0; i < 3 && !sim.poolPhase(0).open; i++) sim.step();
    expect(sim.poolPhase(0).open).toBe(true);
    expect(sim.nudges).toBe(0);
  });

  it('超過起跑區容量的彈珠往上方堆疊，不會生在台面障礙物裡', () => {
    const small = new Simulation({ names: names(200), boardId: 'classic', seed: 5, winnerCount: 1 });
    const big = new Simulation({ names: names(500), boardId: 'classic', seed: 5, winnerCount: 1 });
    const maxY = (sim: Simulation) => Math.max(...sim.marbles.map((m) => m.body.position.y));
    expect(maxY(big)).toBeLessThanOrEqual(maxY(small) + 2);
    expect(Math.min(...big.marbles.map((m) => m.body.position.y))).toBeLessThan(0);
  });
});
