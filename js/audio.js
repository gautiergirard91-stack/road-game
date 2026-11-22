let ctx = null;
let enabled = true;

export function setEnabled(on) {
  enabled = on;
}

function hasAudio() {
  return typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext);
}
function ac() {
  if (!ctx) {
    if (!hasAudio()) return null; // headless / sans WebAudio -> aucun son, aucun crash
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() {
  try {
    ac();
  } catch {
    /* audio indisponible */
  }
}

function tone(freq, dur, type = 'sine', vol = 0.18, when = 0, slide = 0) {
  if (!enabled) return;
  try {
    const c = ac();
    if (!c) return;
    const t0 = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  } catch {
    /* audio indisponible */
  }
}

// --- Musique ADAPTATIVE procédurale (WebAudio, zéro asset) — v1.3.42 ---
// Sequencer 16 pas/mesure avec scheduling lookahead (timer 25 ms, fenêtre 0.15 s).
// L'intensité dépend du combo de PARFAIT : tempo 96 -> 160 BPM, couches qui s'ajoutent
// (kick / hats / caisse / basse / arpège / pad), filtre du bus musique qui s'ouvre.
// Chaque pression du joueur joue un « bit » dont la hauteur monte avec le combo (300 -> 1200 Hz).
// Raté -> sting (mini-thème dissonant descendant) + combo remis à 0. Victoire -> arpège montant.
let musicTimer = null;
let musicStep = 0;
let musicNext = 0;
let musicOn = false;
let musicCombo = 0;
let musicBus = null; // gain + lowpass dont la fréquence de coupure suit l'intensité
let noiseBuf = null;

// --- helpers purs (testables headless) ---
export function comboIntensity(combo) {
  const c = Number.isFinite(combo) ? Math.max(0, combo) : 0;
  return Math.min(1, c / 16);
}
export function musicTempo(combo) {
  return Math.round(96 + comboIntensity(combo) * 64); // 96..160 BPM
}
export function tapFreq(combo) {
  const c = Number.isFinite(combo) ? Math.max(0, combo) : 0;
  return Math.round(300 * Math.pow(2, Math.min(c, 24) / 12)); // 300 Hz -> 1200 Hz max
}
export function musicLayers(combo) {
  const i = comboIntensity(combo);
  return { kick: i > 0.05, hat8: i > 0.25, snare: i > 0.45, bass: i > 0.2, pad: i > 0.4, arp: i > 0.6, hat16: i > 0.8 };
}
export function setMusicCombo(n) {
  musicCombo = Number.isFinite(n) ? Math.max(0, Math.min(99, n)) : 0;
}
export function getMusicState() {
  return { combo: musicCombo, intensity: comboIntensity(musicCombo), tempo: musicTempo(musicCombo), on: musicOn };
}

// Progression 4 mesures en La mineur : [fondamentale, tierce mineure, quinte] par accord
const CHORDS = [
  [220.0, 261.63, 329.63], // Am
  [174.61, 220.0, 261.63], // F
  [261.63, 329.63, 392.0], // C
  [196.0, 246.94, 293.66], // G
];

function getBus(c) {
  if (!musicBus) {
    const g = c.createGain();
    g.gain.value = 0.5;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    g.connect(f).connect(c.destination);
    musicBus = { g, f };
  }
  return musicBus;
}

function getNoise(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.5), c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function env(g, t0, a, peak, dur) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
}

function oscNote(c, dest, t0, freq, dur, type, peak, slideTo) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
  env(g, t0, 0.008, peak, dur);
  o.connect(g).connect(dest);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noiseHit(c, dest, t0, dur, peak, filterType, freq) {
  const src = c.createBufferSource();
  src.buffer = getNoise(c);
  const f = c.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = freq;
  const g = c.createGain();
  env(g, t0, 0.004, peak, dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

function scheduleStep(step, t0) {
  const c = ac();
  if (!c) return;
  const bus = getBus(c);
  const inten = comboIntensity(musicCombo);
  // le filtre du bus s'ouvre avec l'intensité : plus intense = plus brillant
  bus.f.frequency.setTargetAtTime(500 + inten * 4200, t0, 0.05);
  const layers = musicLayers(musicCombo);
  const bar = Math.floor(step / 16) % 4;
  const chord = CHORDS[bar];
  const s = step % 16;
  const root = chord[0] / 2;
  if (layers.kick && (s % 4 === 0 || (s === 14 && inten > 0.75))) oscNote(c, bus.g, t0, 150, 0.14, 'sine', 0.5, 45);
  if (layers.hat8 && s % 2 === 0) noiseHit(c, bus.g, t0, 0.03, layers.hat16 ? 0.1 : 0.06, 'highpass', 6500);
  if (layers.hat16 && s % 2 === 1) noiseHit(c, bus.g, t0, 0.02, 0.05, 'highpass', 8000);
  if (layers.snare && (s === 4 || s === 12)) {
    noiseHit(c, bus.g, t0, 0.12, 0.25, 'bandpass', 1800);
    oscNote(c, bus.g, t0, 190, 0.1, 'triangle', 0.2);
  }
  if (layers.bass && s % 2 === 0) {
    const f = root * (s % 8 === 6 ? 1.5 : 1);
    oscNote(c, bus.g, t0, f, 0.16, 'sawtooth', 0.16, f * 0.99);
  }
  if (layers.pad && s === 0) {
    for (const f of chord) oscNote(c, bus.g, t0, f, 1.6, 'sawtooth', 0.045);
  }
  if (layers.arp) {
    const seq = [chord[0], chord[1], chord[2], chord[0] * 2, chord[2], chord[1], chord[0] * 2, chord[2]];
    oscNote(c, bus.g, t0, seq[s % 8], 0.09, 'square', 0.06);
  }
}

function schedule() {
  if (!musicOn || !enabled) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  const c = ac();
  if (!c) return;
  const ahead = c.currentTime + 0.15;
  if (!musicNext || musicNext < c.currentTime) musicNext = c.currentTime + 0.06;
  while (musicNext < ahead) {
    scheduleStep(musicStep, musicNext);
    musicNext += 60 / musicTempo(musicCombo) / 4; // doubles croches, tempo selon combo
    musicStep++;
  }
}

export function setMusicEnabled(on) {
  musicOn = !!on;
  if (musicOn) startMusic();
  else stopMusic();
}

function startMusic() {
  if (musicTimer || !hasAudio()) return; // headless -> pas de timer (pas de fuite de timer)
  musicStep = 0;
  musicNext = 0;
  musicTimer = setInterval(schedule, 25);
}

function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}

// « bit » à chaque pression du joueur : hauteur qui monte avec le combo + mini-kick
function tapBeat() {
  tone(tapFreq(musicCombo), 0.06, 'square', 0.1);
  tone(120, 0.05, 'sine', 0.12, 0, -60);
}

// mini-thème d'échec : 3 notes descendantes dissonantes (2 osc detunés par note) + boom,
// et le combo retombe à 0 -> la musique se calme derrière
export function musicSting() {
  musicCombo = 0;
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime + 0.02;
    [233.08, 220.0, 207.65].forEach((f, i) => {
      oscNote(c, c.destination, t0 + i * 0.13, f, 0.16, 'sawtooth', 0.16);
      oscNote(c, c.destination, t0 + i * 0.13, f * 1.035, 0.16, 'sawtooth', 0.12); // detune -> dissonance
    });
    oscNote(c, c.destination, t0 + 0.42, 90, 0.35, 'sine', 0.4, 40); // boom
  } catch {
    /* audio indisponible */
  }
}

// --- v1.3.46 : beat calé sur chaque ligne (style Geometry Dash) ---
// Le jeu appelle scheduleLineBeat(tSec, key) à chaque frame avec le temps restant avant
// qu'une ligne atteigne un essieu : un « tic » est joué EXACTEMENT à ce moment -> un joueur
// confirmé peut jouer rien qu'à l'oreille. Si la vitesse change, le tic est re-calé (stop + re-programmé).
const beatSched = new Map(); // key -> { osc, at }
export function scheduleLineBeat(tSec, key) {
  if (!enabled || !hasAudio()) return;
  if (!(tSec > -0.05 && tSec < 0.7)) return;
  const prev = beatSched.get(key);
  if (prev && Math.abs(prev.at - tSec) < 0.06) return; // déjà calé à peu près juste
  if (prev) {
    try { prev.osc.stop(); } catch { /* déjà arrêté */ }
    beatSched.delete(key);
  }
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + Math.max(0, tSec);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(1250, t0);
  o.frequency.exponentialRampToValueAtTime(620, t0 + 0.045);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + 0.12);
  beatSched.set(key, { osc: o, at: tSec });
}
export function clearLineBeats() {
  for (const [, v] of beatSched) {
    try { v.osc.stop(); } catch { /* ignore */ }
  }
  beatSched.clear();
}

