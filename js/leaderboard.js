import { FIREBASE_DB_URL, FIREBASE_DB_SECRET } from './config.js';
import { LEVELS, ENDLESS_LEVEL, WEEKEND_LEVEL } from './data.js';

const LOCAL_KEY = 'roadtap_leaderboard_local_v1';
const TOP = 20;
const MODES = ['auto', 'permisA', 'pilote'];

// --- diagnostic (affiché dans l'UI pour expliquer pourquoi on ne voit que soi) ---
let lastLbError = null;       // ex: 'HTTP 401 sur scores/auto' (lecture) | null
let lastLbWriteError = null;
let lastOnlineWriteAt = 0; // v1.3.79 : rate-limit doux côté client (anti-flood #30d) — min 3 s entre 2 écritures en ligne
let MIN_WRITE_GAP_MS = 3000;
export function _setLastWriteAt(ms) { lastOnlineWriteAt = ms; } // tests
export function _setWriteGap(ms) { MIN_WRITE_GAP_MS = ms; } // tests : 0 = pas de rate-limit  // ex: 'écriture HTTP 403 sur scores/auto' (envoi) | null — v1.3.28 : conservé même après une lecture
let lastLbCount = 0;          // nb d'entrées lues depuis Firebase à la dernière lecture
let lastLbSource = 'local';   // 'firebase' | 'local'
// v1.3.58 : dernier ping détaillé { ok, status, reason: 'ok'|'http-XXX'|'network'|'unconfigured', ms, at, error? }
let lastPing = null;
export function getPingStatus() {
  return lastPing;
}
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

export async function ping(idToken) {
  // v1.3.58 : on conserve le détail du dernier ping pour expliquer la cause exacte
  // (réseau vs HTTP 401 vs HTTP 403) dans ⚙️ Paramètres > Serveur.
  // v1.3.59 : sur 401/403, sonde AVEC jeton auth pour distinguer les deux causes d'un 401 :
  //   - sonde OK   -> les règles exigent auth en lecture (".read": true retiré côté console)
  //   - sonde 401  -> App Check Enforce actif sans token valide (domaines autorisés ?)
  if (!isOnline()) {
    lastPing = { ok: false, status: 0, reason: 'unconfigured', ms: null, at: Date.now(), authProbe: null };
    return false;
  }
  const t0 = Date.now();
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const q = FIREBASE_DB_SECRET ? `auth=${FIREBASE_DB_SECRET}&shallow=true` : 'shallow=true';
    // la racine n'est volontairement PAS lisible publiquement (règles RTDB) :
    // on pingue un nœud public (scores, ".read": true) pour tester la connexion
    const res = await fetch(`${base}/scores/.json?${q}`, { cache: 'no-store' }); // v1.3.72 : jamais de cache HTTP
    const ms = Date.now() - t0;
    lastPing = res.ok
      ? { ok: true, status: res.status, reason: 'ok', ms, at: Date.now(), authProbe: null }
      : { ok: false, status: res.status, reason: 'http-' + res.status, ms, at: Date.now(), authProbe: null };
    if (!res.ok && (res.status === 401 || res.status === 403) && idToken) {
      try {
        const res2 = await fetch(`${base}/scores/.json?auth=${encodeURIComponent(idToken)}&shallow=true`, { cache: 'no-store' }); // v1.3.72
        lastPing.authProbe = { status: res2.status, ok: res2.ok, reason: res2.ok ? 'ok' : 'http-' + res2.status };
      } catch (e) {
        lastPing.authProbe = { status: 0, ok: false, reason: 'network', error: String((e && e.message) || e) };
      }
    }
    return res.ok;
  } catch (e) {
    lastPing = { ok: false, status: 0, reason: 'network', ms: Date.now() - t0, at: Date.now(), error: String((e && e.message) || e), authProbe: null };
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
  // v1.3.45 : une entrée marquée wideWindows (fenêtres élargies) n'est JAMAIS affichée
  if (e.wideWindows === true) return null;
  const score = typeof e.score === 'number' && Number.isFinite(e.score) ? e.score : 0;
  return { ...e, score };
}
// v1.3.67 : UNE SEULE entrée par joueur dans un classement (niveau/difficulté) — on garde SON
// meilleur score (ou son meilleur temps en speedrun / sa meilleure réaction moyenne).
// v1.3.68 : clé d'identité joueur partagée (dédoublonnage + colonnes temps)
export function playerKey(e) {
  if (!e) return '';
  if (e.uid) return 'u:' + String(e.uid);
  return e.pseudo ? 'p:' + String(e.pseudo).toLowerCase() : '';
}

