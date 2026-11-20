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
