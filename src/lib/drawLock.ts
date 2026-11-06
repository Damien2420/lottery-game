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

/** 標記抽獎保護用歷史紀錄項目的 state 欄位名稱 */
const GUARD_KEY = 'drawGuard';

/**
 * 啟用「瀏覽器上一頁／下一頁」的離開確認：先推入一筆同網址的哨兵紀錄，
 * 抽獎期間使用者按上一頁時只會退回原本那筆，此時詢問是否離開。
 * - 取消：再推入哨兵，留在原頁。
 * - 確定：解除鎖定、通知呼叫端（onLeave），並呼叫 history.back() 真正離開，本場作廢。
 * @param onLeave 使用者確認離開時的收尾回呼（清除快照與 beforeunload 監聽等）
 * @returns 解除函式：移除監聽，若哨兵仍在最上層則 history.back() 彈掉它，避免留下多餘的歷史紀錄
 */
export function armBackGuard(onLeave: () => void): () => void {
  const pushGuard = (): void => history.pushState({ [GUARD_KEY]: true }, '', location.href);
  const onPop = (): void => {
    if (!isDrawing()) return;
    if (window.confirm(LEAVE_MESSAGE)) {
      window.removeEventListener('popstate', onPop);
      setDrawing(false);
      onLeave();
      history.back();
    } else {
      pushGuard();
    }
  };
  pushGuard();
  window.addEventListener('popstate', onPop);
  return () => {
    window.removeEventListener('popstate', onPop);
    // 已換頁（如 Nav 確認離開）時 state 不再是哨兵，不可再後退
    const state = history.state as Record<string, unknown> | null;
    if (state && state[GUARD_KEY]) history.back();
  };
}