// v1.3.68 : map joueur -> meilleur temps speedrun (ms) pour une difficulté + un filtre niveau,
// pour afficher la colonne « ⏱ temps » à côté de la colonne score dans chaque difficulté.
export function buildTimeMap(srArr, mode, levelFilter = 'all') {
  const map = new Map();
  for (const e of filterLevel(srArr || [], levelFilter)) {
    if (mode && mode !== 'reaction' && e.mode && e.mode !== mode) continue; // temps de CETTE difficulté
    const k = playerKey(e);
    if (!k || typeof e.timeMs !== 'number' || !Number.isFinite(e.timeMs)) continue;
    const prev = map.get(k);
    if (prev === undefined || e.timeMs < prev) map.set(k, e.timeMs);
  }
  return map;
}

// v1.3.74 : map joueur -> { timeMs, levelId, level } de SON meilleur temps sur le filtre courant
// (pour afficher « ⏱ … · niv. N » dans la colonne temps en vue « Tous niveaux »)
export function buildTimeLevelMap(srArr, mode, levelFilter = 'all') {
  const map = new Map();
  for (const e of filterLevel(srArr || [], levelFilter)) {
    if (mode && mode !== 'reaction' && e.mode && e.mode !== mode) continue;
    const k = playerKey(e);
    if (!k || typeof e.timeMs !== 'number' || !Number.isFinite(e.timeMs)) continue;
    const prev = map.get(k);
    if (prev === undefined || e.timeMs < prev.timeMs) {
      map.set(k, { timeMs: e.timeMs, levelId: e.levelId != null ? Number(e.levelId) : null, level: e.level || '' });
    }
  }
  return map;
}

// v1.3.78 : comparateur officiel AVEC départage des égalités (rapport #28) :
//   score      : score desc -> avgMs asc -> timeMs asc -> misses asc -> date asc (premier arrivé gagne)
//   time/speed : timeMs asc -> avgMs asc -> score desc -> misses asc -> date asc
//   reaction   : avgMs asc -> score desc -> date asc
export function compareEntries(a, b, kind = 'score') {
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const avgA = num(a && a.avgMs);
  const avgB = num(b && b.avgMs);
  const tA = num(a && a.timeMs);
  const tB = num(b && b.timeMs);
  const sA = num(a && a.score) ?? 0;
  const sB = num(b && b.score) ?? 0;
  const mA = num(a && a.misses) ?? Infinity;
  const mB = num(b && b.misses) ?? Infinity;
  const dA = num(a && a.date) ?? Infinity;
  const dB = num(b && b.date) ?? Infinity;
  const cmpOpt = (x, y) => { // null (champ absent) toujours APRÈS
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return x - y;
  };
  if (kind === 'time' || kind === 'speedrun') {
    let c = cmpOpt(tA, tB);
    if (c) return c;
    c = cmpOpt(avgA, avgB);
    if (c) return c;
    if (sA !== sB) return sB - sA;
    if (mA !== mB) return mA - mB;
    return dA - dB;
  }
  if (kind === 'reaction') {
    let c = cmpOpt(avgA, avgB);
    if (c) return c;
    if (sA !== sB) return sB - sA;
    return dA - dB;
  }
  if (sA !== sB) return sB - sA;
  let c = cmpOpt(avgA, avgB);
  if (c) return c;
  c = cmpOpt(tA, tB);
  if (c) return c;
  if (mA !== mB) return mA - mB;
  return dA - dB;
}

// v1.3.70 : tri des lignes — 'score' (défaut, desc) ou 'time' (joueurs avec un temps d'abord, temps asc) ; v1.3.78 : départage via compareEntries
export function sortLbRows(arr, sort = 'score', timeByPlayer = null) {
  const rows = [...(arr || [])];
  if (sort === 'time' && timeByPlayer) {
    return rows.sort((a, b) => {
      const ta = timeByPlayer.get(playerKey(a));
      const tb = timeByPlayer.get(playerKey(b));
      const ea = typeof ta === 'number' ? { ...a, timeMs: ta } : a;
      const eb = typeof tb === 'number' ? { ...b, timeMs: tb } : b;
      return compareEntries(ea, eb, 'time');
    });
  }
  return rows.sort((a, b) => compareEntries(a, b, sort === 'reaction' ? 'reaction' : sort === 'time' ? 'time' : 'score'));
}

