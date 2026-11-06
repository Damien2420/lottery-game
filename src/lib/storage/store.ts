import { STORAGE_KEY, emptyData, isStoredData, type StoredData } from './schema';

/** 寫入結果：失敗時區分容量已滿與無法存取 */
export type SaveResult = { ok: true } | { ok: false; reason: 'unavailable' | 'quota' };

/** 目前的訂閱者 */
const listeners = new Set<() => void>();

/** 通知所有訂閱者資料已變動 */
function notify(): void {
  listeners.forEach((cb) => cb());
}

/**
 * 解析原始字串為 StoredData，失敗時回傳 null。
 * @param raw localStorage 讀到的原始字串
 */
function parseRaw(raw: string): StoredData | null {
  try {
    const v: unknown = JSON.parse(raw);
    return isStoredData(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * 從 localStorage 讀取資料。
 * @returns 讀不到、損毀或版本不符時回傳空資料
 */
export function loadData(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return (raw === null ? null : parseRaw(raw)) ?? emptyData();
  } catch {
    return emptyData();
  }
}

/**
 * 寫入資料並通知訂閱者。
 * @param d 要儲存的完整資料
 * @returns 成功為 ok；QuotaExceededError 為 quota，其餘例外為 unavailable
 */
export function saveData(d: StoredData): SaveResult {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch (e) {
    const quota = e instanceof DOMException && e.name === 'QuotaExceededError';
    return { ok: false, reason: quota ? 'quota' : 'unavailable' };
  }
  notify();
  return { ok: true };
}

/**
 * 訂閱資料變動（本分頁寫入與其他分頁的 storage 事件）。
 * @param cb 變動時呼叫的回呼
 * @returns 取消訂閱函式
 */
export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent): void => {
    if (e.key === null || e.key === STORAGE_KEY) cb();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

/** 快照快取：以原始字串為鍵，null 代表尚無資料 */
let cache: { raw: string | null; data: StoredData } | null = null;
/** localStorage 無法讀取時共用的空資料 */
let fallback: StoredData | null = null;

/**
 * 取得目前資料快照；原始字串未變時回傳同一參考（供 useSyncExternalStore 使用）。
 * @returns 目前的 StoredData
 */
export function getSnapshot(): StoredData {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    fallback ??= emptyData();
    return fallback;
  }
  if (cache === null || cache.raw !== raw) {
    cache = { raw, data: (raw === null ? null : parseRaw(raw)) ?? emptyData() };
  }
  return cache.data;
}

/** 伺服器端快照：伺服器沒有資料，固定為 null */
export function getServerSnapshot(): null {
  return null;
}

/**
 * 解析匯入的 JSON。
 * @param json 使用者提供的 JSON 字串
 * @returns 成功時帶資料，失敗時帶錯誤訊息
 */
export function parseImport(
  json: string,
): { ok: true; data: StoredData } | { ok: false; error: string } {
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    return { ok: false, error: '檔案不是有效的 JSON' };
  }
  if (!isStoredData(v)) return { ok: false, error: '檔案格式不符或版本不支援' };
  return { ok: true, data: v };
}

/**
 * 匯出為 JSON 字串。
 * @param d 要匯出的資料
 */
export function exportJson(d: StoredData): string {
  return JSON.stringify(d, null, 2);
}
