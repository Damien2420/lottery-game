'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from './PageSkeleton';

/**
 * 以 ssr: false 動態載入歷史紀錄頁（資料只存在瀏覽器）。
 */
const HistoryLoader = dynamic(() => import('./HistoryClient'), {
  ssr: false,
  loading: () => <PageSkeleton title="歷史紀錄" variant="rows" />,
});

export default HistoryLoader;
