import confetti from 'canvas-confetti';
import { Sfx } from './audio';
import { MAX_PLAYERS } from './board';
import { Game, type Marble } from './game';
import './style.css';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const namesEl = $<HTMLTextAreaElement>('names');
const countEl = $<HTMLElement>('nameCount');
const winnerCountEl = $<HTMLInputElement>('winnerCount');
const removeWinnersEl = $<HTMLInputElement>('removeWinners');
const soundEl = $<HTMLInputElement>('sound');
const startBtn = $<HTMLButtonElement>('start');
const messageEl = $<HTMLElement>('message');
const resultsEl = $<HTMLOListElement>('results');
const historyEl = $<HTMLOListElement>('history');

const sfx = new Sfx();
const game = new Game($<HTMLCanvasElement>('board'), { onArrive, onDone }, sfx);
let round = 0;

/** 解析名單：一行一位，去除前後空白與空行。 */
function parseNames(): string[] {
  return namesEl.value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function updateCount(): void {
  countEl.textContent = `${parseNames().length} 人`;
}

function setRunning(running: boolean): void {
  startBtn.disabled = running;
  namesEl.disabled = running;
  winnerCountEl.disabled = running;
}

/**
 * 從名單移除得獎者，每位得獎者只移除一筆，以支援同名的不同參加者。
 * @param winners 本輪得獎者
 */
function removeFromList(winners: Marble[]): void {
  const lines = namesEl.value.split(/\r?\n/);
  for (const w of winners) {
    const idx = lines.findIndex((l) => l.trim() === w.name);
    if (idx >= 0) lines.splice(idx, 1);
  }
  namesEl.value = lines.join('\n');
  updateCount();
}

function onArrive(marble: Marble, rank: number): void {
  const li = document.createElement('li');
  const rankEl = document.createElement('span');
  rankEl.className = 'rank';
  rankEl.textContent = `第 ${rank} 名`;
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.style.background = marble.color;
  const name = document.createElement('span');
  name.textContent = marble.name;
  li.append(rankEl, dot, name);
  resultsEl.append(li);

  // 第一名出現就放彩帶，不等全部得獎者產生
  if (rank === 1) {
    confetti({ particleCount: 160, spread: 100, origin: { y: 0.6 } });
    setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } }), 250);
    setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } }), 400);
  }
}

function onDone(winners: Marble[]): void {
  round++;
  const li = document.createElement('li');
  li.textContent = `第 ${round} 輪：${winners.map((w) => w.name).join('、')}`;
  historyEl.prepend(li);

  if (removeWinnersEl.checked) removeFromList(winners);
  messageEl.textContent = '抽獎完成！';
  startBtn.textContent = '再抽一輪';
  setRunning(false);
}

startBtn.addEventListener('click', () => {
  const names = parseNames();
  const winnerCount = Number(winnerCountEl.value);
  if (names.length === 0) {
    messageEl.textContent = '請先輸入參加名單';
    return;
  }
  if (names.length > MAX_PLAYERS) {
    messageEl.textContent = `最多 ${MAX_PLAYERS} 人`;
    return;
  }
  if (!Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > names.length) {
    messageEl.textContent = `抽出名額需介於 1 到 ${names.length}`;
    return;
  }

  sfx.enabled = soundEl.checked;
  sfx.unlock();
  resultsEl.innerHTML = '';
  messageEl.textContent = '抽獎進行中…';
  setRunning(true);
  game.start(names, winnerCount);
});

namesEl.addEventListener('input', updateCount);
soundEl.addEventListener('change', () => (sfx.enabled = soundEl.checked));
updateCount();
