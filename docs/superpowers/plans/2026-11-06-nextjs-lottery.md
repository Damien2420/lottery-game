# 彈珠台抽獎 Next.js 改版實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把現有的 Vite 彈珠台抽獎改寫為 Next.js 網站，加入 SEO 首頁、名單與歷史紀錄的 localStorage 保存、3 種台面，以及以種子重播的功能。

**Architecture:** 把現有 `Game` 拆成兩層：一層是可決定性、可無頭執行的 `Simulation`（純物理與名次判定，只依步數推進），另一層是負責 rAF、鏡頭、Canvas 繪製與音效的 `Game`。抽獎、重播、無頭驗證腳本、單元測試都共用同一個 `Simulation`。資料層是一組操作 `StoredData` 的純函式，加上一個對 localStorage 讀寫的 store，由 `useSyncExternalStore` 接到 React，且伺服器端快照固定為 `null` 以避免 hydration 不一致。首頁靜態產生，其餘頁面為客戶端頁面並設為 noindex。

**Tech Stack:** Next.js（App Router，安裝當下的最新穩定版並鎖定精確版本）、React、TypeScript、Matter.js `0.20.0`（精確版本）、canvas-confetti、Vitest + jsdom、tsx

**Spec:** `docs/superpowers/specs/2026-11-06-nextjs-lottery-design.md`

## Global Constraints

- 直接在現有 `lottery-game` repo 改寫，工作分支 `feat/nextjs-rewrite`，不直接改 `main`。
- `matter-js` 版本寫成 `"0.20.0"`，不可使用 `^` 或 `~`；`next`、`react`、`react-dom` 同樣鎖定精確版本。
- 每場最多 200 人（`MAX_PLAYERS = 200`）。
- localStorage key：`pinball-lottery`；`schemaVersion: 1`；`ENGINE_VERSION` 起始值 `1`；每個台面 `version` 起始值 `1`。
- 種子以 `crypto.getRandomValues(new Uint32Array(1))[0]` 產生，只在按下開始時產生。
- 物理亂數只用 `createRng(seed)`；音效亂數維持 `Math.random()`，兩者不可共用。
- 名單與紀錄不可傳送到任何伺服器，不加入任何會上傳使用者資料的第三方服務。
- 網站網址由 `NEXT_PUBLIC_SITE_URL` 提供，未設定時為 `http://localhost:3000`。
- `<html lang="zh-Hant">`；介面文案為繁體中文。
- 程式碼註解使用繁體中文；Class、Interface、核心 Function 須有繁體中文 JSDoc，說明用途、參數、回傳值。
- 程式碼與文案不使用 emoji。
- Commit 遵守 Conventional Commits、英文撰寫，訊息結尾不加任何 Co-Authored-By 或署名行。

## Review Focus

1. **有資料時重新整理任一客戶端頁面**：第一次渲染必須與伺服器輸出一致（不讀 localStorage），瀏覽器 console 不可出現 hydration 警告。→ Task 4 測試 `getServerSnapshot()` 回傳 `null`；Task 10 手動檢查。
2. **localStorage 內容損毀、版本不符、或不可用（無痕、容量滿）**：讀取時回到空資料而不是整頁崩潰；寫入失敗時抽獎照常完成，並顯示「本次結果無法保存」。→ Task 4 測試 `loadData` 與 `saveData` 的失敗情境；Task 5 使用 `SaveResult` 顯示提示。
3. **抽獎進行中點擊站內導覽連結**：Next.js 站內換頁不會觸發 `beforeunload`，也必須先確認，確認離開則作廢本場、不寫紀錄。→ Task 5 的 `drawLock` 與 `Nav` 測試。
4. **同名參加者**：得獎、移除、重播都以索引對應，同名的兩人可以各自得獎，移除時一次只刪一筆。→ Task 1、Task 4 測試。
5. **React 開發模式重複掛載彈珠台元件**：只能有一個畫面迴圈，卸載後不再繪製或播放音效。→ Task 3 測試 `destroy()`。

---

## 檔案結構

```
src/
  app/
    layout.tsx               根版面：lang、全站 metadata、Nav
    globals.css              由舊 style.css 改寫的全站樣式
    page.tsx                 首頁（靜態產生）
    home.module.css
    opengraph-image.tsx      分享預覽圖
    sitemap.ts / robots.ts
    play/page.tsx            抽獎頁殼（metadata noindex），內容為 PlayClient
    lists/page.tsx           名單管理
    history/page.tsx         歷史紀錄與重播
    settings/page.tsx        匯出／匯入
  components/
    Nav.tsx                  站內導覽，抽獎進行中會先確認
    PinballCanvas.tsx        包裝 Game 的客戶端元件
    HomeDemo.tsx             首頁示範動畫
    PlayClient.tsx           抽獎頁主體
    ListsClient.tsx
    HistoryClient.tsx
    SettingsClient.tsx
  lib/
    pinball/
      rng.ts                 可帶種子的亂數
      physics.ts             物理常數、ENGINE_VERSION、彈珠建立
      boards/
        types.ts             Board、BoardDef、BoardId
        builders.ts          segment / pegField / spinner / bumper
        classic.ts           現有台面
        zigzag.ts            新台面 2
        cascade.ts           新台面 3
        index.ts             BOARDS、getBoard
      simulation.ts          決定性模擬核心與 runHeadless
      game.ts                rAF、鏡頭、繪製
      audio.ts               原 Sfx
    storage/
      schema.ts              StoredData 等型別、emptyData、驗證
      store.ts               loadData、saveData、訂閱
      ops.ts                 名單、紀錄的純函式操作
      useStoredData.ts       React hook
    draw.ts                  parseNames、validateDrawInput、newSeed
    drawLock.ts              抽獎進行中旗標
scripts/simulate.ts          無頭驗證，改用 runHeadless
tests/                       與 src/lib 對應的測試
```

