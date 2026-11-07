// 慢速測試：要讓 Game 把一整場跑完，只在 npm run test:slow 執行
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { Game } from '@/lib/pinball/game';
import { Sfx } from '@/lib/pinball/audio';

/** 空操作的 2D context：任何方法呼叫都不做事，屬性可任意賦值 */
function fakeCtx(): CanvasRenderingContext2D {
  return new Proxy({ measureText: () => ({ width: 0 }) } as Record<string, unknown>, { get: (t: Record<string, unknown>, k: string) => t[k] ?? (() => undefined), set: (t: Record<string, unknown>, k: string, v) => ((t[k] = v), true) }) as unknown as CanvasRenderingContext2D;
}

let pending: Map<number, FrameRequestCallback>;
let nextId: number;
let clock: number;
let disconnect: Mock;
let canvas: HTMLCanvasElement;
const events = { onArrive: vi.fn(), onDone: vi.fn() };

/** 執行目前排程中的所有畫面回呼一次（每次前進 16.7ms） */
function runPendingFrames(): void {
  clock += 1000 / 60;
  const cbs = [...pending.values()];
  pending.clear();
  cbs.forEach((cb) => cb(clock));
}
function runFrames(n: number): void {
  for (let i = 0; i < n; i++) runPendingFrames();
}

beforeEach(() => {
  pending = new Map();
  nextId = 1;
  clock = 0;
  disconnect = vi.fn();
  events.onArrive.mockClear();
  events.onDone.mockClear();
  vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => (pending.set(nextId, cb), nextId++)));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => void pending.delete(id)));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = disconnect;
    },
  );
  const parent = document.createElement('div');
  Object.defineProperty(parent, 'clientWidth', { value: 600 });
  Object.defineProperty(parent, 'clientHeight', { value: 800 });
  canvas = document.createElement('canvas');
  parent.appendChild(canvas);
  vi.spyOn(canvas, 'getContext').mockReturnValue(fakeCtx() as never);
});

afterEach(() => vi.unstubAllGlobals());

describe('Game 完整跑場', () => {
  it('跑完一場會依名次通知並只觸發一次 onDone', () => {
    const game = new Game(canvas, events, new Sfx());
    game.showBoard('classic');
    game.start({ names: ['A', 'B', 'C'], boardId: 'classic', seed: 7, winnerCount: 2 });
    // 台面設計約 2 到 3 分鐘產生得獎者
    runFrames(60 * 240);
    expect(events.onDone).toHaveBeenCalledTimes(1);
    expect(events.onDone.mock.calls[0][0]).toHaveLength(2);
    expect(events.onArrive.mock.calls.map((c) => c[1])).toEqual([1, 2]);
    game.destroy();
  });

  const cfg = { names: ['A', 'B', 'C'], boardId: 'classic' as const, seed: 3, winnerCount: 1 };

  it('snapshot 列出前幾名，已抵達者帶名次且排在前面，計時在全部抵達後停止並記下得獎時間', () => {
    const game = new Game(canvas, events, new Sfx());
    game.start(cfg);
    runFrames(60 * 240);
    const a = game.snapshot();
    expect(a.top).toHaveLength(3);
    expect(a.roster.map((r) => r.name)).toEqual(['A', 'B', 'C']);
    expect(a.top[0].rank).toBe(1);
    expect(a.decidedAt).not.toBeNull();
    expect(a.decidedAt!).toBeLessThanOrEqual(a.elapsed);
    runFrames(60);
    expect(game.snapshot().elapsed).toBe(a.elapsed);
    game.destroy();
  });
});
