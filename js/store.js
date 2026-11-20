const KEY = 'roadtap_save_v1';

const defaults = () => ({
  wallets: { auto: 0, permisA: 0, pilote: 0 },
  trophies: {},
  unlockedLevels: [1],
  skins: ['default'],
  skin: 'default',
  effects: [],
  selectedEffects: [],
  best: {},
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
});

let save;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // migration : l'ancienne save "coins" devient le portefeuille auto
      if (typeof parsed.coins === 'number' && !parsed.wallets) {
        parsed.wallets = { auto: parsed.coins, permisA: 0, pilote: 0 };
        delete parsed.coins;
      }
      save = { ...defaults(), ...parsed };
    } else {
      save = defaults();
    }
    save.wallets = { auto: 0, permisA: 0, pilote: 0, ...(save.wallets || {}) };
    save.trophies = save.trophies || {};
  } catch {
    save = defaults();
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
  save.wallets[key] = (save.wallets[key] || 0) + n;
  persist();
  return save.wallets[key];
}

export function spend(diff, n) {
  const key = save.wallets[diff] !== undefined ? diff : 'auto';
  if ((save.wallets[key] || 0) < n) return false;
  save.wallets[key] -= n;
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

export function buySkin(id, cost, currency = 'auto') {
  if (save.skins.includes(id) || !spend(currency, cost)) return false;
  save.skins.push(id);
  persist();
  return true;
}

export function buyEffect(id, cost, currency = 'auto') {
  if (save.effects.includes(id) || !spend(currency, cost)) return false;
  save.effects.push(id);
  if (!save.selectedEffects.includes(id)) save.selectedEffects.push(id);
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
  save.pseudo = p;
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
    if (!save.selectedEffects.includes(id)) save.selectedEffects.push(id);
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
    skins: save.skins,
    skin: save.skin,
    effects: save.effects,
    selectedEffects: save.selectedEffects,
    best: save.best,
    difficulty: save.difficulty,
    achievements: save.achievements,
    totals: save.totals,
    themeOverride: save.themeOverride,
    themes: save.themes,
    packs: save.packs,
    soundPacks: save.soundPacks,
    soundPack: save.soundPack,
  };
}

export function mergeRemote(remote) {
  if (!remote || typeof remote !== 'object') return false;
  const rw = remote.wallets || (typeof remote.coins === 'number' ? { auto: remote.coins } : {});
  for (const k of ['auto', 'permisA', 'pilote']) {
    save.wallets[k] = Math.max(save.wallets[k] || 0, rw[k] || 0);
  }
  save.trophies = { ...(remote.trophies || {}), ...save.trophies };
  save.packs = [...new Set([...save.packs, ...(remote.packs || [])])];
  save.soundPacks = [...new Set([...save.soundPacks, 'default', ...(remote.soundPacks || [])])];
  if (remote.soundPack && save.soundPacks.includes(remote.soundPack)) save.soundPack = remote.soundPack;
  save.unlockedLevels = [...new Set([...save.unlockedLevels, ...(remote.unlockedLevels || [])])];
  save.skins = [...new Set([...save.skins, ...(remote.skins || [])])];
  save.effects = [...new Set([...save.effects, ...(remote.effects || [])])];
  save.themes = [...new Set([...save.themes, ...(remote.themes || [])])];
  save.achievements = [...new Set([...save.achievements, ...(remote.achievements || [])])];
  for (const [k, v] of Object.entries(remote.best || {})) {
    save.best[k] = Math.max(save.best[k] || 0, v);
  }
  save.totals = {
    runs: Math.max(save.totals.runs, remote.totals?.runs || 0),
    perfects: Math.max(save.totals.perfects, remote.totals?.perfects || 0),
    overtakes: Math.max(save.totals.overtakes, remote.totals?.overtakes || 0),
  };
  persist();
  return true;
}
