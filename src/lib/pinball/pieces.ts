/**
 * 台面機關的繪製元件（實體桌遊棋子風格）。
 * 規則：擋得住彈珠的零件有一段朝畫面下方的硬邊側面（extrude）；只影響彈珠的感應區是印在台面上的平面圖案；
 * 金色只用在轉軸與觸發瞬間。這裡只負責畫，不讀寫任何物理或模擬狀態。
 */

/** 轉軸金與其側面色 */
export const GOLD = '#f2a100';
const GOLD_SIDE = '#a86b00';
const TAU = Math.PI * 2;

/** 機關配色（深淺色各一套，由 game.ts 傳入） */
export interface PiecePalette {
  /** 白色零件（翻板、凸台、滾輪）的頂面與側面 */
  lightTop: string;
  lightSide: string;
  /** 墨黑零件（保險桿底座、擋板、輸送帶、閘門、井心）的頂面與側面 */
  darkTop: string;
  darkSide: string;
  /** 釘子的頂面與側面 */
  pegTop: string;
  pegSide: string;
  /** 斜坡導軌的頂面、側面與溝槽 */
  railTop: string;
  railSide: string;
  railLine: string;
  /** 感應區底色 */
  print: string;
  /** 印刷圖案用的墨色 RGB（以空白分隔，例如 '11 12 15'） */
  inkRgb: string;
}

