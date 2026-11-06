/**
 * 無頭模擬：以 Simulation 跑完整場（所有彈珠抵達），檢查台面是否會卡死、所需時間是否合理。
 * 調整台面配置後可用來驗證。每場以場次編號（1、2、3…）作為種子，結果可重現。
 * 執行：npm run sim -- <boardId|all> [人數=200] [場數=3]
 */
import { BOARD_LIST, getBoard } from '../src/lib/pinball/boards';
import { runHeadless } from '../src/lib/pinball/simulation';

const target = process.argv[2];
const players = Number(process.argv[3] ?? 200);
const rounds = Number(process.argv[4] ?? 3);

const defs = target === 'all' ? BOARD_LIST : [getBoard(target ?? '')].filter((d) => d !== undefined);
if (!defs.length) {
  console.error(`用法：npm run sim -- <${BOARD_LIST.map((d) => d.id).join('|')}|all> [人數=200] [場數=3]`);
  process.exit(1);
}

const names = Array.from({ length: players }, (_, i) => `P${i}`);
for (const def of defs) {
  for (let seed = 1; seed <= rounds; seed++) {
    const r = runHeadless({ names, boardId: def.id, seed, winnerCount: players }, { untilAllFinished: true });
    console.log({ board: def.id, seed, seconds: Math.round(r.steps / 60), finished: r.finished, nudges: r.nudges, stuckAt: r.stuckAt });
  }
}
