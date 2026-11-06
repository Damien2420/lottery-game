'use client';

import dynamic from 'next/dynamic';

/**
 * 以 ssr: false 動態載入歷史紀錄頁（資料只存在瀏覽器）。
 */
const HistoryLoader = dynamic(() => import('./HistoryClient'), {
  ssr: false,
  loading: () => (
    <main className="lists">
      <h1>歷史紀錄</h1>
      <p className="message">載入中…</p>
    </main>
  ),
});

export default HistoryLoader;
