/**
 * 物理與模擬常數。
 * 任何會影響模擬結果的數值或步進邏輯（限速、卡住判定與看門狗、保險桿彈力、彈珠材質、步長、傳送門、可選機關、模式與名次規則）變動時，
 * 都必須調升 ENGINE_VERSION，讓舊紀錄的重播能偵測到引擎已更新。
 */

/** 引擎版本，物理參數或步進邏輯變動時調升 */
export const ENGINE_VERSION = 12;
/** 固定物理步長（毫秒），與畫面更新率脫鉤 */
export const STEP_MS = 1000 / 60;
/** 彈珠半徑 */
export const MARBLE_R = 9;
/** 競速模式下每人最多的彈珠數 */
export const MAX_MARBLES_PER_PERSON = 10;
/** 名單上以 *X 指定的每人彈珠數上限（比每人固定的上限寬鬆） */
export const MAX_MARBLES_PER_ENTRY = 500;
/** 世界寬度（物理座標單位） */
export const WORLD_W = 600;
/** 彈珠最高速度，避免高速穿透釘子 */
export const MAX_SPEED = 12;
/** 低於此速度視為靜止 */
export const STUCK_SPEED = 0.2;
/** 靜止超過此時間（毫秒，物理時間）即推一把 */
export const STUCK_MS = 1500;
/** 看門狗：彈珠的最大 y 至少前進這麼多才算有進度 */
export const PROGRESS_MIN_Y = 30;
/** 看門狗：超過此時間（毫秒，物理時間）沒有進度即推一把，不論速度 */
export const NO_PROGRESS_MS = 6000;
/** 保險桿彈開速度 */
export const BUMPER_KICK = 9;

/** 彈珠材質參數 */
export const MARBLE_OPTS = {
  restitution: 0.5,
  // Matter 的摩擦模型在緩坡上會讓彈珠像黏住一樣，因此不使用摩擦，滾動速度只由坡度決定
  friction: 0,
  // 預設靜摩擦 0.5 會讓低速彈珠黏在斜坡上
  frictionStatic: 0,
  frictionAir: 0.006,
  density: 0.002,
  label: 'marble',
} as const;
