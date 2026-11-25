import { dayKey, weekKey, weeklyQuests, DEFAULT_KEYS, sanitizeKeys, bindKey } from './core.js';

const KEY = 'roadtap_save_v1';

const defaults = () => ({
  wallets: { auto: 0, permisA: 0, pilote: 0 },
  trophies: {},
  stars: {}, // v1.3.35 : étoiles par niveau (1..3), clé = id du niveau
  endlessBest: 0, // v1.3.35 : record de lignes résolues en Survie ∞
  unlockedLevels: [1],
  cleared: {}, // niveaux TERMINÉS en entier (clé = id du niveau) — requis pour acheter le suivant
  skins: ['default'],
  skin: 'default',
  effects: [],
  selectedEffects: [],
  best: {},
  bestTime: {}, // v1.3.19 : meilleurs temps (ms) du mode speedrun, par niveau
  replays: {}, // v1.3.79 : replays locaux du meilleur run par "mode:levelId" — {seed, mode, lines, score, timeMs, hash, taps}
  medals: {}, // v1.3.81 #22 : médailles par "mode:levelId" — 1=🥇 2=🥈 3=🥉 (déduites du rang au classement)
  training: false, // v1.3.82 #1 : mode entraînement (vies infinies, vitesse réglable) — hors classement
  trainSpeed: 1, // v1.3.82 #1 : 0.5 | 0.75 | 1
  vibrate: true, // v1.3.82 #7 : vibration on/off
  leftHanded: false, // v1.3.82 #8 : mode gaucher (zones + swipes inversés)
  windowLevel: 'standard', // v1.3.82 #11 : 'standard' | 'large' | 'xlarge' — hors classement si != standard
  latencyOffsetMs: 0, // v1.3.82 #5 : calibration latence (locale, jamais envoyée) — hors classement si != 0
  speedrun: false,
  verticalZones: false, // v1.3.76 : zones tactiles HAUT/BAS (défaut false = gauche/droite : gauche=AV ⬅, droite=AR ➡)
  sound: true,
  keys: { ...DEFAULT_KEYS }, // v1.3.47 : touches personnalisables (menu Paramètres)
  difficulty: 'auto',
  pseudo: '',
  leaderboardOptIn: false,
  music: true,
  wideWindows: false,
  colorblind: false,
  themeOverride: '',
  tutorialDone: false,
  achievements: [],
  totals: { runs: 0, perfects: 0, overtakes: 0 },
  themes: [],
  packs: [],
  soundPacks: ['default'],
  soundPack: 'default',
  lastLogin: '',
  streak: 0,
  streakRewardDay: '',
  quests: { weekKey: '', progress: {}, done: {} },
  challengeDone: {},
  uid: '',
  googleEmail: '',
  googleRefresh: '',
  friends: [], // v1.3.36 : pseudos des amis pour le classement « amis » (voir core.filterFriendsByPseudo)
  deletedFriends: [], // v1.3.75 : tombstones — pseudos d'amis SUPPRIMÉS (ne doivent pas revenir via le cloud)
  friendRequestsOut: {}, // v1.3.86 : demandes d'amis envoyées — { toUid: { pseudo, date } } (statut relu côté serveur)
  bigTargets: false, // v1.3.80 : #6 gros doigts — zones 60/40 + seuil de swipe 25 px
  reduceAnims: false, // v1.3.80 : #15 animations réduites (photosensibilité) — pas de shake/particules/flash
  highContrast: false, // v1.3.80 : #16 thème contraste élevé (fond noir, lignes blanches)
  textSize: 'medium', // v1.3.80 : #17 'small' | 'medium' | 'large'
  hitMarker: false, // v1.3.80 : #27 flash de la ligne au moment 0 ms — HORS classement (aids)
});

let save;

// v1.3.27 : sanitizers — une sauvegarde corrompue (JSON cassé, mauvais types, vieille version)
// ne doit JAMAIS faire planter le jeu
// v1.3.44 : les records par niveau (score / temps speedrun) sont ISOLÉS PAR DIFFICULTÉ :
// clé "mode:levelId" (ex. "pilote:3"). Les anciennes clés (levelId seul) sont migrées dans sanitize.
const MODES = ['auto', 'permisA', 'pilote'];
export const bestKey = (mode, levelId) => `${mode}:${levelId}`;

