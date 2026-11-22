import { WINDOWS, CONTINUE_BASE_COST, LEVELS } from './data.js';

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

export function judge(dtMs, windows = WINDOWS) {
  if (!Number.isFinite(dtMs)) return null; // v1.3.27 : NaN (ex: vitesse 0) ne doit jamais passer pour un jugement
  const a = Math.abs(dtMs);
  if (a <= windows.perfect) return 'perfect';
  if (a <= windows.good) return 'good';
  if (a <= windows.passable) return 'passable';
  return null;
}

export const BASE_POINTS = { perfect: 100, good: 60, passable: 25 };

export function pointsFor(result, combo) {
  const base = BASE_POINTS[result] || 0; // v1.3.27 : result inconnu/NaN -> 0, jamais NaN
  const c = Number.isFinite(combo) ? combo : 0;
  return Math.round(base * (1 + Math.min(c, 40) * 0.05));
}

export function buildPattern(level, seed, mode = 'auto') {
  const rand = mulberry32(seed);
  let types = Object.keys(level.w || {}).filter((k) => level.w[k] > 0);
  if (!types.length) types = ['dash']; // v1.3.27 : poids corrompus -> dash par défaut
  // v1.3.27 : jamais de boucle infinie, même avec un level bidouillé (lines = NaN/Infinity/énorme)
  const nLines = Math.max(1, Math.min(Math.floor(Number(level.lines)) || 1, 10000));
  const gapMin = Number.isFinite(level.gapMin) ? level.gapMin : 540;
  const gapMax = Number.isFinite(level.gapMax) && level.gapMax >= gapMin ? level.gapMax : gapMin + 180;
  const axle = () => (mode === 'auto' ? 'rear' : rand() < 0.5 ? 'front' : 'rear');
  const lines = [];
  let dist = Math.max(gapMax, 620);
  lines.push({ type: 'dash', dist, axle: axle() });
  for (let i = 1; i < nLines; i++) {
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
    const gap = gapMin + rand() * (gapMax - gapMin);
    dist += gap;
    lines.push({ type, dist, axle: axle() });
    if (rand() < (level.pDouble || 0)) {
      dist += 130;
      lines.push({ type: 'dash', dist, axle: axle() });
    }
  }
  return lines;
}

// v1.3.35 : étoiles par niveau — 0 si pas terminé, 1 si terminé, 2 si >= 60 % de PARFAIT, 3 si full parfait
export function starsFor(stats) {
  const s = stats || {};
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  if (!s.completed) return 0;
  if (isPerfectClear(s)) return 3;
  const judged = n(s.perfects) + n(s.goods) + n(s.passables);
  if (judged > 0 && n(s.perfects) / judged >= 0.6) return 2;
  return 1;
}

// v1.3.35 : paliers de la Survie ∞ (lignes résolues) — récompense en pièces à chaque palier,
// skin exclusive à 50 lignes
export const ENDLESS_MILESTONES = [10, 25, 50, 100, 150, 200, 300, 500];
export function endlessMilestones(prev, next) {
  const p = Number.isFinite(prev) ? prev : 0;
  const n = Number.isFinite(next) ? next : 0;
  return ENDLESS_MILESTONES.filter((m) => p < m && m <= n).map((m) => ({ m, coins: m * 5, skin: m === 50 }));
}

export function isPerfectClear(stats) {
  const s = stats || {};
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return n(s.perfects) > 0 && n(s.goods) === 0 && n(s.passables) === 0 && n(s.misses) === 0;
}

export function perfectClearBonus(level) {
  return 300 + level.id * 60;
}

export function coinsForResult(stats, level, completed) {
  // v1.3.27 : stats corrompues -> 0 (jamais NaN, sinon le portefeuille devenait NaN)
  const fin = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const s = stats || {};
  const id = fin(level && level.id);
  const perfectBonus = completed && isPerfectClear(s) ? perfectClearBonus({ id }) : 0;
  // gains volontairement sobres (anti-farm) : score/8 + 3×PARFAIT + complétion
  return Math.round(fin(s.score) / 8) + fin(s.perfects) * 3 + (completed ? 100 + id * 20 : 0) + perfectBonus;
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

export function firstClearBonus(level) {
  return 150 + level.id * 30;
}

export function axleDelta(wheelY, frontAxleY, axle) {
  return axle === 'front' ? wheelY - frontAxleY : 0;
}

// v1.3.28 : mapping zone de tap, pur et testable.
// horizontal = option "zones gauche/droite" (gauche = AV, droite = AR), sinon haut/bas.
export function zoneFromPoint(x, y, w, h, horizontal) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !(w > 0) || !(h > 0)) return 'rear';
  return horizontal ? (x < w / 2 ? 'front' : 'rear') : y < h / 2 ? 'front' : 'rear';
}

