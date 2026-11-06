import type { Metadata } from 'next';
import SettingsLoader from '@/components/SettingsLoader';

export const metadata: Metadata = { title: '備份設定', robots: { index: false } };

/**
 * 備份設定頁（伺服器元件），實際內容只在客戶端渲染。
 * @returns 備份設定頁
 */
export default function SettingsPage(): React.JSX.Element {
  return <SettingsLoader />;
}
