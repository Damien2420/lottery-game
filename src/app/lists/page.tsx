import type { Metadata } from 'next';
import ListsLoader from '@/components/ListsLoader';

export const metadata: Metadata = { title: '名單管理', robots: { index: false } };

/**
 * 名單管理頁（伺服器元件），實際內容只在客戶端渲染。
 * @returns 名單管理頁
 */
export default function ListsPage(): React.JSX.Element {
  return <ListsLoader />;
}
