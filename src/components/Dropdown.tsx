'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

/** 下拉選單的一個選項 */
export interface DropdownOption {
  /** 選項值 */
  value: string;
  /** 顯示文字 */
  label: string;
  /** 右側的次要資訊（例如人數），可省略 */
  meta?: string;
}

/** Dropdown 元件的參數 */
interface DropdownProps {
  /** 目前選取的值 */
  value: string;
  /** 所有選項 */
  options: DropdownOption[];
  /** 選取新值時呼叫 */
  onChange: (value: string) => void;
  /** 標示這個選單的元素 id（aria-labelledby） */
  labelledBy: string;
}

/**
 * 自訂樣式的單選下拉選單，取代原生 select 的系統彈出清單。
 * 依 WAI-ARIA 的 select-only combobox 模式：觸發按鈕為 combobox，展開的清單為 listbox；
 * 支援上下鍵、Home、End、Enter／空白鍵選取、Esc 關閉，點擊外部或焦點離開時收起。
 * @param props 目前值、選項、變更回呼與標籤 id
 * @returns 下拉選單元素
 */
export default function Dropdown({ value, options, onChange, labelledBy }: DropdownProps) {
  const id = useId();
  const listId = `${id}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const [active, setActive] = useState(selectedIndex);
  const selected = options[selectedIndex];

  // 點擊選單外部時收起
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // 鍵盤移動時讓目前項目保持在清單可視範圍內
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  /** 展開清單，並把目前項目定位到已選取的選項 */
  const show = (): void => {
    setActive(selectedIndex);
    setOpen(true);
  };

  /**
   * 選取指定索引的選項並收起清單。
   * @param i 選項索引
   */
  const choose = (i: number): void => {
    const o = options[i];
    if (o && o.value !== value) onChange(o.value);
    setOpen(false);
  };

  /**
   * 觸發按鈕的鍵盤操作。
   * @param e 鍵盤事件
   */
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>): void => {
    const last = options.length - 1;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((a) => Math.min(last, a + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(last);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        choose(active);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div className="dropdown" ref={rootRef} data-open={open || undefined}>
      <button
        type="button"
        className="dropdown-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelledBy}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
        }}
      >
        <span className="dropdown-value">{selected?.label}</span>
        {selected?.meta && <span className="dropdown-meta">{selected.meta}</span>}
        <svg className="dropdown-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className="dropdown-panel" id={listId} role="listbox" aria-labelledby={labelledBy} ref={listRef} tabIndex={-1}>
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-opt-${i}`}
              data-index={i}
              role="option"
              aria-selected={o.value === value}
              data-active={i === active || undefined}
              className="dropdown-option"
              onPointerEnter={() => setActive(i)}
              // 阻止按下時讓觸發按鈕失焦，避免清單在點選前就收起
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
            >
              <span className="dropdown-value">{o.label}</span>
              {o.meta && <span className="dropdown-meta">{o.meta}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
