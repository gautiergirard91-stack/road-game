import { LEVELS, WINDOWS } from '../js/data.js';
import { buildPattern, judge, pointsFor, coinsForResult, firstClearBonus, maxMissesFor, mulberry32, axleDelta } from '../js/core.js';

const FRONT_GAP = 98;

function gauss(rand) {
  let u = 0;
  let v = 0;
  while (!u) u = rand();
  while (!v) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function simulate(level, mode, sigmaMs, seed) {
  const pattern = buildPattern(level, seed, mode);
  const axles = mode === 'auto' ? ['rear'] : ['front', 'rear'];
  const rand = mulberry32(seed);
  let combo = 0;
  let score = 0;
  let misses = 0;
  let perfects = 0;
  let goods = 0;
  let passables = 0;
  for (const line of pattern) {
    for (const axle of axles) {
      const err = gauss(rand) * sigmaMs;
      const result = judge(err, WINDOWS);
      if (!result) {
        misses++;
        combo = 0;
        continue;
      }
      score += pointsFor(result, combo);
      combo++;
      if (result === 'perfect') perfects++;
      else if (result === 'good') goods++;
      else passables++;
    }
  }
  const completed = misses < maxMissesFor(mode);
  const coins =
    coinsForResult({ score, perfects, goods, passables, misses }, level, completed) +
    (completed ? firstClearBonus(level) : 0);
  const duration = (pattern[pattern.length - 1].dist + 200) / level.speed;
  return { misses, score, coins, duration, completed };
}

const sigma = Number(process.argv[2] || 60);
const N = Number(process.argv[3] || 200);
console.log(`# Simulation d'équilibrage — sigma = ${sigma} ms, ${N} parties/niveau`);
console.log('| niv | mode | vitesse | lignes | ratés moy | score moy | pièces moy | durée moy (s) | terminé % |');
console.log('|-----|------|---------|--------|-----------|-----------|------------|---------------|-----------|');
for (const mode of ['auto', 'permisA']) {
  for (const level of LEVELS) {
    const agg = { misses: 0, score: 0, coins: 0, duration: 0, completed: 0 };
    for (let s = 1; s <= N; s++) {
      const r = simulate(level, mode, sigma, s * 7919);
      agg.misses += r.misses;
      agg.score += r.score;
      agg.coins += r.coins;
      agg.duration += r.duration;
      agg.completed += r.completed ? 1 : 0;
    }
    const lines = buildPattern(level, 1, mode).length;
    console.log(
      `| ${level.id} | ${mode} | ${level.speed} | ${lines} | ${(agg.misses / N).toFixed(2)} | ${Math.round(agg.score / N)} | ${Math.round(agg.coins / N)} | ${(agg.duration / N).toFixed(1)} | ${Math.round((100 * agg.completed) / N)} |`
    );
  }
}
