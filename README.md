# 彈珠台抽獎 Pinball Lottery

以物理模擬呈現的抽獎網頁：每位參加者是一顆彈珠，從彈珠台頂端落下，依序通過終點線的前 N 名即為得獎者。

## 功能

- **名單輸入**：文字框貼上，一行一位（可直接從 Excel 複製一欄），最多 200 人
- **抽出多位得獎者**：依抵達終點的順序決定名次
- **得獎者不重複抽**：可選擇抽完自動從名單移除，支援連續多輪
- **鏡頭跟隨**：畫面自動追蹤領先的彈珠，領先者以白框標示
- **音效與彩帶**：碰撞音效以 Web Audio 即時合成（無音檔），第一名抵達時播放勝利旋律與彩帶
- **歷史紀錄**：保留每一輪的得獎名單

## 公平性設計

- 名單在分配起始位置前先洗牌（Fisher-Yates），輸入順序不影響起跑點
- 物理以固定步長（60 Hz）推進，與畫面更新率脫鉤
- 彈珠靜止超過 1.5 秒會被隨機輕推，避免卡死

## 技術棧

| 項目 | 說明 |
|---|---|
| [Vite](https://vite.dev/) | 開發伺服器與建置 |
| TypeScript | 型別安全 |
| [Matter.js](https://brm.io/matter-js/) | 2D 物理引擎 |
| [canvas-confetti](https://github.com/catdad/canvas-confetti) | 彩帶特效 |

## 快速開始

需求：Node.js 20 以上

```bash
npm install
npm run dev
```

開啟 http://localhost:5173 即可使用。

> Windows PowerShell 若出現 `npm.ps1 未經數位簽署` 的錯誤，改用 `npm.cmd run dev`。

### 建置

```bash
npm run build     # 型別檢查並輸出至 dist/
npm run preview   # 預覽建置結果
```

`dist/` 為純靜態檔案，可部署至任何靜態主機（GitHub Pages、Vercel、Netlify 等）。

## 專案結構

```
├── index.html            頁面與左側操作面板
├── src/
│   ├── main.ts           介面事件、結果列表、彩帶、歷史紀錄
│   ├── game.ts           物理模擬、終點判定、防卡死、鏡頭、Canvas 繪製
│   ├── board.ts          台面配置（障礙物位置與尺寸）
│   ├── audio.ts          Web Audio 合成音效
│   └── style.css         樣式
└── scripts/
    └── simulate.ts       無頭模擬，驗證台面是否會塞車
```

## 台面配置

由上而下：起始區 → 釘陣 → 斜坡 → 旋轉擋板 → 保險桿釘陣 → 漏斗 → 終點釘陣 → 終點線。

修改 `src/board.ts` 調整台面後，建議以無頭模擬確認不會卡死：

```bash
npx tsx scripts/simulate.ts [人數] [場數]
# 例：npx tsx scripts/simulate.ts 200 3
```

輸出包含全部抵達所需秒數、被輕推次數，以及卡住位置的分佈（每 100 單位一格），可用來找出瓶頸。