// thème de victoire : arpège de La mineur montant
export function musicVictory() {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  try {
    [220, 261.63, 329.63, 440, 523.25, 659.25, 880].forEach((f, i) => tone(f, 0.16, 'triangle', 0.14, 0.05 + i * 0.09));
  } catch {
    /* audio indisponible */
  }
}

export const sfx = {
  tap: () => tapBeat(), // v1.3.42 : bit à chaque pression, hauteur selon le combo
  perfect: () => {
    tone(880, 0.12, 'sine', 0.2);
    tone(1320, 0.18, 'sine', 0.13, 0.05);
  },
  good: () => tone(660, 0.1, 'sine', 0.15),
  passable: () => tone(440, 0.1, 'triangle', 0.11),
  fail: () => tone(160, 0.5, 'sawtooth', 0.2, 0, -100),
  miss: () => tone(220, 0.28, 'sawtooth', 0.16, 0, -90),
  coin: () => {
    tone(990, 0.07, 'square', 0.07);
    tone(1480, 0.14, 'square', 0.07, 0.07);
  },
  click: () => tone(700, 0.05, 'triangle', 0.09),
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'sine', 0.15, i * 0.09));
  },
};

// --- Packs de sons (boutique, 100 % cosmétiques) ---
const BASE_SFX = { ...sfx };