/** 墨色加透明度 */
function ink(P: PiecePalette, a: number): string {
  return `rgb(${P.inkRgb} / ${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

/** 金色加透明度 */
function gold(a: number): string {
  return `rgb(242 161 0 / ${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
}

/**
 * 擠出：由下往上逐層畫側面，最後畫頂面。
 * @param g 畫布
 * @param depth 側面厚度（世界單位）
 * @param side 側面色
 * @param top 頂面色
 * @param path 建立頂面路徑的函式（路徑以當下的座標轉換記錄）
 */
function extrude(g: CanvasRenderingContext2D, depth: number, side: string, top: string, path: () => void): void {
  for (let k = depth; k > 0; k--) {
    g.save();
    g.translate(0, k);
    path();
    g.fillStyle = side;
    g.fill();
    g.restore();
  }
  path();
  g.fillStyle = top;
  g.fill();
}

/** 在 (cx, cy) 旋轉 a 的本地座標系中執行 fn */
function local(g: CanvasRenderingContext2D, cx: number, cy: number, a: number, fn: () => void): void {
  g.save();
  g.translate(cx, cy);
  g.rotate(a);
  fn();
  g.restore();
}

/** 金色轉軸 */
export function hub(g: CanvasRenderingContext2D, x: number, y: number, r = 5): void {
  circle(g, x, y + 2, r);
  g.fillStyle = GOLD_SIDE;
  g.fill();
  circle(g, x, y, r);
  g.fillStyle = GOLD;
  g.fill();
}

/**
 * 斜坡導軌：冷灰條、頂面溝槽（厚牆兩條）、兩端螺絲。
 * @param g 畫布
 * @param P 配色
 * @param cx 中心 X
 * @param cy 中心 Y
 * @param a 角度（弧度）
 * @param len 長度
 * @param th 厚度
 */
export function rail(g: CanvasRenderingContext2D, P: PiecePalette, cx: number, cy: number, a: number, len: number, th: number): void {
  // 角度收斂到 (-90°, 90°]，讓本地 -Y 永遠是朝上的那一面（彈珠滾過的上緣）
  let ang = a % Math.PI;
  if (ang > Math.PI / 2) ang -= Math.PI;
  if (ang <= -Math.PI / 2) ang += Math.PI;
  const r = Math.min(6, th / 2);
  extrude(g, 4, P.railSide, P.railTop, () => local(g, cx, cy, ang, () => {
    g.beginPath();
    g.roundRect(-len / 2, -th / 2, len, th, r);
  }));
  if (len < 30) return;
  local(g, cx, cy, ang, () => {
    const grooves = th > 20 ? [-th / 2 + 7, -th / 2 + 14] : [0];
    g.fillStyle = P.railLine;
    for (const gy of grooves) {
      g.beginPath();
      g.roundRect(-len / 2 + 13, gy - 1.5, len - 26, 3, 1.5);
      g.fill();
    }
    g.fillStyle = P.railSide;
    for (const sx of [-len / 2 + 6.5, len / 2 - 6.5]) {
      circle(g, sx, grooves[0], 2.2);
      g.fill();
    }
  });
}

/** 釘子：白色小柱加 2 單位側面 */
export function peg(g: CanvasRenderingContext2D, P: PiecePalette, x: number, y: number, r: number): void {
  extrude(g, 2, P.pegSide, P.pegTop, () => circle(g, x, y, r));
}

/**
 * 保險桿：墨黑底座疊白色凸台與中央按鈕；被撞時頂面下壓、按鈕亮金色。
 * @param f 撞擊強度，0 為平時、1 為剛被撞
 */
export function bumper(g: CanvasRenderingContext2D, P: PiecePalette, x: number, y: number, r: number, f: number): void {
  const depth = 5;
  const press = 3 * f;
  circle(g, x, y + depth, r);
  g.fillStyle = P.darkSide;
  g.fill();
  g.fillRect(x - r, y + press, r * 2, depth - press);
  const ty = y + press;
  circle(g, x, ty, r);
  g.fillStyle = P.darkTop;
  g.fill();
  circle(g, x, ty + 2, r * 0.6);
  g.fillStyle = P.lightSide;
  g.fill();
  circle(g, x, ty, r * 0.6);
  g.fillStyle = P.lightTop;
  g.fill();
  circle(g, x, ty, r * 0.24);
  g.fillStyle = f > 0 ? GOLD : P.darkTop;
  g.fill();
}

/**
 * 翻板：繞中心轉的白色長板。
 * @param pivot 是否畫轉軸（未啟用翻板時保留為固定斜坡，不畫轉軸）
 */
export function plank(
  g: CanvasRenderingContext2D, P: PiecePalette, cx: number, cy: number, a: number, len: number, th: number, pivot: boolean,
): void {
  extrude(g, 4, P.lightSide, P.lightTop, () => local(g, cx, cy, a, () => {
    g.beginPath();
    g.roundRect(-len / 2, -th / 2, len, th, th / 2);
  }));
  if (pivot) hub(g, cx, cy, 4.6);
}

/**
 * 旋轉擋板的一支臂。
 * @param light true 為集結池的白色伸縮段（延長臂），false 為墨黑擋板（帶溝槽與轉軸）
 */
export function spinnerBar(
  g: CanvasRenderingContext2D, P: PiecePalette, cx: number, cy: number, a: number, len: number, th: number, light: boolean,
): void {
  extrude(g, 4, light ? P.lightSide : P.darkSide, light ? P.lightTop : P.darkTop, () => local(g, cx, cy, a, () => {
    g.beginPath();
    g.roundRect(-len / 2, -th / 2, len, th, th / 2);
  }));
  if (light) return;
  if (len > 40) {
    local(g, cx, cy, a, () => {
      g.fillStyle = P.lightSide;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.roundRect(s > 0 ? 9 : -len / 2 + 8, -1.5, len / 2 - 17, 3, 1.5);
        g.fill();
      }
    });
  }
  hub(g, cx, cy);
}

/** 勺形攪拌棒單支臂的折線（以勺尖距離為 1 的比例），與 builders.scoopWheel 相同 */
const SCOOP_SHAPE = [[0, 0], [0.55, 0], [0.8, 0.09], [0.96, 0.3]];

/**
 * 勺形轉子：中央圓盤加三片彎曲葉片，葉片嵌溝槽、尖端一顆白色滾珠。
 * @param reach 最外緣半徑（含臂厚度）
 * @param a 目前角度
 * @param curl 勺口方向（1 或 -1，與旋轉方向相同）
 */
export function scoopRotor(
  g: CanvasRenderingContext2D, P: PiecePalette, cx: number, cy: number, reach: number, a: number, curl: number,
): void {
  const len = (reach - 5) / Math.hypot(0.96, 0.3);
  const pts = SCOOP_SHAPE.map(([px, py]) => [px * len, py * len * curl]);
  const blades = (color: string, dy: number) => {
    g.save();
    g.translate(cx, cy + dy);
    g.rotate(a);
    g.lineWidth = 10;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = color;
    for (let k = 0; k < 3; k++) {
      g.save();
      g.rotate((TAU / 3) * k);
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
      g.restore();
    }
    g.restore();
  };
  for (let k = 4; k > 0; k--) {
    blades(P.darkSide, k);
    circle(g, cx, cy + k, 12);
    g.fillStyle = P.darkSide;
    g.fill();
  }
  blades(P.darkTop, 0);
  circle(g, cx, cy, 12);
  g.fillStyle = P.darkTop;
  g.fill();
  local(g, cx, cy, a, () => {
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = P.lightSide;
    for (let k = 0; k < 3; k++) {
      g.save();
      g.rotate((TAU / 3) * k);
      g.beginPath();
      g.moveTo(16, 0);
      g.lineTo(pts[1][0], pts[1][1]);
      g.lineTo(pts[2][0], pts[2][1]);
      const [ex, ey] = pts[3];
      const [px, py] = pts[2];
      g.lineTo(px + (ex - px) * 0.55, py + (ey - py) * 0.55);
      g.stroke();
      circle(g, ex, ey, 3);
      g.fillStyle = P.lightTop;
      g.fill();
      g.restore();
    }
  });
  circle(g, cx, cy, 8);
  g.fillStyle = P.lightTop;
  g.fill();
  hub(g, cx, cy, 4.5);
}

/**
 * 輸送帶：墨黑帶身、朝運送方向流動的履帶紋、兩端白色滾輪。
 * @param dir 1 往右、-1 往左
 * @param step 物理步數（決定履帶紋位移）
 */
export function belt(
  g: CanvasRenderingContext2D, P: PiecePalette, x: number, y: number, w: number, h: number, dir: number, step: number,
): void {
  extrude(g, 4, P.darkSide, P.darkTop, () => {
    g.beginPath();
    g.roundRect(x, y, w, h, h / 2);
  });
  g.save();
  g.beginPath();
  g.rect(x + h, y, w - h * 2, h);
  g.clip();
  g.strokeStyle = P.lightSide;
  g.lineWidth = 2;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const off = ((step * 1.6) % 16) * dir;
  for (let cx = x - 16; cx < x + w + 16; cx += 16) {
    const px = cx + off;
    g.beginPath();
    g.moveTo(px - 2.5 * dir, y + 3);
    g.lineTo(px + 2.5 * dir, y + h / 2);
    g.lineTo(px - 2.5 * dir, y + h - 3);
    g.stroke();
  }
  g.restore();
  for (const rx of [x + h / 2, x + w - h / 2]) {
    circle(g, rx, y + h / 2, h / 2 - 1.5);
    g.fillStyle = P.lightTop;
    g.fill();
    circle(g, rx, y + h / 2, 1.6);
    g.fillStyle = P.darkTop;
    g.fill();
  }
}

/**
 * 集結池雙開閘門：兩扇墨黑門板，共六顆燈號由兩側往中央依序亮起。
 * @param lit 亮起的燈號數（0 到 6）
 * @param open 0 為關、1 為全開（兩扇門往左右滑出）
 */
export function gateDoors(
  g: CanvasRenderingContext2D, P: PiecePalette, cx: number, cy: number, w: number, h: number, lit: number, open: number,
): void {
  const half = w / 2;
  const slide = half * open;
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? cx - half - slide : cx + slide;
    extrude(g, 4, P.darkSide, P.darkTop, () => {
      g.beginPath();
      g.roundRect(x0, cy - h / 2, half, h, 5);
    });
    // 門縫邊條
    g.fillStyle = P.lightSide;
    g.fillRect(s < 0 ? x0 + half - 4 : x0 + 1, cy - h / 2 + 5, 3, h - 10);
    for (let i = 0; i < 3; i++) {
      const order = s < 0 ? i * 2 : i * 2 + 1;
      const lx = s < 0 ? x0 + 12 + i * 14 : x0 + half - 12 - i * 14;
      circle(g, lx, cy, 4);
      g.fillStyle = P.darkSide;
      g.fill();
      if (order < lit) {
        circle(g, lx, cy, 3.2);
        g.fillStyle = GOLD;
        g.fill();
      }
    }
  }
}

