'use client';

import confetti from 'canvas-confetti';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Sfx } from '@/lib/pinball/audio';
import type { BoardId } from '@/lib/pinball/boards/types';
import { Game, type CameraMode, type FinalResult, type RaceSnapshot } from '@/lib/pinball/game';
import { REDRAW_HUE, REDRAW_NAME, type SimConfig } from '@/lib/pinball/simulation';

/** 一場抽獎的啟動參數；key 每次變動即代表要開新的一場 */
export interface PinballRun extends SimConfig {
  key: number;
}

interface PinballCanvasProps {
  /** 閒置時顯示的台面 */
  boardId: BoardId;
  /** 目前要跑的場次，null 表示閒置 */
  run: PinballRun | null;
  /** 是否播放音效 */
  sound: boolean;
  /** 是否顯示計時、即時名次與全場進度軌 */
  hud?: boolean;
  /** 是否可操作鏡頭（拖曳、滾輪、點選彈珠、鏡頭切換列、左側參加名單） */
  controls?: boolean;
  /** 左側面板最上方的內容（例如本輪狀態與操作按鈕），只在 controls 開啟時顯示 */
  side?: ReactNode;
  /** 得獎名次等結果內容：開啟 controls 時放在左側面板的本輪狀態下方，否則疊在畫面上；未提供時不顯示 */
  results?: ReactNode;
  /** 得獎名額內的彈珠抵達終點時通知 */
  onArrive?: (index: number, rank: number) => void;
  /** 全部得獎者產生時通知 */
  onDone?: (winners: number[]) => void;
  /** 全部彈珠抵達時通知，附各得獎者的抵達秒數 */
  onAllArrived?: (result: FinalResult) => void;
  /** 抽到重抽（重抽彈珠拿到第一名）時通知，本場作廢 */
  onRedraw?: () => void;
}

/** 即時名次固定顯示的人數 */
const RANK_COUNT = 20;
/** HUD 更新間隔（毫秒） */
const HUD_MS = 100;
/** 拖曳超過此距離（CSS 像素）才算拖曳，否則視為點選 */
const DRAG_PX = 5;
/** 鍵盤一次移動的距離（CSS 像素） */
const KEY_PAN = 120;
/** 提示泡泡顯示的毫秒數 */
const TIP_MS = 3500;

/** 鏡頭切換列的選項 */
const CAMERA_OPTIONS: { mode: CameraMode; label: string }[] = [
  { mode: 'leader', label: '跟隨第一名' },
  { mode: 'last', label: '跟隨最後一名' },
  { mode: 'marble', label: '跟隨指定' },
  { mode: 'free', label: '自由視角' },
];

/** 閒置時的 HUD 狀態 */
const IDLE: RaceSnapshot = { active: false, elapsed: 0, decidedAt: null, top: [], roster: [], mode: 'leader', follow: null };

/**
 * HUD 小圓點的背景色：參加者用彈珠色相，重抽彈珠用中性灰。
 * @param hue 彈珠色相或 REDRAW_HUE
 * @returns CSS 顏色
 */
function ballBg(hue: number): string {
  return hue === REDRAW_HUE ? 'var(--ink-3)' : `hsl(${hue} 80% 52%)`;
}

/**
 * 將秒數格式化為 mm:ss.s。
 * @param sec 秒數
 * @returns 計時字串
 */
export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

/**
 * 彈珠台畫布元件：掛載時建立 Game，卸載時銷毀；第一名抵達時施放彩帶。
 * 開啟 hud 時疊上計時器、即時名次與全場進度軌；開啟 controls 時另有左側參加名單（點名字即跟隨該彈珠）、
 * 鏡頭切換列，並可拖曳、滾輪、點選彈珠與點選或拖曳進度軌移動鏡頭。
 * @param props 台面、場次、音效開關、HUD 開關、左側面板與右側結果面板的內容、回呼
 * @returns 填滿父元素的畫布與 HUD
 */
