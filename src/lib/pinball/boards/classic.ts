import Matter from 'matter-js';
import { WORLD_W } from '../physics';
import { bumper, pegField, segment, spinner, STATIC_OPTS, type Circle } from './builders';
import type { Board, BoardDef, Spinner } from './types';

const { Bodies } = Matter;

/** 經典台面的世界高度 */
const WORLD_H = 3040;
/** 經典台面的終點線 Y 座標 */
const FINISH_Y = 2910;

/**
 * 依固定配置建立經典彈珠台。由上而下依序為：
 * 起始區 → 釘陣 → 斜坡 → 旋轉擋板 → 保險桿釘陣 → 漏斗 → 終點釘陣 → 終點線。
 * @returns 台面實體
 */
function buildClassic(): Board {
  const statics: Matter.Body[] = [];
  const spinners: Spinner[] = [];

  // 外框：左右牆、天花板、地板
  statics.push(
    Bodies.rectangle(-20, WORLD_H / 2, 40, WORLD_H + 200, STATIC_OPTS),
    Bodies.rectangle(WORLD_W + 20, WORLD_H / 2, 40, WORLD_H + 200, STATIC_OPTS),
    Bodies.rectangle(WORLD_W / 2, -20, WORLD_W + 80, 40, STATIC_OPTS),
    Bodies.rectangle(WORLD_W / 2, WORLD_H + 20, WORLD_W + 80, 40, STATIC_OPTS),
  );

  // 1. 第一段釘陣
  statics.push(...pegField(290, 700, 48, 40, 5));

  // 2. 之字斜坡（坡度約 24 度；原本約 20 度時 200 顆彈珠會在坡上堆積停住）
  statics.push(segment(0, 720, 450, 920), segment(600, 950, 150, 1150));

  // 3. 旋轉擋板區
  spinners.push(
    spinner(150, 1250, 150, 0.035),
    spinner(450, 1250, 150, -0.035),
    spinner(300, 1400, 160, 0.045),
    spinner(150, 1550, 150, -0.035),
    spinner(450, 1550, 150, 0.035),
  );
  statics.push(bumper({ x: 70, y: 1400, r: 18 }), bumper({ x: 530, y: 1400, r: 18 }));

  // 4. 保險桿 + 釘陣
  const bumpers: Circle[] = [
    { x: 150, y: 1740, r: 20 },
    { x: 450, y: 1740, r: 20 },
    { x: 300, y: 1880, r: 20 },
    { x: 110, y: 2020, r: 20 },
    { x: 490, y: 2020, r: 20 },
  ];
  statics.push(...bumpers.map(bumper), ...pegField(1660, 2080, 60, 50, 6, bumpers));

  // 5. 漏斗：中央留約 70 的出口，下方擋板負責打散排隊的彈珠
  statics.push(segment(0, 2140, 265, 2300), segment(600, 2140, 335, 2300));
  spinners.push(spinner(300, 2380, 110, 0.05));

  // 6. 終點前釘陣
  statics.push(...pegField(2470, 2860, 48, 40, 5));

  return { statics, spinners, worldH: WORLD_H, finishY: FINISH_Y };
}

/** 經典台面定義 */
export const classic: BoardDef = { id: 'classic', name: '經典', version: 1, build: buildClassic };
