import { describe, expect, it } from 'vitest';
import { describeRules, newSeed, parseEntries, parseNames, validateDrawInput } from '@/lib/draw';

describe('draw', () => {
  it('parseNames 去除空白與空行', () => expect(parseNames(' A \r\n\n B\n')).toEqual(['A', 'B']));
  it('parseEntries 解析名字後面的 *X，沒寫為 1 顆，也接受全形與空白', () => {
    expect(parseEntries('王小明*3\n陳美玲\n林志豪 ＊ 2\nA×500')).toEqual({
      entries: [
        { name: '王小明', count: 3 },
        { name: '陳美玲', count: 1 },
        { name: '林志豪', count: 2 },
        { name: 'A', count: 500 },
      ],
      error: null,
    });
  });
  it.each([
    ['王小明*0', '第 1 行「王小明*0」的彈珠數需介於 1 到 500'],
    ['A\n王小明*501', '第 2 行「王小明*501」的彈珠數需介於 1 到 500'],
    ['*3', '第 1 行只有彈珠數，沒有名字'],
  ])('parseEntries 不合法的 *X：%s', (text, error) => expect(parseEntries(text).error).toBe(error));
  it('空名單', () => expect(validateDrawInput([], 1)).toBe('請先輸入參加名單'));
  it('人數沒有上限', () => expect(validateDrawInput(Array(1000).fill('x'), 1)).toBeNull());
  it.each([0, 4, 1.5, NaN])('名額 %s 不合法', (n) =>
    expect(validateDrawInput(['A', 'B', 'C'], n)).toBe('抽出名額需介於 1 到 3'),
  );
  it('合法輸入', () => expect(validateDrawInput(['A'], 1)).toBeNull());
  it('每人多顆時彈珠總數沒有上限', () => expect(validateDrawInput(Array(100).fill('x'), 1, 10)).toBeNull());
  it.each([0, 11, 1.5])('每人彈珠數 %s 不合法', (n) =>
    expect(validateDrawInput(['A'], 1, n)).toBe('每人彈珠數需介於 1 到 10'),
  );
  it('describeRules 描述模式、每人顆數與機關', () => {
    expect(describeRules()).toBe('競速，全部機關');
    expect(describeRules('race', 3, ['wind', 'well'])).toBe('競速，每人 3 顆，機關：吹風區、重力井');
    expect(describeRules('survival', 5, [])).toBe('生存，每人 5 顆，無額外機關');
    expect(describeRules('race', 1, [], [1, 3], 2)).toBe('競速，依名單顆數，再抽一次 2 顆，無額外機關');
  });
  it('newSeed 為 32 位元無號整數', () => {
    const s = newSeed();
    expect(Number.isInteger(s) && s >= 0 && s <= 0xffffffff).toBe(true);
  });
});
