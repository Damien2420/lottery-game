import type { DrawRecord, StoredData } from './schema';

/**
 * 新增名單（複製傳入的 names）。
 * @param d 目前資料
 * @param title 名單標題
 * @param names 參加者
 * @param now ISO 時間字串
 * @param id 新名單 ID
 * @returns 新的 StoredData
 */
export function createList(
  d: StoredData,
  title: string,
  names: string[],
  now: string,
  id: string,
): StoredData {
  return {
    ...d,
    lists: [...d.lists, { id, title, names: [...names], createdAt: now, updatedAt: now }],
  };
}

/**
 * 更新名單標題或參加者，並更新 updatedAt；不影響既有抽獎紀錄。
 * @param d 目前資料
 * @param id 名單 ID
 * @param patch 要更新的欄位
 * @param now ISO 時間字串
 * @returns 新的 StoredData
 */
export function updateList(
  d: StoredData,
  id: string,
  patch: { title?: string; names?: string[] },
  now: string,
): StoredData {
  return {
    ...d,
    lists: d.lists.map((l) =>
      l.id === id
        ? {
            ...l,
            title: patch.title ?? l.title,
            names: patch.names ? [...patch.names] : l.names,
            updatedAt: now,
          }
        : l,
    ),
  };
}

/**
 * 刪除名單（不刪除相關紀錄）。
 * @param d 目前資料
 * @param id 名單 ID
 * @returns 新的 StoredData
 */
export function deleteList(d: StoredData, id: string): StoredData {
  return { ...d, lists: d.lists.filter((l) => l.id !== id) };
}

/**
 * 複製名單，標題加「（複本）」。
 * @param d 目前資料
 * @param id 來源名單 ID
 * @param now ISO 時間字串
 * @param newId 新名單 ID
 * @returns 新的 StoredData；來源不存在時回傳原資料
 */
export function duplicateList(d: StoredData, id: string, now: string, newId: string): StoredData {
  const src = d.lists.find((l) => l.id === id);
  if (!src) return d;
  return createList(d, `${src.title}（複本）`, src.names, now, newId);
}

/**
 * 新增抽獎紀錄，放在最前面（複製 names）。
 * @param d 目前資料
 * @param r 抽獎紀錄
 * @returns 新的 StoredData
 */
export function addDraw(d: StoredData, r: DrawRecord): StoredData {
  return { ...d, draws: [{ ...r, names: [...r.names], winners: [...r.winners] }, ...d.draws] };
}

/**
 * 刪除抽獎紀錄。
 * @param d 目前資料
 * @param id 紀錄 ID
 * @returns 新的 StoredData
 */
export function deleteDraw(d: StoredData, id: string): StoredData {
  return { ...d, draws: d.draws.filter((r) => r.id !== id) };
}

/**
 * 合併更新偏好設定。
 * @param d 目前資料
 * @param p 要更新的偏好
 * @returns 新的 StoredData
 */
export function setPreferences(d: StoredData, p: Partial<StoredData['preferences']>): StoredData {
  return { ...d, preferences: { ...d.preferences, ...p } };
}