const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v, d = '') => (typeof v === 'string' ? v : d);
const bool = (v, d = false) => (typeof v === 'boolean' ? v : d);
const arrStr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
// v1.3.86 : { toUid: { pseudo, date } }
function strObjMap(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out = {};
  for (const k of Object.keys(v).slice(0, 200)) {
    const o = v[k];
    if (o && typeof o === 'object' && typeof o.pseudo === 'string' && o.pseudo) out[k] = { pseudo: str(o.pseudo).slice(0, 16), date: num(o.date, 0) };
  }
  return out;
}
// v1.3.79 : sanitizer des replays — objets valides uniquement, taps plafonnés
function replayMap(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out = {};
  for (const k of Object.keys(v).slice(0, 200)) {
    const r = v[k];
    if (r && typeof r === 'object' && Array.isArray(r.taps) && r.taps.length <= 20000 && r.seed !== undefined) {
      out[k] = {
        seed: r.seed,
        mode: str(r.mode, 'auto'),
        lines: num(r.lines, 0),
        score: num(r.score, 0),
        timeMs: num(r.timeMs, 0),
        hash: str(r.hash, ''),
        taps: r.taps.slice(0, 10000).filter((t) => t && typeof t === 'object' && typeof t.t === 'number'),
      };
    }
  }
  return out;
}
const arrNum = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'number' && Number.isFinite(x)) : []);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const numMap = (v) => {
  const out = {};
  for (const [k, val] of Object.entries(obj(v))) if (typeof val === 'number' && Number.isFinite(val)) out[k] = val;
  return out;
};
const boolMap = (v) => {
  const out = {};
  for (const [k, val] of Object.entries(obj(v))) if (typeof val === 'boolean') out[k] = val;
  return out;
};

function sanitize(s) {
  s.wallets = { auto: num(s.wallets && s.wallets.auto), permisA: num(s.wallets && s.wallets.permisA), pilote: num(s.wallets && s.wallets.pilote) };
  s.trophies = boolMap(s.trophies);
  s.stars = numMap(s.stars);
  s.endlessBest = num(s.endlessBest);
  s.cleared = boolMap(s.cleared);
  s.best = numMap(s.best);
  s.bestTime = numMap(s.bestTime);
  s.replays = replayMap(s.replays); // v1.3.79
  s.friendRequestsOut = strObjMap(s.friendRequestsOut); // v1.3.86
  s.medals = numMap(s.medals); // v1.3.81 #22
  s.training = bool(s.training); // v1.3.82
  s.trainSpeed = [0.5, 0.75, 1].includes(Number(s.trainSpeed)) ? Number(s.trainSpeed) : 1;
  s.vibrate = s.vibrate === undefined ? true : bool(s.vibrate);
  s.leftHanded = bool(s.leftHanded);
  s.windowLevel = ['standard', 'large', 'xlarge'].includes(s.windowLevel) ? s.windowLevel : 'standard';
  s.latencyOffsetMs = Math.max(-100, Math.min(100, num(s.latencyOffsetMs, 0)));
  s.bigTargets = bool(s.bigTargets); // v1.3.80
  s.reduceAnims = bool(s.reduceAnims);
  s.highContrast = bool(s.highContrast);
  s.textSize = ['small', 'medium', 'large'].includes(s.textSize) ? s.textSize : 'medium';
  s.hitMarker = bool(s.hitMarker);
  // v1.3.44 : migration — anciennes clés "levelId" (partagées entre difficultés) copiées dans chaque mode
  for (const field of ['best', 'bestTime']) {
    const m = s[field];
    for (const k of Object.keys(m)) {
      if (k.includes(':')) continue;
      for (const mode of MODES) {
        const nk = bestKey(mode, k);
        if (field === 'best') m[nk] = Math.max(m[nk] || 0, m[k]);
        else m[nk] = m[nk] === undefined ? m[k] : Math.min(m[nk], m[k]);
      }
      delete m[k];
    }
  }
  s.unlockedLevels = arrNum(s.unlockedLevels);
  if (!s.unlockedLevels.includes(1)) s.unlockedLevels.push(1);
  s.skins = arrStr(s.skins);
  if (!s.skins.includes('default')) s.skins.push('default');
  s.skin = str(s.skin, 'default');
  s.effects = arrStr(s.effects);
  s.selectedEffects = arrStr(s.selectedEffects);
  s.themes = arrStr(s.themes);
  s.packs = arrStr(s.packs);
  s.soundPacks = arrStr(s.soundPacks);
  if (!s.soundPacks.includes('default')) s.soundPacks.push('default');
  s.soundPack = str(s.soundPack, 'default');
  s.achievements = arrStr(s.achievements);
  s.difficulty = ['auto', 'permisA', 'pilote'].includes(s.difficulty) ? s.difficulty : 'auto';
  s.pseudo = str(s.pseudo).slice(0, 16);
  s.leaderboardOptIn = bool(s.leaderboardOptIn);
  s.sound = bool(s.sound, true);
  s.music = bool(s.music, true);
  s.wideWindows = bool(s.wideWindows);
  s.colorblind = bool(s.colorblind);
  s.themeOverride = str(s.themeOverride);
  s.tutorialDone = bool(s.tutorialDone);
  s.speedrun = bool(s.speedrun);
  s.keys = sanitizeKeys(s.keys); // v1.3.47 : touches valides, défauts sinon
  s.verticalZones = bool(s.verticalZones); // v1.3.76 : migration faite dans load() sur le JSON brut
  s.lastLogin = str(s.lastLogin);
  s.streak = num(s.streak);
  s.streakRewardDay = str(s.streakRewardDay);
  s.quests = obj(s.quests);
  s.quests.weekKey = str(s.quests.weekKey);
  s.quests.progress = numMap(s.quests.progress);
  s.quests.done = boolMap(s.quests.done);
  s.challengeDone = boolMap(s.challengeDone);
  s.uid = str(s.uid);
  s.googleEmail = str(s.googleEmail);
  s.googleRefresh = str(s.googleRefresh);
  // v1.3.36 : amis = pseudos (16 car. max comme le pseudo), dédupliqués sans tenir compte de la casse
  {
    const seenF = new Set();
    const inputFriends = arrStr(s.friends); // capturer AVANT de réassigner s.friends
    s.friends = [];
    for (const x of inputFriends) {
      const v = x.trim().slice(0, 16);
      const k = v.toLowerCase();
      if (v && !seenF.has(k)) {
        seenF.add(k);
        s.friends.push(v);
      }
    }
  }
  // v1.3.75 : tombstones d'amis (minuscules, dédupliqués, 16 car. max)
  s.deletedFriends = [...new Set(arrStr(s.deletedFriends).map((x) => x.trim().slice(0, 16).toLowerCase()).filter(Boolean))];
  s.totals = obj(s.totals);
  s.totals.runs = num(s.totals.runs);
  s.totals.perfects = num(s.totals.perfects);
  s.totals.overtakes = num(s.totals.overtakes);
  return s;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    let parsed = null;
    if (raw) {
      parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        // migration : l'ancienne save "coins" devient le portefeuille auto
        if (typeof parsed.coins === 'number' && !parsed.wallets) {
          parsed.wallets = { auto: parsed.coins, permisA: 0, pilote: 0 };
          delete parsed.coins;
        }
        // v1.3.76 : migration horizontalZones -> verticalZones (nouveau défaut = gauche/droite)
        if ('horizontalZones' in parsed && typeof parsed.verticalZones !== 'boolean') {
          parsed.verticalZones = !(parsed.horizontalZones === true);
        }
        delete parsed.horizontalZones;
      }
    }
    save = sanitize({ ...defaults(), ...(parsed && typeof parsed === 'object' ? parsed : {}) });
  } catch {
    save = sanitize(defaults());
  }
  restoreKeysForAccount(); // v1.3.57 : récupère les touches du compte si la save principale les a perdues
  return save;
}