// v1.3.30 : comparaison de versions "x.y.z" (sonde anti-SW-obsolète, voir main.js)
export function parseVersion(v) {
  const m = String(v || '').match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
}
export function isNewerVersion(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i];
  }
  return false;
}

// v1.3.28 : touche clavier -> UNE SEULE action ('front' | 'rear' | 'swipe' | null).
// Avant, avec les zones horizontales ON, ArrowLeft faisait tap AV **et** swipe en même temps.
// En mode horizontal, le swipe passe sur ArrowDown / KeyS (le swipe tactile reste sur le geste).
export function keyToAction(code, horizontal) {
  if (horizontal) {
    if (code === 'ArrowLeft') return 'front';
    if (code === 'ArrowRight') return 'rear';
    if (code === 'ArrowDown' || code === 'KeyS') return 'swipe';
    if (code === 'Space' || code === 'Enter') return 'rear';
    return null;
  }
  if (code === 'ArrowUp') return 'front';
  if (code === 'Space' || code === 'ArrowDown' || code === 'Enter') return 'rear';
  if (code === 'ArrowLeft') return 'swipe';
  return null;
}

export function avgReaction(stats) {
  if (!stats.reactions.length) return null;
  return Math.round(stats.reactions.reduce((a, b) => a + b, 0) / stats.reactions.length);
}

// --- Défis & quêtes (rétention) ---

// v1.3.19 : formatage du chrono speedrun -> "m:ss.cc" (v1.3.27 : garde NaN/infini/négatif)
export function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function weekKey(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // lundi de la semaine
  return dayKey(x);
}

const CHALLENGE_KINDS = [
  { id: 'score', label: (t) => `Marquer ${t} points`, min: 300, step: 150 },
  { id: 'perfects', label: (t) => `${t} PARFAIT dans la partie`, min: 5, step: 3 },
  { id: 'combo', label: (t) => `Atteindre un combo x${t}`, min: 5, step: 2 },
  { id: 'overtakes', label: (t) => `${t} dépassement(s)`, min: 1, step: 1 },
  { id: 'complete', label: () => 'Terminer le niveau', min: 1, step: 1 },
];

// Défi du jour : identique pour tous les joueurs (dérivé de la date), avec son classement Firebase
export function dailyChallenge(d = new Date()) {
  const key = dayKey(d);
  const rand = mulberry32(hashString('dc:' + key));
  const kind = CHALLENGE_KINDS[Math.floor(rand() * CHALLENGE_KINDS.length)];
  const mode = kind.id === 'overtakes' ? 'pilote' : ['auto', 'permisA', 'pilote'][Math.floor(rand() * 3)];
  const level = LEVELS[Math.floor(rand() * LEVELS.length)];
  const target = kind.min + Math.floor(rand() * 3) * kind.step;
  const reward = 100 + level.id * 10 + target * (kind.id === 'score' ? 1 : 5);
  return { id: key, mode, levelId: level.id, kind: kind.id, target, label: kind.label(target), reward };
}

const QUEST_KINDS = [
  { id: 'runs', label: (t) => `Jouer ${t} parties`, min: 3, step: 2, reward: (t) => 50 + t * 10 },
  { id: 'perfects', label: (t) => `${t} PARFAIT cumulés`, min: 10, step: 10, reward: (t) => 80 + t * 5 },
  { id: 'overtakes', label: (t) => `${t} dépassements`, min: 3, step: 2, reward: (t) => 60 + t * 10 },
  { id: 'score', label: (t) => `${t} points cumulés`, min: 1000, step: 500, reward: (t) => Math.round(100 + t / 10) },
  { id: 'complete', label: (t) => `Terminer ${t} niveau(x)`, min: 1, step: 1, reward: (t) => 120 + t * 40 },
];

// 3 quêtes hebdo, identiques pour tous (dérivées de la semaine courante)
export function weeklyQuests(d = new Date()) {
  const wk = weekKey(d);
  const rand = mulberry32(hashString('wq:' + wk));
  const pool = [...QUEST_KINDS];
  const out = [];
  while (out.length < 3 && pool.length) {
    const k = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    const target = k.min + Math.floor(rand() * 3) * k.step;
    out.push({ id: `${wk}:${k.id}`, kind: k.id, target, label: k.label(target), reward: Math.round(k.reward(target)) });
  }
  return out;
}