---

### Task 0: 建立分支並把專案換成 Next.js 骨架

**Files:**
- Create: `next.config.ts`、`vitest.config.ts`、`src/app/layout.tsx`、`src/app/page.tsx`（暫時內容）、`src/app/globals.css`（由 `src/style.css` 搬移）、`tests/smoke.test.ts`
- Modify: `package.json`、`tsconfig.json`、`.gitignore`（加入 `.next`、`next-env.d.ts`）
- Delete: `index.html`、`src/main.ts`、`src/vite-env.d.ts`、`src/style.css`
- 搬移：`src/game.ts`、`src/board.ts`、`src/audio.ts` → `src/lib/pinball/`（只搬移，不改內容，下一個 Task 才改）

**Interfaces:**
- Produces: npm scripts `dev`、`build`、`start`、`lint`、`test`（`vitest run`）、`sim`（`tsx scripts/simulate.ts`）；路徑別名 `@/*` → `src/*`（tsconfig 與 vitest 都要設定）

- [ ] **Step 1：建立分支** `git switch -c feat/nextjs-rewrite`
- [ ] **Step 2：調整相依套件**：移除 `vite`；安裝 `next`、`react`、`react-dom`、`@types/react`、`@types/react-dom`、`vitest`、`jsdom`、`tsx`、`eslint`、`eslint-config-next`。`next`、`react`、`react-dom`、`matter-js` 都改成精確版本。若 Next.js 不支援現有的 TypeScript 7，就把 `typescript` 換成 Next.js 文件列出的支援版本並鎖定，在 commit 訊息中註明。
- [ ] **Step 3：設定檔**：`tsconfig.json` 改成 Next.js 標準設定（`jsx: preserve`、`plugins: [{ name: "next" }]`、`paths`），`include` 要涵蓋 `src`、`scripts`、`tests`、`next-env.d.ts`。`vitest.config.ts` 設定 `environment: 'jsdom'` 與 `@` 別名。
- [ ] **Step 4：最小頁面**：`layout.tsx` 設 `<html lang="zh-Hant">` 並引入 `globals.css`；`page.tsx` 先顯示「彈珠台抽獎」。
- [ ] **Step 5：寫冒煙測試** `tests/smoke.test.ts`：`expect(1 + 1).toBe(2)`
- [ ] **Step 6：驗證**：執行 `npm run build`、`npm test`、`npm run lint`，三者都要成功。`npm run dev` 開啟 http://localhost:3000 要看得到標題。
- [ ] **Step 7：Commit** `chore: replace vite with next.js app router scaffold`

---

### Task 1：可決定性的模擬核心

**Files:**
- Create: `src/lib/pinball/rng.ts`、`src/lib/pinball/physics.ts`、`src/lib/pinball/boards/types.ts`、`src/lib/pinball/boards/builders.ts`、`src/lib/pinball/boards/classic.ts`、`src/lib/pinball/boards/index.ts`、`src/lib/pinball/simulation.ts`
- Delete: `src/lib/pinball/board.ts`（內容拆進 boards/）
- Modify: `scripts/simulate.ts`
- Test: `tests/pinball/rng.test.ts`、`tests/pinball/simulation.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // rng.ts
  export function createRng(seed: number): () => number; // mulberry32，回傳 [0, 1)

  // physics.ts
  export const ENGINE_VERSION = 1;
  export const STEP_MS = 1000 / 60;
  export const MARBLE_R = 9;
  export const MAX_PLAYERS = 200;
  export const WORLD_W = 600;
  // 以及 MAX_SPEED=16、STUCK_SPEED=0.2、STUCK_MS=1500、BUMPER_KICK=9、彈珠材質參數（沿用現值）

  // boards/types.ts
  export type BoardId = 'classic' | 'zigzag' | 'cascade';
  export interface Spinner { body: Matter.Body; speed: number }
  export interface Board { statics: Matter.Body[]; spinners: Spinner[]; worldH: number; finishY: number }
  export interface BoardDef { id: BoardId; name: string; version: number; build(): Board }

  // boards/index.ts
  export const BOARDS: Record<BoardId, BoardDef>; // 本 Task 只有 classic，另外兩個在 Task 2 加入
  export const BOARD_LIST: BoardDef[];
  export function getBoard(id: string): BoardDef | undefined;

  // simulation.ts
  export interface SimConfig { names: string[]; boardId: BoardId; seed: number; winnerCount: number }
  export interface SimMarble { index: number; name: string; color: string; body: Matter.Body; finished: boolean }
  export interface StepResult { arrivals: { index: number; rank: number }[]; hits: { speed: number; bumper: boolean }[] }
  export class Simulation {
    constructor(cfg: SimConfig);
    readonly board: Board;
    readonly marbles: readonly SimMarble[];
    readonly winners: number[];      // 依名次排列的 names 索引
    readonly stepCount: number;
    readonly nudges: number;
    isDone(): boolean;               // 前 winnerCount 名都已抵達
    allFinished(): boolean;
    step(): StepResult;
    leader(): SimMarble | null;
  }
  export function orderArrivals(c: { index: number; order: number; y: number }[]): number[];
  export interface HeadlessResult { winners: number[]; steps: number; finished: number; nudges: number; stuckAt: Record<number, number> }
  export function runHeadless(cfg: SimConfig, opts?: { untilAllFinished?: boolean; maxSteps?: number }): HeadlessResult;
  ```

