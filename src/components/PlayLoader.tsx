'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from './PageSkeleton';

/**
 * 以 ssr: false 動態載入抽獎頁（伺服器元件不可使用 ssr: false，故包一層客戶端元件）。
 * 載入期間顯示與 PlayClient 相同的載入中版面。
 */
const PlayLoader = dynamic(() => import('./PlayClient'), {
  ssr: false,
  loading: () => <PageSkeleton title="開始抽獎" variant="setup" />,
});

export default PlayLoader;
