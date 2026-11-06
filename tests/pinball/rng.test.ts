import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/pinball/rng';

describe('createRng', () => {
  it('相同種子產生相同序列', () => {
    const a = createRng(42), b = createRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('數值落在 [0, 1)，種子 0 也可用', () => {
    const r = createRng(0);
    for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
  it('不同種子產生不同序列', () => expect(createRng(1)()).not.toBe(createRng(2)()));
});