export function get() {
  return save;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* stockage indisponible */
  }
}

export function getWallet(diff) {
  return save.wallets[diff] || 0;
}

export function addCoins(diff, n) {
  const key = save.wallets[diff] !== undefined ? diff : 'auto';
  const add = num(n); // v1.3.27 : jamais de NaN dans un portefeuille
  save.wallets[key] = (save.wallets[key] || 0) + add;
  persist();
  return save.wallets[key];
}

export function spend(diff, n) {
  const key = save.wallets[diff] !== undefined ? diff : 'auto';
  const cost = num(n);
  if (cost <= 0) return true;
  if ((save.wallets[key] || 0) < cost) return false;
  save.wallets[key] -= cost;
  persist();
  return true;
}

export function setStars(levelId, n) {
  const v = num(n);
  if (v > (save.stars[levelId] || 0)) {
    save.stars[levelId] = v;
    persist();
  }
}

export function setEndlessBest(n) {
  const v = num(n);
  if (v > save.endlessBest) {
    save.endlessBest = v;
    persist();
  }
}

export function setTrophy(levelId) {
  if (!save.trophies[levelId]) {
    save.trophies[levelId] = true;
    persist();
  }
}

export function unlockLevel(id) {
  if (!save.unlockedLevels.includes(id)) {
    save.unlockedLevels.push(id);
    persist();
  }
}

// v1.3.17 : un niveau est "terminé" seulement quand la partie est complétée (stats.completed)
export function markCleared(levelId) {
  if (!save.cleared[levelId]) {
    save.cleared[levelId] = true;
    persist();
  }
}

