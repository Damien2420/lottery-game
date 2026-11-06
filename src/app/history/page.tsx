import type { Metadata } from 'next';
import { Suspense } from 'react';
import HistoryLoader from '@/components/HistoryLoader';

export const metadata: Metadata = { title: '歷史紀錄', robots: { index: false } };

/**
 * 歷史紀錄頁（伺服器元件），實際內容只在客戶端渲染；讀取查詢參數需包在 Suspense 中。
 * @returns 歷史紀錄頁
 */
export default function HistoryPage(): React.JSX.Element {
  return (
    <Suspense>
      <HistoryLoader />
    </Suspense>
  );
}
