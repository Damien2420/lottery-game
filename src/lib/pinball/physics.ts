/**
 * 物理與模擬常數。
 * 任何會影響模擬結果的數值（限速、卡住判定、保險桿彈力、彈珠材質、步長）變動時，
 * 都必須調升 ENGINE_VERSION，讓舊紀錄的重播能偵測到引擎已更新。
 */

/** 引擎版本，物理參數或步進邏輯變動時調升 */
export const ENGINE_VERSION = 1;
/** 固定物理步長（毫秒），與畫面更新率脫鉤 */
export const STEP_MS = 1000 / 60;
/** 彈珠半徑 */
export const MARBLE_R = 9;
/** 每場最多參加人數（起始區可容納的上限） */
export const MAX_PLAYERS = 200;
/** 世界寬度（物理座標單位） */
export const WORLD_W = 600;
/** 彈珠最高速度，避免高速穿透釘子 */
export const MAX_SPEED = 16;
/** 低於此速度視為靜止 */
export const STUCK_SPEED = 0.2;
/** 靜止超過此時間（毫秒，物理時間）即推一把 */
export const STUCK_MS = 1500;
/** 保險桿彈開速度 */
export const BUMPER_KICK = 9;

/** 彈珠材質參數 */
export const MARBLE_OPTS = {
  restitution: 0.5,
  friction: 0.01,
  // 預設靜摩擦 0.5 會讓低速彈珠黏在斜坡上
  frictionStatic: 0,
  frictionAir: 0.005,
  density: 0.002,
  label: 'marble',
} as const;