export function dedupeByPlayer(arr, kind = 'score') {
  const best = new Map();
  for (const e of arr || []) {
    if (!e || e.pseudo == null || e.pseudo === '') continue;
    const key = playerKey(e); // v1.3.68
    const prev = best.get(key);
    if (!prev) { best.set(key, e); continue; }
    const better = kind === 'speedrun'
      ? (e.timeMs || Infinity) < (prev.timeMs || Infinity)
      : kind === 'reaction'
        ? ((e.avgMs ?? Infinity) < (prev.avgMs ?? Infinity))
        : ((e.score || 0) > (prev.score || 0));
    if (better) best.set(key, e);
  }
  return [...best.values()];
}

function sortDesc(arr) {
  return dedupeByPlayer(arr.map(cleanEntry).filter(Boolean), 'score') // v1.3.67 : 1 entrée/joueur (meilleur score)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP);
}

export function getTopLocal() {
  return sortDesc(localList());
}

// v1.3.66 : file d'envoi hors ligne — un score/temps/challenge fait hors ligne (ou sans compte)
// est stocké dans roadtap_lb_queue_v1 puis rejoué automatiquement dès que le joueur est en ligne
// ET connecté (retour réseau, reconnexion Google, ouverture du classement).
const QUEUE_KEY = 'roadtap_lb_queue_v1';
function readQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function enqueue(kind, payload) {
  try {
    const arr = readQueue();
    if (arr.some((q) => q.kind === kind && JSON.stringify(q.payload) === JSON.stringify(payload))) return; // pas de doublon
    arr.push({ kind, payload, at: Date.now() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(arr.slice(-200))); // plafond 200
  } catch { /* stockage indisponible */ }
}
export function queueSize() {
  return readQueue().length;
}
// rejoue la file vers le serveur. Retourne le nombre d'entrées envoyées.
export async function flushQueue(idToken, uid, pseudo = '') { // v1.3.85 : pseudo = pseudo du compte pour les entrées anonymes
  if (!isOnline() || !hasAuth(idToken)) return 0;
  let arr = readQueue();
  if (!arr.length) return 0;
  let sent = 0;
  const kept = [];
  let idx = 0;
  while (idx < arr.length) {
    const item = arr[idx];
    let drop = false;
    let stop = false;
    try {
      const pl = item.payload;
      if (uid && pl && typeof pl === 'object') {
        if (!pl.uid) pl.uid = uid; // rattache au compte connecté
        const tgt = pl.entry && typeof pl.entry === 'object' ? pl.entry : pl; // speedrun/challenge: payload dans .entry
        if (pseudo && tgt && !tgt.pseudo) tgt.pseudo = pseudo; // v1.3.85 : entrées faites sans pseudo -> pseudo du compte
        if (!tgt.uid) tgt.uid = uid;
      }
      lastLbWriteError = null;
      if (item.kind === 'speedrun') await submitSpeedrun(pl.levelId, pl.entry, idToken);
      else if (item.kind === 'challenge') await submitChallengeScore(pl.dayId, pl.entry, idToken);
      else await submitScore(pl, idToken);
      if (lastLbWriteError) {
        // v1.3.78 : refus DÉFINITIF des règles (HTTP 401/403, ex. entrée pré-MAJ sans 'lines') -> entrée abandonnée pour ne pas bloquer la file
        if (/HTTP 40[13]/.test(lastLbWriteError)) drop = true;
        else stop = true; // refus temporaire -> on garde, réessai à la prochaine connexion
      }
    } catch {
      stop = true; // réseau HS -> on arrête, on réessaiera plus tard
    }
    if (drop) { sent++; idx++; continue; }
    if (stop) { kept.push(...arr.slice(idx)); break; }
    sent++;
    idx++;
  }
  if (sent > 0) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(kept)); } catch { /* ignore */ }
  }
  return sent;
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

