---
name: 抽獎彈珠台
description: 遊戲 HUD 的手感，加上 Apple 式的留白與材質：冷灰台面、白色浮起面板、墨黑膠囊按鈕。
colors:
  ground: "#f3f4f6"
  surface: "#ffffff"
  field: "#fafbfc"
  ink: "#0b0c0f"
  ink-2: "#555b67"
  ink-3: "#8a909b"
  line: "#e2e5ea"
  board: "#eceef2"
  peg: "#c3c9d4"
  gold: "#f2a100"
  gold-ink: "#a86b00"
  gold-wash: "#fff4dc"
  live: "#ff3b30"
  danger: "#d70015"
  switch-off: "#d5d9df"
  disabled: "#c9cdd4"
typography:
  display:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "clamp(36px, 6vw, 84px)"
    fontWeight: 900
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "clamp(34px, 5vw, 52px)"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 900
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.75
  label:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  stage: "28px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "20px"
  xl: "24px"
  gutter: "clamp(16px, 4vw, 56px)"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
    rounded: "{rounded.pill}"
    height: "44px"
  button-disabled:
    backgroundColor: "{colors.disabled}"
    textColor: "{colors.surface}"
  segmented:
    backgroundColor: "{colors.ground}"
    rounded: "14px"
    padding: "4px"
  segmented-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "10px"
    height: "36px"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
    height: "44px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "20px"
  editor-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "24px"
  list-rows:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "18px 24px"
  result-row:
    backgroundColor: "{colors.ground}"
    rounded: "{rounded.md}"
    height: "48px"
  result-row-first:
    backgroundColor: "{colors.gold-wash}"
    textColor: "{colors.gold-ink}"
  stage:
    backgroundColor: "{colors.board}"
    rounded: "{rounded.stage}"
  closing-band:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.stage}"
---

# Design System: 抽獎彈珠台

## Overview

**Creative North Star: "明亮的遊戲控制台"**

介面像一台擺在冷灰桌面上的遊戲機：台面是平的淺灰，操作與資訊以白色面板浮在台面上，按鈕是墨黑的膠囊。留白大方、材質乾淨，但按鈕有按壓位移、名次有進場動畫、LIVE 圓點會呼吸，保留遊戲 HUD 的手感。彩色只屬於彈珠本身，介面其餘部分幾乎全是冷灰與墨黑。

密度分兩種。抽獎與重播頁是舞台模式：彈珠台占滿頁面，設定、計時、即時名次、鏡頭切換、全場進度軌都是浮在台面上的 HUD 面板。名單、紀錄、備份頁是一般頁面：880px 置中欄，白色容器加細分隔線。首頁則以大字標題與留白推進。

專案明確拒絕：太幼稚像兒童 App、太暗或電競霓虹、太素像後台樣板，以及 emoji、漸層文字、光暈、卡片內再套卡片（來自方向契約）。

**Key Characteristics:**
- 冷灰底、白面板、墨黑膠囊；金色與紅色各只有一個專屬角色。
- 標題一律 900 字重、負字距；數字一律 tabular-nums。
- 深度只靠一組柔和的白面板陰影，台面本身是平的。
- 直播縮小後仍要看得清楚：名次、名字、計時器字級偏大。

## Colors

冷灰與墨黑為底，金色只標示第一名，紅色只標示直播中，其餘彩色全由彈珠色相承擔。