const SOUND_PACK_VARIANTS = {
  arcade: {
    tap: () => tone(440, 0.06, 'square', 0.12),
    perfect: () => {
      tone(660, 0.08, 'square', 0.18);
      tone(990, 0.12, 'square', 0.16, 0.06);
    },
    good: () => tone(520, 0.08, 'square', 0.14),
    passable: () => tone(392, 0.08, 'square', 0.1),
    fail: () => tone(180, 0.4, 'square', 0.2, 0, -120),
    miss: () => tone(200, 0.25, 'square', 0.16, 0, -80),
    coin: () => {
      tone(880, 0.06, 'square', 0.08);
      tone(1320, 0.12, 'square', 0.08, 0.06);
    },
    click: () => tone(620, 0.04, 'square', 0.1),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.15, 'square', 0.14, i * 0.08)),
  },
  synthwave: {
    tap: () => tone(300, 0.09, 'sawtooth', 0.08, 0, 120),
    perfect: () => {
      tone(523, 0.14, 'sawtooth', 0.16, 0, 400);
      tone(1047, 0.2, 'sine', 0.12, 0.06);
    },
    good: () => tone(392, 0.1, 'sawtooth', 0.12, 0, 80),
    passable: () => tone(330, 0.1, 'triangle', 0.1),
    fail: () => tone(120, 0.6, 'sawtooth', 0.22, 0, -60),
    miss: () => tone(160, 0.3, 'sawtooth', 0.15, 0, -50),
    coin: () => {
      tone(784, 0.07, 'triangle', 0.1);
      tone(1568, 0.16, 'triangle', 0.1, 0.07);
    },
    click: () => tone(500, 0.05, 'sawtooth', 0.08, 0, 100),
    win: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'sawtooth', 0.13, i * 0.07)),
  },
};

export function applySoundPack(id) {
  Object.assign(sfx, BASE_SFX);
  const v = SOUND_PACK_VARIANTS[id];
  if (v) Object.assign(sfx, v);
}