export function isCleared(levelId) {
  return Boolean(save.cleared[levelId]);
}

// v1.3.19 : mode speedrun (toggle, se cale sur la difficulté Pilote)
export function setSpeedrun(on) {
  save.speedrun = Boolean(on);
  persist();
}

// v1.3.76 : zones de tap verticales haut/bas (défaut = gauche/droite)
export function setBigTargets(on) { save.bigTargets = Boolean(on); persist(); } // v1.3.80 #6
export function setReduceAnims(on) { save.reduceAnims = Boolean(on); persist(); } // v1.3.80 #15
export function setHighContrast(on) { save.highContrast = Boolean(on); persist(); } // v1.3.80 #16
export function setTextSize(v) { save.textSize = ['small', 'medium', 'large'].includes(v) ? v : 'medium'; persist(); } // v1.3.80 #17
export function setHitMarker(on) { save.hitMarker = Boolean(on); persist(); } // v1.3.80 #27 (hors classement)
export function setVerticalZones(on) {
  save.verticalZones = Boolean(on);
  persist();
}

// v1.3.44 : record de temps (ms), isolé par difficulté — retourne true si nouveau record
// v1.3.79 : replay local du meilleur run (vérification #30) — clé "mode:levelId"
export function getReplay(mode, levelId) {
  return (save.replays || {})[bestKey(mode, levelId)] || null;
}
export function setReplay(mode, levelId, rep) {
  if (!rep || !Array.isArray(rep.taps)) return null;
  save.replays = save.replays || {};
  const k = bestKey(mode, levelId);
  const prev = save.replays[k];
  if (!prev || (rep.timeMs || Infinity) < (prev.timeMs || Infinity)) {
    save.replays[k] = rep;
    persist();
  }
  return save.replays[k];
}

// v1.3.90 : historique des 10 dernières parties (menu 🎞 Replays) — clé localStorage dédiée
const REPLAYS_KEY = 'roadtap_replays_v1';
function readReplays() {
  try {
    const a = JSON.parse(localStorage.getItem(REPLAYS_KEY) || '[]');
    return Array.isArray(a) ? a.filter((r) => r && typeof r === 'object' && Array.isArray(r.taps)) : [];
  } catch { return []; }
}
export function listReplays() { return readReplays(); } // plus récent d'abord
export function getReplayById(id) { return readReplays().find((r) => r.id === id) || null; }
export function pushReplay(rep) { // ajoute en tête, garde 10 max
  if (!rep || !Array.isArray(rep.taps)) return null;
  const a = readReplays();
  const entry = {
    id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    date: Date.now(),
    mode: String(rep.mode || 'auto'),
    levelId: rep.levelId,
    levelName: String(rep.levelName || ('Niv. ' + rep.levelId)),
    score: rep.score | 0,
    timeMs: rep.timeMs || 0,
    completed: !!rep.completed,
    reason: String(rep.reason || ''),
    seed: rep.seed,
    lines: rep.lines,
    taps: rep.taps.slice(0, 10000),
  };
  a.unshift(entry);
  while (a.length > 10) a.pop(); // v1.3.90 : 10 dernières parties max
  try { localStorage.setItem(REPLAYS_KEY, JSON.stringify(a)); } catch { /* quota plein : on ignore */ }
  return entry;
}
export function deleteReplay(id) {
  const a = readReplays().filter((r) => r.id !== id);
  try { localStorage.setItem(REPLAYS_KEY, JSON.stringify(a)); } catch { /* ignore */ }
}
export function setTraining(on) { save.training = Boolean(on); persist(); } // v1.3.82 #1
export function setTrainSpeed(v) { save.trainSpeed = [0.5, 0.75, 1].includes(Number(v)) ? Number(v) : 1; persist(); } // v1.3.82 #1
export function setVibrate(on) { save.vibrate = on === undefined ? true : Boolean(on); persist(); } // v1.3.82 #7
export function setLeftHanded(on) { save.leftHanded = Boolean(on); persist(); } // v1.3.82 #8
export function setWindowLevel(v) { save.windowLevel = ['standard', 'large', 'xlarge'].includes(v) ? v : 'standard'; persist(); } // v1.3.82 #11
export function setLatencyOffsetMs(ms) { save.latencyOffsetMs = Math.max(-100, Math.min(100, Math.round(Number(ms) || 0))); persist(); } // v1.3.82 #5
export function getMedal(mode, levelId) { return (save.medals || {})[bestKey(mode, levelId)] || 0; } // v1.3.81 #22
export function setMedal(mode, levelId, m) { // garde la meilleure (1=or est le minimum)
  if (![1, 2, 3].includes(m)) return;
  save.medals = save.medals || {};
  const k = bestKey(mode, levelId);
  const prev = save.medals[k] || 0;
  if (prev === 0 || m < prev) { save.medals[k] = m; persist(); }
}
export function getBestTime(mode, levelId) {
  return save.bestTime[bestKey(mode, levelId)];
}
export function setBestTime(mode, levelId, ms) {
  const k = bestKey(mode, levelId);
  const prev = save.bestTime[k];
  if (prev === undefined || ms < prev) {
    save.bestTime[k] = ms;
    persist();
    return true;
  }
  return false;
}

