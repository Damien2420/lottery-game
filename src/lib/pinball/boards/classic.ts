import type Matter from 'matter-js';
import { addWallBumpers, bumper, frame, funnel, pegField, spinner, wheel, type Circle } from './builders';
import { emptyMechs, finishZone, FLIPPER_WELL_H, flipperWell, MECHANISM_IDS, mechanismSlot, regroupPool, SLOT_H, type MechanismId } from './mechanisms';
import type { Board, BoardDef, Mechs, Spinner } from './types';

/** 關卡數 */
const ACTS = 9;
/** 哪幾關之後放集結池 */
const POOL_AFTER = [3, 7];

/** 收集台面剛體的容器 */
interface Parts {
  statics: Matter.Body[];
  spinners: Spinner[];
}

/**
 * 經典台面的一個關卡，由上而下：釘陣 → 翻板重力井區 → 旋轉擋板林 → 保險桿釘陣 → 漏斗與十字風車。
 * @param y 關卡頂端的 Y
 * @param k 關卡索引，決定旋轉方向與配置錯位
 * @param out 收集剛體的容器
 * @param mech 啟用的可選機關與收集機關資料的容器
 * @returns 下一關的頂端 Y
 */
function act(y: number, k: number, out: Parts, mech: { on: Set<string>; mechs: Mechs }): number {
  const dir = k % 2 ? -1 : 1;
  // 1. 釘陣
  out.statics.push(...pegField(y, y + 400, 48, 40, 5));
  y += 480;

  // 2. 翻板重力井區：重力井吸住彈珠約 3 秒後噴發，下方翻板把彈珠拋回井裡
  flipperWell(y, k, mech.on, out, mech.mechs);
  y += FLIPPER_WELL_H;

  // 3. 旋轉擋板林：三排交錯、相鄰反向
  for (let row = 0; row < 3; row++) {
    const xs = row % 2 ? [200, 400] : [90, 300, 510];
    xs.forEach((x, i) => out.spinners.push(spinner(x, y + row * 130, 130, 0.04 * dir * (i % 2 ? -1 : 1) * (row % 2 ? -1 : 1))));
  }
  y += 400;

  // 3.5 可選機關區塊：依關卡輪流放五種機關，未啟用時改放同高的釘陣
  const kind: MechanismId = MECHANISM_IDS[k % MECHANISM_IDS.length];
  mechanismSlot(kind, mech.on.has(kind), y, k, out, mech.mechs);
  y += SLOT_H;

  // 4. 保險桿釘陣（保險桿位置依關卡左右錯位）
  const shift = k % 2 ? 60 : -60;
  const bumpers: Circle[] = [
    { x: 300 + shift, y: y + 60, r: 20 },
    { x: 140, y: y + 190, r: 20 },
    { x: 460, y: y + 190, r: 20 },
    { x: 300 - shift, y: y + 320, r: 20 },
  ];
  out.statics.push(...bumpers.map(bumper), ...pegField(y, y + 380, 60, 50, 6, bumpers));
  y += 440;

  // 5. 漏斗匯向中央，出口下方的十字風車把排隊的彈珠撥散；最後一關直接接終點前蓄球區，不放風車
  out.statics.push(...funnel(y, 300, 64, 170));
  y += 170;
  if (k < ACTS - 1) out.spinners.push(...wheel(300, y + 110, 150, 2, 0.025 * dir));
  return y + 230;
}

/**
 * 依固定配置建立經典彈珠台：九個關卡依序堆疊，每關包含釘陣、翻板重力井區、旋轉擋板林、可選機關區塊、保險桿與風車漏斗。
 * 左右牆邊有半嵌的保險桿防止彈珠貼牆直落；第 4、8 關之後各有一座集結池把隊伍收攏成大部隊，最後經過終點池抵達終點線。
 * @param mechanisms 要啟用的可選機關，預設全部
 * @returns 台面實體
 */
function buildClassic(mechanisms: readonly string[] = MECHANISM_IDS): Board {
  const out: Parts = { statics: [], spinners: [] };
  const mech = { on: new Set(mechanisms), mechs: emptyMechs() };
  let y = 290;
  for (let k = 0; k < ACTS; k++) {
    y = act(y, k, out, mech);
    if (POOL_AFTER.includes(k)) y = regroupPool(y, k, out, mech.mechs);
  }

  // 終點池，區塊底部就是終點線
  const finishY = finishZone(y, ACTS, mech.on, out, mech.mechs);
  const worldH = finishY + 130;
  const statics = addWallBumpers(out.statics, out.spinners, 330, finishY - 60);
  return { statics: [...statics, ...frame(worldH)], spinners: out.spinners, mechs: mech.mechs, worldH, finishY };
}

/** 經典台面定義 */
export const classic: BoardDef = { id: 'classic', name: '經典', version: 16, build: buildClassic };
