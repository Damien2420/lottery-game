/** 離開抽獎頁時的確認文字 */
export const LEAVE_MESSAGE = '抽獎尚未結束，離開將作廢本場。確定要離開嗎？';

/** 是否有抽獎正在進行（全站共用，供 Nav 在換頁前確認） */
let drawing = false;

/**
 * 設定抽獎進行狀態。
 * @param v true 表示抽獎開始，false 表示結束或作廢
 */
export function setDrawing(v: boolean): void {
  drawing = v;
}

/**
 * 查詢抽獎是否正在進行。
 * @returns 進行中為 true
 */
export function isDrawing(): boolean {
  return drawing;
}
