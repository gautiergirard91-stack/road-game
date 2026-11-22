import { FIREBASE_DB_URL, FIREBASE_DB_SECRET } from './config.js';
import { LEVELS, ENDLESS_LEVEL } from './data.js';

const LOCAL_KEY = 'roadtap_leaderboard_local_v1';
const TOP = 20;
const MODES = ['auto', 'permisA', 'pilote'];

// --- diagnostic (affiché dans l'UI pour expliquer pourquoi on ne voit que soi) ---
let lastLbError = null;       // ex: 'HTTP 401 sur scores/auto' (lecture) | null
let lastLbWriteError = null;  // ex: 'écriture HTTP 403 sur scores/auto' (envoi) | null — v1.3.28 : conservé même après une lecture
let lastLbCount = 0;          // nb d'entrées lues depuis Firebase à la dernière lecture
let lastLbSource = 'local';   // 'firebase' | 'local'
export function getLbStatus() {
  return { error: lastLbError, writeError: lastLbWriteError, count: lastLbCount, source: lastLbSource, online: isOnline() };
}
function setLbStatus(source, count, error = null) {
  lastLbSource = source;
  lastLbCount = count;
  lastLbError = error;
}

export function isOnline() {
  return Boolean(FIREBASE_DB_URL);
}

export async function ping() {
  if (!isOnline()) return false;
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const q = FIREBASE_DB_SECRET ? `auth=${FIREBASE_DB_SECRET}&shallow=true` : 'shallow=true';
    // la racine n'est volontairement PAS lisible publiquement (règles RTDB) :
    // on pingue un nœud public (scores, ".read": true) pour tester la connexion
    const res = await fetch(`${base}/scores/.json?${q}`);
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

function cleanEntry(e) {
  if (!e || typeof e !== 'object') return null;
  const score = typeof e.score === 'number' && Number.isFinite(e.score) ? e.score : 0;
  return { ...e, score };
}
function sortDesc(arr) {
  return arr
    .map(cleanEntry)
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP);
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

const LEVEL_NAMES = { ...Object.fromEntries(LEVELS.map((l) => [l.id, l.name])), [ENDLESS_LEVEL.id]: ENDLESS_LEVEL.name };

// filtre par niveau : levelId (nouveaux scores) ou nom de niveau (anciens scores)
function filterLevel(arr, levelFilter) {
  if (levelFilter === 'all' || levelFilter === null || levelFilter === undefined) return arr;
  const id = Number(levelFilter);
  return arr.filter((e) => e.levelId === id || e.level === LEVEL_NAMES[id]);
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
    if (!res.ok) {
      const err = `écriture HTTP ${res.status} sur scores/${mode} (règles RTDB ?) — score gardé en local`;
      lastLbWriteError = err; // v1.3.28 : conservé et affiché dans l'UI
      throw new Error(err);
    }
    lastLbWriteError = null; // v1.3.28 : une écriture qui passe efface l'erreur précédente
  } catch (e) {
    const msg = String((e && e.message) ? e.message : e);
    if (!lastLbWriteError) lastLbWriteError = msg;
    setLbStatus('local', 0, lastLbError && lastLbError !== msg ? lastLbError : null);
    return submitLocal(entry);
  }
  return getTop('all');
}

export async function getTop(mode = 'all', levelFilter = 'all') {
  if (!isOnline()) { setLbStatus('local', 0); return sortDesc(filterLevel(filterMode(localList(), mode), levelFilter)); }
  const modes = mode === 'all' ? MODES : [mode];
  const all = [];
  const errors = [];
  for (const m of modes) {
    try {
      const base = FIREBASE_DB_URL.replace(/\/$/, '');
      const auth = FIREBASE_DB_SECRET ? `?auth=${FIREBASE_DB_SECRET}` : ''; // v1.3.22 : nœud entier + tri côté client (orderBy sans .indexOn = 400)
      const res = await fetch(`${base}/scores/${m}.json${auth}`);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') all.push(...Object.values(data));
      } else {
        errors.push(`HTTP ${res.status} sur scores/${m}`);
      }
    } catch (e) {
      errors.push(`réseau indisponible (${(e && e.message) ? e.message : 'fetch failed'})`);
    }
  }
  if (all.length) {
    setLbStatus('firebase', all.length, errors.length ? errors.join(' ; ') : null);
    return sortDesc(filterLevel(all, levelFilter));
  }
  setLbStatus('local', 0, errors.length ? errors.join(' ; ') : 'aucun score en ligne (nœuds vides ou règles RTDB restrictives)');
  return sortDesc(filterLevel(filterMode(localList(), mode), levelFilter));
}