export function buySkin(id, cost, currency = 'auto') {
  // v1.3.35 : les skins "récompense" (coût 0, ex. Survie d'or) ne s'achètent pas
  if ((num(cost)) <= 0 && id !== 'default') return false;
  if (save.skins.includes(id) || !spend(currency, cost)) return false;
  save.skins.push(id);
  persist();
  return true;
}

export function buyEffect(id, cost, currency = 'auto') {
  if (save.effects.includes(id) || !spend(currency, cost)) return false;
  save.effects.push(id);
  // v1.3.28 : un achat N'ACTIVE PAS l'effet automatiquement (le joueur choisit dans la boutique)
  persist();
  return true;
}

export function selectSkin(id) {
  if (!save.skins.includes(id)) return false;
  save.skin = id;
  persist();
  return true;
}

export function toggleEffect(id) {
  const i = save.selectedEffects.indexOf(id);
  if (i >= 0) save.selectedEffects.splice(i, 1);
  else if (save.effects.includes(id)) save.selectedEffects.push(id);
  persist();
}

// v1.3.44 : record de score, isolé par difficulté — retourne true si nouveau record
export function getBest(mode, levelId) {
  return save.best[bestKey(mode, levelId)] || 0;
}
export function setBest(mode, levelId, score) {
  const k = bestKey(mode, levelId);
  const prev = save.best[k] || 0;
  if (score > prev) {
    save.best[k] = score;
    persist();
    return true;
  }
  return false;
}

// v1.3.44 : vue aplatie (max de toutes les difficultés par niveau) — utilisée par les succès (champion)
export function bestFlat() {
  const out = {};
  for (const [k, v] of Object.entries(save.best)) {
    const i = k.indexOf(':');
    const lid = i >= 0 ? k.slice(i + 1) : k;
    out[lid] = Math.max(out[lid] || 0, v);
  }
  return out;
}

// v1.3.47 : rebinding d'une touche (menu Paramètres) — false si la touche est déjà prise
export function setKey(action, code) {
  const next = bindKey(save.keys, action, code);
  if (!next) return false;
  save.keys = next;
  persist();
  backupKeysForAccount(); // v1.3.57 : la config touches suit le compte, pas seulement la save principale
  return true;
}

export function setKeys(keys) {
  save.keys = sanitizeKeys(keys);
  persist();
  backupKeysForAccount(); // v1.3.57
}

// v1.3.57 : les touches sont sauvegardées AVEC LE COMPTE, à deux niveaux :
// - cloud : players/<uid>.keys via snapshot()/mergeRemote() (déjà en place depuis v1.3.47)
// - local : clé dédiée par compte roadtap_keys_v1_<uid|pseudo>, écrite à chaque rebind et à
//   chaque connexion, restaurée au chargement si la save principale a perdu les touches
//   (clear site data partiel, save corrompue, ancien resetProgress) -> un CTRL+F5 ou un
//   rechargement ne efface plus jamais la config du joueur.
const KEYS_ACCT_PREFIX = 'roadtap_keys_v1_';
export function keysAccountId() {
  return save.uid || save.pseudo || '';
}
export function backupKeysForAccount() {
  const id = keysAccountId();
  if (!id) return false;
  try {
    localStorage.setItem(KEYS_ACCT_PREFIX + id, JSON.stringify(save.keys));
    return true;
  } catch {
    return false;
  }
}
export function restoreKeysForAccount() {
  const id = keysAccountId();
  if (!id) return false;
  try {
    const raw = localStorage.getItem(KEYS_ACCT_PREFIX + id);
    if (!raw) return false;
    const k = sanitizeKeys(JSON.parse(raw));
    if (JSON.stringify(k) === JSON.stringify(save.keys)) return false;
    save.keys = k;
    persist();
    return true;
  } catch {
    return false;
  }
}

export function setSound(on) {
  save.sound = on;
  persist();
}

export function setDifficulty(id) {
  save.difficulty = id;
  persist();
}

