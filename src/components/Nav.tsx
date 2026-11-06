'use client';

import Link from 'next/link';
import type { MouseEvent } from 'react';
import { isDrawing, LEAVE_MESSAGE } from '@/lib/drawLock';

/** 導覽列項目 */
const LINKS = [
  { href: '/', label: '首頁' },
  { href: '/play', label: '開始抽獎' },
  { href: '/lists', label: '名單管理' },
  { href: '/history', label: '歷史紀錄' },
  { href: '/settings', label: '備份設定' },
] as const;

/**
 * 抽獎進行中點擊連結時先確認，取消則阻止換頁。
 * @param e 連結點擊事件
 */
function guardLeave(e: MouseEvent<HTMLAnchorElement>): void {
  if (isDrawing() && !window.confirm(LEAVE_MESSAGE)) e.preventDefault();
}

/**
 * 全站導覽列。
 * @returns 各頁面連結
 */
export function Nav(): React.JSX.Element {
  return (
    <nav className="nav">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} onClick={guardLeave}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
