import type Matter from 'matter-js';
import { addWallBumpers, frame, funnel, pegField, switchbacks, wheel } from './builders';
import { emptyMechs, finishZone, MECHANISM_IDS, mechanismSlot, regroupPool, SLOT_H } from './mechanisms';
import type { Board, BoardDef, Spinner } from './types';

/** 迴廊段數 */
const CORRIDORS = 4;
/** 每段迴廊的斜坡數 */
const SHELVES = 8;
/** 斜坡坡度（度）；坡度平緩，彈珠自然滾得慢 */
const SLOPE = 8;

/** 收集台面剛體的容器 */
interface Parts {
  statics: Matter.Body[];
  spinners: Spinner[];
}

/**
 * 迴廊之間的大廳：漏斗匯向出口，下方三臂風車把彈珠甩散，再經過一小段釘陣。
 * @param y 大廳頂端的 Y
 * @param c 迴廊索引，決定出口位置與旋轉方向
 * @param out 收集剛體的容器
 * @returns 下一段迴廊頂端的 Y
 */
function hall(y: number, c: number, out: Parts): number {
  // 漏斗出口左右交替，讓彈珠在大廳多走一段
  const exitX = c % 2 ? 380 : 220;
  out.statics.push(...funnel(y + 40, exitX, 64, 170));
  y += 210;
  out.spinners.push(...wheel(exitX, y + 100, 140, 3, c % 2 ? 0.03 : -0.03));
  out.statics.push(...pegField(y + 210, y + 330, 60, 40, 5));
  return y + 400;
}

/**
 * 依固定配置建立之字迴廊台面：四段平緩的長斜坡迴廊，每層斜坡中段有逆向旋轉門把衝太快的彈珠撥回坡上；
 * 迴廊之間的大廳有風車與釘陣；第一、三段迴廊之後各有一座集結池把隊伍收攏成大部隊，最後經過終點池抵達終點線。
 * 起點下方與每個大廳之後各有一個可選機關區塊；左右牆邊有半嵌的保險桿防止彈珠貼牆直落。
 * @param mechanisms 要啟用的可選機關，預設全部
 * @returns 台面實體
 */
function buildZigzag(mechanisms: readonly string[] = MECHANISM_IDS): Board {
  const out: Parts = { statics: [], spinners: [] };
  const on = new Set<string>(mechanisms);
  const mechs = emptyMechs();
  // 可選機關區塊：起點下方一個、每個大廳之後一個，五種各出現一次
  let slot = 0;
  const addSlot = (top: number): number => {
    const kind = MECHANISM_IDS[slot % MECHANISM_IDS.length];
    mechanismSlot(kind, on.has(kind), top, slot, out, mechs);
    slot++;
    return top + SLOT_H;
  };
  let y = addSlot(260);
  for (let c = 0; c < CORRIDORS; c++) {
    const sb = switchbacks(y, SHELVES, SLOPE, c % 2 === 0, true);
    out.statics.push(...sb.statics);
    out.spinners.push(...sb.spinners);
    y = addSlot(hall(sb.bottom, c, out));
    if (c === 0 || c === 2) y = regroupPool(y, c, out, mechs);
  }
  const finishY = finishZone(y, slot, on, out, mechs);
  const worldH = finishY + 130;
  const statics = addWallBumpers(out.statics, out.spinners, 300, finishY - 60);
  return { statics: [...statics, ...frame(worldH)], spinners: out.spinners, mechs, worldH, finishY };
}

/** 之字迴廊台面定義 */
export const zigzag: BoardDef = { id: 'zigzag', name: '之字迴廊', version: 13, build: buildZigzag };
