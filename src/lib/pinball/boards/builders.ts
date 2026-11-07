import Matter from 'matter-js';
import { MARBLE_R, WORLD_W } from '../physics';
import type { Spinner } from './types';

const { Bodies, Body, Query } = Matter;

/** 圓形區域 */
export interface Circle {
  x: number;
  y: number;
  r: number;
}

/** 靜態物件共用的材質參數 */
export const STATIC_OPTS = { isStatic: true, restitution: 0.3, friction: 0.02, frictionStatic: 0, label: 'wall' };

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
 * @param angle 初始角度（弧度）
 * @returns 擋板物件
 */
export function spinner(x: number, y: number, len: number, speed: number, angle = 0): Spinner {
  return { body: Bodies.rectangle(x, y, len, 10, { ...STATIC_OPTS, label: 'spinner', angle }), speed };
}

/**
 * 建立多臂風車：數支共用中心、角度平均錯開的旋轉擋板，轉動時會把彈珠撥回上方或甩向兩側。
 * @param x 中心 X
 * @param y 中心 Y
 * @param len 每支臂（直徑方向）的長度
 * @param arms 臂數（2 為十字、3 為六芒）
 * @param speed 每步旋轉弧度
 * @returns 擋板物件陣列
 */
export function wheel(x: number, y: number, len: number, arms: number, speed: number): Spinner[] {
  return Array.from({ length: arms }, (_, k) => spinner(x, y, len, speed, (Math.PI * k) / arms));
}

/** 勺形攪拌棒臂的厚度 */
const SCOOP_THICK = 10;

/**
 * 建立勺形攪拌棒：三支從中心放射、相隔 120 度的臂，末端往旋轉方向彎起成勺狀，勺尖與折角都是圓的。
 * 實測比較（每種 9 場、60 人）：三臂比四臂在臂與臂之間留出更大的空檔讓彈珠落下，卡住推動從數十次降到約 1 次；
 * 勺口朝後（凸面在前）會把彈珠一路推回斜坡，最差；縮小半徑讓勺尖不碰牆反而讓出口邊緣的彈珠被反覆往上撥。
 * 以複合剛體實作，整體繞中心轉動。
 * @param x 中心 X
 * @param y 中心 Y
 * @param reach 最外緣半徑（含臂的厚度）
 * @param speed 每步旋轉弧度，正值順時針；勺口朝向旋轉方向
 * @returns 擋板物件
 */
export function scoopWheel(x: number, y: number, reach: number, speed: number): Spinner {
  const curl = speed >= 0 ? 1 : -1;
  const half = SCOOP_THICK / 2;
  // 單支臂的折線（臂朝 +X，以勺尖距離為 1 的比例），後兩段往旋轉方向彎
  const shape = [
    [0, 0],
    [0.55, 0],
    [0.8, 0.09],
    [0.96, 0.3],
  ];
  // 縮放到勺尖圓心距離 + 半個厚度剛好等於 reach
  const len = (reach - half) / Math.hypot(0.96, 0.3);
  const parts: Matter.Body[] = [];
  for (let k = 0; k < 3; k++) {
    const a = ((Math.PI * 2) / 3) * k;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const pts = shape.map(([px, py]) => {
      const lx = px * len;
      const ly = py * len * curl;
      return { x: x + lx * cos - ly * sin, y: y + lx * sin + ly * cos };
    });
    for (let j = 0; j < pts.length - 1; j++) {
      const p = pts[j];
      const q = pts[j + 1];
      const segLen = Math.hypot(q.x - p.x, q.y - p.y);
      parts.push(Bodies.rectangle((p.x + q.x) / 2, (p.y + q.y) / 2, segLen, SCOOP_THICK, { label: 'spinner', angle: Math.atan2(q.y - p.y, q.x - p.x) }));
      // 折角與勺尖補一個圓，接縫不留缺口、勺尖是圓的，彈珠碰到會滑開而不是被尖角卡住
      parts.push(Bodies.circle(q.x, q.y, half, { label: 'spinner' }));
    }
  }
  const body = Body.create({ parts, label: 'spinner' });
  Body.setStatic(body, true);
  Body.setPosition(body, { x, y });
  body.restitution = STATIC_OPTS.restitution;
  body.friction = STATIC_OPTS.friction;
  body.frictionStatic = STATIC_OPTS.frictionStatic;
  return { body, speed };
}

/**
 * 建立保險桿（碰到會被大力彈開）。
 * @param c 位置與半徑
 * @returns 靜態圓形剛體
 */
export function bumper(c: Circle): Matter.Body {
  return Bodies.circle(c.x, c.y, c.r, { ...STATIC_OPTS, restitution: 1, label: 'bumper' });
}

/**
 * 建立漏斗：兩側牆面往中間下降，在 exitX 處留下寬 exitW 的出口。
 * @param y 漏斗頂端（牆面處）的 Y
 * @param exitX 出口中心 X
 * @param exitW 出口寬度
 * @param depth 牆面到出口的垂直落差
 * @returns 兩塊斜坡剛體
 */