/** 重力井井心：墨黑圓柱，中央白點 */
export function core(g: CanvasRenderingContext2D, P: PiecePalette, x: number, y: number, r: number): void {
  extrude(g, 3, P.darkSide, P.darkTop, () => circle(g, x, y, r));
  circle(g, x, y, r * 0.42);
  g.fillStyle = P.lightTop;
  g.fill();
}

/** 卡通風紋的外形（本地座標，x 軸為風向）：一段微彎的尾巴，前端往上捲成向內收的螺旋 */
const GUST_PATH: [number, number][] = (() => {
  const pts: [number, number][] = [];
  const R = 14;
  const TAIL = 78;
  for (let i = 0; i <= 26; i++) {
    const x = -TAIL + (TAIL * i) / 26;
    pts.push([x, Math.sin((x + TAIL) / 26) * 2.5 * (1 - i / 26)]);
  }
  for (let i = 1; i <= 40; i++) {
    const k = i / 40;
    const a = Math.PI / 2 - k * Math.PI * 1.6;
    const r = R * (1 - 0.65 * k);
    pts.push([Math.cos(a) * r, -R + Math.sin(a) * r]);
  }
  return pts;
})();

/** 一道卡通風紋從畫出到收掉的毫秒數 */
const GUST_LIFE = 2400;
/** 吹風區內同時出現的風紋數 */
const GUSTS = 6;

