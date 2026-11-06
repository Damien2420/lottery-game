'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { StoredData } from './schema';
import { getServerSnapshot, getSnapshot, saveData, subscribe, type SaveResult } from './store';

/**
 * 以 useSyncExternalStore 讀寫 localStorage 資料。
 * @returns data 在伺服器與水合前為 null；update 對目前快照套用 fn 並存檔，回傳存檔結果
 */
export function useStoredData(): {
  data: StoredData | null;
  update(fn: (d: StoredData) => StoredData): SaveResult;
} {
  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const update = useCallback(
    (fn: (d: StoredData) => StoredData): SaveResult => saveData(fn(getSnapshot())),
    [],
  );
  return { data, update };
}
