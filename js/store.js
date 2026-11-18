const KEY = 'roadtap_save_v1';

const defaults = () => ({
  coins: 0,
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
});

let save;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    save = raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
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

export function addCoins(n) {
  save.coins += n;
  persist();
  return save.coins;
}

export function spend(n) {
  if (save.coins < n) return false;
  save.coins -= n;
  persist();
  return true;
}

export function unlockLevel(id) {
  if (!save.unlockedLevels.includes(id)) {
    save.unlockedLevels.push(id);
    persist();
  }
}

export function buySkin(id, cost) {
  if (save.skins.includes(id) || !spend(cost)) return false;
  save.skins.push(id);
  persist();
  return true;
}

export function buyEffect(id, cost) {
  if (save.effects.includes(id) || !spend(cost)) return false;
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

export function buyTheme(id, cost) {
  if (save.themes.includes(id) || !spend(cost)) return false;
  save.themes.push(id);
  persist();
  return true;
}

export function setTutorialDone() {
  save.tutorialDone = true;
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
    coins: save.coins,
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
  };
}

export function mergeRemote(remote) {
  if (!remote || typeof remote !== 'object') return false;
  save.coins = Math.max(save.coins, remote.coins || 0);
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
