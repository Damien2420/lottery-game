/**
 * 產生備份檔名，日期使用本地時間。
 * @param date 要格式化的時間
 * @returns 形如 pinball-lottery-backup-YYYYMMDD.json 的檔名
 */
export function backupFileName(date: Date): string {
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `pinball-lottery-backup-${y}${m}${d}.json`;
}