- [ ] **Step 1：寫 rng 測試**
  ```ts
  it('相同種子產生相同序列', () => {
    const a = createRng(42), b = createRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('數值落在 [0, 1)，種子 0 也可用', () => {
    const r = createRng(0);
    for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
  it('不同種子產生不同序列', () => expect(createRng(1)()).not.toBe(createRng(2)()));
  ```
- [ ] **Step 2：執行** `npx vitest run tests/pinball/rng.test.ts`，預期 FAIL（找不到模組）
- [ ] **Step 3：實作 `createRng`**（mulberry32）
- [ ] **Step 4：執行同一指令**，預期 PASS
- [ ] **Step 5：寫 simulation 測試**
  ```ts
  const names = (n: number) => Array.from({ length: n }, (_, i) => `P${i}`);
  it('同一種子跑兩次得獎者相同', () => {
    const cfg = { names: names(30), boardId: 'classic' as const, seed: 12345, winnerCount: 5 };
    const a = runHeadless(cfg), b = runHeadless(cfg);
    expect(a.winners).toHaveLength(5);
    expect(a.winners).toEqual(b.winners);
  });
  it('不同種子會產生不同結果', () => {
    const results = [1, 2, 3, 4, 5].map((seed) =>
      runHeadless({ names: names(30), boardId: 'classic', seed, winnerCount: 3 }).winners.join(','));
    expect(new Set(results).size).toBeGreaterThan(1);
  });
  it('同名參加者以索引區分', () => {
    const r = runHeadless({ names: ['A', 'A', 'B'], boardId: 'classic', seed: 7, winnerCount: 3 });
    expect([...r.winners].sort()).toEqual([0, 1, 2]);
  });
  it('同一步抵達者依 y 由大到小，再依洗牌順序排序', () => {
    expect(orderArrivals([{ index: 4, order: 1, y: 10 }, { index: 2, order: 0, y: 10 }, { index: 9, order: 5, y: 20 }]))
      .toEqual([9, 2, 4]);
  });
  it('isDone 後 winners 長度等於名額，且索引不重複', () => {
    const sim = new Simulation({ names: names(20), boardId: 'classic', seed: 99, winnerCount: 4 });
    while (!sim.isDone()) sim.step();
    expect(new Set(sim.winners).size).toBe(4);
  });
  ```
- [ ] **Step 6：執行** `npx vitest run tests/pinball/simulation.test.ts`，預期 FAIL
- [ ] **Step 7：實作**
  - 把 `board.ts` 拆成 `builders.ts`（`segment`、`pegField`、`spinner`、`bumper`）與 `classic.ts`（原 `buildBoard`，`worldH: 3040`、`finishY: 2910`）。
  - `Simulation` 建構時建立**全新的** Engine（`positionIterations: 10, velocityIterations: 8`）與全新的台面，旋轉擋板從建立時的初始角度開始。
  - 以 `createRng(seed)` 對 `names` 的索引洗牌（Fisher-Yates），起跑位置偏移與卡住推動都用同一個 rng，呼叫順序固定。顏色依洗牌後位置 `i` 計算 `hsl(${(i * 137.5) % 360} 80% 60%)`。
  - `step()` 的順序沿用現有 `Game.step()`：轉擋板 → `Engine.update` → 保險桿彈射 → 逐顆處理終點、限速、拉回牆內、卡住判定。同一步越過 `finishY` 的彈珠收集起來，以 `orderArrivals` 排序後再依序給名次。
  - 碰撞時把 `{ speed, bumper }` 放進 `hits`，交給呼叫者決定是否播音效。
  - `runHeadless` 預設 `maxSteps = 60 * 300`。
  - 若「同一種子跑兩次」測試因 Matter.js 全域物件 ID 遞增而失敗，在 `Simulation` 建構時重設 `Matter.Common._nextId = 0`，並加註解說明原因。
- [ ] **Step 8：執行同一指令**，預期 PASS
- [ ] **Step 9：改寫 `scripts/simulate.ts`**，改用 `runHeadless(..., { untilAllFinished: true })`。參數改為 `npm run sim -- <boardId|all> [人數=200] [場數=3]`，每場輸出 `board`、`seconds`（`steps / 60` 取整數）、`finished`、`nudges`、`stuckAt`。執行 `npm run sim -- classic 200 1`，預期 `finished=200`。
- [ ] **Step 10：Commit** `feat: add deterministic seeded simulation core`

---

### Task 2：新增兩種台面並驗收

