import Matter from 'matter-js';
import { WORLD_W } from '../physics';
import { bumper, pegField, scoopWheel, segment, STATIC_OPTS, wheel } from './builders';
import type { Flipper, MechanismId, Mechs, Spinner } from './types';

export { MECHANISM_IDS, MECHANISM_INFO, type MechanismId } from './types';

const { Bodies } = Matter;

/** 一個機關區塊的高度（機關本身約占 350，底部留空讓彈珠落到下一段），未啟用的機關以同高的釘陣取代 */
export const SLOT_H = 420;

/** 吹風區：每幾步換一次風向（約 5 秒） */
const WIND_PERIOD = 300;
/** 輸送帶：每幾步反轉一次 */
const BELT_PERIOD = 210;
/** 翻板：一次循環的步數（翻起 FLIP_UP 步、停 12 步、放下 40 步，其餘靜止） */
export const FLIPPER_CYCLE = 200;
/** 翻板：翻起只花的步數，越少翻得越快 */
const FLIP_UP = 3;
/** 重力井：第一顆彈珠被吸住後經過多少步噴發（約 3 秒） */
export const WELL_CHARGE = 180;
/** 重力井：噴發後多少步內不吸引，讓彈珠飛離 */
export const WELL_COOLDOWN = 60;

/**
 * 吹風區目前的風向。
 * @param step 物理步數
 * @param phase 錯開各區塊節奏的相位
 * @returns 1 為往右上、-1 為往左上
 */
export function windDir(step: number, phase: number): 1 | -1 {
  return Math.floor((step + phase) / WIND_PERIOD) % 2 ? 1 : -1;
}

/**
 * 吹風區目前的風力倍率，一陣一陣起伏。
 * @param step 物理步數
 * @param phase 相位
 * @returns 0.55 到 1 之間
 */
export function windGust(step: number, phase: number): number {
  return 0.55 + 0.45 * Math.sin(((step + phase) / WIND_PERIOD) * Math.PI * 2 - Math.PI / 2) ** 2;
}

/**
 * 輸送帶目前的運送方向。
 * @param step 物理步數
 * @param phase 相位
 * @returns 1 往右、-1 往左
 */
export function beltDir(step: number, phase: number): 1 | -1 {
  return Math.floor((step + phase) / BELT_PERIOD) % 2 ? -1 : 1;
}

/**
 * 翻板目前的角度：快速翻起、停住、慢慢放下。
 * @param f 翻板
 * @param step 物理步數
 * @returns 弧度
 */
export function flipperAngle(f: Flipper, step: number): number {
  const t = (step + f.phase) % FLIPPER_CYCLE;
  if (t < FLIP_UP) return f.rest + (f.up - f.rest) * ((t + 1) / FLIP_UP);
  if (t < FLIP_UP + 12) return f.up;
  if (t < FLIP_UP + 52) return f.up + (f.rest - f.up) * ((t - FLIP_UP - 12) / 40);
  return f.rest;
}

/** 建立空的機關集合 */
export function emptyMechs(): Mechs {
  return { winds: [], belts: [], flippers: [], wells: [], pools: [], pads: [], finishCross: [] };
}

/** 收集台面剛體的容器 */
interface Parts {
  statics: Matter.Body[];
  spinners: Spinner[];
}

/**
 * 在台面上放一個機關區塊（高 SLOT_H）。未啟用時以同高的釘陣取代。
 * @param kind 機關種類
 * @param enabled 是否啟用
 * @param top 區塊頂端 Y
 * @param k 區塊序號，用來左右鏡像與錯開節奏
 * @param out 收集靜態物件
 * @param mechs 收集機關資料
 */
