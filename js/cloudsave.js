import { FIREBASE_DB_URL, FIREBASE_DB_SECRET } from './config.js';
import { isOnline } from './leaderboard.js';

function url(path, idToken) {
  const base = FIREBASE_DB_URL.replace(/\/$/, '');
  // compte Google lié -> jeton Firebase ; sinon pseudo (écriture anonyme validée par les règles)
  const auth = idToken ? `?auth=${encodeURIComponent(idToken)}` : FIREBASE_DB_SECRET ? `?auth=${FIREBASE_DB_SECRET}` : '';
  return `${base}${path}.json${auth}`;
}

function key(account) {
  return encodeURIComponent(String(account).toLowerCase().trim());
}

export async function load(account, idToken) {
  if (!isOnline() || !account) return null;
  try {
    const res = await fetch(url(`/players/${key(account)}`, idToken));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function save(account, snapshot, idToken) {
  if (!isOnline() || !account) return false;
  try {
    const res = await fetch(url(`/players/${key(account)}`, idToken), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...snapshot, updatedAt: Date.now() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