**Files:**
- Create: `src/lib/pinball/boards/zigzag.ts`、`src/lib/pinball/boards/cascade.ts`
- Modify: `src/lib/pinball/boards/index.ts`
- Test: `tests/pinball/boards.test.ts`

**Interfaces:**
- Consumes: Task 1 的 builders、`BoardDef`、`runHeadless`
- Produces: `BOARDS` 包含 `classic`（名稱「經典」）、`zigzag`（「之字迴廊」）、`cascade`（「瀑布」），`version` 皆為 `1`

- [ ] **Step 1：寫測試**
  ```ts
  it.each(BOARD_LIST.map((b) => b.id))('%s：30 人可在時限內全部抵達', (id) => {
    const r = runHeadless({ names: Array.from({ length: 30 }, (_, i) => `P${i}`), boardId: id, seed: 1, winnerCount: 1 },
      { untilAllFinished: true });
    expect(r.finished).toBe(30);
  });
  it('共有 3 種台面且 id 不重複', () => expect(new Set(BOARD_LIST.map((b) => b.id)).size).toBe(3));
  ```
- [ ] **Step 2：執行** `npx vitest run tests/pinball/boards.test.ts`，預期 FAIL（只有 1 種台面）
- [ ] **Step 3：設計並實作 `zigzag` 與 `cascade`**：兩者的軌道走向與障礙物位置都要和 `classic` 明顯不同。起跑區（y < 260）不放障礙物，以容納 200 顆彈珠。配置由實作者設計。
- [ ] **Step 4：執行同一指令**，預期 PASS
- [ ] **Step 5：200 人驗收**：執行 `npm run sim -- all 200 3`。通過條件：每場 `finished=200`；每個台面 3 場的平均秒數，最大值不超過最小值的 1.5 倍；`stuckAt` 中沒有任何一格超過 20 次。不通過就調整配置後重跑，並把最後一次的輸出貼進 commit 訊息內文。
- [ ] **Step 6：Commit** `feat: add zigzag and cascade boards`

---

### Task 3：繪製層 Game 與 React 元件

**Files:**
- Modify: `src/lib/pinball/game.ts`（改為驅動 `Simulation`）、`src/lib/pinball/audio.ts`（不改行為）
- Create: `src/components/PinballCanvas.tsx`
- Test: `tests/pinball/game.test.ts`

**Interfaces:**
- Consumes: `Simulation`、`SimConfig`、`getBoard`、`Sfx`
- Produces:
  ```ts
  export interface GameEvents { onArrive(index: number, rank: number): void; onDone(winners: number[]): void }
  export class Game {
    constructor(canvas: HTMLCanvasElement, events: GameEvents, sfx: Sfx);
    showBoard(boardId: BoardId): void;   // 閒置時顯示台面，擋板不轉
    start(cfg: SimConfig): void;
    stop(): void;                        // 中止目前這場，不觸發 onDone
    destroy(): void;                     // 停止 rAF、解除 ResizeObserver，可重複呼叫
  }
  // PinballCanvas.tsx（'use client'）
  export interface PinballRun extends SimConfig { key: number }
  export function PinballCanvas(props: {
    boardId: BoardId; run: PinballRun | null; sound: boolean;
    onArrive?: (index: number, rank: number) => void; onDone?: (winners: number[]) => void;
  }): JSX.Element;
  ```

- [ ] **Step 1：寫測試**（在 jsdom 中以 `vi.stubGlobal` 替換 `requestAnimationFrame`、`cancelAnimationFrame`、`ResizeObserver`，並 mock `canvas.getContext` 回傳空操作物件）
  ```ts
  it('destroy 會取消 rAF 並解除 ResizeObserver，重複呼叫不拋錯', () => {
    const game = new Game(canvas, events, new Sfx());
    game.destroy(); game.destroy();
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
  it('destroy 後不再排程新的畫面', () => {
    const game = new Game(canvas, events, new Sfx());
    game.destroy();
    const calls = (requestAnimationFrame as Mock).mock.calls.length;
    runPendingFrames();
    expect((requestAnimationFrame as Mock).mock.calls.length).toBe(calls);
  });
  it('stop 後不會觸發 onDone', () => {
    const game = new Game(canvas, events, new Sfx());
    game.start({ names: ['A', 'B'], boardId: 'classic', seed: 1, winnerCount: 1 });
    game.stop(); runFrames(60 * 60);
    expect(events.onDone).not.toHaveBeenCalled();
  });
  ```
