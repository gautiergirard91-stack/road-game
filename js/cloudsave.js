import { FIREBASE_DB_URL, FIREBASE_DB_SECRET } from './config.js';
import { isOnline } from './leaderboard.js';

function url(path) {
  const base = FIREBASE_DB_URL.replace(/\/$/, '');
  const auth = FIREBASE_DB_SECRET ? `?auth=${FIREBASE_DB_SECRET}` : '';
  return `${base}${path}.json${auth}`;
}

function key(pseudo) {
  return encodeURIComponent(pseudo.toLowerCase().trim());
}

export async function load(pseudo) {
  if (!isOnline() || !pseudo) return null;
  try {
    const res = await fetch(url(`/players/${key(pseudo)}`));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function save(pseudo, snapshot) {
  if (!isOnline() || !pseudo) return false;
  try {
    const res = await fetch(url(`/players/${key(pseudo)}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...snapshot, updatedAt: Date.now() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
