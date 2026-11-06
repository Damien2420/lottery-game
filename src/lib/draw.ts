import { MAX_PLAYERS } from './pinball/physics';

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

/**
 * 驗證抽獎輸入。
 * @param names 參加者名單
 * @param winnerCount 抽出名額
 * @returns 錯誤訊息；合法時為 null
 */
export function validateDrawInput(names: string[], winnerCount: number): string | null {
  if (names.length === 0) return '請先輸入參加名單';
  if (names.length > MAX_PLAYERS) return `最多 ${MAX_PLAYERS} 人`;
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
