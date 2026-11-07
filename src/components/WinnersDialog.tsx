'use client';

import { useEffect, useRef } from 'react';

/** 得獎名單的一列 */
export interface WinnerRow {
  /** 名次（從 1 開始） */
  rank: number;
  /** 參加者名字 */
  name: string;
  /** 抵達時間（已格式化） */
  time: string;
}

/** WinnersDialog 元件的參數 */
interface WinnersDialogProps {
  /** 是否顯示 */
  open: boolean;
  /** 標題，預設「得獎名單」 */
  title?: string;
  /** 再抽一場按鈕的文字，預設「用同樣設定再抽一場」 */
  replayLabel?: string;
  /** 標題下方的說明（台面、人數、總時間） */
  summary: string;
  /** 依名次排列的得獎者；空陣列時不顯示名單（例如抽到重抽） */
  rows: WinnerRow[];
  /** 再抽一場 */
  onReplay: () => void;
  /** 關閉視窗（按鈕、Esc 或點背景） */
  onClose: () => void;
}

/** 名單逐列進場的最大延遲列數，避免名額很多時等太久 */
const STAGGER_MAX = 8;

/**
 * 全部彈珠抵達後跳出的得獎名單視窗；抽到重抽時也用同一個視窗，只顯示說明與再抽按鈕。
 * 使用原生 dialog 的 showModal：自帶焦點鎖定、Esc 關閉與背景遮罩；點背景也會關閉。
 * @param props 顯示狀態、說明文字、得獎者與兩個操作的回呼
 * @returns 對話框元素
 */
export default function WinnersDialog({
  open,
  title = '得獎名單',
  replayLabel = '用同樣設定再抽一場',
  summary,
  rows,
  onReplay,
  onClose,
}: WinnersDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  // 依 open 開關原生對話框
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="winners"
      aria-labelledby="winners-title"
      onClose={onClose}
      // 點到對話框本身（背景遮罩區域）才關閉，點內容不關閉
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="winners-body">
        <header className="winners-head">
          <h2 id="winners-title">{title}</h2>
          <p>{summary}</p>
        </header>
        {rows.length > 0 && (
          <ol className="winners-list">
            {rows.map((r, i) => (
              <li key={r.rank} style={{ animationDelay: `${120 + Math.min(i, STAGGER_MAX) * 60}ms` }}>
                <span className="winners-rank">第 {r.rank} 名</span>
                <span className="winners-name">{r.name}</span>
                <span className="winners-time">{r.time}</span>
              </li>
            ))}
          </ol>
        )}
        <div className="winners-actions">
          <button type="button" className="secondary" onClick={onClose}>
            查看台面
          </button>
          <button type="button" onClick={onReplay} autoFocus>
            {replayLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
