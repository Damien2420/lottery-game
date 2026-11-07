'use client';

import Link from 'next/link';
import { useState } from 'react';
import { validateListForm } from '@/lib/listForm';
import { createList, deleteList, duplicateList, updateList } from '@/lib/storage/ops';
import { useStoredData } from '@/lib/storage/useStoredData';

/** 存檔失敗時的提示 */
const SAVE_FAILED = '無法保存，請確認瀏覽器允許儲存資料';

/** 編輯器狀態：id 為 null 表示新增 */
interface Editor {
  id: string | null;
  title: string;
  text: string;
}

/**
 * 把 ISO 時間轉成本地顯示字串。
 * @param iso ISO 時間字串
 * @returns 本地日期時間
 */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', { hour12: false });
}

/**
 * 名單管理頁客戶端元件：列出、新增、編輯、複製與刪除名單。
 * @returns 名單管理頁版面
 */
export default function ListsClient(): React.JSX.Element {
  const { data, update } = useStoredData();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  if (data === null) {
    return (
      <main className="page">
        <h1>名單管理</h1>
        <p className="message">載入中…</p>
      </main>
    );
  }

  /** 儲存編輯器內容；失敗時保留編輯器 */
  const save = (): void => {
    if (!editor) return;
    const r = validateListForm(editor.title, editor.text);
    if (!r.ok) return setError(r.error);
    const now = new Date().toISOString();
    const id = editor.id;
    const saved = update((d) =>
      id === null
        ? createList(d, r.title, r.names, now, crypto.randomUUID())
        : updateList(d, id, { title: r.title, names: r.names }, now),
    );
    if (!saved.ok) return setError(SAVE_FAILED);
    setEditor(null);
    setError('');
    setMessage('');
  };

  /** 複製名單 */
  const duplicate = (id: string): void => {
    const r = update((d) => duplicateList(d, id, new Date().toISOString(), crypto.randomUUID()));
    setMessage(r.ok ? '' : SAVE_FAILED);
  };

  /** 確認後刪除名單 */
  const remove = (id: string, title: string): void => {
    if (!window.confirm(`確定要刪除「${title}」嗎？歷史紀錄不受影響。`)) return;
    const r = update((d) => deleteList(d, id));
    setMessage(r.ok ? '' : SAVE_FAILED);
    if (r.ok && editor?.id === id) setEditor(null);
  };

  /** 開啟編輯器 */
  const open = (next: Editor): void => {
    setEditor(next);
    setError('');
    setMessage('');
  };

  return (
    <main className="page">
      <div className="page-head">
        <h1>名單管理</h1>
        <button type="button" onClick={() => open({ id: null, title: '', text: '' })}>
          新增名單
        </button>
      </div>
      <p className="message" role="status">{message}</p>
      {editor && (
        <section className="editor">
          <h2>{editor.id === null ? '新增名單' : '編輯名單'}</h2>
          <input
            type="text"
            placeholder="名單標題"
            aria-label="名單標題"
            value={editor.title}
            onChange={(e) => setEditor({ ...editor, title: e.target.value })}
          />
          <label className="field">
            <span>參加名單（一行一位）</span>
            <textarea value={editor.text} onChange={(e) => setEditor({ ...editor, text: e.target.value })} />
          </label>
          {error && (
            <p className="message" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button type="button" onClick={save}>
              儲存
            </button>
            <button type="button" className="secondary" onClick={() => setEditor(null)}>
              取消
            </button>
          </div>
        </section>
      )}
      {data.lists.length === 0 ? (
        <p className="empty">目前沒有名單，請先新增一份。</p>
      ) : (
        <ul className="list-rows">
          {data.lists.map((l) => (
            <li key={l.id}>
              <div className="info">
                <strong>{l.title}</strong>
                <span>
                  {l.names.length} 人，更新於 {formatTime(l.updatedAt)}
                </span>
              </div>
              <div className="actions">
                <Link href={`/play?list=${encodeURIComponent(l.id)}`} className="pill small">
                  用這份名單抽獎
                </Link>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => open({ id: l.id, title: l.title, text: l.names.join('\n') })}
                >
                  編輯
                </button>
                <button type="button" className="secondary small" onClick={() => duplicate(l.id)}>
                  複製
                </button>
                <button type="button" className="danger small" onClick={() => remove(l.id, l.title)}>
                  刪除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