/**
 * 吹風區：淡色區塊 + 此起彼落的卡通風紋（一筆畫出、順風飄、再從尾巴收掉）。
 * @param zone 吹風區範圍
 * @param ts 本次風向開始後經過的毫秒數
 * @param periodMs 一次風向持續的毫秒數
 * @param dir 1 往右上、-1 往左上
 * @param gust 風力倍率（0.55 到 1）
 */
export function windZone(
  g: CanvasRenderingContext2D, P: PiecePalette, zone: { x: number; y: number; w: number; h: number },
  ts: number, periodMs: number, dir: number, gust: number,
): void {
  const fade = Math.min(1, ts / 700, (periodMs - ts) / 500);
  const ang = Math.atan2(-1, dir * 0.85);
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  g.save();
  g.beginPath();
  g.roundRect(zone.x, zone.y, zone.w, zone.h, 18);
  g.fillStyle = P.print;
  g.fill();
  g.clip();
  const n = GUST_PATH.length - 1;
  for (let i = 0; i < GUSTS; i++) {
    const lt = ts + i * (GUST_LIFE / GUSTS);
    const cycle = Math.floor(lt / GUST_LIFE);
    const q = (lt % GUST_LIFE) / GUST_LIFE;
    // 每一輪換一個起點（固定的偽隨機），散佈在整個吹風區
    const h = Math.sin((cycle * 7 + i) * 12.9898) * 43758.5453;
    const rx = h - Math.floor(h);
    const ry = h * 7.13 - Math.floor(h * 7.13);
    const x0 = zone.x + 60 + rx * (zone.w - 120);
    const y0 = zone.y + 70 + ry * (zone.h - 90);
    const drift = q * 70 * (0.7 + 0.5 * gust);
    const i0 = Math.floor(Math.max(0, (q - 0.55) / 0.45) * n);
    const i1 = Math.ceil(Math.min(1, q / 0.45) * n);
    if (i1 - i0 < 2) continue;
    g.save();
    g.translate(x0 + ux * drift, y0 + uy * drift);
    g.rotate(ang);
    g.scale(1, dir > 0 ? 1 : -1);
    g.beginPath();
    g.moveTo(GUST_PATH[i0][0], GUST_PATH[i0][1]);
    for (let j = i0 + 1; j <= i1; j++) g.lineTo(GUST_PATH[j][0], GUST_PATH[j][1]);
    g.lineWidth = 3.2;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = ink(P, (0.3 + 0.25 * gust) * fade);
    g.stroke();
    g.restore();
  }
  g.restore();
}

/**
 * 重力井（水流漩渦）：範圍線、一層層加深的凹陷、繞中心旋轉並捲入的水流線。
 * @param w 井的位置與吸引半徑
 * @param inner 水流線最內圈的半徑（約井心外緣）
 * @param k 蓄力程度 0 到 1（已平滑過渡）：捲得更緊、線更多更粗、轉成金色
 * @param flow 往內流動的相位（每 1 為一趟）
 * @param spin 整體自轉角度（弧度）
 * @param vis 水流的可見程度 0 到 1：噴發時被衝散（往外推開並淡出），之後從外圍收回並淡入
 */
