'use client';

import { useState, type ChangeEvent } from 'react';
import { backupFileName } from '@/lib/backupFileName';
import { exportJson, parseImport } from '@/lib/storage/store';
import { useStoredData } from '@/lib/storage/useStoredData';

/** 存檔失敗時的提示 */
const SAVE_FAILED = '無法保存，請確認瀏覽器允許儲存資料';

/**
 * 備份設定頁客戶端元件：匯出與匯入全部名單與紀錄。
 * @returns 備份設定頁版面
 */
export default function SettingsClient(): React.JSX.Element {
  const { data, update } = useStoredData();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (data === null) {
    return (
      <main className="lists">
        <h1>備份設定</h1>
        <p className="message">載入中…</p>
      </main>
    );
  }

  /** 以 Blob 下載目前資料，完成後釋放物件網址 */
  const exportData = (): void => {
    const blob = new Blob([exportJson(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName(new Date());
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setError('');
    setMessage('');
  };

  /**
   * 讀取選取的檔案並匯入；失敗或取消時資料不變。
   * @param e 檔案選取事件
   */
  const importData = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const input = e.target;
    const file = input.files?.[0];
    setMessage('');
    setError('');
    if (!file) return;
    try {
      const r = parseImport(await file.text());
      if (!r.ok) return setError(`匯入失敗：${r.error}`);
      if (!window.confirm('匯入將取代目前所有名單與紀錄，確定嗎？')) return;
      const saved = update(() => r.data);
      if (!saved.ok) return setError(SAVE_FAILED);
      setMessage('匯入完成');
    } catch {
      setError('匯入失敗：無法讀取檔案');
    } finally {
      // 清空選取，讓同一個檔案可以再次選擇
      input.value = '';
    }
  };

  return (
    <main className="lists">
      <h1>備份設定</h1>
      <p>資料只存在這個瀏覽器，換電腦請用匯出／匯入</p>
      <section className="editor">
        <h2>匯出</h2>
        <div className="actions">
          <button type="button" onClick={exportData}>
            匯出備份
          </button>
        </div>
      </section>
      <section className="editor">
        <h2>匯入</h2>
        <input type="file" accept=".json,application/json" aria-label="選擇備份檔" onChange={importData} />
        {error && (
          <p className="message" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="message" role="status">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
