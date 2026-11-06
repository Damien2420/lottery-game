import Matter from 'matter-js';
import { MARBLE_R, WORLD_W } from '../physics';
import type { Spinner } from './types';

const { Bodies } = Matter;

/** 圓形區域 */
export interface Circle {
  x: number;
  y: number;
  r: number;
}

/** 靜態物件共用的材質參數 */
export const STATIC_OPTS = { isStatic: true, restitution: 0.3, friction: 0.02, label: 'wall' };

/**
 * 建立兩點之間的斜坡（以旋轉的矩形實作）。
 * @param x1 起點 X
 * @param y1 起點 Y
 * @param x2 終點 X
 * @param y2 終點 Y
 * @param thick 厚度
 * @returns 靜態矩形剛體
 */
export function segment(x1: number, y1: number, x2: number, y2: number, thick = 12): Matter.Body {
  const len = Math.hypot(x2 - x1, y2 - y1);
  return Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2, len, thick, {
    ...STATIC_OPTS,
    angle: Math.atan2(y2 - y1, x2 - x1),
  });
}

/**
 * 產生交錯排列的釘陣。
 * @param y0 起始 Y
 * @param y1 結束 Y
 * @param gapX 水平間距
 * @param gapY 垂直間距
 * @param r 釘子半徑
 * @param avoid 需避開的圓形區域（例如保險桿），與其重疊的釘子不產生
 * @returns 釘子剛體陣列
 */
export function pegField(y0: number, y1: number, gapX: number, gapY: number, r: number, avoid: Circle[] = []): Matter.Body[] {
  const pegs: Matter.Body[] = [];
  for (let y = y0, row = 0; y <= y1; y += gapY, row++) {
    const offset = row % 2 ? gapX / 2 : 0;
    for (let x = 30 + offset; x <= WORLD_W - 30; x += gapX) {
      // 釘子與保險桿之間至少留一顆彈珠的通道
      if (avoid.some((c) => Math.hypot(c.x - x, c.y - y) < c.r + r + MARBLE_R * 2 + 4)) continue;
      pegs.push(Bodies.circle(x, y, r, { ...STATIC_OPTS, label: 'peg' }));
    }
  }
  return pegs;
}

/**
 * 建立旋轉擋板。
 * @param x 中心 X
 * @param y 中心 Y
 * @param len 長度
 * @param speed 每步旋轉弧度
 * @returns 擋板物件
 */
export function spinner(x: number, y: number, len: number, speed: number): Spinner {
  return { body: Bodies.rectangle(x, y, len, 10, { ...STATIC_OPTS, label: 'spinner' }), speed };
}

/**
 * 建立保險桿（碰到會被大力彈開）。
 * @param c 位置與半徑
 * @returns 靜態圓形剛體
 */
export function bumper(c: Circle): Matter.Body {
  return Bodies.circle(c.x, c.y, c.r, { ...STATIC_OPTS, restitution: 1, label: 'bumper' });
}
