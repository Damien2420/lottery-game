import Matter from 'matter-js';
import { WORLD_W } from '../physics';
import { bumper, pegField, segment, spinner, STATIC_OPTS, type Circle } from './builders';
import type { Board, BoardDef, Spinner } from './types';

const { Bodies } = Matter;

/** 第一段階梯層數 */
const STAIRS_1 = 7;
/** 第二段階梯層數 */
const STAIRS_2 = 6;
/** 水池出口寬度 */
const POOL_EXIT = 50;
/** 階梯每層的垂直間距 */
const LEDGE_PITCH = 130;
/** 階梯擋板兩端的高低差（長度 200 時約 24 度） */
const LEDGE_DROP = 90;

/**
 * 產生一層「瀑布階梯」：兩塊同向傾斜的擋板，彈珠沿擋板滾到低端後落到下一層。
 * 偶數層往右滾、奇數層往左滾，且兩層擋板錯開，讓上一層低端正好落在下一層擋板上。
 * 擋板與牆面至少保留 40 的距離，避免彈珠卡在牆角。
 * @param y 擋板高端的 Y
 * @param k 層數索引，決定錯位與傾斜方向
 * @returns 擋板剛體陣列
 */
function ledgeRow(y: number, k: number): Matter.Body[] {
  if (k % 2 === 0) {
    // 往右滾：高端在左
    return [segment(40, y, 240, y + LEDGE_DROP, 10), segment(310, y, 510, y + LEDGE_DROP, 10)];
  }
  // 往左滾：高端在右
  return [segment(380, y, 180, y + LEDGE_DROP, 10), segment(560, y, 450, y + (LEDGE_DROP * 110) / 200, 10)];
}

/**
 * 產生一段連續的瀑布階梯。
 * @param y0 第一層擋板高端的 Y
 * @param rows 層數
 * @param k0 第一層的層數索引
 * @returns 擋板剛體陣列
 */
function ledgeStairs(y0: number, rows: number, k0: number): Matter.Body[] {
  return Array.from({ length: rows }, (_, i) => ledgeRow(y0 + i * LEDGE_PITCH, k0 + i)).flat();
}

/**
 * 依固定配置建立瀑布台面：彈珠在層層錯開的短擋板與水池之間跌落。
 * 由上而下依序為：第一段階梯 → 水池一（中央出口）→ 倒 V 分流與兩側旋轉擋板 → 保險桿釘陣
 * → 水池二（右側出口）→ 第二段階梯 → 終點釘陣 → 終點線。
 * @returns 台面實體
 */
function buildCascade(): Board {
  const statics: Matter.Body[] = [];
  const spinners: Spinner[] = [];

  // 以 y 作為由上而下的配置游標，各區段只描述相對位置
  let y = 320;

  // 1. 第一段瀑布階梯
  statics.push(...ledgeStairs(y, STAIRS_1, 0));
  y += STAIRS_1 * LEDGE_PITCH + 40;

  // 2. 水池一：兩側斜坡匯向中央
  statics.push(segment(0, y, 300 - POOL_EXIT / 2, y + 150), segment(WORLD_W, y, 300 + POOL_EXIT / 2, y + 150));
  spinners.push(spinner(300, y + 230, 110, 0.05));
  y += 320;

  // 3. 倒 V 分流把彈珠分往左右兩側，兩側通道各有旋轉擋板
  statics.push(segment(300, y, 150, y + 90), segment(300, y, 450, y + 90));
  spinners.push(spinner(110, y + 200, 130, -0.04), spinner(490, y + 200, 130, 0.04));
  statics.push(bumper({ x: 300, y: y + 210, r: 24 }));
  y += 340;

  // 4. 保險桿釘陣（保險桿排成菱形）
  const bumpers: Circle[] = [
    { x: 300, y: y + 60, r: 20 },
    { x: 180, y: y + 180, r: 20 },
    { x: 420, y: y + 180, r: 20 },
    { x: 300, y: y + 300, r: 20 },
  ];
  statics.push(...bumpers.map(bumper), ...pegField(y, y + 360, 54, 46, 5, bumpers));
  y += 420;

  // 5. 水池二：長斜坡由左牆往右下，出口偏右
  const exitX = 440;
  statics.push(segment(0, y, exitX - POOL_EXIT / 2, y + 190), segment(WORLD_W, y + 100, exitX + POOL_EXIT / 2, y + 190));
  spinners.push(spinner(exitX, y + 270, 110, -0.05));
  y += 370;

  // 6. 第二段瀑布階梯
  statics.push(...ledgeStairs(y, STAIRS_2, 1));
  y += STAIRS_2 * LEDGE_PITCH + 40;

  // 7. 終點前釘陣，終點線在釘陣下方
  statics.push(...pegField(y, y + 260, 60, 44, 5));
  const finishY = y + 310;
  const worldH = finishY + 130;

  // 外框：左右牆、天花板、地板（世界高度在配置完成後才確定，因此最後加入）
  statics.push(
    Bodies.rectangle(-20, worldH / 2, 40, worldH + 200, STATIC_OPTS),
    Bodies.rectangle(WORLD_W + 20, worldH / 2, 40, worldH + 200, STATIC_OPTS),
    Bodies.rectangle(WORLD_W / 2, -20, WORLD_W + 80, 40, STATIC_OPTS),
    Bodies.rectangle(WORLD_W / 2, worldH + 20, WORLD_W + 80, 40, STATIC_OPTS),
  );

  return { statics, spinners, worldH, finishY };
}

/** 瀑布台面定義 */
export const cascade: BoardDef = { id: 'cascade', name: '瀑布', version: 1, build: buildCascade };
