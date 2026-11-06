import Matter from 'matter-js';

const { Bodies } = Matter;

/** 世界寬度（物理座標單位） */
export const WORLD_W = 600;
/** 世界高度 */
export const WORLD_H = 3040;
/** 終點線 Y 座標，彈珠中心越過即算抵達 */
export const FINISH_Y = 2910;
/** 彈珠半徑 */
export const MARBLE_R = 9;
/** 起始區可容納的最大人數 */
export const MAX_PLAYERS = 200;

/** 旋轉擋板 */
export interface Spinner {
  body: Matter.Body;
  /** 每個物理步進旋轉的弧度，正值順時針 */
  speed: number;
}

/** 台面上所有固定物件 */
export interface Board {
  statics: Matter.Body[];
  spinners: Spinner[];
}

interface Circle {
  x: number;
  y: number;
  r: number;
}

const STATIC_OPTS = { isStatic: true, restitution: 0.3, friction: 0.02, label: 'wall' };

/**
 * 建立兩點之間的斜坡（以旋轉的矩形實作）。
 * @param x1 起點 X
 * @param y1 起點 Y
 * @param x2 終點 X
 * @param y2 終點 Y
 * @param thick 厚度
 * @returns 靜態矩形剛體
 */
function segment(x1: number, y1: number, x2: number, y2: number, thick = 12): Matter.Body {
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
function pegField(y0: number, y1: number, gapX: number, gapY: number, r: number, avoid: Circle[] = []): Matter.Body[] {
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
function spinner(x: number, y: number, len: number, speed: number): Spinner {
  return { body: Bodies.rectangle(x, y, len, 10, { ...STATIC_OPTS, label: 'spinner' }), speed };
}

/**
 * 建立保險桿（碰到會被大力彈開）。
 * @param c 位置與半徑
 * @returns 靜態圓形剛體
 */
function bumper(c: Circle): Matter.Body {
  return Bodies.circle(c.x, c.y, c.r, { ...STATIC_OPTS, restitution: 1, label: 'bumper' });
}

/**
 * 依固定配置建立整個彈珠台。由上而下依序為：
 * 起始區 → 釘陣 → 斜坡 → 旋轉擋板 → 保險桿釘陣 → 漏斗 → 終點釘陣 → 終點線。
 * @returns 台面物件集合
 */
export function buildBoard(): Board {
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

  // 2. 之字斜坡（坡度約 20 度，太平緩彈珠會堆積停住）
  statics.push(segment(0, 730, 450, 890), segment(600, 950, 150, 1100));

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

  return { statics, spinners };
}