export function mechanismSlot(kind: MechanismId, enabled: boolean, top: number, k: number, out: Parts, mechs: Mechs): void {
  if (!enabled) {
    out.statics.push(...pegField(top + 20, top + SLOT_H - 60, 52, 44, 5));
    return;
  }
  const phase = (k * 97) % 400;
  switch (kind) {
    case 'wind': {
      // 上方兩排釘子把彈珠打散，風區內放五顆保險桿；下方兩道斜坡收回中央
      out.statics.push(...pegField(top, top + 50, 48, 40, 5));
      // 風區橫跨全寬、涵蓋整段保險桿；底部停在斜坡上方，避免把牆邊的彈珠壓在牆與斜坡的夾角
      const zone = { x: 0, y: top + 50, w: WORLD_W, h: 230 };
      out.statics.push(
        bumper({ x: 160, y: top + 140, r: 18 }),
        bumper({ x: 300, y: top + 190, r: 18 }),
        bumper({ x: 440, y: top + 140, r: 18 }),
        bumper({ x: 230, y: top + 250, r: 16 }),
        bumper({ x: 370, y: top + 250, r: 16 }),
        segment(0, top + 300, 250, top + 340),
        segment(WORLD_W, top + 300, 350, top + 340),
      );
      mechs.winds.push({ ...zone, phase });
      return;
    }
    case 'splitter': {
      // 輸送帶群：四排錯開的中、短輸送帶，相鄰兩條方向相反，彈珠在帶上被來回送再從端點落下
      out.statics.push(...pegField(top, top + 40, 48, 40, 5));
      const belts = [
        { x: 40, y: top + 90, w: 190 },
        { x: 370, y: top + 90, w: 190 },
        { x: 205, y: top + 170, w: 190 },
        { x: 60, y: top + 250, w: 130 },
        { x: 410, y: top + 250, w: 130 },
        { x: 235, y: top + 330, w: 130 },
      ];
      belts.forEach((t, j) => {
        const belt = { x: t.x, y: t.y, w: t.w, h: 12 };
        out.statics.push(Bodies.rectangle(belt.x + belt.w / 2, belt.y + belt.h / 2, belt.w, belt.h, { ...STATIC_OPTS, label: 'belt' }));
        mechs.belts.push({ ...belt, phase: phase + (j % 2) * BELT_PERIOD });
      });
      return;
    }
    case 'flipper': {
      out.statics.push(...pegField(top, top + 50, 52, 44, 5));
      out.statics.push(segment(0, top + 80, 80, top + 150), segment(WORLD_W, top + 80, WORLD_W - 80, top + 150));
      const y = top + 190;
      const left = Bodies.rectangle(170, y, 190, 12, { ...STATIC_OPTS, label: 'paddle', angle: 0.28 });
      const right = Bodies.rectangle(430, y, 190, 12, { ...STATIC_OPTS, label: 'paddle', angle: -0.28 });
      out.statics.push(left, right);
      // 翻起角度大（約 50 度），三步內翻完，靠近中央那端往上掃，把板上的彈珠拋回上方
      mechs.flippers.push(
        { body: left, len: 190, rest: 0.28, up: -0.6, phase },
        { body: right, len: 190, rest: -0.28, up: 0.6, phase: phase + FLIPPER_CYCLE / 2 },
      );
      out.statics.push(...pegField(top + 250, top + 320, 60, 40, 5));
      return;
    }
    case 'conveyor': {
      out.statics.push(...pegField(top, top + 50, 48, 40, 5));
      const belt = { x: 90, y: top + 110, w: 420, h: 12 };
      out.statics.push(
        Bodies.rectangle(belt.x + belt.w / 2, belt.y + belt.h / 2, belt.w, belt.h, { ...STATIC_OPTS, label: 'belt' }),
        segment(0, top + 190, 250, top + 260),
        segment(WORLD_W, top + 190, 350, top + 260),
      );
      mechs.belts.push({ ...belt, phase });
      return;
    }
    case 'well': {
      // 中央一座大的，左右上方各一座小的
      out.statics.push(...pegField(top, top + 40, 48, 40, 5));
      addWell(300, top + 210, 140, 16, out, mechs);
      addWell(100, top + 130, 72, 10, out, mechs);
      addWell(500, top + 130, 72, 10, out, mechs);
      return;
    }
  }
}

/**
 * 放一座重力井：井心是彈性較高的小圓柱，範圍內的彈珠會被吸住，滿 WELL_CHARGE 步後一起噴出。
 * @param x 中心 X
 * @param y 中心 Y
 * @param r 吸引範圍半徑
 * @param core 井心半徑
 * @param out 收集靜態物件
 * @param mechs 收集機關資料
 * @param repeat 是否可重複吸引同一顆彈珠
 */
function addWell(
  x: number,
  y: number,
  r: number,
  core: number,
  out: Parts,
  mechs: Mechs,
  repeat = false,
): void {
  out.statics.push(Bodies.circle(x, y, core, { ...STATIC_OPTS, restitution: 0.8, label: 'core' }));
  mechs.wells.push({ x, y, r, ...(repeat ? { repeat } : {}) });
}

/**
 * 建立一個集結池的閘門（初始為關閉）。
 * @param x 中心 X
 * @param y 中心 Y
 * @param w 寬度
 * @returns 閘門剛體
 */
function gateBody(x: number, y: number, w: number): Matter.Body {
  return Bodies.rectangle(x, y, w, GATE_H, { ...STATIC_OPTS, label: 'gate' });
}

