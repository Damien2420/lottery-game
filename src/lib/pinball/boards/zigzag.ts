import Matter from 'matter-js';
import { MARBLE_R, WORLD_W } from '../physics';
import { bumper, pegField, segment, spinner, STATIC_OPTS } from './builders';
import type { Board, BoardDef, Spinner } from './types';

const { Bodies } = Matter;

/** 迴廊斜坡段數 */
const SHELVES = 5;
/** 第一段斜坡高端的 Y */
const SHELF_TOP = 300;
/** 相鄰兩段斜坡的垂直間距 */
const PITCH = 470;
/** 斜坡水平長度（另一側留下約 130 的出口） */
const SHELF_LEN = 470;
/** 斜坡高低差（約 32 度，太平緩彈珠會堆積停住） */
const DROP = 300;

/** 斜坡上保險桿的半徑 */
const BUMPER_R = 16;
/**
 * 保險桿圓心在斜坡中心線正上方的垂直距離：
 * 垂直於斜坡方向扣掉保險桿半徑與半個斜坡厚度後，至少留下一顆彈珠直徑加 8 的通道，
 * 否則彈珠會卡在保險桿與斜坡之間被反覆彈射。
 */
const BUMPER_LIFT = (BUMPER_R + 6 + MARBLE_R * 2 + 8) / Math.cos(Math.atan2(DROP, SHELF_LEN));

/**
 * 依固定配置建立之字迴廊台面：彈珠沿著左右交替、幾乎橫跨全寬的長斜坡來回滾動。
 * 每段斜坡中段有一顆懸空的保險桿製造變數，出口下方放一支旋轉擋板打散排隊的彈珠，
 * 最後經過一小段釘陣抵達終點線。
 * @returns 台面實體
 */
function buildZigzag(): Board {
  const statics: Matter.Body[] = [];
  const spinners: Spinner[] = [];

  for (let k = 0; k < SHELVES; k++) {
    const y = SHELF_TOP + k * PITCH;
    const fromLeft = k % 2 === 0;
    // 斜坡由高側牆面往出口側下降
    const [x1, x2] = fromLeft ? [0, SHELF_LEN] : [WORLD_W, WORLD_W - SHELF_LEN];
    statics.push(segment(x1, y, x2, y + DROP));
    // 斜坡中段上方懸空的保險桿，讓彈珠從底下通過時被彈起
    const bx = fromLeft ? 250 : WORLD_W - 250;
    statics.push(bumper({ x: bx, y: y + (DROP * 250) / SHELF_LEN - BUMPER_LIFT, r: BUMPER_R }));
    // 出口下方的旋轉擋板
    const sx = fromLeft ? 520 : WORLD_W - 520;
    spinners.push(spinner(sx, y + DROP + 90, 100, fromLeft ? 0.05 : -0.05));
  }

  // 最後一支旋轉擋板下方的釘陣，終點線在釘陣下方
  const pegTop = SHELF_TOP + (SHELVES - 1) * PITCH + DROP + 180;
  statics.push(...pegField(pegTop, pegTop + 160, 60, 40, 5));
  const finishY = pegTop + 210;
  const worldH = finishY + 130;

  // 外框：左右牆、天花板、地板（世界高度依配置推算，因此最後加入）
  statics.push(
    Bodies.rectangle(-20, worldH / 2, 40, worldH + 200, STATIC_OPTS),
    Bodies.rectangle(WORLD_W + 20, worldH / 2, 40, worldH + 200, STATIC_OPTS),
    Bodies.rectangle(WORLD_W / 2, -20, WORLD_W + 80, 40, STATIC_OPTS),
    Bodies.rectangle(WORLD_W / 2, worldH + 20, WORLD_W + 80, 40, STATIC_OPTS),
  );

  return { statics, spinners, worldH, finishY };
}

/** 之字迴廊台面定義 */
export const zigzag: BoardDef = { id: 'zigzag', name: '之字迴廊', version: 1, build: buildZigzag };
