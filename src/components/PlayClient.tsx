'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Dropdown from '@/components/Dropdown';
import { PinballCanvas, formatTime, type PinballRun } from '@/components/PinballCanvas';
import WinnersDialog from '@/components/WinnersDialog';
import { describeRules, MAX_REDRAW, newSeed, parseEntries, parseNames, validateDrawInput } from '@/lib/draw';
import { validateListForm } from '@/lib/listForm';
import { armBackGuard, setDrawing } from '@/lib/drawLock';
import { BOARD_LIST, getBoard } from '@/lib/pinball/boards';
import { MECHANISM_IDS, MECHANISM_INFO, type BoardId, type MechanismId } from '@/lib/pinball/boards/types';
import type { FinalResult } from '@/lib/pinball/game';
import { ENGINE_VERSION, MAX_MARBLES_PER_PERSON } from '@/lib/pinball/physics';
import { addDraw, createList, setPreferences, updateList } from '@/lib/storage/ops';
import type { DrawMode, DrawRecord } from '@/lib/storage/schema';
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
  mode: DrawMode;
  /** 每人固定彈珠數（未開啟固定時為 1，以 counts 為準） */
  perPerson: number;
  /** 依名單 *X 設定的每人彈珠數；全部 1 顆或開啟固定時省略 */
  counts?: number[];
  /** 重抽彈珠數 */
  redraw: number;
  /** 啟用的可選機關 */
  mechanisms: MechanismId[];
  /** 開始前覆蓋名單時是否已存檔失敗 */
  saveFailed: boolean;
}

/** 本輪結果的一列 */
interface ResultRow {
  index: number;
  rank: number;
}

