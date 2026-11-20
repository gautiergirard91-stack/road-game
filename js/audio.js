let ctx = null;
let enabled = true;

export function setEnabled(on) {
  enabled = on;
}

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
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

let musicTimer = null;
let musicStep = 0;
let musicOn = false;

const BASS = [110, 110, 131, 98];
const ARP = [440, 523, 659, 784];

export function setMusicEnabled(on) {
  musicOn = on;
  if (on) startMusic();
  else stopMusic();
}

function startMusic() {
  if (musicTimer) return;
  musicTimer = setInterval(() => {
    if (!musicOn || !enabled) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    tone(BASS[musicStep % 4], 0.22, 'triangle', 0.055);
    tone(ARP[(musicStep * 2) % 4] * (musicStep % 8 < 4 ? 1 : 0.5), 0.12, 'sine', 0.035);
    musicStep++;
  }, 240);
}

function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}

export const sfx = {
  tap: () => tone(520, 0.08, 'triangle', 0.1),
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