- [ ] **Step 2：執行** `npx vitest run tests/pinball/game.test.ts`，預期 FAIL
- [ ] **Step 3：實作**：把物理相關邏輯從 `Game` 移除，改為持有一個 `Simulation | null`。`frame()` 沿用固定步長累加器（單次 dt 上限 100ms），每步呼叫 `sim.step()`，依 `hits` 呼叫 `sfx.hit`、依 `arrivals` 播放音效並呼叫 `onArrive`（只通知前 `winnerCount` 名），`isDone()` 時呼叫 `onDone`。鏡頭、繪製、終點線沿用現有程式碼，`WORLD_H` 與 `FINISH_Y` 改讀自 `board.worldH`、`board.finishY`。
- [ ] **Step 4：執行同一指令**，預期 PASS
- [ ] **Step 5：實作 `PinballCanvas`**：在 `useEffect` 中建立 `Game`，cleanup 時呼叫 `destroy()`。`boardId` 變更時呼叫 `showBoard`；`run?.key` 變更時呼叫 `start(run)`；`sound` 變更時同步 `sfx.enabled`；第一名抵達時放彩帶（沿用 `main.ts` 的三段 confetti 參數）。`onArrive`、`onDone` 以 ref 保存最新值，避免因 callback 改變而重建 `Game`。
- [ ] **Step 6：手動驗證**：暫時在 `src/app/page.tsx` 放 `PinballCanvas`，以 `next/dynamic` 並設定 `ssr: false` 載入。`npm run dev` 後確認可以抽完一場；開發模式下 React 的重複掛載不會出現兩組彈珠或兩倍速度。驗證後把暫時放的元件移除。
- [ ] **Step 7：Commit** `refactor: split rendering from simulation and add PinballCanvas`

---

### Task 4：資料層

**Files:**
- Create: `src/lib/storage/schema.ts`、`src/lib/storage/store.ts`、`src/lib/storage/ops.ts`、`src/lib/storage/useStoredData.ts`
- Test: `tests/storage/store.test.ts`、`tests/storage/ops.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // schema.ts：StoredData、ParticipantList、DrawRecord 完全照設計文件第 5 節（含 engineVersion）
  export const STORAGE_KEY = 'pinball-lottery';
  export function emptyData(): StoredData; // preferences: { sound: true, removeWinners: true }
  export function isStoredData(v: unknown): v is StoredData;

  // store.ts
  export type SaveResult = { ok: true } | { ok: false; reason: 'unavailable' | 'quota' };
  export function loadData(): StoredData;           // 讀不到、壞掉、版本不符 → emptyData()
  export function saveData(d: StoredData): SaveResult;
  export function subscribe(cb: () => void): () => void; // 本分頁寫入與其他分頁的 storage 事件都會通知
  export function getSnapshot(): StoredData;        // 有快取，同一份資料回傳同一個參考
  export function getServerSnapshot(): null;
  export function parseImport(json: string): { ok: true; data: StoredData } | { ok: false; error: string };
  export function exportJson(d: StoredData): string;

  // ops.ts（全部是純函式，回傳新的 StoredData）
  export function createList(d: StoredData, title: string, names: string[], now: string, id: string): StoredData;
  export function updateList(d: StoredData, id: string, patch: { title?: string; names?: string[] }, now: string): StoredData;
  export function deleteList(d: StoredData, id: string): StoredData;
  export function duplicateList(d: StoredData, id: string, now: string, newId: string): StoredData; // 標題加「（複本）」
  export function addDraw(d: StoredData, r: DrawRecord): StoredData;   // 新紀錄放最前面
  export function deleteDraw(d: StoredData, id: string): StoredData;
  export function setPreferences(d: StoredData, p: Partial<StoredData['preferences']>): StoredData;
  export function removeWinnersOnce(names: string[], winnerNames: string[]): string[];

  // useStoredData.ts（'use client'）
  export function useStoredData(): { data: StoredData | null; update(fn: (d: StoredData) => StoredData): SaveResult };
  ```

- [ ] **Step 1：寫 store 測試**
  ```ts
  beforeEach(() => localStorage.clear());
  it('沒有資料時回傳空資料', () => expect(loadData()).toEqual(emptyData()));
  it('JSON 損毀時回傳空資料而不拋錯', () => { localStorage.setItem(STORAGE_KEY, '{oops'); expect(loadData()).toEqual(emptyData()); });
  it('schemaVersion 不符時回傳空資料', () => { localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 99 })); expect(loadData()).toEqual(emptyData()); });
  it('存入後可讀回', () => { const d = createList(emptyData(), '尾牙', ['A'], '2026-01-01T00:00:00Z', 'l1'); saveData(d); expect(loadData()).toEqual(d); });
  it('容量已滿時回傳 quota', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    expect(saveData(emptyData())).toEqual({ ok: false, reason: 'quota' });
  });
  it('localStorage 無法存取時回傳 unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
    expect(saveData(emptyData())).toEqual({ ok: false, reason: 'unavailable' });
  });
  it('伺服器快照為 null', () => expect(getServerSnapshot()).toBeNull());
  it('getSnapshot 在資料未變時回傳同一參考', () => expect(getSnapshot()).toBe(getSnapshot()));
  it('匯出再匯入得到相同資料', () => { const d = emptyData(); const r = parseImport(exportJson(d)); expect(r).toEqual({ ok: true, data: d }); });
  it('匯入格式錯誤時回傳錯誤', () => expect(parseImport('[]').ok).toBe(false));
  ```
- [ ] **Step 2：寫 ops 測試**
  ```ts
  it('同名只移除一筆', () => expect(removeWinnersOnce(['小明', '小明', '阿美'], ['小明'])).toEqual(['小明', '阿美']));
  it('不存在的得獎者不影響名單', () => expect(removeWinnersOnce(['A'], ['Z'])).toEqual(['A']));
  it('updateList 更新 updatedAt 且不影響既有紀錄的快照', () => { /* 先 addDraw 一筆 names=['A','B']，再 updateList 改成 ['C']，斷言 draws[0].names 仍為 ['A','B'] */ });
  it('duplicateList 產生新 id 與「（複本）」標題', () => { /* 斷言 lists 長度 +1、title === '尾牙（複本）'、names 相同但不是同一參考 */ });
  it('deleteList 不刪除相關紀錄', () => { /* 斷言 draws 長度不變 */ });
  it('addDraw 把新紀錄放在最前面', () => { /* 斷言 draws[0].id 為最新 */ });
  ```