export function funnel(y: number, exitX: number, exitW: number, depth: number): Matter.Body[] {
  return [segment(0, y, exitX - exitW / 2, y + depth), segment(WORLD_W, y, exitX + exitW / 2, y + depth)];
}

/** 牆邊保險桿的半徑（圓心在牆外，只露出一部分） */
const WALL_BUMPER_R = 22;
/** 牆邊保險桿圓心與牆面的距離（在牆外） */
const WALL_BUMPER_OUT = 6;

/**
 * 沿左右牆加上半嵌在牆內的保險桿，把貼著牆垂直落下的彈珠彈回台面中間。
 * 左右交錯排列；與保險桿太近的釘子會被移除以保留通道，若與其他物件（斜坡、擋板、轉軸等）重疊則略過該位置。
 * @param statics 既有的靜態物件（不含外框）
 * @param spinners 旋轉擋板（以轉動範圍判斷重疊）
 * @param y0 起始 Y
 * @param y1 結束 Y
 * @param pitch 同一側相鄰保險桿的間距
 * @returns 加入保險桿並移除衝突釘子後的靜態物件
 */
export function addWallBumpers(statics: Matter.Body[], spinners: Spinner[], y0: number, y1: number, pitch = 150): Matter.Body[] {
  let out = statics;
  for (let y = y0, i = 0; y <= y1; y += pitch / 2, i++) {
    const c: Circle = { x: i % 2 ? WORLD_W + WALL_BUMPER_OUT : -WALL_BUMPER_OUT, y, r: WALL_BUMPER_R };
    const probe = Bodies.circle(c.x, c.y, c.r + MARBLE_R * 2 + 4);
    const others = out.filter((b) => b.label !== 'peg');
    if (Query.collides(probe, others).length) continue;
    if (spinners.some((s) => Math.hypot(s.body.position.x - c.x, s.body.position.y - c.y) < spinnerReach(s) + c.r + MARBLE_R * 2)) continue;
    out = out.filter((b) => b.label !== 'peg' || !Query.collides(probe, [b]).length);
    out.push(bumper(c));
  }
  return out;
}

/** 旋轉擋板的轉動半徑 */
function spinnerReach(s: Spinner): number {
  const b = s.body.bounds;
  return Math.hypot(b.max.x - b.min.x, b.max.y - b.min.y) / 2;
}


/**
 * 建立外框：左右牆、天花板、地板。標記為 frame 只影響繪製（位於台面外不必畫出），不影響碰撞。
 * @param worldH 世界高度
 * @returns 四面牆剛體
 */
export function frame(worldH: number): Matter.Body[] {
  const opts = { ...STATIC_OPTS, label: 'frame' };
  return [
    Bodies.rectangle(-20, worldH / 2, 40, worldH + 200, opts),
    Bodies.rectangle(WORLD_W + 20, worldH / 2, 40, worldH + 200, opts),
    Bodies.rectangle(WORLD_W / 2, -20, WORLD_W + 80, 40, opts),
    Bodies.rectangle(WORLD_W / 2, worldH + 20, WORLD_W + 80, 40, opts),
  ];
}

/**
 * 一段之字下坡：左右交替、幾乎橫跨全寬的平緩長斜坡。
 * 坡度決定滾動速度（越平緩越慢），不靠阻力拖慢；間距依坡度推算，讓出口落下後有足夠的高度差。
 * @param y 第一層斜坡高端的 Y
 * @param shelves 層數
 * @param slopeDeg 坡度（度）
 * @param fromLeft 第一層是否由左牆往右下
 * @param doors 是否在每層斜坡中段加一扇逆向旋轉門
 * @returns 斜坡、旋轉門與這段之字下坡底部的 Y
 */
export function switchbacks(
  y: number,
  shelves: number,
  slopeDeg: number,
  fromLeft = true,
  doors = false,
): { statics: Matter.Body[]; spinners: Spinner[]; bottom: number } {
  const len = 480;
  const drop = len * Math.tan((slopeDeg * Math.PI) / 180);
  // 上一層出口到下一層斜坡至少留 70 的落差
  const pitch = drop * 0.75 + 70;
  const statics: Matter.Body[] = [];
  const spinners: Spinner[] = [];
  for (let k = 0; k < shelves; k++) {
    const sy = y + k * pitch;
    const left = (k % 2 === 0) === fromLeft;
    const [x1, x2] = left ? [0, len] : [WORLD_W, WORLD_W - len];
    statics.push(segment(x1, sy, x2, sy + drop));
    if (doors) {
      // 旋轉門中心在斜坡上方，臂尖掠過坡面；逆著滾動方向轉，把衝太快的彈珠撥回坡上
      const t = 0.45 + (k % 3) * 0.1;
      const dx = len * t;
      spinners.push(spinner(left ? dx : WORLD_W - dx, sy + drop * t - 52, 80, left ? -0.04 : 0.04));
    }
  }
  return { statics, spinners, bottom: y + (shelves - 1) * pitch + drop };
}
