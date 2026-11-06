'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { PinballCanvas, type PinballRun } from '@/components/PinballCanvas';
import { getBoard } from '@/lib/pinball/boards';
import type { BoardId } from '@/lib/pinball/boards/types';
import { checkReplayable, sameWinners } from '@/lib/replay';
import { deleteDraw } from '@/lib/storage/ops';
import type { DrawRecord } from '@/lib/storage/schema';
import { useStoredData } from '@/lib/storage/useStoredData';

/** 存檔失敗時的提示 */
const SAVE_FAILED = '無法保存，請確認瀏覽器允許儲存資料';
/** 重播結果與紀錄不同時的提示 */
const MISMATCH = '此重播與原始結果不同（可能因瀏覽器或版本差異），以紀錄中的排名為準';

/**
 * 把 ISO 時間轉成本地顯示字串。
 * @param iso ISO 時間字串
 * @returns 本地日期時間
 */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', { hour12: false });
}

/**
 * 取得台面顯示名稱；台面已被移除時顯示替代文字。
 * @param id 紀錄中的台面 ID
 * @returns 台面名稱
 */
function boardName(id: string): string {
  return getBoard(id)?.name ?? '已移除的台面';
}

/**
 * 把得獎索引轉成得獎者名稱。
 * @param r 抽獎紀錄
 * @returns 依名次排列的名稱
 */
function winnerNames(r: DrawRecord): string[] {
  return r.winners.map((i) => r.names[i]);
}

/**
 * 歷史紀錄頁客戶端元件：沒有 ?id 時列出紀錄，有 ?id 時顯示單場排名並提供重播。
 * @returns 歷史紀錄頁版面
 */
export default function HistoryClient(): React.JSX.Element {
  const { data, update } = useStoredData();
  const id = useSearchParams().get('id');
  const [message, setMessage] = useState('');

  if (data === null) {
    return (
      <main className="lists">
        <h1>歷史紀錄</h1>
        <p className="message">載入中…</p>
      </main>
    );
  }

  /** 確認後刪除一筆紀錄（唯一會寫入資料的操作） */
  const remove = (recordId: string): void => {
    if (!window.confirm('確定要刪除這筆紀錄嗎？')) return;
    const r = update((d) => deleteDraw(d, recordId));
    setMessage(r.ok ? '' : SAVE_FAILED);
  };

  if (id !== null) {
    const record = data.draws.find((d) => d.id === id);
    if (!record) {
      return (
        <main className="lists">
          <h1>歷史紀錄</h1>
          <p>找不到這筆紀錄</p>
          <div>
            <Link href="/history">回到歷史紀錄</Link>
          </div>
        </main>
      );
    }
    return <ReplayView key={record.id} record={record} />;
  }

  return (
    <main className="lists">
      <h1>歷史紀錄</h1>
      <p className="message">{message}</p>
      {data.draws.length === 0 ? (
        <p>目前沒有抽獎紀錄。</p>
      ) : (
        <ul className="list-rows">
          {data.draws.map((d) => (
            <li key={d.id}>
              <div className="info">
                <strong>{d.listTitle}</strong>
                <span>
                  {formatTime(d.createdAt)}，{boardName(d.boardId)}
                </span>
                <span>得獎者：{winnerNames(d).join('、')}</span>
              </div>
              <div className="actions">
                <Link href={`/history?id=${encodeURIComponent(d.id)}`}>查看與重播</Link>
                <button type="button" className="secondary" onClick={() => remove(d.id)}>
                  刪除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/** 重播中即時產生的名次 */
interface LiveRow {
  index: number;
  rank: number;
}

/**
 * 單場紀錄檢視：顯示紀錄排名，並以紀錄中的種子與設定重播。重播不寫入任何資料。
 * @param props.record 要檢視的紀錄
 * @returns 單場檢視版面
 */
function ReplayView({ record }: { record: DrawRecord }): React.JSX.Element {
  const check = checkReplayable(record);
  const [run, setRun] = useState<PinballRun | null>(null);
  const [live, setLive] = useState<LiveRow[]>([]);
  const [finished, setFinished] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  /** 重播音效預設關閉 */
  const [sound, setSound] = useState(false);
  const [key, setKey] = useState(0);

  /** 開始或重新開始重播（新 key 讓畫布重開一場） */
  const replay = (): void => {
    const next = key + 1;
    setKey(next);
    setLive([]);
    setFinished(false);
    setMismatch(false);
    setRun({
      key: next,
      names: record.names,
      boardId: record.boardId as BoardId,
      seed: record.seed,
      winnerCount: record.winnerCount,
    });
  };

  /** 名額內的彈珠抵達時加入即時名次 */
  const onArrive = (index: number, rank: number): void => {
    setLive((l) => [...l, { index, rank }]);
  };

  /** 重播結束：與紀錄比對 */
  const onDone = (winners: number[]): void => {
    setFinished(true);
    setMismatch(!sameWinners(winners, record.winners));
  };

  return (
    <div className="play">
      <aside className="panel">
        <h1>歷史紀錄</h1>
        <Link href="/history">回到歷史紀錄</Link>
        <p className="message">
          {record.listTitle}，{formatTime(record.createdAt)}，{boardName(record.boardId)}
        </p>
        <h2>紀錄排名</h2>
        <ol className="results">
          {record.winners.map((w, i) => (
            <li key={i}>
              <span className="rank">第 {i + 1} 名</span>
              {record.names[w]}
            </li>
          ))}
        </ol>
        {!check.ok && (
          <p className="message" role="alert">
            {check.message}
          </p>
        )}
        <label className="check">
          <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
          音效
        </label>
        <button type="button" disabled={!check.ok} onClick={replay}>
          {run ? '重新重播' : '重播'}
        </button>
        {run && (
          <>
            <h2>重播名次</h2>
            <ol className="results">
              {live.map((r) => (
                <li key={r.rank}>
                  <span className="rank">第 {r.rank} 名</span>
                  {record.names[r.index]}
                </li>
              ))}
            </ol>
          </>
        )}
        {finished && mismatch && (
          <p className="message" role="alert">
            {MISMATCH}
          </p>
        )}
      </aside>
      <section className="stage">
        {check.ok && (
          <PinballCanvas boardId={record.boardId as BoardId} run={run} sound={sound} onArrive={onArrive} onDone={onDone} />
        )}
      </section>
    </div>
  );
}
