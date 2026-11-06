import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: '彈珠台抽獎',
};

/**
 * 全站根版面。
 * @param props.children 子頁面內容
 * @returns 帶有 zh-Hant 語系的 html 結構
 */
export default function RootLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
