import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { Game } from '@/lib/pinball/game';
import { Sfx } from '@/lib/pinball/audio';

/** 空操作的 2D context：任何方法呼叫都不做事，屬性可任意賦值 */
function fakeCtx(): CanvasRenderingContext2D {
  return new Proxy({}, { get: (t: Record<string, unknown>, k: string) => t[k] ?? (() => undefined), set: (t: Record<string, unknown>, k: string, v) => ((t[k] = v), true) }) as unknown as CanvasRenderingContext2D;
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

describe('Game', () => {
  it('destroy 會取消 rAF 並解除 ResizeObserver，重複呼叫不拋錯', () => {
    const game = new Game(canvas, events, new Sfx());
    game.destroy();
    game.destroy();
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('destroy 後不再排程新的畫面', () => {
    const game = new Game(canvas, events, new Sfx());
    game.destroy();
    const calls = (requestAnimationFrame as Mock).mock.calls.length;
    runPendingFrames();
    expect((requestAnimationFrame as Mock).mock.calls.length).toBe(calls);
  });

  it('stop 後不會觸發 onDone', () => {
    const game = new Game(canvas, events, new Sfx());
    game.start({ names: ['A', 'B'], boardId: 'classic', seed: 1, winnerCount: 1 });
    game.stop();
    runFrames(60 * 60);
    expect(events.onDone).not.toHaveBeenCalled();
    game.destroy();
  });

  it('跑完一場會依名次通知並只觸發一次 onDone', () => {
    const game = new Game(canvas, events, new Sfx());
    game.showBoard('classic');
    game.start({ names: ['A', 'B', 'C'], boardId: 'classic', seed: 7, winnerCount: 2 });
    runFrames(60 * 120);
    expect(events.onDone).toHaveBeenCalledTimes(1);
    expect(events.onDone.mock.calls[0][0]).toHaveLength(2);
    expect(events.onArrive.mock.calls.map((c) => c[1])).toEqual([1, 2]);
    game.destroy();
  });
});

describe('Game 音效', () => {
  const cfg = { names: ['A', 'B'], boardId: 'classic' as const, seed: 1, winnerCount: 1 };

  it('音效關閉時 start 不解鎖，開啟後的下一次 start 才解鎖', () => {
    const sfx = new Sfx();
    const unlock = vi.spyOn(sfx, 'unlock').mockImplementation(() => undefined);
    const game = new Game(canvas, events, sfx);
    sfx.enabled = false;
    game.start(cfg);
    expect(unlock).not.toHaveBeenCalled();
    sfx.enabled = true;
    game.start(cfg);
    expect(unlock).toHaveBeenCalledTimes(1);
    game.destroy();
  });

  it('destroy 會釋放 AudioContext', () => {
    const sfx = new Sfx();
    const dispose = vi.spyOn(sfx, 'dispose');
    new Game(canvas, events, sfx).destroy();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('dispose 關閉 AudioContext，之後 unlock 會重新建立', () => {
    const close = vi.fn(() => Promise.resolve());
    const ctors = vi.fn();
    vi.stubGlobal(
      'AudioContext',
      class {
        state = 'running';
        close = close;
        constructor() {
          ctors();
        }
      },
    );
    const sfx = new Sfx();
    sfx.unlock();
    sfx.dispose();
    sfx.dispose();
    expect(close).toHaveBeenCalledTimes(1);
    sfx.unlock();
    expect(ctors).toHaveBeenCalledTimes(2);
  });
});