- [ ] **Step 3：執行** `npx vitest run tests/storage`，預期 FAIL
- [ ] **Step 4：實作**。`saveData` 依 `DOMException.name === 'QuotaExceededError'` 判斷 quota，其餘例外視為 unavailable。`getSnapshot` 以原始字串作為快取鍵。`useStoredData` 以 `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` 實作。
- [ ] **Step 5：執行同一指令**，預期 PASS
- [ ] **Step 6：Commit** `feat: add localStorage data layer`

---

### Task 5：抽獎頁

**Files:**
- Create: `src/lib/draw.ts`、`src/lib/drawLock.ts`、`src/components/Nav.tsx`、`src/components/PlayClient.tsx`、`src/app/play/page.tsx`
- Modify: `src/app/layout.tsx`（加入 Nav）
- Test: `tests/draw.test.ts`、`tests/drawLock.test.ts`

**Interfaces:**
- Consumes: `PinballCanvas`、`useStoredData`、`ops`、`BOARD_LIST`、`ENGINE_VERSION`
- Produces:
  ```ts
  // draw.ts
  export function parseNames(text: string): string[];                     // 一行一位，trim，去空行
  export function validateDrawInput(names: string[], winnerCount: number): string | null;
  export function newSeed(): number;
  // drawLock.ts
  export function setDrawing(v: boolean): void;
  export function isDrawing(): boolean;
  export const LEAVE_MESSAGE = '抽獎尚未結束，離開將作廢本場。確定要離開嗎？';
  // Nav.tsx：連結到 /、/play、/lists、/history、/settings；抽獎進行中點擊時先 window.confirm(LEAVE_MESSAGE)，取消則 preventDefault
  ```

- [ ] **Step 1：寫測試**
  ```ts
  it('parseNames 去除空白與空行', () => expect(parseNames(' A \r\n\n B\n')).toEqual(['A', 'B']));
  it('空名單', () => expect(validateDrawInput([], 1)).toBe('請先輸入參加名單'));
  it('超過 200 人', () => expect(validateDrawInput(Array(201).fill('x'), 1)).toBe('最多 200 人'));
  it.each([0, 4, 1.5, NaN])('名額 %s 不合法', (n) => expect(validateDrawInput(['A', 'B', 'C'], n)).toBe('抽出名額需介於 1 到 3'));
  it('合法輸入', () => expect(validateDrawInput(['A'], 1)).toBeNull());
  it('newSeed 為 32 位元無號整數', () => { const s = newSeed(); expect(Number.isInteger(s) && s >= 0 && s <= 0xffffffff).toBe(true); });
  it('抽獎中點擊 Nav 連結且取消確認時不換頁', () => { /* render <Nav/>，setDrawing(true)，confirm 回傳 false，click 連結，斷言 defaultPrevented */ });
  ```
  （Nav 的測試需要 `@testing-library/react`，在此 Task 加入 devDependencies。）
- [ ] **Step 2：執行** `npx vitest run tests/draw.test.ts tests/drawLock.test.ts`，預期 FAIL
- [ ] **Step 3：實作 `draw.ts`、`drawLock.ts`、`Nav.tsx`**
- [ ] **Step 4：執行同一指令**，預期 PASS
- [ ] **Step 5：實作 `PlayClient`**，行為如下：
  - `data === null`（伺服器端與首次渲染）時顯示載入中的版面，不讀 localStorage。
  - 名單來源下拉選單：「直接輸入（未存檔）」加上所有已存名單。選已存名單時，文字框帶入內容，可以直接修改。未存檔模式下提供「存成名單」按鈕與標題輸入。
  - 台面選擇預設為 `preferences.lastBoardId`，沒有時用 `classic`；另外有名額、自動移除、音效三個設定，後兩者讀寫 `preferences`。
  - 按下開始：`validateDrawInput` → 若為已存名單且內容有變，`updateList` 覆蓋 → `newSeed()` → 記下名單快照 → `setDrawing(true)` 並註冊 `beforeunload` → 交給 `PinballCanvas` 開始。
  - `onArrive` 時把名次加入「本輪結果」；`onDone` 時組出 `DrawRecord`（`id: crypto.randomUUID()`、`createdAt`、`listId`、`listTitle`（未存檔為「未命名名單」）、`names` 快照、`boardId`、`boardVersion`、`engineVersion`、`winnerCount`、`seed`、`winners`）並 `addDraw`。若勾選自動移除：已存名單用 `updateList` 加上 `removeWinnersOnce`，未存檔則改文字框。同時更新 `lastBoardId`。任一 `update` 回傳 `ok: false` 時，顯示「本次結果無法保存」。最後 `setDrawing(false)` 並移除 `beforeunload`。
  - 元件卸載時若仍在抽獎中：`setDrawing(false)`，不寫入任何資料。
  - 抽獎進行中，畫面上顯示「抽獎進行中，離開頁面將作廢本場」，並停用表單。
