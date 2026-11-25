import { FIREBASE_DB_URL, FIREBASE_DB_SECRET } from './config.js';
import { isOnline } from './leaderboard.js';

function url(path, idToken) {
  const base = FIREBASE_DB_URL.replace(/\/$/, '');
  // compte Google lié -> jeton Firebase (?auth=) ; v1.3.37 : JAMAIS d'écriture anonyme
  const auth = idToken ? `?auth=${encodeURIComponent(idToken)}` : FIREBASE_DB_SECRET ? `?auth=${FIREBASE_DB_SECRET}` : '';
  return `${base}${path}.json${auth}`;
}

// v1.3.37 : NE PAS mettre la clé en minuscules ! La règle players est `auth.uid == $id` et les uid
// Firebase contiennent des majuscules : un $id lowercasé ne matche JAMAIS -> 403 systématique ->
// sauvegarde cloud jamais écrite (cause racine « progression pas liée entre tel et PC »).
function key(account) {
  return encodeURIComponent(String(account).trim());
}

export async function load(account, idToken) {
  if (!isOnline() || !account) return null;
  try {
    const res = await fetch(url(`/players/${key(account)}`, idToken), { cache: 'no-store' }); // v1.3.72 : sauvegarde cloud toujours fraîche
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// v1.3.89 : variante qui distingue « nœud vide » (ok, data=null) d'une ERREUR (401 App Check / réseau).
// pushCloud ne doit JAMAIS pousser après un pull en échec : le PUT écraserait tout players/<uid> (pseudo, amis…).
export async function loadRaw(account, idToken) {
  if (!isOnline() || !account) return { ok: false, data: null, error: 'offline' };
  try {
    const res = await fetch(url(`/players/${key(account)}`, idToken), { cache: 'no-store' });
    if (!res.ok) return { ok: false, data: null, error: 'HTTP ' + res.status };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, data: null, error: 'network' };
  }
}

export async function save(account, snapshot, idToken) {
  if (!isOnline() || !account) return false;
  try {
    const res = await fetch(url(`/players/${key(account)}`, idToken), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...snapshot, updatedAt: Date.now() }),
      keepalive: true, // v1.3.37 : le PUT survit à la fermeture de l'onglet (pagehide sur mobile)
    });
    return res.ok;
  } catch {
    return false;
  }
}
