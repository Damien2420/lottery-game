import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Nav } from '@/components/Nav';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '抽獎彈珠台｜免費線上抽獎工具',
    template: '%s｜抽獎彈珠台',
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    locale: 'zh_TW',
    type: 'website',
    siteName: SITE_NAME,
  },
};

/**
 * 全站根版面。
 * @param props.children 子頁面內容
 * @returns 帶有 zh-Hant 語系的 html 結構
 */
export default function RootLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <html lang="zh-Hant">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
