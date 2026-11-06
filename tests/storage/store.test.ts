import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY, emptyData, isStoredData } from '@/lib/storage/schema';
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

describe('isStoredData', () => {
  it('接受空資料，拒絕缺欄位或型別錯誤的資料', () => {
    expect(isStoredData(emptyData())).toBe(true);
    expect(isStoredData(null)).toBe(false);
    expect(isStoredData({ ...emptyData(), lists: [{ id: 1 }] })).toBe(false);
    expect(isStoredData({ ...emptyData(), preferences: { sound: 'yes' } })).toBe(false);
  });
});
