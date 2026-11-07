import { describe, expect, it } from 'vitest';
import { emptyData, type DrawRecord } from '@/lib/storage/schema';
import {
  addDraw,
  createList,
  deleteDraw,
  deleteList,
  duplicateList,
  setPreferences,
  updateList,
} from '@/lib/storage/ops';

const T0 = '2026-01-01T00:00:00Z';
const T1 = '2026-02-01T00:00:00Z';

/** 建立測試用抽獎紀錄 */
function draw(id: string, names: string[]): DrawRecord {
  return {
    id,
    createdAt: T0,
    listId: 'l1',
    listTitle: '尾牙',
    names,
    boardId: 'classic',
    boardVersion: 1,
    engineVersion: 1,
    winnerCount: 1,
    seed: 123,
    winners: [0],
  };
}

describe('ops', () => {
  it('createList 複製傳入陣列', () => {
    const names = ['A'];
    const d = createList(emptyData(), '尾牙', names, T0, 'l1');
    names.push('B');
    expect(d.lists[0].names).toEqual(['A']);
  });

  it('updateList 更新 updatedAt 且不影響既有紀錄的快照', () => {
    let d = createList(emptyData(), '尾牙', ['A', 'B'], T0, 'l1');
    d = addDraw(d, draw('d1', d.lists[0].names));
    const next = updateList(d, 'l1', { names: ['C'] }, T1);
    expect(next.lists[0].names).toEqual(['C']);
    expect(next.lists[0].updatedAt).toBe(T1);
    expect(next.lists[0].createdAt).toBe(T0);
    expect(next.draws[0].names).toEqual(['A', 'B']);
    expect(d.lists[0].names).toEqual(['A', 'B']);
  });

  it('updateList 只改標題時保留 names', () => {
    const d = createList(emptyData(), '尾牙', ['A'], T0, 'l1');
    const next = updateList(d, 'l1', { title: '春酒' }, T1);
    expect(next.lists[0]).toMatchObject({ title: '春酒', names: ['A'] });
  });

  it('duplicateList 產生新 id 與「（複本）」標題', () => {
    const d = createList(emptyData(), '尾牙', ['A', 'B'], T0, 'l1');
    const next = duplicateList(d, 'l1', T1, 'l2');
    expect(next.lists).toHaveLength(2);
    const copy = next.lists.find((l) => l.id === 'l2')!;
    expect(copy.title).toBe('尾牙（複本）');
    expect(copy.names).toEqual(['A', 'B']);
    expect(copy.names).not.toBe(d.lists[0].names);
    expect(copy.createdAt).toBe(T1);
  });

  it('deleteList 不刪除相關紀錄', () => {
    let d = createList(emptyData(), '尾牙', ['A'], T0, 'l1');
    d = addDraw(d, draw('d1', ['A']));
    const next = deleteList(d, 'l1');
    expect(next.lists).toHaveLength(0);
    expect(next.draws).toHaveLength(1);
  });

  it('addDraw 把新紀錄放在最前面', () => {
    let d = addDraw(emptyData(), draw('d1', ['A']));
    d = addDraw(d, draw('d2', ['A']));
    expect(d.draws.map((r) => r.id)).toEqual(['d2', 'd1']);
  });

  it('addDraw 複製 names 陣列', () => {
    const names = ['A'];
    const d = addDraw(emptyData(), draw('d1', names));
    names.push('B');
    expect(d.draws[0].names).toEqual(['A']);
  });

  it('deleteDraw 只刪指定紀錄', () => {
    let d = addDraw(emptyData(), draw('d1', ['A']));
    d = addDraw(d, draw('d2', ['A']));
    expect(deleteDraw(d, 'd1').draws.map((r) => r.id)).toEqual(['d2']);
  });

  it('setPreferences 合併偏好且不改動原物件', () => {
    const d = emptyData();
    const next = setPreferences(d, { sound: false, lastBoardId: 'zigzag' });
    expect(next.preferences).toEqual({ sound: false, lastBoardId: 'zigzag' });
    expect(d.preferences.sound).toBe(true);
  });
});
