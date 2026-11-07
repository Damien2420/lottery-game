import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';
import { Noto_Sans_TC } from 'next/font/google';
import type { ReactNode } from 'react';
import { Nav } from '@/components/Nav';
import { THEME_INIT_SCRIPT } from '@/components/ThemeToggle';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import './globals.css';

/** 全站字體；中文字形量大，不預先載入，由 unicode-range 依實際用字下載 */
const sans = Noto_Sans_TC({
  weight: ['400', '500', '700', '900'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-sans',
});

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
  twitter: { card: 'summary_large_image' },
};

/**
 * 全站根版面。
 * @param props.children 子頁面內容
 * @returns 帶有 zh-Hant 語系的 html 結構
 */
export default function RootLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    // data-theme 由首次繪製前的腳本設定，與伺服器輸出不同屬正常，不需警告
    <html lang="zh-Hant" className={sans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Nav />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