- [ ] **Step 6：`play/page.tsx`**：`export const metadata = { title: '開始抽獎', robots: { index: false } }`，內容以 `next/dynamic`（`ssr: false`）載入 `PlayClient`。若 Next.js 不允許在伺服器元件中使用 `ssr: false`，就另外包一層 `'use client'` 的元件。
- [ ] **Step 7：手動驗證**：`npm run dev`
  - 用未存檔名單抽一場，重新整理後，紀錄仍在 localStorage（DevTools > Application）。
  - 已存名單在抽獎頁修改後抽獎，名單被覆蓋，舊紀錄的快照不變。
  - 抽獎中按重新整理會出現瀏覽器的離開確認；確認離開後沒有新紀錄。
  - 抽獎中點 Nav 連結會出現確認對話框；取消則留在原頁。
- [ ] **Step 8：Commit** `feat: add play page with saved lists and draw records`

---

### Task 6：名單管理頁

**Files:**
- Create: `src/components/ListsClient.tsx`、`src/app/lists/page.tsx`

**Interfaces:**
- Consumes: `useStoredData`、`createList`、`updateList`、`deleteList`、`duplicateList`、`parseNames`、`MAX_PLAYERS`

- [ ] **Step 1：實作**：列出名單（標題、人數、更新時間），提供新增、編輯（標題與一行一位的文字框）、複製、刪除（需確認）。人數超過 200 時不允許儲存並提示「最多 200 人」。每列提供「用這份名單抽獎」連結，指向 `/play?list=<id>`，`PlayClient` 讀取此參數並預選名單（讀取查詢參數時需包在 `Suspense` 中）。頁面 metadata 設定 `robots: { index: false }`。
- [ ] **Step 2：手動驗證**：新增、編輯、複製、刪除後重新整理，結果都正確；從名單頁點「用這份名單抽獎」，抽獎頁會預選該名單。
- [ ] **Step 3：Commit** `feat: add list management page`

---

### Task 7：歷史紀錄與重播

**Files:**
- Create: `src/components/HistoryClient.tsx`、`src/app/history/page.tsx`、`src/lib/replay.ts`
- Test: `tests/replay.test.ts`

**Interfaces:**
- Consumes: `DrawRecord`、`getBoard`、`ENGINE_VERSION`、`PinballCanvas`
- Produces:
  ```ts
  export type ReplayCheck = { ok: true } | { ok: false; message: string };
  export function checkReplayable(r: DrawRecord): ReplayCheck;
  export function sameWinners(a: number[], b: number[]): boolean;
  ```

- [ ] **Step 1：寫測試**
  ```ts
  it('版本相同可重播', () => expect(checkReplayable(rec({ boardVersion: 1, engineVersion: ENGINE_VERSION }))).toEqual({ ok: true }));
  it('台面版本不同', () => expect(checkReplayable(rec({ boardVersion: 0 }))).toEqual({ ok: false, message: '台面或引擎已更新，無法精確重播' }));
  it('引擎版本不同', () => expect(checkReplayable(rec({ engineVersion: 0 })).ok).toBe(false));
  it('台面已不存在', () => expect(checkReplayable(rec({ boardId: 'gone' as BoardId })).ok).toBe(false));
  it('名次順序不同即不一致', () => expect(sameWinners([1, 2], [2, 1])).toBe(false));
  ```
- [ ] **Step 2：執行** `npx vitest run tests/replay.test.ts`，預期 FAIL
- [ ] **Step 3：實作 `replay.ts`**
- [ ] **Step 4：執行同一指令**，預期 PASS
- [ ] **Step 5：實作 `HistoryClient`**：
  - 沒有 `?id=` 時列出紀錄（時間、名單標題、台面名稱、得獎者），可刪除（需確認）。
  - 有 `?id=` 時顯示該場得獎排名（依 `winners` 順序，用 `names[index]` 取名字），並提供「重播」按鈕。
  - `checkReplayable` 不通過時顯示 message 並停用重播，排名照常顯示。
  - 重播時以紀錄中的 config 交給 `PinballCanvas`，重播頁的音效預設關閉。重播結束後以 `sameWinners` 比對，不一致時顯示「此重播與原始結果不同（可能因瀏覽器或版本差異），以紀錄中的排名為準」。
  - 重播不會寫入或修改任何資料。
  - 讀取查詢參數需包在 `Suspense` 中；頁面 metadata 設定 `robots: { index: false }`。
- [ ] **Step 6：手動驗證**：抽完一場後到歷史頁重播，結果和紀錄一致且沒有警告。在 DevTools 把該筆的 `engineVersion` 改成 0，重新整理後應顯示無法重播。
- [ ] **Step 7：Commit** `feat: add history page with seeded replay`

---

### Task 8：匯出與匯入

**Files:**
- Create: `src/components/SettingsClient.tsx`、`src/app/settings/page.tsx`

**Interfaces:**
- Consumes: `exportJson`、`parseImport`、`saveData`、`useStoredData`

