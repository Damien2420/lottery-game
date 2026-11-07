'use client';

import { useEffect, useSyncExternalStore } from 'react';

/** 深淺色模式 */
type Theme = 'light' | 'dark';

/** 使用者選擇的模式存在 localStorage 的鍵；未選擇時跟隨系統 */
export const THEME_KEY = 'theme';

/**
 * 首次繪製前執行的腳本：依已存的選擇或系統偏好設定 <html data-theme>，避免先閃一下淺色。
 * 放在 <head> 以 inline script 輸出，內容需保持自給自足。
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}})()`;

/** 監聽 <html data-theme> 的變動（供 useSyncExternalStore 訂閱） */
function subscribe(onChange: () => void): () => void {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => mo.disconnect();
}

/** 目前套用中的模式 */
function current(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/**
 * 讀取使用者已存的選擇；無法存取 localStorage 時視為未選擇。
 * @returns 已選擇的模式，未選擇為 null
 */
function stored(): Theme | null {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

/**
 * 深淺色切換按鈕：點一下在淺色與深色間切換並記住；從未切換過時跟隨系統設定（含系統即時變更）。
 * @returns 圓形圖示按鈕
 */
export function ThemeToggle(): React.JSX.Element {
  // 伺服器端不知道模式，先以淺色輸出，掛載後換成實際值
  const theme = useSyncExternalStore(subscribe, current, () => 'light' as Theme);

  // 使用者沒選過時，系統切換深淺色就跟著切
  useEffect(() => {
    // 不支援 matchMedia 的環境（舊瀏覽器、測試環境）就不跟隨系統變更
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent): void => {
      if (!stored()) document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  /** 切換並記住選擇 */
  const toggle = (): void => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // 無法存檔（例如無痕模式限制）時只切換本次瀏覽
    }
  };

  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={dark ? '切換為淺色模式' : '切換為深色模式'}
      title={dark ? '切換為淺色模式' : '切換為深色模式'}
    >
      {dark ? (
        // 太陽：目前是深色，點了換淺色
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
        </svg>
      ) : (
        // 月亮：目前是淺色，點了換深色
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6Z" />
        </svg>
      )}
    </button>
  );
}
