'use client';

import dynamic from 'next/dynamic';

/**
 * 以 ssr: false 動態載入備份設定頁（資料只存在瀏覽器）。
 */
const SettingsLoader = dynamic(() => import('./SettingsClient'), {
  ssr: false,
  loading: () => (
    <main className="lists">
      <h1>備份設定</h1>
      <p className="message">載入中…</p>
    </main>
  ),
});

export default SettingsLoader;
