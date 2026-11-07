'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from './PageSkeleton';

/**
 * 以 ssr: false 動態載入名單管理頁（資料只存在瀏覽器）。
 */
const ListsLoader = dynamic(() => import('./ListsClient'), {
  ssr: false,
  loading: () => <PageSkeleton title="名單管理" variant="rowsWithAction" />,
});

export default ListsLoader;