const LEVEL_NAMES = { ...Object.fromEntries(LEVELS.map((l) => [l.id, l.name])), [ENDLESS_LEVEL.id]: ENDLESS_LEVEL.name, [WEEKEND_LEVEL.id]: WEEKEND_LEVEL.name };

// filtre par niveau : levelId (nouveaux scores) ou nom de niveau (anciens scores)
// v1.3.36 : exporté pour le classement « amis » (filtrage client après getAll)
export function filterLevel(arr, levelFilter) {
  if (levelFilter === 'all' || levelFilter === null || levelFilter === undefined) return arr;
  const id = Number(levelFilter);
  return arr.filter((e) => Number(e.levelId) === id || e.level === LEVEL_NAMES[id]); // v1.3.50 : levelId string ou number accepté
}


// v1.3.32 : jeton Firebase (Google Sign-In) passé en ?auth= -> les règles RTDB peuvent
// vérifier que le champ 'uid' de l'entrée == auth.uid (anti-usurpation quand connecté)
function authQuery(idToken) {
  const t = idToken || FIREBASE_DB_SECRET;
  return t ? `?auth=${encodeURIComponent(t)}` : '';
}

// v1.3.37 : l'accès anonyme au classement est RETIRÉ — un envoi nécessite un jeton Firebase
// (compte Google connecté). Sans jeton, on garde le score en local et on l'affiche dans le diagnostic.
function hasAuth(idToken) {
  return Boolean(idToken || FIREBASE_DB_SECRET);
}
const ANON_WRITE_MSG = '⚠ v1.3.37 : envoi réservé aux comptes Google connectés (règles RTDB auth != null) — score gardé en local, connecte-toi pour apparaître dans le classement';

