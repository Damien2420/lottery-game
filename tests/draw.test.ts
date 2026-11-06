import { describe, expect, it } from 'vitest';
import { newSeed, parseNames, validateDrawInput } from '@/lib/draw';

describe('draw', () => {
  it('parseNames 去除空白與空行', () => expect(parseNames(' A \r\n\n B\n')).toEqual(['A', 'B']));
  it('空名單', () => expect(validateDrawInput([], 1)).toBe('請先輸入參加名單'));
  it('超過 200 人', () => expect(validateDrawInput(Array(201).fill('x'), 1)).toBe('最多 200 人'));
  it.each([0, 4, 1.5, NaN])('名額 %s 不合法', (n) =>
    expect(validateDrawInput(['A', 'B', 'C'], n)).toBe('抽出名額需介於 1 到 3'),
  );
  it('合法輸入', () => expect(validateDrawInput(['A'], 1)).toBeNull());
  it('newSeed 為 32 位元無號整數', () => {
    const s = newSeed();
    expect(Number.isInteger(s) && s >= 0 && s <= 0xffffffff).toBe(true);
  });
});
