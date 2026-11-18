import { WINDOWS, CONTINUE_BASE_COST } from './data.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function judge(dtMs) {
  const a = Math.abs(dtMs);
  if (a <= WINDOWS.perfect) return 'perfect';
  if (a <= WINDOWS.good) return 'good';
  if (a <= WINDOWS.passable) return 'passable';
  return null;
}

export const BASE_POINTS = { perfect: 100, good: 60, passable: 25 };

export function pointsFor(result, combo) {
  return Math.round(BASE_POINTS[result] * (1 + Math.min(combo, 40) * 0.05));
}

export function buildPattern(level, seed, mode = 'auto') {
  const rand = mulberry32(seed);
  const types = Object.keys(level.w).filter((k) => level.w[k] > 0);
  const axle = () => (mode === 'auto' ? 'rear' : rand() < 0.5 ? 'front' : 'rear');
  const lines = [];
  let dist = Math.max(level.gapMax, 620);
  lines.push({ type: 'dash', dist, axle: axle() });
  for (let i = 1; i < level.lines; i++) {
    const r = rand();
    let acc = 0;
    let type = types[0];
    for (const t of types) {
      acc += level.w[t];
      if (r <= acc) {
        type = t;
        break;
      }
    }
    if (level.crosswalk && i > 2 && rand() < 0.1) type = 'crosswalk';
    const gap = level.gapMin + rand() * (level.gapMax - level.gapMin);
    dist += gap;
    lines.push({ type, dist, axle: axle() });
    if (rand() < (level.pDouble || 0)) {
      dist += 130;
      lines.push({ type: 'dash', dist, axle: axle() });
    }
  }
  return lines;
}

export function coinsForResult(stats, level, completed) {
  return Math.round(stats.score / 8) + stats.perfects * 3 + (completed ? 150 + level.id * 30 : 0);
}

export function accuracy(stats) {
  const total = stats.perfects + stats.goods + stats.passables + stats.misses;
  if (!total) return 100;
  return Math.round(((stats.perfects + stats.goods + stats.passables) / total) * 100);
}

export function continueCost(continues) {
  return CONTINUE_BASE_COST * Math.pow(2, continues);
}

export function maxMissesFor(mode) {
  return mode === 'auto' ? 3 : 5;
}

export function avgReaction(stats) {
  if (!stats.reactions.length) return null;
  return Math.round(stats.reactions.reduce((a, b) => a + b, 0) / stats.reactions.length);
}