export async function submitScore(entry, idToken) {
  const mode = modeOf(entry);
  if (!isOnline()) { enqueue('score', entry); return submitLocal(entry); } // v1.3.66 : file hors ligne
  if (!hasAuth(idToken)) {
    lastLbWriteError = ANON_WRITE_MSG;
    enqueue('score', entry); // v1.3.66 : rejoué à la connexion
    return submitLocal(entry);
  }
  if (Date.now() - lastOnlineWriteAt < MIN_WRITE_GAP_MS) { enqueue('score', entry); return submitLocal(entry); } // v1.3.79 : anti-flood — trop tôt, on met en file
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const auth = authQuery(idToken);
    const res = await fetch(`${base}/scores/${mode}.json${auth}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...entry, uid: entry.uid || '' }),
    });
    if (!res.ok) {
      const err = `écriture HTTP ${res.status} sur scores/${mode} (règles RTDB ?) — score gardé en local`;
      lastLbWriteError = err; // v1.3.28 : conservé et affiché dans l'UI
      throw new Error(err);
    }
    lastLbWriteError = null; // v1.3.28 : une écriture qui passe efface l'erreur précédente
    lastOnlineWriteAt = Date.now(); // v1.3.79 : rate-limit — on note l'heure de la dernière écriture réussie
  } catch (e) {
    const msg = String((e && e.message) ? e.message : e);
    if (!lastLbWriteError) lastLbWriteError = msg;
    if (!/HTTP \d+/.test(msg)) enqueue('score', entry); // v1.3.66 : erreur réseau -> file (un refus HTTP = règles, on ne boucle pas)
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
      const res = await fetch(`${base}/scores/${m}.json${auth}`, { cache: 'no-store' }); // v1.3.72 : lecture toujours fraîche
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

// --- v1.3.36 : classement « amis » — TOUTES les entrées (sans limite TOP), triées, pour
// filtrage client par pseudo (core.filterFriendsByPseudo). Utilise le même nœud /scores/<mode>.
// v1.3.81 : #25 — saison hebdomadaire (reset lundi via weekKey) : nœud /seasons/<week>/<mode>, mêmes règles que scores
export async function submitSeason(week, entry, idToken) {
  if (!isOnline() || !hasAuth(idToken)) return;
  if (Date.now() - lastOnlineWriteAt < MIN_WRITE_GAP_MS) return; // rate-limit partagé avec submitScore
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const res = await fetch(`${base}/seasons/${week}/${modeOf(entry)}.json${authQuery(idToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...entry, uid: entry.uid || '' }),
    });
    if (res.ok) lastOnlineWriteAt = Date.now();
  } catch { /* saison = best effort, jamais bloquant */ }
}
export async function getSeasonAll(week, mode = 'all') {
  if (!isOnline()) return [];
  const base = FIREBASE_DB_URL.replace(/\/$/, '');
  const auth = FIREBASE_DB_SECRET ? `?auth=${FIREBASE_DB_SECRET}` : '';
  const modes = mode === 'all' ? MODES : [mode];
  const all = [];
  for (const m of modes) {
    try {
      const res = await fetch(`${base}/seasons/${week}/${m}.json${auth}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') all.push(...Object.values(data).map(cleanEntry).filter(Boolean));
      }
    } catch { /* ignore */ }
  }
  return all.sort((a, b) => (b.score || 0) - (a.score || 0));
}

// v1.3.82 : #24 — duels asynchrones entre amis (nœud /challenges/duels, mode 'duel', create-only comme le reste)
export async function submitDuel(fromPseudo, uid, toPseudo, levelId, score, idToken) {
  if (!isOnline() || !hasAuth(idToken)) return false;
  if (Date.now() - lastOnlineWriteAt < MIN_WRITE_GAP_MS) return false; // rate-limit partagé
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const res = await fetch(`${base}/challenges/duels.json${authQuery(idToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pseudo: fromPseudo, uid: uid || '', score, levelId, mode: 'duel', target: toPseudo, date: Date.now() }),
    });
    if (res.ok) lastOnlineWriteAt = Date.now();
    return res.ok;
  } catch { return false; }
}
export async function getDuels(pseudo) {
  if (!isOnline()) return [];
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const auth = FIREBASE_DB_SECRET ? `?auth=${FIREBASE_DB_SECRET}` : '';
    const res = await fetch(`${base}/challenges/duels.json${auth}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    const all = data && typeof data === 'object' ? Object.values(data) : [];
    return all.filter((d) => d && d.mode === 'duel' && String(d.target || '').toLowerCase() === String(pseudo || '').toLowerCase());
  } catch { return []; }
}

// v1.3.86 : système de demandes d'amis (nœud /friendRequests/<toUid>/<fromUid>, statut pending/accepted/refused)
export async function resolveUidByPseudo(pseudo) { // pseudo -> uid via les entrées PUBLIQUES scores/speedrun (le pseudo doit exister)
  const p = String(pseudo || '').trim().toLowerCase();
  if (!p) return null;
  try {
    const all = [...(await getAll('all')), ...(await getSpeedrunAll())];
    const hit = all.find((e) => e && String(e.pseudo || '').toLowerCase() === p && e.uid);
    return hit ? { uid: hit.uid, pseudo: hit.pseudo } : null;
  } catch { return null; }
}
export async function sendFriendRequest(fromUid, fromPseudo, toUid, toPseudo, idToken) {
  if (!isOnline() || !hasAuth(idToken) || !fromUid || !toUid) return false;
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const res = await fetch(`${base}/friendRequests/${encodeURIComponent(toUid)}/${encodeURIComponent(fromUid)}.json${authQuery(idToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromPseudo: String(fromPseudo || '').slice(0, 16), fromUid, status: 'pending', date: Date.now() }),
    });
    return res.ok;
  } catch { return false; }
}
export async function getIncomingFriendRequests(uid, idToken) { // demandes reçues en attente
  if (!isOnline() || !hasAuth(idToken) || !uid) return [];
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const res = await fetch(`${base}/friendRequests/${encodeURIComponent(uid)}.json${authQuery(idToken)}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data && typeof data === 'object' ? Object.values(data).filter((r) => r && r.status === 'pending') : [];
  } catch { return []; }
}
export async function respondFriendRequest(myUid, fromUid, status, idToken) { // accepter / refuser (PATCH statut)
  if (!isOnline() || !hasAuth(idToken) || !myUid || !fromUid) return false;
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const res = await fetch(`${base}/friendRequests/${encodeURIComponent(myUid)}/${encodeURIComponent(fromUid)}.json${authQuery(idToken)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return res.ok;
  } catch { return false; }
}
export async function getOutgoingRequestStatus(toUid, fromUid, idToken) { // l'émetteur relit le statut de sa demande
  if (!isOnline() || !hasAuth(idToken) || !toUid || !fromUid) return null;
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const res = await fetch(`${base}/friendRequests/${encodeURIComponent(toUid)}/${encodeURIComponent(fromUid)}.json${authQuery(idToken)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.status ? data.status : null;
  } catch { return null; }
}
export async function deleteFriendRequest(myUid, fromUid, idToken) { // le destinataire supprime après réponse
  if (!isOnline() || !hasAuth(idToken) || !myUid || !fromUid) return false;
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const res = await fetch(`${base}/friendRequests/${encodeURIComponent(myUid)}/${encodeURIComponent(fromUid)}.json${authQuery(idToken)}`, { method: 'DELETE' });
    return res.ok;
  } catch { return false; }
}

export async function getAll(mode = 'all') {
  const fetchMode = async (m) => {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const auth = FIREBASE_DB_SECRET ? `?auth=${FIREBASE_DB_SECRET}` : '';
    const res = await fetch(`${base}/scores/${m}.json${auth}`, { cache: 'no-store' }); // v1.3.72 : lecture toujours fraîche
    if (!res.ok) throw new Error(`HTTP ${res.status} sur scores/${m}`);
    const data = await res.json();
    return data && typeof data === 'object' ? Object.values(data) : [];
  };
  if (!isOnline()) {
    setLbStatus('local', 0);
    return filterMode(localList(), mode).map(cleanEntry).filter(Boolean).sort((a, b) => b.score - a.score);
  }
  const modes = mode === 'all' ? MODES : [mode];
  const all = [];
  const errors = [];
  for (const m of modes) {
    try {
      all.push(...(await fetchMode(m)));
    } catch (e) {
      errors.push(String((e && e.message) || e));
    }
  }
  if (all.length) {
    setLbStatus('firebase', all.length, errors.length ? errors.join(' ; ') : null);
    return all.map(cleanEntry).filter(Boolean).sort((a, b) => b.score - a.score);
  }
  setLbStatus('local', 0, errors.length ? errors.join(' ; ') : 'aucun score en ligne');
  return filterMode(localList(), mode).map(cleanEntry).filter(Boolean).sort((a, b) => b.score - a.score);
}

// --- Classement du défi du jour (nœud /challenges/<dayKey>) ---
export async function submitChallengeScore(dayId, entry, idToken) {
  if (!isOnline()) { enqueue('challenge', { dayId, entry }); return false; } // v1.3.66
  if (!hasAuth(idToken)) {
    lastLbWriteError = ANON_WRITE_MSG;
    enqueue('challenge', { dayId, entry }); // v1.3.66
    return false;
  }
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const auth = authQuery(idToken);
    const res = await fetch(`${base}/challenges/${dayId}.json${auth}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...entry, uid: entry.uid || '' }),
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
    const res = await fetch(`${base}/challenges/${dayId}.json${auth}`, { cache: 'no-store' }); // v1.3.72
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
  if (e.wideWindows === true) return null; // v1.3.45 : idem pour le classement speedrun
  if (typeof e.timeMs !== 'number' || !Number.isFinite(e.timeMs)) return null;
  return { ...e, timeMs: e.timeMs };
}

