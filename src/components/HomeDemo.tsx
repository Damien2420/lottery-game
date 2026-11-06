'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import styles from '@/app/home.module.css';
import { newSeed } from '@/lib/draw';
import type { PinballRun } from './PinballCanvas';

/** 僅在進入可視範圍後才載入的畫布（含 matter-js），不進入首屏 bundle */
const PinballCanvas = dynamic(() => import('./PinballCanvas').then((m) => m.PinballCanvas), {
  ssr: false,
});

/** 示範用範例名單 */
const SAMPLE_NAMES = ['小明', '小華', '阿美', '大雄', '靜香', '胖虎', '小夫', '阿哲', '小玉', '志明', '春嬌', '阿德'];

/** 一場結束後到下一場開始的等待毫秒數 */
const RERUN_DELAY_MS = 4000;

/**
 * 建立一場示範場次。
 * @param key 場次識別；變動即代表新的一場
 * @returns 使用新種子、經典台面的場次設定
 */
function makeRun(key: number): PinballRun {
  return { key, names: SAMPLE_NAMES, boardId: 'classic', seed: newSeed(), winnerCount: 3 };
}

/**
 * 首頁示範區：進入可視範圍後才載入彈珠台，靜音自動播放，結束後隔數秒以新種子重跑。
 * 不讀寫 localStorage，也不建立任何抽獎紀錄。
 * @returns 固定高度的示範容器
 */
export function HomeDemo(): React.JSX.Element {
  const boxRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);
  const [run, setRun] = useState<PinballRun | null>(null);

  // 進入可視範圍後才開始載入並啟動第一場
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        setRun(makeRun(++keyRef.current));
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 卸載時清除等待中的重跑計時器
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  /** 一場結束後等待數秒，再以新種子與新 key 重跑 */
  const onDone = (): void => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setRun(makeRun(++keyRef.current)), RERUN_DELAY_MS);
  };

  return (
    <div ref={boxRef} className={styles.demo} aria-label="抽獎彈珠台示範動畫" role="img">
      {visible && <PinballCanvas boardId="classic" run={run} sound={false} onDone={onDone} />}
    </div>
  );
}
