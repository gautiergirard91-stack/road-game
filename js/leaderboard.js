import { FIREBASE_DB_URL, FIREBASE_DB_SECRET } from './config.js';

const LOCAL_KEY = 'roadtap_leaderboard_local_v1';
const TOP = 20;

export function isOnline() {
  return Boolean(FIREBASE_DB_URL);
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

export async function submitScore(entry) {
  if (!isOnline()) return submitLocal(entry);
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const auth = FIREBASE_DB_SECRET ? `?auth=${FIREBASE_DB_SECRET}` : '';
    const res = await fetch(`${base}/scores.json${auth}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error('firebase submit failed');
  } catch {
    return submitLocal(entry);
  }
  return getTop();
}

export async function getTop() {
  if (!isOnline()) return getTopLocal();
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const params = `orderBy="score"&limitToLast=${TOP}${FIREBASE_DB_SECRET ? `&auth=${FIREBASE_DB_SECRET}` : ''}`;
    const res = await fetch(`${base}/scores.json?${params}`);
    if (!res.ok) throw new Error('firebase read failed');
    const data = await res.json();
    const arr = data && typeof data === 'object' ? Object.values(data) : [];
    return sortDesc(arr);
  } catch {
    return getTopLocal();
  }
}