function sortAscTime(arr) {
  return sortAscTimeUnbounded(arr).slice(0, TOP);
}

// v1.3.36 : tri croissant SANS slice — utilisé par getSpeedrunAll (classement amis)
function sortAscTimeUnbounded(arr) {
  // v1.3.74 : PAS de dédoublonnage global ici — sinon un seul temps par joueur survivrait,
  // tous niveaux confondus, et les autres niveaux disparaîtraient (colonne ⏱ / rang).
  // Le dedupe 1 entrée/joueur se fait APRÈS le filtre par niveau (getSpeedrunTop / buildTimeMap).
  return (arr || []).map(cleanTimeEntry).filter(Boolean).sort((a, b) => a.timeMs - b.timeMs);
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

export async function submitSpeedrun(levelId, entry, idToken) {
  // v1.3.68 : speedrun dispo dans toutes les difficultés -> fallback 'auto' (main.js transmet de toute façon le mode réellement joué)
  const body = { pseudo: entry.pseudo, uid: entry.uid || '', timeMs: entry.timeMs, level: entry.level, levelId, mode: entry.mode || 'auto', date: entry.date };
  // v1.3.78 : champs de départage/anti-triche transmis si présents (lines, avgMs, misses, score, biasMs) + hash du replay (v1.3.79)
  for (const k of ['lines', 'avgMs', 'misses', 'score', 'biasMs', 'hash']) if (entry[k] != null) body[k] = entry[k];
  if (!isOnline()) { enqueue('speedrun', { levelId, entry: body }); return submitSpeedrunLocal(body); } // v1.3.66
  if (!hasAuth(idToken)) {
    lastLbWriteError = ANON_WRITE_MSG;
    enqueue('speedrun', { levelId, entry: body }); // v1.3.66
    return submitSpeedrunLocal(body);
  }
  if (Date.now() - lastOnlineWriteAt < MIN_WRITE_GAP_MS) { enqueue('speedrun', { levelId, entry: body }); return submitSpeedrunLocal(body); } // v1.3.79 : anti-flood
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const auth = authQuery(idToken);
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
    if (!/HTTP \d+/.test(String(lastLbWriteError))) enqueue('speedrun', { levelId, entry: body }); // v1.3.66 : réseau -> file
    return submitSpeedrunLocal(body);
  }
  return getSpeedrunTop('all');
}

