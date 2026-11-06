'use client';

import dynamic from 'next/dynamic';

/**
 * 以 ssr: false 動態載入名單管理頁（資料只存在瀏覽器）。
 */
const ListsLoader = dynamic(() => import('./ListsClient'), {
  ssr: false,
  loading: () => (
    <main className="lists">
      <h1>名單管理</h1>
      <p className="message">載入中…</p>
    </main>
  ),
});

export default ListsLoader;