/**
 * 集結池閘門的厚度。池裡堆了數百顆彈珠時，底層彈珠會被壓進閘門十幾單位深，
 * 閘門太薄（原本 12）時彈珠中心一旦被壓過閘門中線，碰撞修正就會把它往下推出去（漏球），
 * 加厚後要壓進超過厚度一半才會發生。
 */
export const GATE_H = 36;

/**
 * 建立集結池的厚斜牆：上表面與一般 12 厚的 segment 相同位置，多出的厚度往牆下方長（理由同 GATE_H，
 * 高速落下的彈珠撞上池裡的彈珠堆時，會被碰撞修正一次推過 12 厚的斜牆）。
 * @param x1 起點 X
 * @param y1 起點 Y
 * @param x2 終點 X
 * @param y2 終點 Y
 * @returns 靜態矩形剛體
 */
function poolWall(x1: number, y1: number, x2: number, y2: number): Matter.Body {
  const len = Math.hypot(x2 - x1, y2 - y1);
  // 取朝下（Y 為正）的法向量，中心線往下平移，讓上表面維持原位
  const sign = x2 > x1 ? 1 : -1;
  const nx = (-(y2 - y1) / len) * sign;
  const ny = ((x2 - x1) / len) * sign;
  const shift = (GATE_H - 12) / 2;
  return segment(x1 + nx * shift, y1 + ny * shift, x2 + nx * shift, y2 + ny * shift, GATE_H);
}

/** 集結池的高度（區塊頂端到下一段） */
export const POOL_H = 300;

/**
 * 集結池（固定配置）：兩側斜牆匯向中央，底部以閘門封住，池中央一支雙臂攪拌棒，左右上方各一支反向旋轉的十字，把彈珠攪亂。
 * 上方的彈珠全部到齊（最落後的那顆也進池）、或第一顆進池後滿時限時，閘門整個打開讓大家一起出發，
 * 把拉長的隊伍重新收成一個大部隊。
 * @param top 區塊頂端 Y
 * @param k 區塊序號，決定攪拌方向
 * @param out 收集靜態物件與擋板
 * @param mechs 收集機關資料
 * @returns 下一段頂端 Y
 */
export function regroupPool(top: number, k: number, out: Parts, mechs: Mechs): number {
  // 閘門上緣固定在 top + 200（與斜牆末端齊平），厚度往下長
  const gateY = top + 200 + GATE_H / 2;
  const gate = gateBody(300, gateY, 110);
  out.statics.push(poolWall(0, top, 255, top + 200), poolWall(WORLD_W, top, WORLD_W - 255, top + 200), gate);
  // 攪拌棒中心在 top + 110：扇葉尖端停在出口上方，不會在出口來回把最後幾顆彈珠撥回斜牆
  // （實測壓低反而讓開閘時彈珠在池裡多待 15 到 30 秒，抬高後最多約 3 秒）
  const speed = k % 2 ? -0.045 : 0.045;
  out.spinners.push(...wheel(300, top + 110, 150, 2, speed));
  // 延長臂（長 184，尖端剛好掃過閘門面、碰不到斜牆）與主臂同角度同速旋轉：閘門關著時掃到閘門上的彈珠，開閘時移走
  const arms = wheel(300, top + 110, 184, 2, speed);
  out.spinners.push(...arms);
  // 左右兩側各一支十字（長 120），與中央反向轉。中心抬到 top - 50，扇葉尖端與 V 形斜牆、外框和上一段的機關都至少留一顆彈珠多一點的空隙，
  // 彈珠不會被夾在扇葉和牆之間；長 150 的十字在之字與瀑布台面會碰到上一段的輸送帶與斜牆，放不下
  out.spinners.push(...wheel(110, top - 50, 120, 2, -speed * 1.2), ...wheel(WORLD_W - 110, top - 50, 120, 2, speed * 1.2));
  // 池子滿出來時彈珠會往上堆，計數範圍往上多算一段
  mechs.pools.push({
    gate,
    closed: { x: 300, y: gateY },
    top: top - 200,
    bottom: top + 212,
    arms: arms.map((a) => a.body),
    armsAt: { x: 300, y: top + 110 },
  });
  return top + POOL_H;
}