// v1.3.36 : idem pour le classement speedrun — toutes les entrées, tri croissant, sans limite
export async function getSpeedrunAll() {
  const readAll = async () => {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const auth = FIREBASE_DB_SECRET ? `?auth=${FIREBASE_DB_SECRET}` : '';
    const res = await fetch(`${base}/speedrun.json${auth}`, { cache: 'no-store' }); // v1.3.72 : lecture toujours fraîche
    if (!res.ok) throw new Error(`HTTP ${res.status} sur speedrun`);
    const data = await res.json();
    const all = [];
    if (data && typeof data === 'object') {
      for (const entries of Object.values(data)) {
        if (entries && typeof entries === 'object') all.push(...Object.values(entries));
      }
    }
    return all;
  };
  if (!isOnline()) {
    setLbStatus('local', 0);
    return sortAscTimeUnbounded(localSrList());
  }
  try {
    const all = await readAll();
    if (all.length) {
      setLbStatus('firebase', all.length, null);
      return sortAscTimeUnbounded(all);
    }
    setLbStatus('local', 0, 'aucun temps speedrun en ligne');
  } catch (e) {
    setLbStatus('local', 0, `speedrun: ${(e && e.message) || e}`);
  }
  return sortAscTimeUnbounded(localSrList());
}

export async function getSpeedrunTop(levelFilter = 'all') {
  const keep = (arr) => {
    if (levelFilter === 'all' || levelFilter === null || levelFilter === undefined) return arr;
    const id = Number(levelFilter);
    return arr.filter((e) => Number(e.levelId) === id || e.level === LEVEL_NAMES[id]); // v1.3.50 : levelId string ou number accepté
  };
  // v1.3.74 : filtre par niveau PUIS dedupe 1 entrée/joueur (meilleur temps) DANS ce niveau
  const top = (arr) => dedupeByPlayer(keep(arr).map(cleanTimeEntry).filter(Boolean), 'speedrun').sort((a, b) => a.timeMs - b.timeMs).slice(0, TOP);
  if (!isOnline()) {
    setLbStatus('local', 0);
    return top(localSrList());
  }
  try {
    const base = FIREBASE_DB_URL.replace(/\/$/, '');
    const auth = FIREBASE_DB_SECRET ? `?auth=${FIREBASE_DB_SECRET}` : ''; // nœud entier + tri croissant côté client (idem v1.3.22)
    const res = await fetch(`${base}/speedrun.json${auth}`, { cache: 'no-store' }); // v1.3.72 : lecture toujours fraîche
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        const all = [];
        for (const entries of Object.values(data)) {
          if (entries && typeof entries === 'object') all.push(...Object.values(entries));
        }
        if (all.length) {
          setLbStatus('firebase', all.length, null);
          return top(all);
        }
      }
      setLbStatus('local', 0, 'aucun temps speedrun en ligne (nœud /speedrun vide ou règles RTDB)');
      return top(localSrList());
    }
    setLbStatus('local', 0, `HTTP ${res.status} sur speedrun`);
  } catch (e) {
    setLbStatus('local', 0, `speedrun: réseau indisponible (${(e && e.message) || 'fetch failed'})`);
  }
  return top(localSrList());
}
