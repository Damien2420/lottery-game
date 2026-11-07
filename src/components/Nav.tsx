'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MouseEvent } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { isDrawing, LEAVE_MESSAGE } from '@/lib/drawLock';

/** 導覽列的一般連結 */
const LINKS = [
  { href: '/lists', label: '名單' },
  { href: '/history', label: '歷史紀錄' },
  { href: '/settings', label: '備份' },
] as const;

/**
 * 抽獎進行中點擊連結時先確認，取消則阻止換頁。
 * @param e 連結點擊事件
 */
function guardLeave(e: MouseEvent<HTMLAnchorElement>): void {
  if (isDrawing() && !window.confirm(LEAVE_MESSAGE)) e.preventDefault();
}

/**
 * 全站導覽列：左側品牌回首頁，右側一般連結、深淺色切換與「開始抽獎」膠囊按鈕；目前頁面以 aria-current 標示。
 * @returns 導覽列
 */
export function Nav(): React.JSX.Element {
  // 測試環境或尚未掛載路由時可能為 null
  const path = usePathname() ?? '';
  const current = (href: string) => (path === href || path.startsWith(`${href}/`) ? 'page' : undefined);
  return (
    <nav className="nav" aria-label="主要">
      <Link href="/" className="brand" onClick={guardLeave}>
        <span className="marble-dot" aria-hidden="true" />
        <span className="brand-name">抽獎彈珠台</span>
      </Link>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="link" aria-current={current(l.href)} onClick={guardLeave}>
          {l.label}
        </Link>
      ))}
      <ThemeToggle />
      <Link href="/play" className="pill" aria-current={current('/play')} onClick={guardLeave}>
        開始抽獎
      </Link>
    </nav>
  );
}
