'use client';

import { useEffect, useRef, useState } from 'react';
import { PinballCanvas, type PinballRun } from '@/components/PinballCanvas';
import { newSeed, parseNames, validateDrawInput } from '@/lib/draw';
import { setDrawing } from '@/lib/drawLock';
import { BOARD_LIST, getBoard } from '@/lib/pinball/boards';
import type { BoardId } from '@/lib/pinball/boards/types';
import { ENGINE_VERSION } from '@/lib/pinball/physics';
import { addDraw, createList, removeWinnersOnce, setPreferences, updateList } from '@/lib/storage/ops';
import type { DrawRecord } from '@/lib/storage/schema';
import { useStoredData } from '@/lib/storage/useStoredData';

/** 未存檔名單寫入紀錄時使用的標題 */
const UNSAVED_TITLE = '未命名名單';
/** 存檔失敗時的提示 */
const SAVE_FAILED = '本次結果無法保存';

/** 按下開始時記下的本場快照，抽獎結束時據此寫入紀錄 */
interface DrawSnapshot {
  listId: string | null;
  listTitle: string;
  names: string[];
  boardId: BoardId;
  winnerCount: number;
  seed: number;
  /** 是否在結束後自動移除得獎者 */
  removeWinners: boolean;
  /** 開始前覆蓋名單時是否已存檔失敗 */
  saveFailed: boolean;
}

/** 本輪結果的一列 */
interface ResultRow {
  index: number;
  rank: number;
}

/**
 * 抽獎進行中的離開確認；瀏覽器會忽略自訂文字，只顯示內建提示。
 * @param e beforeunload 事件
 */
function onBeforeUnload(e: BeforeUnloadEvent): void {
  e.preventDefault();
  e.returnValue = '';
}

/** 兩份名單內容是否完全相同 */
function sameNames(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((n, i) => n === b[i]);
}

/**
 * 抽獎頁客戶端元件：選名單、台面與設定，開始抽獎並在結束後寫入紀錄。
 * 中途離開或卸載時本場作廢，不寫入任何資料。
 * @returns 抽獎頁版面
 */
