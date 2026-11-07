import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Nav } from '@/components/Nav';
import { armBackGuard, isDrawing, LEAVE_MESSAGE, setDrawing } from '@/lib/drawLock';

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
    expect(hrefs).toEqual(['/', '/lists', '/history', '/settings', '/play']);
  });

  it('抽獎中點擊 Nav 連結且取消確認時不換頁', () => {
    render(createElement(Nav));
    setDrawing(true);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(clickLink('名單')).toBe(true);
    expect(confirm).toHaveBeenCalledWith(LEAVE_MESSAGE);
  });

  it('未抽獎時點擊 Nav 連結不詢問', () => {
    render(createElement(Nav));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    // 在 document 層阻止預設動作，避免 jsdom 嘗試實際換頁
    const stop = (e: Event): void => e.preventDefault();
    document.addEventListener('click', stop);
    clickLink('名單');
    document.removeEventListener('click', stop);
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe('armBackGuard', () => {
  it('啟用時推入哨兵紀錄，解除時彈掉它', () => {
    const push = vi.spyOn(history, 'pushState');
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);
    const disarm = armBackGuard(() => undefined);
    expect(push).toHaveBeenCalledTimes(1);
    disarm();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('哨兵已不在最上層（已換頁）時，解除不後退', () => {
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);
    const disarm = armBackGuard(() => undefined);
    history.replaceState(null, '', location.href);
    disarm();
    expect(back).not.toHaveBeenCalled();
  });

  it('抽獎中按上一頁並取消：留在原頁、重新推入哨兵、鎖定不變', () => {
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onLeave = vi.fn();
    const disarm = armBackGuard(onLeave);
    setDrawing(true);
    const push = vi.spyOn(history, 'pushState');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(confirm).toHaveBeenCalledWith(LEAVE_MESSAGE);
    expect(push).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();
    expect(isDrawing()).toBe(true);
    disarm();
  });

  it('抽獎中按上一頁並確定：解除鎖定、通知離開並後退一次', () => {
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onLeave = vi.fn();
    armBackGuard(onLeave);
    setDrawing(true);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(back).toHaveBeenCalledTimes(1);
    expect(isDrawing()).toBe(false);
    // 監聽已移除，再觸發 popstate 不會重複詢問
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('未在抽獎或已解除後，popstate 不詢問', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(history, 'back').mockImplementation(() => undefined);
    const disarm = armBackGuard(() => undefined);
    window.dispatchEvent(new PopStateEvent('popstate'));
    disarm();
    setDrawing(true);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(confirm).not.toHaveBeenCalled();
  });
});
