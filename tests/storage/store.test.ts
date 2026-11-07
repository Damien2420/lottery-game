import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY, emptyData, isStoredData, type DrawRecord } from '@/lib/storage/schema';
import {
  exportJson,
  getServerSnapshot,
  getSnapshot,
  loadData,
  parseImport,
  saveData,
  subscribe,
} from '@/lib/storage/store';
import { createList } from '@/lib/storage/ops';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('store', () => {
  it('沒有資料時回傳空資料', () => expect(loadData()).toEqual(emptyData()));
  it('JSON 損毀時回傳空資料而不拋錯', () => {
    localStorage.setItem(STORAGE_KEY, '{oops');
    expect(loadData()).toEqual(emptyData());
  });
  it('schemaVersion 不符時回傳空資料', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 99 }));
    expect(loadData()).toEqual(emptyData());
  });
  it('存入後可讀回', () => {
    const d = createList(emptyData(), '尾牙', ['A'], '2026-01-01T00:00:00Z', 'l1');
    expect(saveData(d)).toEqual({ ok: true });
    expect(loadData()).toEqual(d);
  });
  it('容量已滿時回傳 quota', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(saveData(emptyData())).toEqual({ ok: false, reason: 'quota' });
  });
  it('localStorage 無法存取時回傳 unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(saveData(emptyData())).toEqual({ ok: false, reason: 'unavailable' });
  });
  it('伺服器快照為 null', () => expect(getServerSnapshot()).toBeNull());
  it('getSnapshot 在資料未變時回傳同一參考', () => expect(getSnapshot()).toBe(getSnapshot()));
  it('getSnapshot 在資料改變後回傳新參考', () => {
    const a = getSnapshot();
    saveData(createList(emptyData(), 'x', ['A'], 't', 'l1'));
    const b = getSnapshot();
    expect(b).not.toBe(a);
    expect(b.lists).toHaveLength(1);
  });
  it('localStorage 讀取拋錯時 getSnapshot 回傳同一份空資料', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(getSnapshot()).toEqual(emptyData());
    expect(getSnapshot()).toBe(getSnapshot());
  });
  it('saveData 成功後通知訂閱者，取消訂閱後不再通知', () => {
    const cb = vi.fn();
    const off = subscribe(cb);
    saveData(emptyData());
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    saveData(emptyData());
    expect(cb).toHaveBeenCalledTimes(1);
  });
  it('其他分頁的 storage 事件會通知訂閱者', () => {
    const cb = vi.fn();
    const off = subscribe(cb);
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    expect(cb).toHaveBeenCalledTimes(1);
    off();
  });
  it('匯出再匯入得到相同資料', () => {
    const d = emptyData();
    expect(parseImport(exportJson(d))).toEqual({ ok: true, data: d });
  });
  it('匯入格式錯誤時回傳錯誤', () => {
    expect(parseImport('[]').ok).toBe(false);
    expect(parseImport('{oops').ok).toBe(false);
  });
});

/** 建立合法抽獎紀錄，可覆寫欄位 */
function draw(over: Partial<DrawRecord> = {}): DrawRecord {
  return {
    id: 'd1',
    createdAt: 't',
    listId: null,
    listTitle: 'x',
    names: ['A', 'B', 'C'],
    boardId: 'classic',
    boardVersion: 1,
    engineVersion: 1,
    winnerCount: 2,
    seed: 4294967295,
    winners: [2, 0],
    ...over,
  };
}

/** 以指定紀錄組出完整資料 */
function withDraws(...draws: DrawRecord[]) {
  return { ...createList(emptyData(), 't', ['A'], 't', 'l1'), draws };
}

