# 彈珠台抽獎 Pinball Lottery

以物理模擬呈現的線上抽獎網站：每位參加者是一顆彈珠，從彈珠台頂端落下，依序通過終點線的前 N 名即為得獎者。使用 Next.js（App Router）打造，所有資料只保存在瀏覽器本機。

## 功能

- **名單管理**：可建立多份名單，文字框貼上即可，一行一位（可直接從 Excel 複製一欄），人數不設上限
- **三種台面**：經典、之字迴廊、瀑布，可在抽獎前選擇；每種台面都設計成第一名約在 2 到 3 分鐘抵達，靠平緩的長斜坡、旋轉擋板與風車拉長賽程並打亂名次；左右牆邊的保險桿防止彈珠貼牆直落
- **兩種模式**：競速（最先抵達者得獎）與生存（最後抵達者得獎，所有人抵達才結束）；可抽出多位得獎者，支援連續多輪
- **每人多顆彈珠**：每人可設 1 到 10 顆，也可在名單的名字後面加 `*X` 個別指定（例如「王小明*3」）；競速模式以每人最先抵達的那顆計名次，生存模式以最後抵達的那顆計名次，彈珠總數不設上限
- **可選機關**：吹風區、輸送帶群、翻板、輸送帶、重力井（吸住約 3 秒後噴發），開始前可逐一勾選（預設全部加入）；保險桿、集結池與終點池是固定配置
- **集結池**：每種台面有兩座，池內攪拌棒持續攪亂彈珠，收到約八成彈珠（或等滿 10 秒）才開閘，把隊伍收攏成大部隊
- **終點池**：終點前封閉的 V 形池，池底彈射點把彈珠拋向三座重力井，大部隊到齊後中央出口才定時短暫打開，誰先出去是隨機的
- **鏡頭模式**：跟隨第一名、跟隨指定彈珠（點左側參加名單的名字或台面上的彈珠）、自由視角（拖曳、滾輪、上下鍵）
- **全場進度軌**：右側一條由起點到終點的直條，以深淺顯示人潮分布，標出第一名、第二名、跟隨中的彈珠與鏡頭範圍，點選或拖曳即可移動鏡頭
- **即時名次與計時**：直播時觀眾也能看懂誰領先
- **音效與彩帶**：碰撞音效以 Web Audio 即時合成（無音檔），第一名抵達時播放勝利旋律與彩帶
- **歷史紀錄與重播**：保留每一輪的得獎名單，並可用當時的種子重播同一場抽獎
- **備份與還原**：設定頁可匯出、匯入全部資料
- **SEO**：首頁為靜態頁面，含 sitemap、robots 與社群分享圖

## 公平性設計

- 每場抽獎於按下開始時以 `crypto.getRandomValues` 產生種子，物理亂數只使用該種子驅動的 `createRng(seed)`
- 模擬為確定性：相同種子、名單、台面與引擎版本會得到完全相同的結果，因此可重播驗證
- 物理以固定步長推進，與畫面更新率脫鉤
- 鏡頭操作只影響畫面，不影響模擬
- 可選機關（風向、翻板與輸送帶節奏、重力井蓄力）與蓄球池的開閘只依物理步數與彈珠位置決定，不讀時鐘；紀錄會保存模式、每人顆數與勾選的機關，重播時以相同設定執行
- 彈珠長時間沒有進展時，由防卡死機制輕推，避免塞住
- 音效使用獨立的 `Math.random()`，不影響抽獎結果

## 技術棧

