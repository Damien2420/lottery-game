/**
 * 解析網站網址（去除結尾斜線）。優先順序：
 * 1. NEXT_PUBLIC_SITE_URL（自訂網域時設定）
 * 2. https://VERCEL_PROJECT_PRODUCTION_URL（Vercel 自動提供）
 * 3. http://localhost:3000；正式建置（NODE_ENV=production）會警告但不中斷，讓本機 build 仍可執行
 * @returns 網站網址
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`.replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production') {
    console.warn('[site] 未設定 NEXT_PUBLIC_SITE_URL，sitemap、canonical 與社群分享圖將使用 http://localhost:3000');
  }
  return 'http://localhost:3000';
}

/** 網站網址（去除結尾斜線） */
export const SITE_URL: string = resolveSiteUrl();

/** 網站名稱 */
export const SITE_NAME = '抽獎彈珠台';

/** 全站預設描述 */
export const SITE_DESCRIPTION =
  '貼上名單就能開抽的線上抽獎彈珠台，適合尾牙、社團、直播抽獎。免註冊，資料只存在你的瀏覽器。';

/** 常見問題；首頁以此渲染並輸出 FAQPage JSON-LD，內容須與產品行為一致 */
export const FAQ: { q: string; a: string }[] = [
  {
    q: '公平嗎？',
    a: '每場開始時，會以瀏覽器的加密等級亂數產生一組隨機種子，並據此打亂所有彈珠的起始位置，主辦人無法預先決定結果。同一組種子可以在歷史紀錄中重播，驗證當場結果。',
  },
  {
    q: '資料會被上傳嗎？',
    a: '不會。名單與抽獎紀錄全部只存在這個瀏覽器的 localStorage，不會傳送到任何伺服器，也不需要註冊帳號。',
  },
  {
    q: '最多可以抽幾個人？',
    a: '每一場最多 200 人，抽出名額可設定為 1 到參加人數之間。',
  },
  {
    q: '換電腦資料還在嗎？',
    a: '不會自動同步。資料只存在原本的瀏覽器，換電腦前請先到「備份設定」頁使用匯出功能，在新電腦的同一頁匯入即可。',
  },
];