export function wellFlow(
  g: CanvasRenderingContext2D, P: PiecePalette, w: { x: number; y: number; r: number }, inner: number,
  k: number, flow: number, spin: number, vis: number,
): void {
  g.lineWidth = 1.5;
  g.strokeStyle = ink(P, 0.14);
  circle(g, w.x, w.y, w.r);
  g.stroke();
  if (vis <= 0.01) return;
  for (let j = 1; j <= 6; j++) {
    circle(g, w.x, w.y, w.r * (1 - j / 7.5));
    g.fillStyle = ink(P, (0.022 + 0.01 * k) * vis);
    g.fill();
  }
  // 不可見時水流線往外擴散，淡入時看起來是從外圍被重新吸回來
  const spread = 1 + 0.3 * (1 - vis);
  // 墨色與金色依蓄力程度連續混色，進入與離開蓄力時不會突然換色
  const [ir, ig, ib] = P.inkRgb.split(' ').map(Number);
  const mix = `rgb(${Math.round(ir + (242 - ir) * k)} ${Math.round(ig + (161 - ig) * k)} ${Math.round(ib + (0 - ib) * k)})`;
  // 線數依井的大小；蓄力時多出約四成的線淡入，線的角度不隨條數改變
  const base = Math.round(w.r / 7.8);
  const n = Math.round(base * 1.45);
  const windUp = 6 + 4 * k;
  const thick = Math.min(1, w.r / 110);
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const show = i < base ? 1 : k;
    if (show <= 0.01) continue;
    const q = (flow + ((i * 0.618) % 1)) % 1;
    const rad = (w.r * 0.95 * (1 - q) + inner * q) * spread;
    const th = (i * TAU) / n - spin - q * q * windUp;
    const len = 0.45 + (0.55 + 0.3 * k) * q;
    const a = Math.sin(q * Math.PI) ** 0.8 * (0.42 + 0.43 * k) * show * vis;
    g.beginPath();
    g.arc(w.x, w.y, rad, th - len, th);
    g.lineWidth = (2 + (2.2 + k) * q) * thick;
    g.strokeStyle = mix;
    g.globalAlpha = Math.max(0, Math.min(1, a));
    g.stroke();
    g.globalAlpha = 1;
  }
}

/**
 * 重力井噴發的衝擊波：一圈金色往外擴散。
 * @param cooling 噴發後的剩餘冷卻比例，1 為剛噴發
 */
export function shockwave(g: CanvasRenderingContext2D, w: { x: number; y: number; r: number }, cooling: number): void {
  g.lineWidth = 6 * cooling;
  g.strokeStyle = gold(cooling);
  circle(g, w.x, w.y, w.r * (1.4 - 0.9 * cooling));
  g.stroke();
}

/** 實心 V 字箭頭，朝 ang 方向 */
function chevron(g: CanvasRenderingContext2D, x: number, y: number, ang: number, s: number, color: string): void {
  local(g, x, y, ang, () => {
    g.beginPath();
    g.moveTo(-s * 0.5, -s * 0.6);
    g.lineTo(s * 0.3, 0);
    g.lineTo(-s * 0.5, s * 0.6);
    g.lineWidth = 2.6;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = color;
    g.stroke();
  });
}

/**
 * 彈射點：沿斜坡平貼的扁平彈射板（不超出坡面），板上方兩道箭頭指向瞄準點；
 * 彈出時板子變金色，箭頭往瞄準方向彈出一段再收回。
 * @param f 彈出閃光強度 0 到 1
 * @param slope 所在斜坡的角度（弧度），彈射板沿此角度擺放
 */
export function padPrint(
  g: CanvasRenderingContext2D, P: PiecePalette, p: { x: number; y: number; r: number; target: { x: number; y: number } },
  f: number, slope: number,
): void {
  const plateW = p.r * 2;
  const plateH = 9;
  local(g, p.x, p.y, slope, () => {
    g.beginPath();
    g.roundRect(-plateW / 2, -plateH / 2, plateW, plateH, plateH / 2);
    g.fillStyle = f > 0 ? gold(0.45 + 0.55 * f) : ink(P, 0.16);
    g.fill();
    // 板面三條橫紋，看起來像彈簧板
    g.fillStyle = f > 0 ? 'rgb(255 255 255 / 0.7)' : ink(P, 0.22);
    for (const sx of [-plateW / 4, 0, plateW / 4]) g.fillRect(sx - 1, -plateH / 2 + 2, 2, plateH - 4);
  });
  // 箭頭放在板子上方（坡面法線朝上的一側），彈出時沿瞄準方向推出
  const nx = Math.sin(slope);
  const ny = -Math.cos(slope);
  const ang = Math.atan2(p.target.y - p.y, p.target.x - p.x);
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const push = 7 * f;
  const bx = p.x + nx * 14 + ux * push;
  const by = p.y + ny * 14 + uy * push;
  const color = f > 0 ? GOLD : ink(P, 0.5);
  chevron(g, bx - ux * 4, by - uy * 4, ang, 10, color);
  chevron(g, bx + ux * 4, by + uy * 4, ang, 10, color);
}