- [ ] **Step 1：實作**：「匯出」以 Blob 下載 `pinball-lottery-backup-YYYYMMDD.json`。「匯入」選擇檔案後執行 `parseImport`：失敗時顯示錯誤，資料不變；成功時以 `window.confirm('匯入將取代目前所有名單與紀錄，確定嗎？')` 確認後整份取代。頁面說明「資料只存在這個瀏覽器，換電腦請用匯出／匯入」。metadata 設定 `robots: { index: false }`。
- [ ] **Step 2：手動驗證**：匯出 → 清除 localStorage → 匯入 → 名單與紀錄恢復；匯入一個亂寫的 `.json` 會顯示錯誤，資料不變。
- [ ] **Step 3：Commit** `feat: add backup export and import`

---

### Task 9：首頁與 SEO

**Files:**
- Modify: `src/app/page.tsx`、`src/app/layout.tsx`
- Create: `src/app/home.module.css`、`src/components/HomeDemo.tsx`、`src/app/sitemap.ts`、`src/app/robots.ts`、`src/app/opengraph-image.tsx`
- Test: `tests/seo.test.ts`

**Interfaces:**
- Consumes: `PinballCanvas`
- Produces: `src/lib/site.ts`：`export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'`；`export const FAQ: { q: string; a: string }[]`

- [ ] **Step 1：寫測試**
  ```ts
  it('sitemap 只列出首頁', () => expect(sitemap().map((e) => e.url)).toEqual([`${SITE_URL}/`]));
  it('robots 指向 sitemap', () => expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`));
  it('FAQ 至少包含 4 題', () => expect(FAQ.length).toBeGreaterThanOrEqual(4));
  ```
- [ ] **Step 2：執行** `npx vitest run tests/seo.test.ts`，預期 FAIL
- [ ] **Step 3：實作 `site.ts`、`sitemap.ts`、`robots.ts`**
- [ ] **Step 4：執行同一指令**，預期 PASS
- [ ] **Step 5：layout 的全站 metadata**：設定 `metadataBase: new URL(SITE_URL)`，title template 為 `%s｜抽獎彈珠台`，default title 為 `抽獎彈珠台｜免費線上抽獎工具`，description 為「貼上名單就能開抽的線上抽獎彈珠台，適合尾牙、社團、直播抽獎。免註冊，資料只存在你的瀏覽器。」，並設定 `openGraph` 的 locale 為 `zh_TW`。
- [ ] **Step 6：首頁內容**（伺服器元件，靜態產生）：
  - 主標題「免費線上抽獎彈珠台」，副標「貼上名單就能開抽」，以及連到 `/play` 的「開始抽獎」按鈕。
  - `HomeDemo`：客戶端元件，進入可視範圍後才以 `next/dynamic` 載入 `PinballCanvas`。使用 12 位範例名單、靜音、`classic` 台面，跑完後隔幾秒自動以新種子重跑。
  - 特色：免註冊、最多 200 人、可重播、資料只存在你的瀏覽器、3 種台面。
  - 三步驟：貼上名單 → 選台面與名額 → 開始抽獎。
  - 常見問題：從 `FAQ` 渲染，至少包含「公平嗎？」、「資料會被上傳嗎？」、「最多可以抽幾個人？」、「換電腦資料還在嗎？」，並輸出 `FAQPage` JSON-LD（`<script type="application/ld+json">`）。
  - 首頁的文案必須自然包含「抽獎彈珠台」、「線上抽獎」、「尾牙抽獎」。
- [ ] **Step 7：`opengraph-image.tsx`**：1200x630，深色底，大字「抽獎彈珠台」。
- [ ] **Step 8：驗證**：`npm run build` 的輸出要顯示 `/` 為靜態頁面。`npm run start` 後用 `curl http://localhost:3000/` 確認 HTML 中直接包含主標題與 FAQ 文字，而且有 JSON-LD；`/sitemap.xml`、`/robots.txt`、`/opengraph-image` 都能取得；`/play` 的 HTML 含有 `noindex`。
- [ ] **Step 9：Commit** `feat: add seo landing page`

---

### Task 10：收尾

**Files:**
- Modify: `README.md`、`src/app/globals.css`（版面調整）
- Delete: `src/lib/pinball/` 中已無人使用的舊程式碼（若有）

- [ ] **Step 1：README**：改寫為 Next.js 版本的功能、技術棧、啟動（`npm run dev`）、測試（`npm test`）、台面驗收（`npm run sim -- all 200 3`）、部署到 Vercel 的方式與 `NEXT_PUBLIC_SITE_URL` 說明，並加上開發守則：「變動物理參數、模擬邏輯、亂數演算法或 Matter.js 版本時，必須將 `ENGINE_VERSION` 加 1；變動台面配置時，必須將該台面的 `version` 加 1。」
- [ ] **Step 2：全面驗證**：`npm run lint`、`npm test`、`npm run build` 全部成功。
- [ ] **Step 3：瀏覽器手動驗證**：`npm run dev`，逐頁走一遍。在有資料的狀態下重新整理每個客戶端頁面，console 不可出現 hydration 警告；在 375px 寬度下各頁可以操作，沒有水平捲動；用無痕視窗抽一場，抽獎可以完成，若無法寫入則出現「本次結果無法保存」。
- [ ] **Step 4：Commit** `docs: update readme for next.js version`
