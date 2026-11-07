import { MECHANISM_IDS, MECHANISM_INFO } from './pinball/boards/types';
import { MAX_MARBLES_PER_ENTRY, MAX_MARBLES_PER_PERSON } from './pinball/physics';

/**
 * 將文字框內容解析為參加者名單：一行一位，去除前後空白並略過空行。
 * @param text 文字框原始內容（可含 \r\n）
 * @returns 參加者姓名陣列（允許同名）
 */
export function parseNames(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

export { MAX_REDRAW } from './storage/schema';

/** 名單一行解析後的結果 */
export interface Entry {
  /** 去掉 *X 後的名字 */
  name: string;
  /** 名字後面 *X 指定的彈珠數，沒寫為 1 */
  count: number;
}

/** 名字結尾的「*數字」（也接受全形 ＊ 與 ×） */
const COUNT_SUFFIX = /^(.*?)\s*[*＊×]\s*(\d+)$/;

/**
 * 解析名單：一行一位，名字後面加上 *X 表示放 X 顆彈珠（例如「王小明*3」），沒寫為 1 顆。
 * @param text 文字框原始內容
 * @returns entries 為每位參加者；error 為第一個不合法的行（*X 超出範圍或只有 *X 沒有名字），合法時為 null
 */
export function parseEntries(text: string): { entries: Entry[]; error: string | null } {
  const entries: Entry[] = [];
  let error: string | null = null;
  parseNames(text).forEach((line, i) => {
    const m = COUNT_SUFFIX.exec(line);
    if (!m) {
      entries.push({ name: line, count: 1 });
      return;
    }
    const name = m[1].trim();
    const count = Number(m[2]);
    if (!error && name === '') error = `第 ${i + 1} 行只有彈珠數，沒有名字`;
    if (!error && (count < 1 || count > MAX_MARBLES_PER_ENTRY)) {
      error = `第 ${i + 1} 行「${line}」的彈珠數需介於 1 到 ${MAX_MARBLES_PER_ENTRY}`;
    }
    entries.push({ name: name || line, count: Math.min(MAX_MARBLES_PER_ENTRY, Math.max(1, count)) });
  });
  return { entries, error };
}

/**
 * 驗證抽獎輸入。
 * @param names 參加者名單
 * @param winnerCount 抽出名額
 * @param perPerson 每人固定彈珠數，預設 1
 * @returns 錯誤訊息；合法時為 null
 */
export function validateDrawInput(names: string[], winnerCount: number, perPerson = 1): string | null {
  if (names.length === 0) return '請先輸入參加名單';
  if (!Number.isInteger(perPerson) || perPerson < 1 || perPerson > MAX_MARBLES_PER_PERSON) {
    return `每人彈珠數需介於 1 到 ${MAX_MARBLES_PER_PERSON}`;
  }
  if (!Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > names.length) {
    return `抽出名額需介於 1 到 ${names.length}`;
  }
  return null;
}

/**
 * 產生一場抽獎的種子，只在按下開始時呼叫。
 * @returns 以 crypto.getRandomValues 產生的 32 位元無號整數
 */
export function newSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

/**
 * 把一場抽獎的玩法設定寫成一行摘要（歷史紀錄與結果使用）。
 * @param mode 遊戲模式，省略為競速
 * @param perPerson 每人固定彈珠數，省略為 1
 * @param mechanisms 啟用的可選機關，省略為全部
 * @param counts 依名單 *X 設定的每人彈珠數；有值時取代 perPerson
 * @param redraw 重抽彈珠數，省略為 0
 * @returns 例如「競速，每人 3 顆，再抽一次 2 顆，機關：吹風區、輸送帶群」
 */
export function describeRules(
  mode?: string,
  perPerson?: number,
  mechanisms?: readonly string[],
  counts?: readonly number[],
  redraw?: number,
): string {
  const parts = [mode === 'survival' ? '生存' : '競速'];
  if (counts) parts.push('依名單顆數');
  else if ((perPerson ?? 1) > 1) parts.push(`每人 ${perPerson} 顆`);
  if ((redraw ?? 0) > 0) parts.push(`再抽一次 ${redraw} 顆`);
  const on = mechanisms ?? MECHANISM_IDS;
  const names = MECHANISM_IDS.filter((m) => on.includes(m)).map((m) => MECHANISM_INFO[m].name);
  parts.push(names.length === MECHANISM_IDS.length ? '全部機關' : names.length ? `機關：${names.join('、')}` : '無額外機關');
  return parts.join('，');
}
