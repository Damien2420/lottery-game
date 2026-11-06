'use client';

import dynamic from 'next/dynamic';

/**
 * 以 ssr: false 動態載入抽獎頁（伺服器元件不可使用 ssr: false，故包一層客戶端元件）。
 * 載入期間顯示與 PlayClient 相同的載入中版面。
 */
const PlayLoader = dynamic(() => import('./PlayClient'), {
  ssr: false,
  loading: () => (
    <div className="play">
      <aside className="panel">
        <h1>開始抽獎</h1>
        <p className="message">載入中…</p>
      </aside>
      <section className="stage" />
    </div>
  ),
});

export default PlayLoader;
