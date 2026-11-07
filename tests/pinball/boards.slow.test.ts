import { describe, expect, it } from 'vitest';
import { BOARD_LIST } from '../../src/lib/pinball/boards';
import { runHeadless } from '../../src/lib/pinball/simulation';

// 慢速測試：每個案例都要完整跑完一場（約 2 到 4 分鐘的模擬），只在 npm run test:slow 執行

const names = (n: number) => Array.from({ length: n }, (_, i) => `P${i}`);

describe('台面計時', () => {
  it.each(BOARD_LIST.map((b) => b.id))('%s：30 人可在時限內全部抵達', (id) => {
    const r = runHeadless({ names: names(30), boardId: id, seed: 1, winnerCount: 1 }, { untilAllFinished: true });
    expect(r.finished).toBe(30);
  });

  it.each(BOARD_LIST.map((b) => b.id))('%s：第一名約在 2 到 3 分鐘抵達', (id) => {
    const r = runHeadless({ names: names(50), boardId: id, seed: 1, winnerCount: 1 });
    const sec = r.steps / 60;
    expect(sec).toBeGreaterThanOrEqual(120);
    expect(sec).toBeLessThanOrEqual(180);
  });

  it.each(BOARD_LIST.map((b) => b.id))('%s：不加任何額外機關時第一名也約在 2 到 3 分鐘抵達', (id) => {
    const r = runHeadless({ names: names(50), boardId: id, seed: 1, winnerCount: 1, mechanisms: [] });
    const sec = r.steps / 60;
    expect(sec).toBeGreaterThanOrEqual(120);
    expect(sec).toBeLessThanOrEqual(180);
  });
});
