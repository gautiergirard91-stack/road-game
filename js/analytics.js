import { FIREBASE_DB_URL, FIREBASE_DB_SECRET } from './config.js';
import { isOnline } from './leaderboard.js';

export function logEvent(name, data = {}) {
  if (!isOnline()) return;
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const auth = FIREBASE_DB_SECRET ? `?auth=${FIREBASE_DB_SECRET}` : '';
    fetch(`${base}/analytics/${name}.json${auth}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, at: Date.now() }),
    }).catch(() => {});
  } catch {
    /* analytics best-effort */
  }
}
