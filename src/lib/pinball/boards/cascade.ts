import type Matter from 'matter-js';
import { addWallBumpers, bumper, frame, funnel, pegField, segment, spinner, wheel, type Circle } from './builders';
import { emptyMechs, finishZone, MECHANISM_IDS, mechanismSlot, regroupPool, SLOT_H } from './mechanisms';
import type { Board, BoardDef, Spinner } from './types';

/** 瀑布層數 */
const TIERS = 10;
/** 每層階梯的列數 */
const STAIRS = 5;
/** 階梯每列的垂直間距 */
const LEDGE_PITCH = 130;
/** 階梯擋板兩端的高低差（長度 200 時約 13 度，坡度平緩讓彈珠自然滾慢） */
const LEDGE_DROP = 40;

/** 收集台面剛體的容器 */
interface Parts {
  statics: Matter.Body[];
  spinners: Spinner[];
}

/**
 * 產生一列「瀑布階梯」：兩塊同向傾斜的擋板，彈珠沿擋板滾到低端後落到下一列。
 * 偶數列往右滾、奇數列往左滾；擋板高端貼牆、低端遠離牆面，避免彈珠卡在牆角。
 * 兩列擋板錯開，上一列兩個低端（偶數列 200、460；奇數列 140、400）都正好落在下一列擋板上，
 * 且偶數列的空隙（200-260、460-600）與奇數列的空隙（0-140、340-400）沒有重疊，
 * 不會出現一路直落到底的縫。
 * @param y 擋板高端的 Y
 * @param k 列索引，決定傾斜方向
 * @returns 擋板剛體陣列
 */
function ledgeRow(y: number, k: number): Matter.Body[] {
  if (k % 2 === 0) {
    // 往右滾：高端在左
    return [segment(0, y, 200, y + LEDGE_DROP, 10), segment(260, y, 460, y + LEDGE_DROP, 10)];
  }
  // 往左滾：高端在右
  return [segment(600, y, 400, y + LEDGE_DROP, 10), segment(340, y, 140, y + LEDGE_DROP, 10)];
}

/**
 * 瀑布的一層，由上而下：錯落的階梯 → 水池（漏斗）→ 一對反向水車 → 保險桿釘陣。
 * @param y 該層頂端的 Y
 * @param t 層索引，決定水池出口位置與旋轉方向
 * @param out 收集剛體的容器
 * @returns 下一層頂端的 Y
 */
function tier(y: number, t: number, out: Parts): number {
  const dir = t % 2 ? -1 : 1;
  // 1. 瀑布階梯，中段一支旋轉擋板讓彈珠在階梯間跳層
  for (let i = 0; i < STAIRS; i++) out.statics.push(...ledgeRow(y + i * LEDGE_PITCH, t + i));
  out.spinners.push(spinner(300, y + (STAIRS / 2) * LEDGE_PITCH - 30, 80, 0.05 * dir));
  y += STAIRS * LEDGE_PITCH + 40;

  // 2. 水池：出口左右交替
  const exitX = t % 2 ? 420 : 180;
  out.statics.push(...funnel(y, exitX, 64, 180));
  y += 180;

  // 3. 一對反向水車：出口正下方一座、對側一座，把彈珠撈起來甩到另一邊
  out.spinners.push(...wheel(exitX, y + 110, 160, 3, 0.022 * dir), ...wheel(600 - exitX, y + 250, 160, 3, -0.022 * dir));
  y += 360;

  // 4. 保險桿釘陣
  const bumpers: Circle[] = [
    { x: 150, y: y + 70, r: 20 },
    { x: 450, y: y + 70, r: 20 },
    { x: 300, y: y + 190, r: 22 },
  ];
  out.statics.push(...bumpers.map(bumper), ...pegField(y, y + 260, 54, 46, 5, bumpers));
  return y + 320;
}

/**
 * 依固定配置建立瀑布台面：十層瀑布，每層是平緩錯落的階梯、水池、一對水車與保險桿釘陣。
 * 左右牆邊有半嵌的保險桿防止彈珠貼牆直落；每兩層之後有一個可選機關區塊，
 * 第 4、8 層之後各有一座集結池把隊伍收攏成大部隊，最後經過終點池抵達終點線。
 * @param mechanisms 要啟用的可選機關，預設全部
 * @returns 台面實體
 */
function buildCascade(mechanisms: readonly string[] = MECHANISM_IDS): Board {
  const out: Parts = { statics: [], spinners: [] };
  const on = new Set<string>(mechanisms);
  const mechs = emptyMechs();
  let y = 300;
  for (let t = 0; t < TIERS; t++) {
    y = tier(y, t, out);
    // 奇數層之後各放一個可選機關區塊，五種各出現一次
    if (t % 2 === 1) {
      const slot = (t - 1) / 2;
      const kind = MECHANISM_IDS[slot % MECHANISM_IDS.length];
      mechanismSlot(kind, on.has(kind), y, slot, out, mechs);
      y += SLOT_H;
    }
    if (t === 3 || t === 7) y = regroupPool(y, t, out, mechs);
  }
  // 終點前翻板區，區塊底部就是終點線
  const finishY = finishZone(y, TIERS, on, out, mechs);
  const worldH = finishY + 130;
  const statics = addWallBumpers(out.statics, out.spinners, 340, finishY - 60);
  return { statics: [...statics, ...frame(worldH)], spinners: out.spinners, mechs, worldH, finishY };
}

/** 瀑布台面定義 */
export const cascade: BoardDef = { id: 'cascade', name: '瀑布', version: 13, build: buildCascade };