export function setPseudo(p) {
  save.pseudo = str(p).slice(0, 16); // v1.3.27 : toujours une string sûre, même en session
  persist();
}

export function setLeaderboardOptIn(on) {
  save.leaderboardOptIn = on;
  persist();
}

export function setMusic(on) {
  save.music = on;
  persist();
}

export function setWideWindows(on) {
  save.wideWindows = on;
  persist();
}

export function setColorblind(on) {
  save.colorblind = on;
  persist();
}

export function setThemeOverride(id) {
  save.themeOverride = save.themeOverride === id ? '' : id;
  persist();
}

export function buyTheme(id, cost, currency = 'auto') {
  if (save.themes.includes(id) || !spend(currency, cost)) return false;
  save.themes.push(id);
  persist();
  return true;
}

export function setTutorialDone() {
  save.tutorialDone = true;
  persist();
}

export function grantSkin(id) {
  if (!save.skins.includes(id)) {
    save.skins.push(id);
    persist();
  }
}

export function grantEffect(id) {
  if (!save.effects.includes(id)) {
    save.effects.push(id);
    // v1.3.28 : un pack débloque le contenu mais ne l'active pas (évite « secousse activée par défaut »)
    persist();
  }
}

// achat d'un pack : une seule monnaie, contenus débloqués d'un coup
export function buyPack(pack) {
  if (save.packs.includes(pack.id) || !spend(pack.currency || 'auto', pack.cost)) return false;
  for (const it of pack.items || []) {
    if (it.type === 'skin') grantSkin(it.id);
    else if (it.type === 'effect') grantEffect(it.id);
  }
  save.packs.push(pack.id);
  persist();
  return true;
}

export function buySoundPack(sp) {
  if (save.soundPacks.includes(sp.id) || !spend(sp.currency || 'auto', sp.cost)) return false;
  save.soundPacks.push(sp.id);
  persist();
  return true;
}

export function selectSoundPack(id) {
  if (!save.soundPacks.includes(id)) return false;
  save.soundPack = id;
  persist();
  return true;
}

// --- rétention : série de connexion (1 récompense 🪙 par jour, plafonnée à 7 jours) ---
export function touchLogin() {
  const today = dayKey();
  if (save.lastLogin === today) return { streak: save.streak, reward: 0 };
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  save.streak = save.lastLogin === yesterday ? save.streak + 1 : 1;
  save.lastLogin = today;
  let reward = 0;
  if (save.streakRewardDay !== today) {
    reward = Math.min(save.streak, 7) * 25;
    save.streakRewardDay = today;
    save.wallets.auto = (save.wallets.auto || 0) + reward;
  }
  persist();
  return { streak: save.streak, reward };
}

// --- quêtes hebdo : progression cumulée, quêtes terminées renvoyées ---
export function addQuestProgress(delta) {
  const wk = weekKey();
  if (save.quests.weekKey !== wk) save.quests = { weekKey: wk, progress: {}, done: {} };
  const newly = [];
  for (const q of weeklyQuests()) {
    if (save.quests.done[q.id]) continue;
    const cur = (save.quests.progress[q.kind] || 0) + (delta[q.kind] || 0);
    save.quests.progress[q.kind] = cur;
    if (cur >= q.target) {
      save.quests.done[q.id] = true;
      newly.push(q);
    }
  }
  persist();
  return newly;
}

export function markChallengeDone(dayId) {
  save.challengeDone[dayId] = true;
  persist();
}

export function isChallengeDone(dayId) {
  return !!save.challengeDone[dayId];
}

// --- compte Google (uid) : la sauvegarde cloud est keyed par uid quand lié ---
export function setGoogleAccount(uid, email, refreshToken) {
  save.uid = uid || '';
  save.googleEmail = email || '';
  if (refreshToken) save.googleRefresh = refreshToken;
  persist();
}

export function clearGoogleAccount() {
  save.uid = '';
  save.googleEmail = '';
  save.googleRefresh = '';
  persist();
}

// v1.3.40 : déconnexion Google -> on repart de 0 EN LOCAL. Seules les préférences de l'appareil
// sont conservées (son, musique, accessibilité écran + v1.3.57 : touches personnalisées, qui sont
// de la config, pas de la progression). Le cloud players/<uid>
// n'est PAS touché : à la reconnexion, cette save locale (à 0) fusionne avec le cloud via
// mergeRemote (max/union par champ) -> la progression cloud revient.
export function resetProgress() {
  const keepDevicePrefs = {
    sound: save.sound,
    music: save.music,
    wideWindows: save.wideWindows,
    colorblind: save.colorblind,
    verticalZones: save.verticalZones, // v1.3.76 : zones haut/bas = config, pas progression
    keys: save.keys, // v1.3.57 : les touches sont la config du joueur — JAMAIS effacées par une déconnexion
  };
  save = sanitize({ ...defaults(), ...keepDevicePrefs });
  persist();
}

