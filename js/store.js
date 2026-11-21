import { dayKey, weekKey, weeklyQuests } from './core.js';

const KEY = 'roadtap_save_v1';

const defaults = () => ({
  wallets: { auto: 0, permisA: 0, pilote: 0 },
  trophies: {},
  unlockedLevels: [1],
  cleared: {}, // niveaux TERMINÉS en entier (clé = id du niveau) — requis pour acheter le suivant
  skins: ['default'],
  skin: 'default',
  effects: [],
  selectedEffects: [],
  best: {},
  bestTime: {}, // v1.3.19 : meilleurs temps (ms) du mode speedrun, par niveau
  speedrun: false,
  horizontalZones: false, // v1.3.21 : zones gauche/droite (gauche=AV, droite=AR) au lieu de haut/bas
  sound: true,
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
});

let save;

// v1.3.27 : sanitizers — une sauvegarde corrompue (JSON cassé, mauvais types, vieille version)
// ne doit JAMAIS faire planter le jeu
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v, d = '') => (typeof v === 'string' ? v : d);
const bool = (v, d = false) => (typeof v === 'boolean' ? v : d);
const arrStr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
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
  s.cleared = boolMap(s.cleared);
  s.best = numMap(s.best);
  s.bestTime = numMap(s.bestTime);
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
  s.horizontalZones = bool(s.horizontalZones);
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
      }
    }
    save = sanitize({ ...defaults(), ...(parsed && typeof parsed === 'object' ? parsed : {}) });
  } catch {
    save = sanitize(defaults());
  }
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

// v1.3.21 : zones de tap horizontales (gauche = roues AV, droite = roues AR)
export function setHorizontalZones(on) {
  save.horizontalZones = Boolean(on);
  persist();
}

// v1.3.19 : record de temps (ms) — retourne true si nouveau record
export function setBestTime(levelId, ms) {
  const prev = save.bestTime[levelId];
  if (prev === undefined || ms < prev) {
    save.bestTime[levelId] = ms;
    persist();
    return true;
  }
  return false;
}

export function buySkin(id, cost, currency = 'auto') {
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

export function setBest(levelId, score) {
  const prev = save.best[levelId] || 0;
  if (score > prev) {
    save.best[levelId] = score;
    persist();
    return true;
  }
  return false;
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
    wallets: save.wallets,
    trophies: save.trophies,
    unlockedLevels: save.unlockedLevels,
    cleared: save.cleared,
    skins: save.skins,
    skin: save.skin,
    effects: save.effects,
    selectedEffects: save.selectedEffects,
    best: save.best,
    bestTime: save.bestTime,
    speedrun: save.speedrun,
    horizontalZones: save.horizontalZones,
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
    uid: save.uid,
    googleEmail: save.googleEmail,
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
  save.packs = [...new Set([...save.packs, ...arr(remote.packs)])];
  save.soundPacks = [...new Set([...save.soundPacks, 'default', ...arr(remote.soundPacks)])];
  if (remote.soundPack && save.soundPacks.includes(remote.soundPack)) save.soundPack = remote.soundPack;
  save.streak = Math.max(save.streak || 0, num(remote.streak));
  if (!save.uid && remote.uid) {
    save.uid = remote.uid;
    save.googleEmail = remote.googleEmail || '';
  }
  save.challengeDone = { ...(remote.challengeDone || {}), ...save.challengeDone };
  if (remote.quests && typeof remote.quests === 'object' && remote.quests.weekKey === save.quests.weekKey) {
    save.quests.done = { ...remote.quests.done, ...save.quests.done };
    for (const [k, v] of Object.entries((remote.quests.progress && typeof remote.quests.progress === 'object') ? remote.quests.progress : {})) {
      save.quests.progress[k] = Math.max(save.quests.progress[k] || 0, num(v));
    }
  }
  save.unlockedLevels = [...new Set([...save.unlockedLevels, ...arr(remote.unlockedLevels)])];
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
  if (remote.horizontalZones === true) save.horizontalZones = true;
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