/** 遊戲模式選項 */
const MODE_OPTIONS: { mode: DrawMode; label: string; desc: string }[] = [
  { mode: 'race', label: '競速', desc: '最先抵達終點的人得獎' },
  { mode: 'survival', label: '生存', desc: '最後抵達終點的人得獎，每人以最後一顆抵達為準，所有人抵達才結束' },
];

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
  const listParam = useSearchParams().get('list');
  /** 是否已處理過網址的 ?list 預選 */
  const [paramApplied, setParamApplied] = useState(false);
  /** 名單來源：空字串為直接輸入（未存檔），其餘為名單 ID */
  const [source, setSource] = useState('');
  const [text, setText] = useState('');
  const [newTitle, setNewTitle] = useState('');
  /** 使用者選的台面；null 表示沿用偏好或預設 */
  const [boardSel, setBoardSel] = useState<BoardId | null>(null);
  const [winnerCount, setWinnerCount] = useState('1');
  /** 偏好的本地覆寫，讓 localStorage 無法寫入時開關仍可切換 */
  const [soundSel, setSoundSel] = useState<boolean | null>(null);
  const [modeSel, setModeSel] = useState<DrawMode | null>(null);
  const [perSel, setPerSel] = useState<number | null>(null);
  const [fixedSel, setFixedSel] = useState<boolean | null>(null);
  const [redrawSel, setRedrawSel] = useState<number | null>(null);
  /** 重抽彈珠輸入框正在輸入的文字；null 表示顯示目前的值 */
  const [redrawText, setRedrawText] = useState<string | null>(null);
  /** 本場是否抽到重抽（顯示重抽視窗） */
  const [redrawn, setRedrawn] = useState(false);
  const [mechSel, setMechSel] = useState<MechanismId[] | null>(null);
  const [run, setRun] = useState<PinballRun | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ResultRow[]>([]);
  /** 抽獎結束後面板是否停在結果畫面（按「修改設定」回到設定） */
  const [showResults, setShowResults] = useState(false);
  /** 本輪結果對應的名單快照，換台面後仍保留 */
  const [resultNames, setResultNames] = useState<string[]>([]);
  /** 全部彈珠抵達後的最終結果，用於得獎名單視窗 */
  const [final, setFinal] = useState<FinalResult | null>(null);
  const [finalOpen, setFinalOpen] = useState(false);
  const [message, setMessage] = useState('');
  const snapshotRef = useRef<DrawSnapshot | null>(null);
  const runKeyRef = useRef(0);
  /** 解除上一頁／下一頁確認的函式；非抽獎中為 null */
  const disarmBackRef = useRef<(() => void) | null>(null);

  /** 移除 beforeunload 與上一頁確認（正常結束時呼叫，會彈掉多餘的哨兵歷史紀錄） */
  const releaseGuards = (): void => {
    window.removeEventListener('beforeunload', onBeforeUnload);
    const disarm = disarmBackRef.current;
    disarmBackRef.current = null;
    disarm?.();
  };

  // 卸載時若仍在抽獎中：作廢本場，不寫入任何資料
  useEffect(
    () => () => {
      if (snapshotRef.current) {
        snapshotRef.current = null;
        setDrawing(false);
        window.removeEventListener('beforeunload', onBeforeUnload);
        disarmBackRef.current?.();
        disarmBackRef.current = null;
      }
    },
    [],
  );

  if (data === null) {
    return (
      <main className="page setup" aria-busy="true">
        <h1>開始抽獎</h1>
        <p className="message">載入中…</p>
      </main>
    );
  }

  // 首次取得資料時，依網址 ?list 預選名單；找不到則忽略
  if (!paramApplied) {
    setParamApplied(true);
    const preset = listParam ? data.lists.find((l) => l.id === listParam) : undefined;
    if (preset) {
      setSource(preset.id);
      setText(preset.names.join('\n'));
    }
  }

  const selectedList = data.lists.find((l) => l.id === source);
  const boardId: BoardId = boardSel ?? data.preferences.lastBoardId ?? 'classic';
  const sound = soundSel ?? data.preferences.sound;
  const mode: DrawMode = modeSel ?? data.preferences.mode ?? 'race';
  const perSetting = perSel ?? data.preferences.perPerson ?? 1;
  /** 是否每人固定彈珠數；沒設定過時，舊偏好有設每人多顆就視為開啟，維持原本的行為 */
  const fixedPer = fixedSel ?? data.preferences.fixedPer ?? perSetting > 1;
  const redraw = redrawSel ?? data.preferences.redraw ?? 0;
  const parsed = parseEntries(text);
  /** 名單是否有寫 *X */
  const hasCounts = parsed.entries.some((e) => e.count > 1);
  /** 實際的每人固定彈珠數；未開啟固定時為 1，改依名單 *X */
  const perPerson = fixedPer ? perSetting : 1;
  /** 依名單 *X 的每人彈珠數；開啟固定或全部 1 顆時為 undefined */
  const counts = !fixedPer && hasCounts ? parsed.entries.map((e) => e.count) : undefined;
  // 依固定順序保存，未知的值（舊資料）忽略
  const mechanisms: MechanismId[] = MECHANISM_IDS.filter((m) =>
    (mechSel ?? (data.preferences.mechanisms as MechanismId[] | undefined) ?? MECHANISM_IDS).includes(m),
  );

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
    const form = validateListForm(title, text);
    if (!form.ok) return setMessage(form.error);
    const id = crypto.randomUUID();
    const r = update((d) => createList(d, title, names, new Date().toISOString(), id));
    if (!r.ok) return setMessage('名單無法保存');
    setSource(id);
    setText(names.join('\n'));
    setNewTitle('');
    setMessage(`已存成名單「${title}」`);
  };

  /** 切換音效：先更新本地狀態，再寫入 preferences */
  const changeSound = (v: boolean): void => {
    setSoundSel(v);
    update((d) => setPreferences(d, { sound: v }));
  };

  /** 切換遊戲模式並記住 */
  const changeMode = (v: DrawMode): void => {
    setModeSel(v);
    setMessage('');
    update((d) => setPreferences(d, { mode: v }));
  };

  /** 每人彈珠數加減一，限制在 1 到上限，並記住 */
  const stepPer = (delta: number): void => {
    const v = Math.min(MAX_MARBLES_PER_PERSON, Math.max(1, perSetting + delta));
    setPerSel(v);
    setMessage('');
    update((d) => setPreferences(d, { perPerson: v }));
  };

  /** 切換每人固定彈珠數並記住 */
  const changeFixed = (v: boolean): void => {
    setFixedSel(v);
    setMessage('');
    update((d) => setPreferences(d, { fixedPer: v }));
  };

  /**
   * 設定重抽彈珠數（限制在 0 到上限）並記住。
   * @param n 新的數量
   */
  const setRedraw = (n: number): void => {
    const v = Math.min(MAX_REDRAW, Math.max(0, Math.floor(n)));
    setRedrawSel(v);
    setMessage('');
    update((d) => setPreferences(d, { redraw: v }));
  };

  /** 重抽彈珠數加減一 */
  const stepRedraw = (delta: number): void => {
    setRedrawText(null);
    setRedraw(redraw + delta);
  };

  /** 直接輸入重抽彈珠數：輸入合法整數就套用；清空或輸入中途的文字先保留，離開欄位時恢復成目前的值 */
  const typeRedraw = (text: string): void => {
    setRedrawText(text);
    const n = Number(text);
    if (text.trim() !== '' && Number.isInteger(n)) setRedraw(n);
  };

  /** 勾選或取消一種可選機關並記住 */
  const toggleMech = (id: MechanismId, on: boolean): void => {
    const next = MECHANISM_IDS.filter((m) => (m === id ? on : mechanisms.includes(m)));
    setMechSel(next);
    update((d) => setPreferences(d, { mechanisms: next }));
  };

  /** 換台面；上一場已結束時清掉 run，讓畫布顯示新台面 */
  const changeBoard = (id: BoardId): void => {
    setBoardSel(id);
    setRun(null);
  };

  /** 按下開始：驗證、必要時覆蓋名單、產生種子並交給畫布 */
  const start = (): void => {
    const names = parsed.entries.map((e) => e.name);
    const count = Number(winnerCount);
    // 開啟每人固定時忽略 *X，不檢查 *X 的範圍
    if (!fixedPer && parsed.error) return setMessage(parsed.error);
    const err = validateDrawInput(names, count, perPerson);
    if (err) return setMessage(err);
    let saveFailed = false;
    // 名單存原始行（保留 *X），比對也用原始行
    const lines = parseNames(text);
    if (selectedList && !sameNames(lines, selectedList.names)) {
      const r = update((d) => updateList(d, selectedList.id, { names: lines }, new Date().toISOString()));
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
      mode,
      perPerson,
      counts,
      redraw,
      mechanisms,
      saveFailed,
    };
    setDrawing(true);
    window.addEventListener('beforeunload', onBeforeUnload);
    // 使用者在上一頁確認離開時：本場作廢、不寫入資料（鎖定已由 armBackGuard 解除）
    disarmBackRef.current = armBackGuard(() => {
      snapshotRef.current = null;
      window.removeEventListener('beforeunload', onBeforeUnload);
      disarmBackRef.current = null;
    });
    setRunning(true);
    setShowResults(true);
    setResults([]);
    setResultNames(names);
    setFinal(null);
    setFinalOpen(false);
    setRedrawn(false);
    setMessage('');
    runKeyRef.current += 1;
    setRun({ key: runKeyRef.current, names, boardId, seed, winnerCount: count, mode, perPerson, counts, redraw, mechanisms });
  };

  /** 名額內的彈珠抵達時加入本輪結果，依名次排列（生存模式的名次由大到小產生） */
  const onArrive = (index: number, rank: number): void => {
    setResults((r) => [...r, { index, rank }].sort((a, b) => a.rank - b.rank));
  };

  /** 全部得獎者產生：寫入紀錄、記住台面，最後解除鎖定 */
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
      mode: s.mode,
      perPerson: s.perPerson,
      ...(s.counts ? { counts: s.counts } : {}),
      ...(s.redraw > 0 ? { redraw: s.redraw } : {}),
      mechanisms: s.mechanisms,
    };
    // 紀錄與偏好合併為一次寫入，避免部分成功
    const r = update((d) => setPreferences(addDraw(d, record), { lastBoardId: s.boardId }));
    if (!r.ok || s.saveFailed) setMessage(SAVE_FAILED);
    setDrawing(false);
    releaseGuards();
    setRunning(false);
  };

  /** 抽到重抽：本場作廢、不寫入紀錄，解除鎖定後跳出重抽視窗 */
  const onRedraw = (): void => {
    if (!snapshotRef.current) return;
    snapshotRef.current = null;
    setDrawing(false);
    releaseGuards();
    setRunning(false);
    setResults([]);
    setRedrawn(true);
    setFinalOpen(true);
  };

  /** 全部彈珠抵達：跳出得獎名單視窗 */
  const onAllArrived = (result: FinalResult): void => {
    setFinal(result);
    setFinalOpen(true);
  };

  /** 抽出名額加減一，不小於 1 */
  const stepCount = (delta: number): void => {
    const n = Number(winnerCount);
    setWinnerCount(String(Math.max(1, (Number.isFinite(n) ? Math.floor(n) : 1) + delta)));
  };

  const nameCount = parsed.entries.length;
  const marbleCount = (counts ? counts.reduce((a, b) => a + b, 0) : nameCount * perPerson) + redraw;

  return showResults ? (
    <div className="play">
      <section className="stage">
        <PinballCanvas
          boardId={boardId}
          run={run}
          sound={sound}
          hud
          controls
          onArrive={onArrive}
          onDone={onDone}
          onAllArrived={onAllArrived}
          onRedraw={onRedraw}
          results={
            results.length > 0 ? (
              <>
                <h2>{mode === 'survival' ? '生存名次' : '得獎名次'}</h2>
                <ol className="results">
                  {results.map((r) => (
                    <li key={r.rank}>
                      <span className="rank">第 {r.rank} 名</span>
                      {resultNames[r.index]}
                    </li>
                  ))}
                </ol>
              </>
            ) : undefined
          }
          side={
            <div className="race-status">
              <h1>{running ? '抽獎進行中' : '本輪結果'}</h1>
              {running ? (
                <p className="status">
                  <i />
                  離開頁面將作廢本場
                </p>
              ) : (
                <p className="message">
                  {redrawn
                    ? `${getBoard(boardId)?.name}，抽到再抽一次，本場作廢`
                    : `${getBoard(boardId)?.name}，${resultNames.length} 人抽出 ${results.length} 名`}
                </p>
              )}
              <p className="message">{describeRules(mode, perPerson, mechanisms, run?.counts, run?.redraw)}</p>
              {message && (
                <p className="message" role="status">
                  {message}
                </p>
              )}
              {!running && (
                <div className="panel-actions">
                  <button type="button" onClick={start}>
                    用同樣設定再抽一場
                  </button>
                  <button type="button" className="secondary" onClick={() => setShowResults(false)}>
                    修改設定
                  </button>
                </div>
              )}
            </div>
          }
        />
      </section>
      {redrawn && (
        <WinnersDialog
          open={finalOpen}
          title="抽到再抽一次"
          replayLabel="再抽一次"
          summary="第一名是再抽一次彈珠，本場作廢、不列入紀錄。用同樣的設定再抽一次。"
          rows={[]}
          onReplay={start}
          onClose={() => setFinalOpen(false)}
        />
      )}
      {final && (
        <WinnersDialog
          open={finalOpen}
          summary={`${getBoard(boardId)?.name}，${resultNames.length} 人，全部抵達 ${formatTime(final.total)}`}
          rows={final.winners.map((index, i) => ({
            rank: i + 1,
            name: resultNames[index] ?? '',
            time: formatTime(final.times[i]),
          }))}
          onReplay={start}
          onClose={() => setFinalOpen(false)}
        />
      )}
    </div>
  ) : (
    <main className="page setup">
      <div className="page-head">
        <h1>開始抽獎</h1>
      </div>
      <div className="setup-grid">
        <section className="editor">
          <div className="field">
            <span id="source-label">名單來源</span>
            <Dropdown
              labelledBy="source-label"
              value={selectedList ? source : ''}
              onChange={changeSource}
              options={[
                { value: '', label: '直接輸入（未存檔）' },
                ...data.lists.map((l) => ({ value: l.id, label: l.title, meta: `${l.names.length} 人` })),
              ]}
            />
          </div>
          <label className="field">
            <span>
              參加名單（一行一位）<em>{nameCount} 人</em>
            </span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
          </label>
          <small className="hint">名字後面加上 *3 就放 3 顆彈珠，例如「王小明*3」，最多 500 顆；沒寫就是 1 顆</small>
          <div className="field inline">
            <span id="redraw-label">再抽一次彈珠</span>
            <div className="stepper" role="group" aria-labelledby="redraw-label">
              <button type="button" aria-label="減少再抽一次彈珠" disabled={redraw <= 0} onClick={() => stepRedraw(-1)}>
                −
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_REDRAW}
                aria-labelledby="redraw-label"
                value={redrawText ?? String(redraw)}
                onChange={(e) => typeRedraw(e.target.value)}
                onBlur={() => setRedrawText(null)}
              />
              <button type="button" aria-label="增加再抽一次彈珠" disabled={redraw >= MAX_REDRAW} onClick={() => stepRedraw(1)}>
                +
              </button>
            </div>
          </div>
          <small className="hint">再抽一次彈珠拿到第一名時，本場作廢，可以用同樣設定直接再抽</small>
          {!selectedList && (
            <div className="field row">
              <input
                type="text"
                placeholder="名單標題"
                aria-label="名單標題"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <button type="button" className="secondary small" onClick={saveAsList}>
                存成名單
              </button>
            </div>
          )}
        </section>
        <section className="editor">
          <div className="field">
            台面
            <div className="segmented" role="group" aria-label="台面">
              {BOARD_LIST.map((b) => (
                <button key={b.id} type="button" aria-pressed={b.id === boardId} onClick={() => changeBoard(b.id)}>
                  {b.name}
                </button>
              ))}
            </div>
          </div>
          <div className="field inline">
            <label htmlFor="winner-count">抽出名額</label>
            <div className="stepper">
              <button type="button" aria-label="減少名額" onClick={() => stepCount(-1)}>
                −
              </button>
              <input
                id="winner-count"
                type="number"
                min={1}
                value={winnerCount}
                onChange={(e) => setWinnerCount(e.target.value)}
              />
              <button type="button" aria-label="增加名額" onClick={() => stepCount(1)}>
                +
              </button>
            </div>
          </div>
          <div className="field">
            模式
            <div className="segmented" role="group" aria-label="模式">
              {MODE_OPTIONS.map((o) => (
                <button key={o.mode} type="button" aria-pressed={o.mode === mode} onClick={() => changeMode(o.mode)}>
                  {o.label}
                </button>
              ))}
            </div>
            <small className="hint">{MODE_OPTIONS.find((o) => o.mode === mode)?.desc}</small>
          </div>
          <label className="check">
            <input type="checkbox" checked={fixedPer} onChange={(e) => changeFixed(e.target.checked)} />
            每人固定彈珠數
          </label>
          {fixedPer && (
            <div className="field inline">
              <span id="per-label">每人彈珠數</span>
              <div className="stepper" role="group" aria-labelledby="per-label">
                <button type="button" aria-label="減少每人彈珠數" disabled={perSetting <= 1} onClick={() => stepPer(-1)}>
                  −
                </button>
                <output aria-live="polite">{perSetting}</output>
                <button
                  type="button"
                  aria-label="增加每人彈珠數"
                  disabled={perSetting >= MAX_MARBLES_PER_PERSON}
                  onClick={() => stepPer(1)}
                >
                  +
                </button>
              </div>
            </div>
          )}
          <small className={!fixedPer && parsed.error ? "hint error" : "hint"}>
            {fixedPer && hasCounts && '已開啟每人固定，會忽略名單上的 *X 數量。'}
            {!fixedPer && parsed.error ? parsed.error : `共 ${marbleCount} 顆彈珠`}
          </small>
          <fieldset className="field mechs">
            <legend>額外機關</legend>
            {MECHANISM_IDS.map((id) => (
              <label key={id} className="check">
                <input type="checkbox" checked={mechanisms.includes(id)} onChange={(e) => toggleMech(id, e.target.checked)} />
                <span>
                  {MECHANISM_INFO[id].name}
                  <small>{MECHANISM_INFO[id].desc}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <label className="check">
            <input type="checkbox" checked={sound} onChange={(e) => changeSound(e.target.checked)} />
            音效
          </label>
          <p className="message" role="status">
            {message}
          </p>
          <button type="button" className="start" onClick={start}>
            開始抽獎
          </button>
        </section>
      </div>
    </main>
  );
}
