import { MAX_PLAYERS } from '@/lib/pinball/physics';
import { BOARD_IDS, type BoardId } from '@/lib/pinball/boards/types';

/** localStorage 使用的單一 key */
export const STORAGE_KEY = 'pinball-lottery';

/** 一份參加者名單 */
export interface ParticipantList {
  id: string;
  title: string;
  /** 一個元素一位參加者，允許同名 */
  names: string[];
  /** ISO 8601 */
  createdAt: string;
  updatedAt: string;
}

/** 一場抽獎紀錄，寫入後不可修改，只能刪除 */
export interface DrawRecord {
  id: string;
  createdAt: string;
  /** 來源名單 ID；名單之後可能已被刪除，僅供參考 */
  listId: string | null;
  /** 抽獎當下的名單標題 */
  listTitle: string;
  /** 抽獎當下的參加者快照，重播只依賴此快照 */
  names: string[];
  /** 刻意不用 BoardId：台面日後可能移除，紀錄仍須保留，重播時再判斷台面是否存在 */
  boardId: string;
  boardVersion: number;
  /** 引擎版本：物理參數、模擬邏輯、亂數演算法或 Matter.js 版本任一變動即升版 */
  engineVersion: number;
  winnerCount: number;
  /** 32 位元無號整數 */
  seed: number;
  /** 得獎者依抵達順序排列，對應 names 的索引（支援同名） */
  winners: number[];
}

/** 偏好設定 */
export interface Preferences {
  lastBoardId?: BoardId;
  sound: boolean;
  removeWinners: boolean;
}

/** 存入 localStorage 的完整資料 */
export interface StoredData {
  /** 資料結構版本，日後遷移用 */
  schemaVersion: 1;
  lists: ParticipantList[];
  draws: DrawRecord[];
  preferences: Preferences;
}

/**
 * 建立一份全新的空資料。
 * @returns 預設偏好為音效開啟、得獎者自動移除的空資料
 */
export function emptyData(): StoredData {
  return {
    schemaVersion: 1,
    lists: [],
    draws: [],
    preferences: { sound: true, removeWinners: true },
  };
}

/** 是否為一般物件 */
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 是否為字串陣列 */
function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/** 是否為整數 */
function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

/** 是否為 32 位元無號整數 */
function isUint32(v: unknown): v is number {
  return isInt(v) && v >= 0 && v <= 0xffffffff;
}

/** 是否為已知台面識別碼 */
function isBoardId(v: unknown): v is BoardId {
  return typeof v === 'string' && (BOARD_IDS as readonly string[]).includes(v);
}

/** 驗證單一名單結構 */
function isList(v: unknown): boolean {
  return (
    isObj(v) &&
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    isStringArray(v.names) &&
    typeof v.createdAt === 'string' &&
    typeof v.updatedAt === 'string'
  );
}

/** 驗證單筆抽獎紀錄結構（boardId 只檢查為字串，是否存在由重播時判斷） */
function isDraw(v: unknown): boolean {
  if (
    !isObj(v) ||
    typeof v.id !== 'string' ||
    typeof v.createdAt !== 'string' ||
    !(v.listId === null || typeof v.listId === 'string') ||
    typeof v.listTitle !== 'string' ||
    !isStringArray(v.names) ||
    typeof v.boardId !== 'string' ||
    v.boardId === '' ||
    !isInt(v.boardVersion) ||
    !isInt(v.engineVersion) ||
    !isInt(v.winnerCount) ||
    !isUint32(v.seed) ||
    !Array.isArray(v.winners)
  ) {
    return false;
  }
  const n = v.names.length;
  const winners: unknown[] = v.winners;
  return (
    n >= 1 &&
    n <= MAX_PLAYERS &&
    v.winnerCount >= 1 &&
    winners.length <= v.winnerCount &&
    winners.every((w) => isInt(w) && w >= 0 && w < n) &&
    new Set(winners).size === winners.length
  );
}

/** 陣列內 id 是否皆不重複 */
function uniqueIds(arr: { id: unknown }[]): boolean {
  return new Set(arr.map((x) => x.id)).size === arr.length;
}

/**
 * 驗證未知資料是否符合 StoredData 結構（僅檢查結構，不匯入台面登錄表）。
 * @param v 待驗證的值
 * @returns 符合時為 true，並收窄型別
 */
export function isStoredData(v: unknown): v is StoredData {
  if (!isObj(v) || v.schemaVersion !== 1) return false;
  if (!Array.isArray(v.lists) || !v.lists.every(isList) || !uniqueIds(v.lists)) return false;
  if (!Array.isArray(v.draws) || !v.draws.every(isDraw) || !uniqueIds(v.draws)) return false;
  const p = v.preferences;
  return (
    isObj(p) &&
    typeof p.sound === 'boolean' &&
    typeof p.removeWinners === 'boolean' &&
    (p.lastBoardId === undefined || isBoardId(p.lastBoardId))
  );
}

/**
 * 驗證並正規化：未知的 lastBoardId 不使整份資料失效，而是移除該欄位。
 * @param v 待驗證的值（例如剛解析的 JSON）
 * @returns 合法時回傳正規化後的資料，否則 null
 */
export function normalizeStoredData(v: unknown): StoredData | null {
  if (isObj(v) && isObj(v.preferences) && !isBoardId(v.preferences.lastBoardId)) {
    const rest = { ...v.preferences };
    delete rest.lastBoardId;
    v = { ...v, preferences: rest };
  }
  return isStoredData(v) ? v : null;
}
