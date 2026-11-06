import type { Metadata } from 'next';
import { Suspense } from 'react';
import PlayLoader from '@/components/PlayLoader';

export const metadata: Metadata = { title: '開始抽獎', robots: { index: false } };

/**
 * 抽獎頁（伺服器元件），實際內容只在客戶端渲染。
 * @returns 抽獎頁
 */
export default function PlayPage(): React.JSX.Element {
  return (
    <Suspense>
      <PlayLoader />
    </Suspense>
  );
}