| 項目 | 說明 |
|---|---|
| [Next.js](https://nextjs.org/) 16（App Router） | 框架、路由、SEO 中繼資料 |
| React 19 | 介面 |
| TypeScript | 型別安全 |
| [Matter.js](https://brm.io/matter-js/) 0.20.0 | 2D 物理引擎（鎖定精確版本） |
| [canvas-confetti](https://github.com/catdad/canvas-confetti) | 彩帶特效 |
| Vitest + Testing Library | 單元與元件測試 |
| ESLint（eslint-config-next） | 程式碼檢查 |

## 快速開始

需求：Node.js 20.9 以上（Next.js 16 的最低要求）

```bash
npm install
npm run dev
```

開啟 http://localhost:3000 即可使用。

> Windows PowerShell 若出現 `npm.ps1 未經數位簽署` 的錯誤，改用 `npm.cmd run dev`。

## 指令

| 指令 | 說明 |
|---|---|
| `npm run dev` | 啟動開發伺服器 |
| `npm run build` | 正式建置（需要網路，見下方部署說明） |
| `npm run start` | 啟動建置後的正式伺服器 |
| `npm run lint` | 執行 ESLint |
| `npm test` | 執行測試 |
| `npm run sim -- <台面\|all> [人數] [場數]` | 無頭模擬，驗證台面是否塞車 |

### 台面驗收

```bash
npm run sim -- all 200 3
```

對全部台面各模擬 3 場、每場 200 人，輸出全部抵達所需秒數、防卡死觸發次數，以及卡住位置的分佈，可用來找出瓶頸。也可指定單一台面，例如 `npm run sim -- classic 200 3`。

## 專案結構

```
├── src/
│   ├── app/                  頁面與路由（/、/play、/lists、/history、/settings）
│   │   ├── home.module.css   首頁樣式
│   │   ├── globals.css       全站樣式
│   │   ├── sitemap.ts        sitemap
│   │   ├── robots.ts         robots
│   │   └── opengraph-image.tsx / twitter-image.tsx   社群分享圖
│   ├── components/           各頁面的客戶端元件與載入器、導覽列
│   │   ├── PinballCanvas.tsx 彈珠台畫布（抽獎與重播共用）
│   │   └── HomeDemo.tsx      首頁示範動畫
│   └── lib/
│       ├── pinball/          物理模擬、亂數、音效、渲染（含全場進度軌）
│       │   └── boards/       台面配置（classic、zigzag、cascade）
│       ├── storage/          localStorage 資料層
│       │   ├── schema.ts     資料結構與驗證
│       │   ├── ops.ts        名單與紀錄操作
│       │   ├── store.ts      讀寫與訂閱
│       │   └── useStoredData.ts  React 訂閱 hook
│       ├── draw.ts           抽獎流程
│       ├── drawLock.ts       抽獎進行中的鎖定
│       ├── replay.ts         歷史紀錄重播
│       ├── listForm.ts       名單表單解析與驗證
│       ├── backupFileName.ts 備份檔名產生
│       └── site.ts           網站網址設定
├── scripts/simulate.ts       無頭模擬腳本
└── tests/                    測試
```

## 開發守則

變動物理參數、模擬邏輯、亂數演算法或 Matter.js 版本時，必須將 `ENGINE_VERSION` 加 1；變動台面配置時，必須將該台面的 `version` 加 1。

`ENGINE_VERSION` 定義於 `src/lib/pinball/physics.ts`，各台面的 `version` 在 `src/lib/pinball/boards/` 下。歷史紀錄會記錄當時的版本，重播時以此判斷結果是否仍可重現。調整台面後，請以 `npm run sim -- all 200 3` 確認不會卡死。

## 部署到 Vercel

1. 將此 repo 匯入 Vercel（Framework Preset 會自動偵測為 Next.js）。
2. 網站網址的決定順序：`NEXT_PUBLIC_SITE_URL`（使用自訂網域時請設定，例如 `https://your-domain.example`）→ Vercel 自動提供的 `VERCEL_PROJECT_PRODUCTION_URL`（不需設定）→ `http://localhost:3000`。sitemap、robots、canonical 與社群分享圖都會使用此值；正式建置若兩者皆未設定會在建置日誌輸出警告。
3. 部署。

注意：社群分享圖需要的字型會在建置時從 Google Fonts 下載，因此建置環境必須能連上網路。

## 資料儲存

- 名單與歷史紀錄只保存在瀏覽器的 localStorage（key 為 `pinball-lottery`），不會傳送到任何伺服器，也沒有使用會上傳使用者資料的第三方服務。
- 清除瀏覽器資料、使用無痕視窗或更換瀏覽器都會讓資料消失。請定期到設定頁匯出備份，需要時再匯入還原。
- 若瀏覽器無法寫入（例如儲存空間已滿或被停用），抽獎仍可完成，但會提示「本次結果無法保存」。
