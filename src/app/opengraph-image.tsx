import { ImageResponse } from 'next/og';

export const alt = '抽獎彈珠台｜免費線上抽獎工具';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** 圖片中的主標與副標 */
const TITLE = '抽獎彈珠台';
const SUBTITLE = '免費線上抽獎工具';

/**
 * 從 Google Fonts 取得只含指定字元的 Noto Sans TC 粗體子集（預設字型沒有 CJK 字形）。
 * 此路由為靜態產生，故僅在建置時抓取一次。
 * @param text 圖片中實際用到的所有字元
 * @returns 字型檔的二進位內容
 */
async function loadFont(text: string): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@700&text=${encodeURIComponent(text)}`;
  // 以舊版瀏覽器 UA 取得 woff/ttf（Satori 不支援 woff2）
  const css = await (
    await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; rv:2.0) Gecko/20100101 Firefox/4.0' } })
  ).text();
  const match = css.match(/src: url\((.+?)\) format\('(woff|opentype|truetype)'\)/);
  if (!match) throw new Error('無法從 Google Fonts CSS 解析字型網址');
  const res = await fetch(match[1]);
  if (!res.ok) throw new Error(`字型下載失敗：${res.status}`);
  return res.arrayBuffer();
}

/**
 * 產生社群分享用的 Open Graph 圖片（1200x630、深色底、大字標題）。
 * @returns PNG 圖片回應
 */
export default async function OpengraphImage(): Promise<ImageResponse> {
  const font = await loadFont(TITLE + SUBTITLE);
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b1020',
          color: '#e6e9f5',
          fontFamily: 'Noto Sans TC',
        }}
      >
        <div style={{ fontSize: 180, fontWeight: 700, color: '#ff5c8a', display: 'flex' }}>{TITLE}</div>
        <div style={{ fontSize: 56, marginTop: 24, color: '#9fb3ff', display: 'flex' }}>{SUBTITLE}</div>
      </div>
    ),
    { ...size, fonts: [{ name: 'Noto Sans TC', data: font, weight: 700, style: 'normal' }] },
  );
}