export function PinballCanvas({
  boardId,
  run,
  sound,
  hud = false,
  controls = false,
  side,
  results,
  onArrive,
  onDone,
  onAllArrived,
  onRedraw,
}: PinballCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const sfxRef = useRef<Sfx | null>(null);
  // 以 ref 保存最新值，避免 callback 或 props 改變時重建 Game
  const onArriveRef = useRef(onArrive);
  const onDoneRef = useRef(onDone);
  const onAllArrivedRef = useRef(onAllArrived);
  const onRedrawRef = useRef(onRedraw);
  const boardIdRef = useRef(boardId);
  const soundRef = useRef(sound);
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
    onArriveRef.current = onArrive;
    onDoneRef.current = onDone;
    onAllArrivedRef.current = onAllArrived;
    onRedrawRef.current = onRedraw;
    boardIdRef.current = boardId;
    soundRef.current = sound;
  });

  const [snap, setSnap] = useState<RaceSnapshot>(IDLE);
  /** 提示泡泡的文字，空字串表示不顯示 */
  const [tip, setTip] = useState('');
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 窄螢幕上左側名單是否展開 */
  const [sideOpen, setSideOpen] = useState(false);
  /** 名單搜尋字串，輸入即時篩選 */
  const [query, setQuery] = useState('');
  /** 拖曳狀態：起點與上一點的 Y、是否已超過拖曳門檻 */
  const dragRef = useRef<{ startY: number; lastY: number; moved: boolean } | null>(null);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const sfx = new Sfx();
    sfx.enabled = soundRef.current;
    const game = new Game(
      canvasRef.current!,
      {
        onArrive: (index, rank) => {
          if (rank === 1) {
            void confetti({ particleCount: 160, spread: 100, origin: { y: 0.6 } });
            timers.push(setTimeout(() => void confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } }), 250));
            timers.push(setTimeout(() => void confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } }), 400));
          }
          onArriveRef.current?.(index, rank);
        },
        onDone: (winners) => {
          // 窄螢幕上名單平常收起，結束時自動展開讓結果看得到
          setSideOpen(true);
          onDoneRef.current?.(winners);
        },
        onAllArrived: (result) => onAllArrivedRef.current?.(result),
        onRedraw: () => {
          setSideOpen(true);
          onRedrawRef.current?.();
        },
      },
      sfx,
    );
    sfxRef.current = sfx;
    gameRef.current = game;
    game.attachMinimap(miniRef.current);
    game.showBoard(boardIdRef.current);
    const tips = tipTimer;
    return () => {
      timers.forEach(clearTimeout);
      if (tips.current) clearTimeout(tips.current);
      game.destroy();
      gameRef.current = null;
      sfxRef.current = null;
    };
  }, []);

  // HUD 以固定間隔向 Game 取狀態，不在每個畫面觸發 React 更新
  useEffect(() => {
    if (!hud && !controls) return;
    const id = setInterval(() => {
      const g = gameRef.current;
      if (g) setSnap(g.snapshot(RANK_COUNT));
    }, HUD_MS);
    return () => clearInterval(id);
  }, [hud, controls]);

  // 閒置時換台面；進行中的場次由 run 控制，不在此中止
  useEffect(() => {
    if (!run) gameRef.current?.showBoard(boardId);
  }, [boardId, run]);

  useEffect(() => {
    if (sfxRef.current) sfxRef.current.enabled = sound;
  }, [sound]);

  const runKey = run?.key;
  useEffect(() => {
    if (runKey === undefined) return;
    // run 以 key 識別，同一個 key 下內容不會變動，這裡讀 ref 取最新值
    if (runRef.current) gameRef.current?.start(runRef.current);
  }, [runKey]);

  // 滾輪移動鏡頭：需要非被動監聽才能阻止頁面捲動
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!controls || !canvas) return;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      gameRef.current?.panBy(e.deltaY);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [controls]);

  /**
   * 顯示提示泡泡，數秒後自動消失。
   * @param text 提示文字
   */
  const showTip = (text: string): void => {
    setTip(text);
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => setTip(''), TIP_MS);
  };

  /**
   * 跟隨指定的參加者，成功時顯示提示並更新 HUD。
   * @param index 參加者在名單中的索引
   */
  const followIndex = (index: number): void => {
    const g = gameRef.current;
    if (!g?.follow(index)) return;
    setSnap(g.snapshot(RANK_COUNT));
    showTip(`跟隨中：${runRef.current?.names[index] ?? REDRAW_NAME}`);
  };

  /** 按下：開始追蹤拖曳 */
  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>): void => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, lastY: e.clientY, moved: false };
  };

  /** 移動：超過門檻後跟手移動鏡頭 */
  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>): void => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientY - d.startY) > DRAG_PX) d.moved = true;
    if (d.moved) gameRef.current?.panBy(d.lastY - e.clientY);
    d.lastY = e.clientY;
  };

  /** 放開：沒有拖曳就當作點選，點到彈珠即跟隨 */
  const onPointerUp = (e: PointerEvent<HTMLCanvasElement>): void => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.moved) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const index = gameRef.current?.pick(e.clientX - rect.left, e.clientY - rect.top) ?? null;
    if (index !== null) followIndex(index);
  };

  /** 鍵盤：上下鍵與翻頁鍵移動鏡頭 */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const dy = { ArrowDown: KEY_PAN, ArrowUp: -KEY_PAN, PageDown: KEY_PAN * 4, PageUp: -KEY_PAN * 4 }[e.key];
    if (dy === undefined || e.target !== e.currentTarget) return;
    e.preventDefault();
    gameRef.current?.panBy(dy);
  };

  /** 點擊進度軌：鏡頭移到該高度，按住拖曳可連續移動 */
  const onMiniDown = (e: PointerEvent<HTMLCanvasElement>): void => {
    e.currentTarget.setPointerCapture(e.pointerId);
    gameRef.current?.jumpMinimap(e.clientY - e.currentTarget.getBoundingClientRect().top);
  };

  /** 在進度軌上按住拖曳 */
  const onMiniMove = (e: PointerEvent<HTMLCanvasElement>): void => {
    if (e.buttons & 1) gameRef.current?.jumpMinimap(e.clientY - e.currentTarget.getBoundingClientRect().top);
  };

  /** 切換鏡頭模式；「跟隨指定」在尚未指定彈珠時只提示操作方式 */
  const chooseMode = (mode: CameraMode): void => {
    const g = gameRef.current;
    if (!g) return;
    if (mode === 'marble' && snap.follow === null) {
      showTip('點左側名單裡的名字，或直接點台面上的彈珠，鏡頭就會跟著它');
      setSideOpen(true);
      return;
    }
    g.setCameraMode(mode);
    setSnap(g.snapshot(RANK_COUNT));
  };

  const live = snap.active && snap.top.some((r) => r.rank === null);
  const leader = snap.top[0];
  const modeLabel = run?.mode === 'survival' ? '生存' : '競速';
  const keyword = query.trim().toLowerCase();
  const roster = keyword ? snap.roster.filter((r) => r.name.toLowerCase().includes(keyword)) : snap.roster;

  return (
    <div
      className="pinball"
      tabIndex={controls ? 0 : undefined}
      onKeyDown={controls ? onKeyDown : undefined}
      aria-label={controls ? '彈珠台，可用上下鍵移動鏡頭' : undefined}
    >
      <canvas
        ref={canvasRef}
        className={controls ? 'pinball-canvas interactive' : 'pinball-canvas'}
        onPointerDown={controls ? onPointerDown : undefined}
        onPointerMove={controls ? onPointerMove : undefined}
        onPointerUp={controls ? onPointerUp : undefined}
        onPointerCancel={() => (dragRef.current = null)}
      />
      {controls && (
        <aside className={sideOpen ? 'hud hud-side open' : 'hud hud-side'} aria-label="參加名單">
          {side}
          {results && (
            <section className="side-results" aria-label="得獎名次">
              {results}
            </section>
          )}
          <h2 className="hud-side-title">
            參加名單<em>{snap.roster.length} 人</em>
          </h2>
          <input
            type="search"
            className="roster-search"
            placeholder="搜尋名字"
            aria-label="搜尋參加者"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {keyword && !roster.length && <p className="hud-empty roster-empty">找不到「{query.trim()}」</p>}
          <ul className="roster">
            {roster.map((r) => (
              <li key={r.index}>
                <button
                  type="button"
                  aria-pressed={snap.mode === 'marble' && snap.follow === r.index}
                  onClick={() => followIndex(r.index)}
                >
                  <span className="hud-ball" style={{ background: ballBg(r.hue) }} />
                  <span className="hud-name">{r.name}</span>
                  {r.rank !== null && <span className="roster-rank">第 {r.rank} 名</span>}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
      {hud && (
        <>
          <div className="hud hud-timer" aria-label="經過時間">
            <span>{formatTime(snap.elapsed)}</span>
            {/* 得獎者產生後計時繼續，另外標出得獎當下的時間（生存模式兩者相同，不重複顯示） */}
            {snap.decidedAt !== null && snap.decidedAt < snap.elapsed && (
              <span className="hud-decided">
                得獎 <b>{formatTime(snap.decidedAt)}</b>
              </span>
            )}
          </div>
          {/* 目前第一名：遊戲畫面上方置中放大顯示，名字用彈珠的色相 */}
          {leader && (
            <div className="hud hud-leader" aria-label={`${modeLabel}模式，目前第一名：${leader.name}`}>
              <span className="hud-leader-mode">{modeLabel}</span>
              <span className="hud-leader-tag">第一名</span>
              <span className="hud-ball" style={{ background: ballBg(leader.hue) }} />
              <span
                className={leader.hue === REDRAW_HUE ? 'hud-leader-name redraw' : 'hud-leader-name'}
                style={{ '--hue': leader.hue } as React.CSSProperties}
              >
                {leader.name}
              </span>
            </div>
          )}
          <section className="hud hud-rank" aria-label="即時名次">
            <header>
              <span>即時名次</span>
              {live && (
                <span className="hud-live">
                  <i />
                  LIVE
                </span>
              )}
            </header>
            {snap.top.length ? (
              <ol>
                {snap.top.map((r, i) => (
                  <li key={r.index} className={r.rank !== null ? 'arrived' : undefined}>
                    <span className="hud-pos">{String(i + 1).padStart(2, '0')}</span>
                    <span className="hud-ball" style={{ background: ballBg(r.hue) }} />
                    <span className="hud-name">{r.name}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="hud-empty">開始後顯示前 20 名</p>
            )}
          </section>
          {controls && (
            <div className="hud hud-cams">
              {tip && (
                <p className="hud-tip" role="status">
                  {tip}
                </p>
              )}
              <div className="segmented" role="group" aria-label="鏡頭">
                {CAMERA_OPTIONS.map((o) => (
                  <button
                    key={o.mode}
                    type="button"
                    aria-pressed={snap.mode === o.mode}
                    disabled={o.mode !== 'free' && !snap.active}
                    onClick={() => chooseMode(o.mode)}
                  >
                    {o.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="side-toggle"
                  aria-expanded={sideOpen}
                  onClick={() => setSideOpen((v) => !v)}
                >
                  名單
                </button>
              </div>
            </div>
          )}
          {results && !controls && <section className="hud hud-results" aria-label="得獎名次">{results}</section>}
          <div className="hud hud-mini">
            <canvas
              ref={miniRef}
              aria-label="全場進度：上方是起點、下方是終點，點選可移動鏡頭"
              onPointerDown={controls ? onMiniDown : undefined}
              onPointerMove={controls ? onMiniMove : undefined}
              className={controls ? 'interactive' : undefined}
            />
          </div>
        </>
      )}
    </div>
  );
}
