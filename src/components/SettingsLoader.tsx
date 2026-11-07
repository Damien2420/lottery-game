'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from './PageSkeleton';

/**
 * 以 ssr: false 動態載入備份設定頁（資料只存在瀏覽器）。
 */
const SettingsLoader = dynamic(() => import('./SettingsClient'), {
  ssr: false,
  loading: () => <PageSkeleton title="備份設定" variant="settings" />,
});

export default SettingsLoader;
