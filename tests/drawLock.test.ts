import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Nav } from '@/components/Nav';
import { isDrawing, LEAVE_MESSAGE, setDrawing } from '@/lib/drawLock';

afterEach(() => {
  cleanup();
  setDrawing(false);
  vi.restoreAllMocks();
});

/** 點擊連結並回傳事件是否被取消 */
function clickLink(name: string): boolean {
  const link = screen.getByRole('link', { name });
  const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  fireEvent(link, ev);
  return ev.defaultPrevented;
}

describe('drawLock', () => {
  it('預設未在抽獎中，可切換狀態', () => {
    expect(isDrawing()).toBe(false);
    setDrawing(true);
    expect(isDrawing()).toBe(true);
    setDrawing(false);
    expect(isDrawing()).toBe(false);
  });

  it('Nav 包含所有頁面連結', () => {
    render(createElement(Nav));
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/', '/play', '/lists', '/history', '/settings']);
  });

  it('抽獎中點擊 Nav 連結且取消確認時不換頁', () => {
    render(createElement(Nav));
    setDrawing(true);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(clickLink('名單管理')).toBe(true);
    expect(confirm).toHaveBeenCalledWith(LEAVE_MESSAGE);
  });

  it('未抽獎時點擊 Nav 連結不詢問', () => {
    render(createElement(Nav));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    // 在 document 層阻止預設動作，避免 jsdom 嘗試實際換頁
    const stop = (e: Event): void => e.preventDefault();
    document.addEventListener('click', stop);
    clickLink('名單管理');
    document.removeEventListener('click', stop);
    expect(confirm).not.toHaveBeenCalled();
  });
});