### Primary
- **墨黑 Ink** (#0b0c0f)：主要按鈕底色、分段切換與開關的選取狀態、焦點外框、反白選取、首頁收尾色塊。同時是旋轉擋板的顏色。

### Secondary
- **轉軸金 Gold** (#f2a100)：第一名的標記與旋轉擋板的轉軸，首頁步驟 1 的大數字。只在畫布與裝飾數字上使用。
- **金字墨 Gold Ink** (#a86b00)：第一名的文字（名次數字）。金色本身對比不足，文字一律改用這個深金。
- **金底 Gold Wash** (#fff4dc)：結果清單第一名那一列的底色。
- **直播紅 Live** (#ff3b30)：LIVE 狀態文字與呼吸圓點、抽獎進行中的提示。
- **警示紅 Danger** (#d70015)：錯誤訊息與危險按鈕文字；與直播紅分開，避免把錯誤讀成直播中。

### Neutral
- **台面灰 Ground** (#f3f4f6)：頁面底色、分段切換與加減器的凹槽、結果列底色。
- **面板白 Surface** (#ffffff)：所有浮起面板、卡片、次要按鈕。
- **欄位白 Field** (#fafbfc)：輸入框底色，比面板白略灰。
- **台面 Board** (#eceef2)：彈珠台舞台底色。
- **釘灰 Peg** (#c3c9d4)：釘子、首頁的步驟數字。
- **次要墨 Ink 2** (#555b67)：次要文字、說明文字。
- **三級墨 Ink 3** (#8a909b)：停用文字、空狀態提示、懸停時的邊框。
- **分隔線 Line** (#e2e5ea)：輸入框邊框、清單分隔線、次要按鈕外框。
- **開關灰** (#d5d9df)、**停用灰** (#c9cdd4)：開關關閉底色與停用按鈕底色。

### Named Rules
**The Two Signals Rule.** 金色只代表第一名與轉軸，紅色只代表 LIVE。這兩個顏色不用於裝飾、不用於一般按鈕，稀有才讓它有意義。

**The Marble Is The Color Rule.** 介面本身沒有彩色強調；彩色由彈珠的色相提供，介面保持冷灰讓彈珠成為視覺主角。

**The Gold Text Rule.** 金色當文字時一律使用金字墨 (#a86b00)，不用 #f2a100。

## Typography

**Display Font:** Noto Sans TC（經 next/font 載入為 `--font-sans`，後備 PingFang TC、Microsoft JhengHei、system-ui）
**Body Font:** 同上，單一字族。
**Label/Mono Font:** 無獨立字族；數字用 `font-variant-numeric: tabular-nums`。

**Character:** 單一無襯線字族靠字重對比建立層級：標題 900、內文 500、標籤與按鈕 700。大標題收緊字距，像遊戲介面的粗體標題。

### Hierarchy
- **Display** (900, clamp(36px, 6vw, 84px), 1.04, -0.035em)：首頁 h1。
- **Headline** (900, clamp(34px, 5vw, 52px), 字距 -0.035em)：一般頁面 h1；首頁區段標題為 clamp(30px, 4vw, 48px)、-0.03em。
- **Title** (900, 22px)：面板 h1、首頁特色與步驟 h3、HUD 計時器；編輯卡 h2 為 19px，面板 h2 為 15px，清單主名稱 17px。
- **Body** (500, 16px, 行高 1.75)：說明與 lede，用 ink-2 色；段落上限約 34ch 至 64ch。
- **Label** (700, 14px)：欄位標籤、次要連結、小按鈕、分段切換（手機 13px）。
- **Result** (900, 18px；名次 700 13px)：本輪結果，直播縮小後仍清楚。HUD 名次列為 700 16px。

### Named Rules
**The Heavy Headline Rule.** 所有標題（h1 至 h3）使用 900 字重與負字距，字距隨字級收緊（-0.02em 至 -0.035em）。

**The Tabular Numbers Rule.** 計時、名次、人數、名額等數字一律 tabular-nums，數字變動時不跳動。

## Layout

三種版面。首頁：區段以 `clamp(64px, 9vw, 112px)` 上緣間距分隔，特色與步驟用 auto-fit 欄 (min 180px)，常見問題為左右兩欄（1fr : 2fr，欄距 56px），左欄標題與說明 sticky（top 96px），右欄清單填滿剩餘寬度，860px 以下改為上下堆疊。一般頁面：880px 置中單欄，內部 gap 20px，底部留 96px。抽獎與重播頁：舞台高度為視窗減去導覽列 64px（最小 560px），彈珠台占滿，設定面板固定在左側 (324px，左上下各 20px)，其餘 HUD 面板距邊緣 20px。

水平留白使用統一的 gutter `clamp(16px, 4vw, 56px)`。面板內部間距以 14px 為欄位節奏，卡片內邊距 20 至 24px，清單列 18px 24px。

響應式：1180px 以下設定面板縮為 288px、計時器移到迷你地圖上方；860px 以下舞台去掉圓角與外距，設定面板改為堆疊在台面上方，台面高 78vh（最小 480px），HUD 縮小。520px 以下導覽列隱藏品牌文字，只留彈珠圖示。

### Named Rules
**The Float On The Board Rule.** 抽獎頁的所有控制與資訊都以 HUD 面板浮在台面上，不在台面外另做側欄或頁首區塊（手機堆疊除外）。

## Elevation & Depth

混合式：台面與頁面本身是平的，只有白色面板浮起。整個站只用一組面板陰影，加上按鈕懸停時的墨色陰影。畫布上的彈珠則以內部漸層做出玻璃珠的立體感。

### Shadow Vocabulary
- **面板浮起** (`box-shadow: 0 1px 2px rgb(11 12 15 / 0.06), 0 12px 32px -8px rgb(11 12 15 / 0.14)`)：設定面板、HUD、編輯卡、群組清單、首頁常見問題與示範標籤。
- **按鈕懸停** (`0 8px 20px -6px rgb(11 12 15 / 0.4)`)：膠囊按鈕懸停時，並上移 1px；按下時移除陰影、下移 1px 並縮為 0.98。
- **次要按鈕外框** (`inset 0 0 0 1px var(--line)`)：次要與危險按鈕用內陰影做出 1px 細框。
- **開關滑鈕** (`0 1px 3px rgb(0 0 0 / 0.25)`)：開關的白色圓鈕。
- **彈珠小圖示** (`inset -2px -3px 4px rgb(0 0 0 / 0.2), inset 2px 2px 3px rgb(255 255 255 / 0.5)`)：HUD 名次列的彈珠點。

### Named Rules
**The One Float Rule.** 浮起只有一種：面板陰影。不新增第二種卡片陰影，也不在面板內再浮起面板。

## Shapes

圓角隨容器層級放大：輸入框 12px、面板與 HUD 16px、卡片與清單 20px、舞台與首頁大色塊 28px、按鈕與加減器為全圓 (999px)。內部元件比外層小一級（分段切換 14px 容器、10px 按鈕）。邊框幾乎不用：區隔靠底色差異與 1px 分隔線，輸入框是唯一有實線外框的元件。彈珠與狀態圓點是正圓；旋轉擋板是墨黑圓角條。

## Components

### Buttons
- **Shape:** 全圓膠囊 (999px)，最小高度 44px（小尺寸 36px、導覽列 40px），字重 700。
- **Primary:** 墨黑底、白字，水平內距 20px。
- **Hover / Focus / Active:** 懸停上移 1px 並出現墨色陰影；按下下移 1px 並縮為 0.98；焦點為 2px 墨黑外框、外移 2px。
- **Secondary:** 白底墨字，1px 分隔線色內框，懸停時框線轉為 ink-3。
- **Danger:** 白底、警示紅文字，同次要按鈕外框。
- **Disabled:** 停用灰底 (#c9cdd4)、白字，不位移。

### Segmented Switch
- 台面灰凹槽 (14px 圓角、內距 4px)，內含 36px 高、10px 圓角的透明按鈕。選取狀態 (`aria-pressed`) 為墨黑底白字；未選取為 ink-2 文字，懸停轉墨黑。分段按鈕不做按壓位移。用於台面選擇與鏡頭模式。

### Stepper and Switch
- **加減器：** 全圓台面灰凹槽，內有 34px 圓形按鈕與 56px 寬、900 字重的數字輸入。
- **開關：** 取代原生核取方塊，44x26 全圓軌道，關閉為 #d5d9df、開啟為墨黑，白色 20px 圓鈕滑動 18px，標籤在左、開關在右。

### Inputs / Fields
- **Style:** 欄位白底、1px 分隔線色框、12px 圓角、44px 最小高、15px 字。
- **Dropdown:** 不用原生 select，改用自訂元件（`Dropdown.tsx`，ARIA select-only combobox）。收起時與輸入框同外觀，右側 12px SVG V 形箭頭，展開時轉 180 度；懸停框線轉 ink-3，展開或焦點時轉墨黑。展開的清單是白色面板（14px 圓角、內距 6px、面板浮起陰影、最高 288px 可捲動），以 0.18s 上移 4px 並淡入。選項 40px 高、10px 圓角：滑過或鍵盤停留為台面灰底，已選取為墨黑底白字 700。右側次要資訊（名單人數）13px 700 ink-3、tabular-nums，在已選取項目上轉為 70% 白。
- **Focus:** 框線轉為墨黑，無光暈。
- **Error:** 訊息文字用警示紅 14px；欄位標籤 700 14px，右側 `em` 數值為 ink-2。

### Navigation
- 無底色的單列導覽，最小高 64px，左側品牌（22px 彈珠圖示 + 18px 900 字重名稱），右側連結 15px 500，ink-2 色；懸停與目前頁 (`aria-current`) 轉墨黑，目前頁字重 700。導覽列內的膠囊按鈕縮為 40px。手機隱藏品牌文字。

### Panels and HUD
- 白底、16px 圓角、面板浮起陰影。設定面板含標題、欄位與底部的操作區 (`margin-top: auto`)。HUD 包含計時器 (22px 900)、即時名次（30px 一列，26px 名次欄 + 16px 彈珠點 + 名字，第一名名次用金字墨，抵達者加灰色「抵達」小標）、鏡頭切換、名單搜尋、全場進度軌（64px 寬，深淺表示人潮密度，第一名、第二名與跟隨中放大）。LIVE 圓點以 1.4s 呼吸動畫。

### Results List
- 本輪結果為間距 6px 的列：48px 高、12px 圓角、台面灰底、名字 18px 900、名次 13px 700 ink-2；第一名列改用金底，名次轉金字墨。每列以 0.5s 上滑淡入進場。

### Grouped List Rows
- 一個白色容器 (20px 圓角、面板陰影) 內含多列，列與列之間 1px 分隔線，列內邊距 18px 24px，主名稱 17px 900、次要資訊 14px ink-2。不做一列一張卡。

### Pinball Canvas (signature)
- 畫布色板（`game.ts` 常數 C）：牆 #3a3f4a、釘 #c3c9d4、擋板墨黑 #0b0c0f、轉軸金 #f2a100、蓄球池閘門墨黑並在上方畫金色開閘進度條、重力井為轉動虛線圈（蓄力時染橘、噴發時一圈橘色衝擊波）、彈射點為金色虛線圈加朝上箭頭、其餘標示物 #9aa1ad。畫布底色 #e4e7ec 略深於 CSS 的台面色。
- 彈珠為玻璃珠精靈圖：徑向漸層，高光白 (#fff) 起、0.2 處 `hsl(hue 90% 66%)`、邊緣 `hsl(hue 75% 38%)`，色相按參加者分配。名稱標籤 700 12px，第一名與被跟隨者的標籤為 900 14px。導覽列品牌圖示重用同一組橘紅漸層。

## Do's and Don'ts

### Do:
- **Do** 以冷灰台面 (#f3f4f6 / #eceef2) 搭配白色浮起面板，並只使用面板浮起這一組陰影。
- **Do** 主要動作用墨黑全圓膠囊 (44px)，選取狀態一律用墨黑底白字。
- **Do** 標題使用 900 字重與負字距，數字使用 tabular-nums。
- **Do** 金色只給第一名與轉軸，紅色只給 LIVE；金色文字用 #a86b00。
- **Do** 群組清單用一個白色容器加 1px 分隔線。
- **Do** 保持 HUD 字級：名次 16px、結果 18px、計時器 22px，確保縮小直播仍可讀。
- **Do** 提供 `prefers-reduced-motion` 退讓，所有動畫與過渡在該設定下近乎瞬間。

### Don't:
- **Don't** 在卡片或面板內再套卡片，也不做一列一張卡片的清單。
- **Don't** 使用 emoji、漸層文字、霓虹光暈或深色電競配色。
- **Don't** 用金色或紅色做一般強調、按鈕或裝飾（首頁步驟 1 的大數字除外）。
- **Don't** 使用原生核取方塊，一律用開關樣式。
- **Don't** 把介面做成兒童 App 的圓潤彩色，或後台樣板的素面表格。
- **Don't** 在介面上新增彩色主題色；彩色屬於彈珠。