export default function PlayClient(): React.JSX.Element {
  const { data, update } = useStoredData();
  /** 名單來源：空字串為直接輸入（未存檔），其餘為名單 ID */
  const [source, setSource] = useState('');
  const [text, setText] = useState('');
  const [newTitle, setNewTitle] = useState('');
  /** 使用者選的台面；null 表示沿用偏好或預設 */
  const [boardSel, setBoardSel] = useState<BoardId | null>(null);
  const [winnerCount, setWinnerCount] = useState('1');
  /** 偏好的本地覆寫，讓 localStorage 無法寫入時開關仍可切換 */
  const [soundSel, setSoundSel] = useState<boolean | null>(null);
  const [removeSel, setRemoveSel] = useState<boolean | null>(null);
  const [run, setRun] = useState<PinballRun | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ResultRow[]>([]);
  /** 本輪結果對應的名單快照，換台面後仍保留 */
  const [resultNames, setResultNames] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const snapshotRef = useRef<DrawSnapshot | null>(null);
  const runKeyRef = useRef(0);

  // 卸載時若仍在抽獎中：作廢本場，不寫入任何資料
  useEffect(
    () => () => {
      if (snapshotRef.current) {
        snapshotRef.current = null;
        setDrawing(false);
        window.removeEventListener('beforeunload', onBeforeUnload);
      }
    },
    [],
  );

  if (data === null) {
    return (
      <div className="play">
        <aside className="panel">
          <h1>開始抽獎</h1>
          <p className="message">載入中…</p>
        </aside>
        <section className="stage" />
      </div>
    );
  }

  const selectedList = data.lists.find((l) => l.id === source);
  const boardId: BoardId = boardSel ?? data.preferences.lastBoardId ?? 'classic';
  const sound = soundSel ?? data.preferences.sound;
  const removeWinners = removeSel ?? data.preferences.removeWinners;

  /** 切換名單來源，選已存名單時帶入內容 */
  const changeSource = (id: string): void => {
    setSource(id);
    const list = data.lists.find((l) => l.id === id);
    setText(list ? list.names.join('\n') : '');
    setMessage('');
  };

  /** 把未存檔的文字框存成新名單，成功後切換為該名單 */
  const saveAsList = (): void => {
    const title = newTitle.trim();
    const names = parseNames(text);
    if (title === '') return setMessage('請輸入名單標題');
    if (names.length === 0) return setMessage('請先輸入參加名單');
    const id = crypto.randomUUID();
    const r = update((d) => createList(d, title, names, new Date().toISOString(), id));
    if (!r.ok) return setMessage('名單無法保存');
    setSource(id);
    setText(names.join('\n'));
    setNewTitle('');
    setMessage(`已存成名單「${title}」`);
  };

  /** 切換偏好開關：先更新本地狀態，再寫入 preferences */
  const changePref = (key: 'sound' | 'removeWinners', v: boolean): void => {
    if (key === 'sound') {
      setSoundSel(v);
      update((d) => setPreferences(d, { sound: v }));
    } else {
      setRemoveSel(v);
      update((d) => setPreferences(d, { removeWinners: v }));
    }
  };

  /** 換台面；上一場已結束時清掉 run，讓畫布顯示新台面 */
  const changeBoard = (id: BoardId): void => {
    setBoardSel(id);
    setRun(null);
  };

  /** 按下開始：驗證、必要時覆蓋名單、產生種子並交給畫布 */
  const start = (): void => {
    const names = parseNames(text);
    const count = Number(winnerCount);
    const err = validateDrawInput(names, count);
    if (err) return setMessage(err);
    let saveFailed = false;
    if (selectedList && !sameNames(names, selectedList.names)) {
      const r = update((d) => updateList(d, selectedList.id, { names }, new Date().toISOString()));
      saveFailed = !r.ok;
    }
    const seed = newSeed();
    snapshotRef.current = {
      listId: selectedList?.id ?? null,
      listTitle: selectedList?.title ?? UNSAVED_TITLE,
      names,
      boardId,
      winnerCount: count,
      seed,
      removeWinners,
      saveFailed,
    };
    setDrawing(true);
    window.addEventListener('beforeunload', onBeforeUnload);
    setRunning(true);
    setResults([]);
    setResultNames(names);
    setMessage('');
    runKeyRef.current += 1;
    setRun({ key: runKeyRef.current, names, boardId, seed, winnerCount: count });
  };

  /** 名額內的彈珠抵達時加入本輪結果 */
  const onArrive = (index: number, rank: number): void => {
    setResults((r) => [...r, { index, rank }]);
  };

  /** 全部得獎者產生：寫入紀錄、自動移除得獎者、記住台面，最後解除鎖定 */
  const onDone = (winners: number[]): void => {
    const s = snapshotRef.current;
    if (!s) return;
    snapshotRef.current = null;
    const now = new Date().toISOString();
    const record: DrawRecord = {
      id: crypto.randomUUID(),
      createdAt: now,
      listId: s.listId,
      listTitle: s.listTitle,
      names: s.names,
      boardId: s.boardId,
      boardVersion: getBoard(s.boardId)?.version ?? 1,
      engineVersion: ENGINE_VERSION,
      winnerCount: s.winnerCount,
      seed: s.seed,
      winners,
    };
    const winnerNames = winners.map((i) => s.names[i]);
    // 紀錄、名單移除與偏好合併為一次寫入，避免部分成功
    const r = update((d) => {
      let next = addDraw(d, record);
      if (s.removeWinners && s.listId) {
        const list = next.lists.find((l) => l.id === s.listId);
        if (list) next = updateList(next, list.id, { names: removeWinnersOnce(list.names, winnerNames) }, now);
      }
      return setPreferences(next, { lastBoardId: s.boardId });
    });
    if (s.removeWinners) setText(removeWinnersOnce(s.names, winnerNames).join('\n'));
    if (!r.ok || s.saveFailed) setMessage(SAVE_FAILED);
    setDrawing(false);
    window.removeEventListener('beforeunload', onBeforeUnload);
    setRunning(false);
  };

  return (
    <div className="play">
      <aside className="panel">
        <h1>開始抽獎</h1>
        {running && <p className="message">抽獎進行中，離開頁面將作廢本場</p>}
        <fieldset className="fields" disabled={running}>
          <label className="field">
            名單來源
            <select value={selectedList ? source : ''} onChange={(e) => changeSource(e.target.value)}>
              <option value="">直接輸入（未存檔）</option>
              {data.lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>
              參加名單（一行一位）<em>{parseNames(text).length} 人</em>
            </span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          {!selectedList && (
            <div className="field">
              <input
                type="text"
                placeholder="名單標題"
                aria-label="名單標題"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <button type="button" className="secondary" onClick={saveAsList}>
                存成名單
              </button>
            </div>
          )}
          <label className="field">
            台面
            <select value={boardId} onChange={(e) => changeBoard(e.target.value as BoardId)}>
              {BOARD_LIST.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field inline">
            抽出名額
            <input type="number" min={1} value={winnerCount} onChange={(e) => setWinnerCount(e.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={removeWinners} onChange={(e) => changePref('removeWinners', e.target.checked)} />
            得獎者自動從名單移除
          </label>
          <label className="check">
            <input type="checkbox" checked={sound} onChange={(e) => changePref('sound', e.target.checked)} />
            音效
          </label>
          <button type="button" onClick={start}>
            開始抽獎
          </button>
        </fieldset>
        <p className="message">{message}</p>
        <h2>本輪結果</h2>
        <ol className="results">
          {results.map((r) => (
            <li key={r.rank}>
              <span className="rank">第 {r.rank} 名</span>
              {resultNames[r.index]}
            </li>
          ))}
        </ol>
      </aside>
      <section className="stage">
        <PinballCanvas boardId={boardId} run={run} sound={sound} onArrive={onArrive} onDone={onDone} />
      </section>
    </div>
  );
}

