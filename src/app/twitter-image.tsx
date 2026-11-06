// 與 Open Graph 圖片共用同一份繪製邏輯（含 CJK 字型載入）；
// Next 需靜態分析路由設定，故 alt / size / contentType 須在此直接宣告。
export { default } from './opengraph-image';

export const alt = '抽獎彈珠台｜免費線上抽獎工具';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
