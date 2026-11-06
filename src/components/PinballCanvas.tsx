'use client';

import confetti from 'canvas-confetti';
import { useEffect, useRef } from 'react';
import { Sfx } from '@/lib/pinball/audio';
import type { BoardId } from '@/lib/pinball/boards/types';
import { Game } from '@/lib/pinball/game';
import type { SimConfig } from '@/lib/pinball/simulation';

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
  /** 得獎名額內的彈珠抵達終點時通知 */
  onArrive?: (index: number, rank: number) => void;
  /** 全部得獎者產生時通知 */
  onDone?: (winners: number[]) => void;
}

/**
 * 彈珠台畫布元件：掛載時建立 Game，卸載時銷毀；第一名抵達時施放彩帶。
 * @param props 台面、場次、音效開關與回呼
 * @returns 填滿父元素的畫布
 */
export function PinballCanvas({ boardId, run, sound, onArrive, onDone }: PinballCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const sfxRef = useRef<Sfx | null>(null);
  // 以 ref 保存最新值，避免 callback 或 props 改變時重建 Game
  const onArriveRef = useRef(onArrive);
  const onDoneRef = useRef(onDone);
  const boardIdRef = useRef(boardId);
  const soundRef = useRef(sound);
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
    onArriveRef.current = onArrive;
    onDoneRef.current = onDone;
    boardIdRef.current = boardId;
    soundRef.current = sound;
  });

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
        onDone: (winners) => onDoneRef.current?.(winners),
      },
      sfx,
    );
    sfxRef.current = sfx;
    gameRef.current = game;
    game.showBoard(boardIdRef.current);
    return () => {
      timers.forEach(clearTimeout);
      game.destroy();
      gameRef.current = null;
      sfxRef.current = null;
    };
  }, []);

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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  );
}
