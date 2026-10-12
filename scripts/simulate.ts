/**
 * 無頭模擬：以與 Game 相同的物理參數跑完整場，檢查台面是否會卡死、所需時間是否合理。
 * 調整 board.ts 配置後可用來驗證。
 * 執行：npx tsx scripts/simulate.ts [人數] [場數]
 */
import Matter from 'matter-js';
import { buildBoard, FINISH_Y, MARBLE_R, WORLD_W } from '../src/board';

const { Engine, Composite, Bodies, Body, Events, Vector } = Matter;
const STEP_MS = 1000 / 60;

/**
 * 跑一場模擬。
 * @param players 彈珠數
 * @returns 全部抵達所需秒數、抵達數、被推動次數，以及卡住位置分佈（每 100 單位一格）
 */
function run(players: number) {
  const engine = Engine.create({ positionIterations: 10, velocityIterations: 8 });
  const board = buildBoard();
  Composite.add(engine.world, [...board.statics, ...board.spinners.map((s) => s.body)]);

  const gap = MARBLE_R * 2 + 6;
  const perRow = Math.floor((WORLD_W - 40) / gap);
  const marbles = Array.from({ length: players }, (_, i) =>
    Bodies.circle(20 + gap / 2 + (i % perRow) * gap, 30 + Math.floor(i / perRow) * gap, MARBLE_R, {
      restitution: 0.5,
      friction: 0.01,
      frictionStatic: 0,
      frictionAir: 0.005,
      density: 0.002,
      label: 'marble',
    }),
  );
  Composite.add(engine.world, marbles);

  let kicks: [Matter.Body, Matter.Body][] = [];
  Events.on(engine, 'collisionStart', (e) => {
    for (const { bodyA, bodyB } of e.pairs) {
      if (bodyA.label === 'marble' && bodyB.label === 'bumper') kicks.push([bodyA, bodyB]);
      if (bodyB.label === 'marble' && bodyA.label === 'bumper') kicks.push([bodyB, bodyA]);
    }
  });

  const still = new Map<number, number>();
  const done = new Set<number>();
  const stuckAt: Record<number, number> = {};
  let nudges = 0;
  let steps = 0;
  const maxSteps = 60 * 600;
  while (done.size < players && steps < maxSteps) {
    for (const s of board.spinners) Body.setAngle(s.body, s.body.angle + s.speed);
    Engine.update(engine, STEP_MS);
    steps++;
    for (const [m, b] of kicks) Body.setVelocity(m, Vector.mult(Vector.normalise(Vector.sub(m.position, b.position)), 9));
    kicks = [];
    const now = engine.timing.timestamp;
    for (const b of marbles) {
      if (done.has(b.id)) continue;
      if (b.position.y > FINISH_Y) {
        done.add(b.id);
        Composite.remove(engine.world, b);
        continue;
      }
      if (b.speed > 16) Body.setVelocity(b, Vector.mult(b.velocity, 16 / b.speed));
      if (b.speed < 0.2) {
        if (!still.has(b.id)) still.set(b.id, now);
        else if (now - still.get(b.id)! > 1500) {
          Body.setVelocity(b, { x: (Math.random() - 0.5) * 8, y: -5 });
          still.delete(b.id);
          nudges++;
          const bucket = Math.floor(b.position.y / 100) * 100;
          stuckAt[bucket] = (stuckAt[bucket] ?? 0) + 1;
        }
      } else still.delete(b.id);
    }
  }
  return { seconds: Math.round(steps / 60), finished: done.size, nudges, stuckAt };
}

const players = Number(process.argv[2] ?? 12);
const rounds = Number(process.argv[3] ?? 3);
for (let i = 0; i < rounds; i++) console.log(`players=${players}`, run(players));
