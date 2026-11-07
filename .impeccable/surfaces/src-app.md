---
version: 1
slug: "src-app"
primary_target: "src/app"
related_targets: ["src/components"]
---

# Surface brief: 全站（首頁、抽獎、名單、紀錄、備份）

## Mode
- 首頁 `/`：Persuade（讓搜尋進來的主辦人立刻看懂並按下開始抽獎）。
- `/play`：Operate + 直播舞台（主持人操作、觀眾看懂局勢）。
- `/lists`、`/history`、`/settings`：Operate。

## Direction contract（使用者已核准原型 .impeccable/mocks/proto-home.html，2026-11-06）
- 世界：遊戲 HUD 的手感，融合 Apple 式精緻、留白與材質。明亮冷灰底、白色浮起面板、墨黑膠囊按鈕。
- 色彩 token：ground #f3f4f6、surface #ffffff、ink #0b0c0f、ink-2 #555b67、line #e2e5ea、board #eceef2、peg #c3c9d4、gold #f2a100（第一名、轉軸）、live #ff3b30（LIVE）。第一名文字用 #a86b00 以維持對比。
- 字體：Noto Sans TC，標題 900、字距 -0.035em；數字一律 tabular-nums。
- 材質：彈珠是有高光的立體玻璃珠；旋轉擋板是墨黑圓角條加金色轉軸；台面是平的淺灰，不做卡片套卡片。
- 版面：抽獎頁的彈珠台占滿舞台，設定、計時、即時名次、鏡頭切換、迷你地圖都是浮在台面上的 HUD 面板；手機上設定面板改為堆疊在台面上方。
- 互動：膠囊按鈕有按壓位移；分段切換鈕以墨黑表示選取。

## 不要
- 太幼稚像兒童 App；太暗或電競霓虹；太素像後台樣板。車站看板、雜誌風已被否決。
- emoji、漸層文字、霓虹光暈、卡片內再套卡片。

## 必須保留
- 首頁 SEO 結構（h1、FAQ、結構化資料、特色與步驟文案的事實內容）。
- 抽獎進行中的離開確認、作廢規則、紀錄寫入流程。
- 直播縮小後仍可辨識：名次、名字、領先者、計時器字級要夠大。
