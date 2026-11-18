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