// --- v1.3.36 : amis (classement « amis » par pseudo) ---
// 16 car. max comme le pseudo ; la casse est conservée pour l'affichage, la comparaison
// se fait en minuscules (add/remove/merge et core.filterFriendsByPseudo).
export function addFriend(p) {
  const v = str(p).trim().slice(0, 16);
  if (!v) return false;
  if (save.friends.some((f) => f.toLowerCase() === v.toLowerCase())) return false;
  save.friends.push(v);
  save.deletedFriends = save.deletedFriends.filter((d) => d !== v.toLowerCase()); // v1.3.75 : ré-ajout = tombstone levé
  persist();
  return true;
}

// v1.3.86 : demandes d'amis envoyées (en attente de réponse)
export function getOutgoingFriendRequests() { return save.friendRequestsOut || {}; }
export function addOutgoingFriendRequest(toUid, pseudo) {
  save.friendRequestsOut = save.friendRequestsOut || {};
  save.friendRequestsOut[String(toUid)] = { pseudo: str(pseudo).slice(0, 16), date: Date.now() };
  persist();
}
export function removeOutgoingFriendRequest(toUid) {
  if (save.friendRequestsOut && save.friendRequestsOut[String(toUid)]) {
    delete save.friendRequestsOut[String(toUid)];
    persist();
  }
}
export function removeFriend(p) {
  const v = str(p).trim();
  const i = save.friends.findIndex((f) => f.toLowerCase() === v.toLowerCase());
  if (i < 0) return false;
  save.friends.splice(i, 1);
  const dk = v.toLowerCase();
  if (!save.deletedFriends.includes(dk)) save.deletedFriends.push(dk); // v1.3.75 : tombstone — ne reviendra pas via le cloud
  persist();
  return true;
}

export function unlockAchievement(id) {
  if (!save.achievements.includes(id)) {
    save.achievements.push(id);
    persist();
  }
}

export function addTotals(t) {
  save.totals.runs += t.runs || 0;
  save.totals.perfects += t.perfects || 0;
  save.totals.overtakes += t.overtakes || 0;
  persist();
}

export function snapshot() {
  return {
    keys: save.keys, // v1.3.47
    wallets: save.wallets,
    trophies: save.trophies,
    stars: save.stars,
    endlessBest: save.endlessBest,
    unlockedLevels: save.unlockedLevels,
    cleared: save.cleared,
    skins: save.skins,
    skin: save.skin,
    effects: save.effects,
    selectedEffects: save.selectedEffects,
    best: save.best,
    bestTime: save.bestTime,
    speedrun: save.speedrun,
    verticalZones: save.verticalZones,
    difficulty: save.difficulty,
    achievements: save.achievements,
    totals: save.totals,
    themeOverride: save.themeOverride,
    themes: save.themes,
    packs: save.packs,
    soundPacks: save.soundPacks,
    soundPack: save.soundPack,
    lastLogin: save.lastLogin,
    streak: save.streak,
    streakRewardDay: save.streakRewardDay,
    quests: save.quests,
    challengeDone: save.challengeDone,
    pseudo: save.pseudo, // v1.3.83 : le pseudo part dans le cloud -> récupéré à la reconnexion
    uid: save.uid,
    googleEmail: save.googleEmail,
    friends: save.friends, // v1.3.36 : liste d'amis synchronisée avec le cloud
    friendRequestsOut: save.friendRequestsOut, // v1.3.86
    deletedFriends: save.deletedFriends, // v1.3.75 : tombstones synchronisées avec le cloud
    // googleRefresh volontairement EXCLU du snapshot cloud (credential)
  };
}

const arr = (x) => (Array.isArray(x) ? x : []);