/** 終點池的高度（區塊頂端到終點線） */
export const FINISH_ZONE_H = 540;
/**
 * 終點池（三種台面共用）：上方三座可重複吸引的重力井，下方是坡度平緩的 V 形池，底部正中央一個常開的窄出口，
 * 出口下方接一段只容 2 到 3 顆彈珠並排的漏斗頸直通終點線。
 * 池底兩側各有兩個噴泉式彈射點，把滾過的彈珠朝重力井彈上去；出口正上方一支大十字攪拌棒，
 * 扇葉轉過出口時擋住、轉開時才讓彈珠落下，等於一道會轉的閘門，誰剛好落下是隨機的。
 * 重力井依可選機關開關決定；池子、彈射點與十字固定存在。
 * @param top 區塊頂端 Y
 * @param k 區塊序號，用來錯開翻板節奏
 * @param on 啟用的可選機關
 * @param out 收集靜態物件與擋板
 * @param mechs 收集機關資料
 * @returns 終點線 Y
 */
export function finishZone(top: number, k: number, on: ReadonlySet<string>, out: Parts, mechs: Mechs): number {
  if (on.has('well')) {
    // 終點池的重力井可重複吸引：被彈射點彈回來的彈珠會再被吸住，比賽尾聲仍持續攪和
    addWell(300, top + 150, 110, 16, out, mechs, true);
    addWell(105, top + 110, 75, 10, out, mechs, true);
    addWell(WORLD_W - 105, top + 110, 75, 10, out, mechs, true);
  }
  // V 形池底：坡度約 20 度，兩側斜牆在中央留 64 寬的常開出口
  const floorY = top + 360;
  const bottomY = top + 460;
  out.statics.push(segment(0, floorY, 268, bottomY), segment(WORLD_W, floorY, WORLD_W - 268, bottomY));
  // 出口下方的漏斗頸：內緣從 52 寬收窄到 46 寬（約 2.5 顆彈珠）一路接到終點線，一次只能並排落下 2 到 3 顆
  const neckY = top + FINISH_ZONE_H;
  out.statics.push(segment(268, bottomY, 271, neckY), segment(WORLD_W - 268, bottomY, WORLD_W - 271, neckY));
  // 三臂勺形攪拌棒（最外緣半徑 63）中心在出口正上方，扇葉掃進出口，當作會轉的閘門；
  // 中心比出口低一點（bottomY - 44），勺口朝旋轉方向，能把停在出口邊緣的彈珠勾起帶走
  const scoop = scoopWheel(300, bottomY - 44, 63, k % 2 ? -0.06 : 0.06);
  out.spinners.push(scoop);
  mechs.finishCross.push(scoop.body);
  // 彈射點貼在斜牆上方：靠牆的一個瞄準側邊重力井，靠中央的一個瞄準中央重力井
  const slope = (bottomY - floorY) / 268;
  for (const [x, tx, ty] of [[86, 105, top + 110], [140, 300, top + 150]]) {
    const y = floorY + x * slope - 10;
    mechs.pads.push({ x, y, r: 24, target: { x: tx, y: ty } });
    mechs.pads.push({ x: WORLD_W - x, y, r: 24, target: { x: WORLD_W - tx, y: ty } });
  }
  return top + FINISH_ZONE_H;
}

/** 翻板重力井區的高度 */
export const FLIPPER_WELL_H = 400;

/**
 * 翻板重力井區（經典台面每關固定一處）：上方中央一座重力井，下方左右各一片翻板，
 * 翻板往中央下斜，翻起時把板上的彈珠往上拋回井裡；兩側牆邊有導板把彈珠送上翻板。
 * 翻板與重力井分別依可選機關開關決定：翻板未啟用時保留為固定斜坡，重力井未啟用時不放。
 * @param top 區塊頂端 Y
 * @param k 區塊序號，用來錯開翻板節奏
 * @param on 啟用的可選機關
 * @param out 收集靜態物件
 * @param mechs 收集機關資料
 */
export function flipperWell(top: number, k: number, on: ReadonlySet<string>, out: Parts, mechs: Mechs): void {
  if (on.has('well')) addWell(300, top + 120, 130, 16, out, mechs);
  const y = top + 300;
  const left = Bodies.rectangle(170, y, 190, 12, { ...STATIC_OPTS, label: 'paddle', angle: 0.28 });
  const right = Bodies.rectangle(430, y, 190, 12, { ...STATIC_OPTS, label: 'paddle', angle: -0.28 });
  out.statics.push(left, right, segment(0, top + 235, 82, top + 262), segment(WORLD_W, top + 235, WORLD_W - 82, top + 262));
  if (on.has('flipper')) {
    const phase = (k * 131) % FLIPPER_CYCLE;
    mechs.flippers.push(
      { body: left, len: 190, rest: 0.28, up: -0.6, phase },
      { body: right, len: 190, rest: -0.28, up: 0.6, phase: phase + FLIPPER_CYCLE / 2 },
    );
  }
}
