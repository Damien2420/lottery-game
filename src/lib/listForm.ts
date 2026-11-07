import { parseNames } from '@/lib/draw';

/** 標題留空時使用的預設標題 */
export const DEFAULT_LIST_TITLE = '未命名名單';

/** 名單表單驗證結果 */
export type ListFormResult = { ok: true; title: string; names: string[] } | { ok: false; error: string };

/**
 * 驗證並整理名單編輯表單。標題空白時以預設標題取代；名單可為空。
 * @param title 標題輸入
 * @param text 一行一位的名單文字
 * @returns 通過時回傳整理後的標題與名單；否則回傳錯誤訊息
 */
export function validateListForm(title: string, text: string): ListFormResult {
  const names = parseNames(text);
  return { ok: true, title: title.trim() || DEFAULT_LIST_TITLE, names };
}