function mergeRemoteBody(remote) {
  if (!remote || typeof remote !== 'object') return false;
  const rw = remote.wallets || (typeof remote.coins === 'number' ? { auto: remote.coins } : {});
  for (const k of ['auto', 'permisA', 'pilote']) {
    save.wallets[k] = Math.max(save.wallets[k] || 0, num(rw[k]));
  }
  save.trophies = { ...(remote.trophies || {}), ...save.trophies };
  for (const [k, v] of Object.entries((remote.stars && typeof remote.stars === 'object') ? remote.stars : {})) {
    save.stars[k] = Math.max(save.stars[k] || 0, num(v));
  }
  save.endlessBest = Math.max(save.endlessBest || 0, num(remote.endlessBest));
  save.packs = [...new Set([...save.packs, ...arr(remote.packs)])];
  save.soundPacks = [...new Set([...save.soundPacks, 'default', ...arr(remote.soundPacks)])];
  if (remote.soundPack && save.soundPacks.includes(remote.soundPack)) save.soundPack = remote.soundPack;
  save.streak = Math.max(save.streak || 0, num(remote.streak));
  if (!save.uid && remote.uid) {
    save.uid = remote.uid;
    save.googleEmail = remote.googleEmail || '';
  }
  // v1.3.83 : à la reconnexion, le pseudo revient du cloud s'il manque en local (jamais d'écrasement d'un pseudo local)
  if (!save.pseudo && typeof remote.pseudo === 'string' && remote.pseudo.trim()) {
    save.pseudo = str(remote.pseudo).slice(0, 16);
  }
  save.challengeDone = { ...(remote.challengeDone || {}), ...save.challengeDone };
  if (remote.quests && typeof remote.quests === 'object' && remote.quests.weekKey === save.quests.weekKey) {
    save.quests.done = { ...remote.quests.done, ...save.quests.done };
    for (const [k, v] of Object.entries((remote.quests.progress && typeof remote.quests.progress === 'object') ? remote.quests.progress : {})) {
      save.quests.progress[k] = Math.max(save.quests.progress[k] || 0, num(v));
    }
  }
  save.unlockedLevels = [...new Set([...save.unlockedLevels, ...arr(remote.unlockedLevels)])];
  save.friendRequestsOut = { ...(remote.friendRequestsOut && typeof remote.friendRequestsOut === 'object' ? remote.friendRequestsOut : {}), ...save.friendRequestsOut }; // v1.3.86
  // v1.3.36 : union des listes d'amis, dédupliquée sans tenir compte de la casse
  // v1.3.75 : tombstones — un ami supprimé (en local OU sur un autre appareil) ne revient JAMAIS
  {
    const tomb = new Set([
      ...arr(save.deletedFriends).map((x) => String(x).toLowerCase()),
      ...arr(remote.deletedFriends).map((x) => String(x).trim().slice(0, 16).toLowerCase()).filter(Boolean),
    ]);
    save.deletedFriends = [...tomb];
    const allF = [...save.friends, ...arr(remote.friends).map((x) => String(x).trim().slice(0, 16)).filter(Boolean)];
    const seenF = new Set();
    save.friends = [];
    for (const f of allF) {
      const k = f.toLowerCase();
      if (!seenF.has(k) && !tomb.has(k)) { // v1.3.75 : tombstone -> exclu de la liste
        seenF.add(k);
        save.friends.push(f);
      }
    }
  }
  save.cleared = { ...(remote.cleared || {}), ...save.cleared };
  save.skins = [...new Set([...save.skins, ...arr(remote.skins)])];
  save.effects = [...new Set([...save.effects, ...arr(remote.effects)])];
  save.themes = [...new Set([...save.themes, ...arr(remote.themes)])];
  save.achievements = [...new Set([...save.achievements, ...arr(remote.achievements)])];
  for (const [k, v] of Object.entries((remote.best && typeof remote.best === 'object') ? remote.best : {})) {
    save.best[k] = Math.max(save.best[k] || 0, num(v));
  }
  for (const [k, v] of Object.entries((remote.bestTime && typeof remote.bestTime === 'object') ? remote.bestTime : {})) {
    if (!num(v)) continue;
    const cur = save.bestTime[k];
    if (cur === undefined || v < cur) save.bestTime[k] = v;
  }
  if (remote.speedrun === true) save.speedrun = true;
  if (typeof remote.verticalZones === 'boolean') save.verticalZones = remote.verticalZones;
  else if (remote.horizontalZones === true) save.verticalZones = false; // v1.3.76 : ancien champ -> gauche/droite
  if (remote.keys && typeof remote.keys === 'object') save.keys = sanitizeKeys(remote.keys); // v1.3.47 : touches du cloud (dernier appareil gagne)
  save.totals = {
    runs: Math.max(save.totals.runs, remote.totals?.runs || 0),
    perfects: Math.max(save.totals.perfects, remote.totals?.perfects || 0),
    overtakes: Math.max(save.totals.overtakes, remote.totals?.overtakes || 0),
  };
  persist();
  return true;
}

// mergeRemote ne doit JAMAIS faire planter le jeu : données distantes corrompues => on ignore.
export function mergeRemote(remote) {
  try {
    return mergeRemoteBody(remote);
  } catch (e) {
    console.warn('[store] mergeRemote ignoré (données distantes invalides):', e);
    return false;
  }
}