// --- Classement du défi du jour (nœud /challenges/<dayKey>) ---
export async function submitChallengeScore(dayId, entry) {
  if (!isOnline()) return false;
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const auth = FIREBASE_DB_SECRET ? `?auth=${FIREBASE_DB_SECRET}` : '';
    const res = await fetch(`${base}/challenges/${dayId}.json${auth}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getChallengeTop(dayId) {
  if (!isOnline()) return [];
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const auth = FIREBASE_DB_SECRET ? `?auth=${FIREBASE_DB_SECRET}` : ''; // v1.3.22 : idem
    const res = await fetch(`${base}/challenges/${dayId}.json${auth}`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') return sortDesc(Object.values(data));
    } else {
      setLbStatus('local', 0, `HTTP ${res.status} sur challenges/${dayId}`);
    }
  } catch (e) {
    setLbStatus('local', 0, `challenges: réseau indisponible (${(e && e.message) ? e.message : 'fetch failed'})`);
  }
  return [];
}


// --- v1.3.31 : Classement SPEEDRUN dédié (nœud /speedrun/<levelId>, tri CROISSANT sur timeMs) ---
// Le score speedrun est un temps : il ne va PAS dans /scores (tri décroissant) mais dans /speedrun.
const LOCAL_SR_KEY = 'roadtap_speedrun_local_v1';

function localSrList() {
  try {
    const raw = localStorage.getItem(LOCAL_SR_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function cleanTimeEntry(e) {
  if (!e || typeof e !== 'object') return null;
  if (typeof e.timeMs !== 'number' || !Number.isFinite(e.timeMs)) return null;
  return { ...e, timeMs: e.timeMs };
}

function sortAscTime(arr) {
  return arr
    .map(cleanTimeEntry)
    .filter(Boolean)
    .sort((a, b) => a.timeMs - b.timeMs)
    .slice(0, TOP);
}

export function submitSpeedrunLocal(entry) {
  const arr = localSrList();
  arr.push(entry);
  arr.sort((a, b) => (a.timeMs || 0) - (b.timeMs || 0));
  try {
    localStorage.setItem(LOCAL_SR_KEY, JSON.stringify(arr.slice(0, 100)));
  } catch {
    /* stockage indisponible */
  }
  return arr.slice(0, TOP);
}

export async function submitSpeedrun(levelId, entry) {
  const body = { pseudo: entry.pseudo, timeMs: entry.timeMs, level: entry.level, levelId, mode: 'pilote', date: entry.date };
  if (!isOnline()) return submitSpeedrunLocal(body);
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const auth = FIREBASE_DB_SECRET ? `?auth=${FIREBASE_DB_SECRET}` : '';
    const res = await fetch(`${base}/speedrun/${levelId}.json${auth}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      lastLbWriteError = `écriture HTTP ${res.status} sur speedrun/${levelId} (règles RTDB ?) — temps gardé en local`;
      throw new Error(lastLbWriteError);
    }
    lastLbWriteError = null;
  } catch (e) {
    if (!lastLbWriteError) lastLbWriteError = String((e && e.message) || e);
    return submitSpeedrunLocal(body);
  }
  return getSpeedrunTop('all');
}

export async function getSpeedrunTop(levelFilter = 'all') {
  const keep = (arr) => {
    if (levelFilter === 'all' || levelFilter === null || levelFilter === undefined) return arr;
    const id = Number(levelFilter);
    return arr.filter((e) => e.levelId === id || e.level === LEVEL_NAMES[id]);
  };
  if (!isOnline()) {
    setLbStatus('local', 0);
    return keep(sortAscTime(localSrList()));
  }
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const auth = FIREBASE_DB_SECRET ? `?auth=${FIREBASE_DB_SECRET}` : ''; // nœud entier + tri croissant côté client (idem v1.3.22)
    const res = await fetch(`${base}/speedrun.json${auth}`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        const all = [];
        for (const entries of Object.values(data)) {
          if (entries && typeof entries === 'object') all.push(...Object.values(entries));
        }
        if (all.length) {
          setLbStatus('firebase', all.length, null);
          return keep(sortAscTime(all));
        }
      }
      setLbStatus('local', 0, 'aucun temps speedrun en ligne (nœud /speedrun vide ou règles RTDB)');
      return keep(sortAscTime(localSrList()));
    }
    setLbStatus('local', 0, `HTTP ${res.status} sur speedrun`);
  } catch (e) {
    setLbStatus('local', 0, `speedrun: réseau indisponible (${(e && e.message) || 'fetch failed'})`);
  }
  return keep(sortAscTime(localSrList()));
}