describe('isStoredData', () => {
  it('接受空資料，拒絕缺欄位或型別錯誤的資料', () => {
    expect(isStoredData(emptyData())).toBe(true);
    expect(isStoredData(null)).toBe(false);
    expect(isStoredData({ ...emptyData(), lists: [{ id: 1 }] })).toBe(false);
    expect(isStoredData({ ...emptyData(), preferences: { sound: 'yes' } })).toBe(false);
  });

  it('接受含名單、紀錄與偏好（有或無 lastBoardId）的資料', () => {
    const d = withDraws(draw());
    expect(isStoredData(d)).toBe(true);
    const prefs = { sound: false, lastBoardId: 'cascade', mode: 'survival', perPerson: 3, mechanisms: ['wind', 'well'] };
    expect(isStoredData({ ...d, preferences: prefs })).toBe(true);
  });

  it('驗證模式、每人顆數與機關欄位，彈珠總數沒有上限', () => {
    expect(isStoredData(withDraws(draw({ mode: 'survival', perPerson: 1, mechanisms: ['wind'] })))).toBe(true);
    expect(isStoredData(withDraws(draw({ mode: 'x' as never })))).toBe(false);
    expect(isStoredData(withDraws(draw({ perPerson: 11 })))).toBe(false);
    expect(isStoredData(withDraws(draw({ mechanisms: ['laser'] })))).toBe(false);
    const many = Array.from({ length: 21 }, (_, i) => `P${i}`);
    expect(isStoredData(withDraws(draw({ names: many, perPerson: 10 })))).toBe(true);
    expect(isStoredData(withDraws(draw({ names: many, perPerson: 10, mode: 'survival' })))).toBe(true);
    // 依名單顆數與重抽彈珠：counts 長度要等於人數、每格 1 到 500；重抽 0 到 500
    expect(isStoredData(withDraws(draw({ counts: [1, 500, 2], redraw: 2 })))).toBe(true);
    expect(isStoredData(withDraws(draw({ counts: [1] })))).toBe(false);
    expect(isStoredData(withDraws(draw({ counts: [1, 501, 1] })))).toBe(false);
    expect(isStoredData(withDraws(draw({ redraw: 501 })))).toBe(false);
  });

  it('接受未知 boardId 的紀錄（重播時再處理）', () => {
    expect(isStoredData(withDraws(draw({ boardId: 'gone' })))).toBe(true);
  });

  it.each<[string, Partial<DrawRecord>]>([
    ['winners 非整數', { winners: [0.5] }],
    ['winners 為負數', { winners: [-1] }],
    ['winners 超出 names', { winners: [3] }],
    ['winners 重複', { winners: [1, 1] }],
    ['winners 多於 winnerCount', { winners: [0, 1, 2], winnerCount: 2 }],
    ['winnerCount 非整數', { winnerCount: 1.5 }],
    ['winnerCount 為 0', { winnerCount: 0, winners: [] }],
    ['seed 非整數', { seed: 1.5 }],
    ['seed 為負數', { seed: -1 }],
    ['seed 超過 uint32', { seed: 4294967296 }],
    ['boardVersion 非整數', { boardVersion: 1.5 }],
    ['engineVersion 非整數', { engineVersion: 0.1 }],
    ['boardId 為空字串', { boardId: '' }],
    ['names 為空', { names: [], winners: [] }],
  ])('拒絕不合法紀錄：%s', (_label, over) => {
    expect(isStoredData(withDraws(draw(over)))).toBe(false);
  });

  it('拒絕重複的名單 id 或紀錄 id', () => {
    expect(isStoredData(withDraws(draw(), draw()))).toBe(false);
    const d = createList(createList(emptyData(), 'a', [], 't', 'l1'), 'b', [], 't', 'l1');
    expect(isStoredData(d)).toBe(false);
  });

  it('未知的 lastBoardId 在 loadData 與 parseImport 時被移除', () => {
    const raw = {
      ...emptyData(),
      preferences: { sound: true, lastBoardId: 'nope' },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
    expect(loadData()).toEqual(emptyData());
    expect(parseImport(JSON.stringify(raw))).toEqual({ ok: true, data: emptyData() });
  });
});
