/**
 * 建立可帶種子的亂數產生器（mulberry32）。
 * 物理模擬中所有亂數都必須由此取得，確保同一種子可重現同一結果。
 * @param seed 種子，會被轉為 32 位元無號整數（0 也可用）
 * @returns 每次呼叫回傳 [0, 1) 浮點數的函式
 */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
