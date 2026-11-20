import { FIREBASE_DB_URL, FIREBASE_DB_SECRET } from './config.js';

const LOCAL_KEY = 'roadtap_leaderboard_local_v1';
const TOP = 20;
const MODES = ['auto', 'permisA', 'pilote'];

export function isOnline() {
  return Boolean(FIREBASE_DB_URL);
}

export async function ping() {
  if (!isOnline()) return false;
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const q = FIREBASE_DB_SECRET ? `auth=${FIREBASE_DB_SECRET}&shallow=true` : 'shallow=true';
    const res = await fetch(`${base}/.json?${q}`);
    return res.ok;
  } catch {
    return false;
  }
}

function localList() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function sortDesc(arr) {
  return [...arr].sort((a, b) => b.score - a.score).slice(0, TOP);
}

export function getTopLocal() {
  return sortDesc(localList());
}

export function submitLocal(entry) {
  const arr = localList();
  arr.push(entry);
  arr.sort((a, b) => b.score - a.score);
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(arr.slice(0, 100)));
  } catch {
    /* stockage indisponible */
  }
  return arr.slice(0, TOP);
}

function modeOf(e) {
  return e.mode || 'auto';
}

function filterMode(arr, mode) {
  return mode === 'all' ? arr : arr.filter((e) => modeOf(e) === mode);
}

export async function submitScore(entry) {
  const mode = modeOf(entry);
  if (!isOnline()) return submitLocal(entry);
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const auth = FIREBASE_DB_SECRET ? `?auth=${FIREBASE_DB_SECRET}` : '';
    const res = await fetch(`${base}/scores/${mode}.json${auth}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error('firebase submit failed');
  } catch {
    return submitLocal(entry);
  }
  return getTop('all');
}

export async function getTop(mode = 'all') {
  if (!isOnline()) return sortDesc(filterMode(localList(), mode));
  const modes = mode === 'all' ? MODES : [mode];
  const all = [];
  for (const m of modes) {
    try {
      const base = FIREBASE_DB_URL.replace(/\/$/, '');
      const params = `orderBy="score"&limitToLast=100${FIREBASE_DB_SECRET ? `&auth=${FIREBASE_DB_SECRET}` : ''}`;
      const res = await fetch(`${base}/scores/${m}.json?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') all.push(...Object.values(data));
      }
    } catch {
      /* réseau indisponible */
    }
  }
  if (all.length) return sortDesc(all);
  return sortDesc(filterMode(localList(), mode));
}
