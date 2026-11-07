import { describe, expect, it } from 'vitest';
import { BOARD_LIST } from '../../src/lib/pinball/boards';
import { WORLD_W } from '../../src/lib/pinball/physics';

describe('台面', () => {
  it('共有 3 種台面且 id 不重複', () => expect(new Set(BOARD_LIST.map((b) => b.id)).size).toBe(3));
});

describe('可選機關', () => {
  it.each(BOARD_LIST)('$id：預設五種機關都有，全部取消時都沒有，且台面高度不變', (def) => {
    const all = def.build();
    const none = def.build([]);
    for (const k of ['winds', 'belts', 'flippers', 'wells'] as const) {
      expect(all.mechs[k].length).toBeGreaterThan(0);
      expect(none.mechs[k]).toHaveLength(0);
    }
    expect(none.worldH).toBe(all.worldH);
    expect(none.mechs.pools.length).toBe(all.mechs.pools.length);
  });

  it.each(BOARD_LIST)('$id：只開一種機關時只有那一種', (def) => {
    const b = def.build(['well']);
    expect(b.mechs.wells.length).toBeGreaterThan(0);
    expect(b.mechs.winds).toHaveLength(0);
    expect(b.mechs.belts).toHaveLength(0);
  });
});

describe('牆邊保險桿與蓄球池', () => {
  it.each(BOARD_LIST)('$id：左右牆邊都有保險桿', (def) => {
    const b = def.build();
    const wall = b.statics.filter((s) => s.label === 'bumper');
    expect(wall.some((s) => s.position.x < 0)).toBe(true);
    expect(wall.some((s) => s.position.x > WORLD_W)).toBe(true);
  });

  it.each(BOARD_LIST)('$id：至少 2 座集結池，都在終點線之前，閘門一開始都是關著的', (def) => {
    const b = def.build();
    const pools = b.mechs.pools;
    expect(pools.length).toBeGreaterThanOrEqual(2);
    for (const p of pools) {
      expect(p.bottom).toBeLessThan(b.finishY);
      expect(p.gate.position).toEqual(expect.objectContaining(p.closed));
    }
  });

  it.each(BOARD_LIST)('$id：終點池有 4 個彈射點，出口沒有閘門', (def) => {
    const b = def.build();
    expect(b.mechs.pads).toHaveLength(4);
    expect(b.statics.some((s) => s.label === 'gate' && s.position.y > b.finishY - 100)).toBe(false);
  });
});
