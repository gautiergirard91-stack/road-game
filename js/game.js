import { THEMES, SKINS, WINDOWS } from './data.js';
import { buildPattern, judge, pointsFor, maxMissesFor, axleDelta } from './core.js';

const RESULT_STYLE = {
  perfect: { label: 'PARFAIT', color: '#ffd54a' },
  good: { label: 'BIEN', color: '#7ee081' },
  passable: { label: 'OK', color: '#9ecbff' },
};

export const MODELS = {
  citadine: { w: 56, bodyH: 62, cabW: 0.66, cabH: 34, spoiler: false },
  berline: { w: 70, bodyH: 82, cabW: 0.72, cabH: 40, spoiler: false },
  sport: { w: 75, bodyH: 60, cabW: 0.58, cabH: 27, spoiler: true },
  suv: { w: 78, bodyH: 86, cabW: 0.78, cabH: 46, spoiler: false },
  f1: { w: 86, bodyH: 30, cabW: 0.42, cabH: 20, spoiler: true },
};

const TRAFFIC_COLORS = ['#c94f4f', '#4f7ec9', '#c9b84f', '#7a4fc9', '#4fc9a8', '#b8b8b8', '#e07b39'];

const CAR_LANE = 0.72;
const ONCOMING_LANE = 0.28;
const BLOCK_RANGE = 240;
const GRACE_SECONDS = 1.0;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function shade(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const f = (v) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTrafficCar(ctx, x, y, w, color, down) {
  ctx.save();
  ctx.translate(x, y);
  if (down) ctx.scale(1, -1);
  const h = w * 1.55;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 6, w * 0.55, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  rr(ctx, -w / 2, -h / 2, w, h, 9);
  ctx.fill();
  const og = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  og.addColorStop(0, 'rgba(255,255,255,0.35)');
  og.addColorStop(0.45, 'rgba(255,255,255,0)');
  og.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = og;
  rr(ctx, -w / 2, -h / 2, w, h, 9);
  ctx.fill();
  ctx.fillStyle = '#bfe6ff';
  rr(ctx, -w * 0.36, -h * 0.16, w * 0.72, h * 0.22, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  rr(ctx, -w * 0.36, h * 0.18, w * 0.72, h * 0.14, 5);
  ctx.fill();
  ctx.fillStyle = '#14161f';
  for (const [sx, sy] of [[-1, -0.3], [1, -0.3], [-1, 0.3], [1, 0.3]]) {
    ctx.beginPath();
    ctx.arc(sx * w * 0.44, sy * h, 7.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = down ? '#fff3b0' : '#ff5c5c';
  const ly = down ? -h / 2 + 3 : h / 2 - 6;
  ctx.beginPath();
  ctx.ellipse(-w * 0.3, ly, 6, 3.5, 0, 0, Math.PI * 2);
  ctx.ellipse(w * 0.3, ly, 6, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export class Game {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.level = opts.level;
    this.theme = THEMES[opts.themeOverride] || THEMES[opts.level.theme];
    this.skin = SKINS.find((s) => s.id === opts.skinId) || SKINS[0];
    this.mode = opts.mode || 'auto';
    this.effects = opts.effects || [];
    this.windows = opts.windows || WINDOWS;
    this.access = opts.access || {};
    this.tutorial = opts.tutorial || false;
    this.audio = opts.audio || {};
    this.onJudge = opts.onJudge || (() => {});
    this.onEnd = opts.onEnd || (() => {});
    this.onMiss = opts.onMiss || (() => {});
    this.onThreshold = opts.onThreshold || (() => {});
    this.running = false;
    this.paused = false;
    this.tutHold = false;
    this.resize();
    this.stars = [];
    for (let i = 0; i < 60; i++) {
      this.stars.push({ x: (i * 97.3) % 1, y: (i * 57.7) % 1, r: 0.6 + ((i * 13) % 10) / 8 });
    }
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.roadW = Math.max(240, Math.min(w * 0.74, 460));
    this.roadX = (w - this.roadW) / 2;
    this.wheelY = Math.round(h * 0.78);
    const m = MODELS[this.skin ? this.skin.model : 'berline'] || MODELS.berline;
    this.frontAxleY = this.wheelY - m.bodyH - 16;
  }

  start() {
    const seed = (Date.now() % 2147483647) >>> 0;
    this.lines = buildPattern(this.level, seed, this.mode).map((l) => ({
      type: l.type,
      dist: l.dist,
      axle: l.axle,
      hits: { front: null, rear: null },
      state: 'pending',
      result: null,
      flash: 0,
      glow: 0,
    }));
    this.axles = this.mode === 'auto' ? ['rear'] : ['front', 'rear'];
    this.remaining = this.lines.length;
    this.lastOvertaken = null;
    this.distance = 0;
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.stats = { perfects: 0, goods: 0, passables: 0, misses: 0, overtakes: 0, reactions: [], score: 0 };
    this.popups = [];
    this.particles = [];
    this.confetti = [];
    this.shake = 0;
    this.time = 0;
    this.running = true;
    this.paused = false;
    this.tutHold = false;
    this.pendingContinue = false;
    this.pendingStray = 0;
    this.slow = 1;
    this.slowCause = null;
    this.effSpeed = this.level.speed;
    this.carXFrac = CAR_LANE;
    this.prevCarX = CAR_LANE;
    this.laneTarget = CAR_LANE;
    this.blocker = null;
    this.oncoming = [];
    this.sameDir = [];
    this.tOncoming = 1.2;
    this.tSame = 4;
    this.ped = null;
    this.autoStop = false;
    this.drops = [];
    this.maxMisses = maxMissesFor(this.mode);
    const mm = MODELS[this.skin.model] || MODELS.berline;
    this.frontAxleY = this.wheelY - mm.bodyH - 16;
    this.scenery = [];
    for (let i = 0; i < 22; i++) this.scenery.push(this.makeScenery(true));
  }

  makeScenery(anywhere) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const margin = Math.max(30, (this.w - this.roadW) / 2 - 50);
    return {
      side,
      x: side * (this.roadW / 2 + 26 + Math.random() * margin),
      dist: anywhere ? Math.random() * (this.h + 200) : -Math.random() * 120,
      size: 0.6 + Math.random() * 0.9,
      hue: Math.random(),
      kind: Math.random() < 0.22 ? 'lamp' : this.theme.scenery,
    };
  }

  hasEffect(id) {
    return this.effects.includes(id);
  }

  lineAxleY(axle) {
    return axle === 'front' ? this.frontAxleY : this.wheelY;
  }

  lineY(line) {
    return this.wheelY + this.distance - line.dist;
  }

  axleDelta(axle) {
    return axleDelta(this.wheelY, this.frontAxleY, axle);
  }

  registerMiss(line, axle) {
    if (line) line.hits[axle] = 'missed';
    const ay = line ? this.lineAxleY(axle) : this.wheelY;
    if (this.tutorial) {
      this.popups.push({ text: 'Réessaie !', y: ay - 70, life: 0.8, color: '#9ecbff' });
      this.audio.tap?.();
      this.onMiss(0);
      return;
    }
    this.stats.misses++;
    this.combo = 0;
    this.popups.push({ text: 'RATÉ', y: ay - 70, life: 0.9, color: '#ff5c5c' });
    this.shake = 8;
    this.audio.miss?.();
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    this.onMiss(this.stats.misses);
    if (this.stats.misses >= this.maxMisses && !this.pendingContinue) {
      this.pendingContinue = true;
      this.paused = true;
      this.onThreshold();
    }
  }

  update(dt) {
    if (!this.running || this.paused || this.tutHold) return;
    this.time += dt;
    const baseSpeed = this.level.endless
      ? Math.min(this.level.speed + this.distance * 0.02, this.level.speed * 2.4)
      : this.level.speed;
    this.effSpeed = baseSpeed * this.slow;
    this.distance += this.effSpeed * dt;
    const missPx = (this.effSpeed * this.windows.passable) / 1000;
    for (const line of this.lines) {
      if (line.state !== 'pending') continue;
      let missedNow = false;
      for (const axle of this.axles) {
        if (line.hits[axle]) continue;
        if (this.distance - line.dist + this.axleDelta(axle) > missPx) {
          this.registerMiss(line, axle);
          missedNow = true;
          break;
        }
      }
      if (missedNow) {
        if (this.axles.every((a) => line.hits[a])) {
          line.state = 'resolved';
          this.remaining--;
        }
        return;
      }
    }
    if (this.pendingStray > 0) {
      this.pendingStray -= dt;
      if (this.pendingStray <= 0) {
        this.pendingStray = 0;
        this.registerMiss(null, 'rear');
        return;
      }
    }
    for (const line of this.lines) {
      if (line.flash > 0) line.flash -= dt;
      if (line.glow > 0) line.glow -= dt;
    }
    for (const p of this.particles) {
      p.y += p.vy * dt;
      p.x += p.vx * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const c of this.confetti) {
      c.y += c.vy * dt;
      c.x += c.vx * dt;
      c.rot += dt * 6;
      c.life -= dt;
    }
    this.confetti = this.confetti.filter((c) => c.life > 0 && c.y < this.h + 20);
    for (const p of this.popups) {
      p.y -= 46 * dt;
      p.life -= dt;
    }
    this.popups = this.popups.filter((p) => p.life > 0);
    this.shake = Math.max(0, this.shake - dt * 28);
    // changement de voie quasi instantané pendant un dépassement (évite de traverser la voiture doublée)
    this.prevCarX = this.carXFrac;
    const laneRate = this.laneTarget === ONCOMING_LANE ? 18 : 4;
    this.carXFrac += (this.laneTarget - this.carXFrac) * Math.min(1, dt * laneRate);
    const range = this.h + 240;
    for (const s of this.scenery) {
      if (s.dist + this.distance > this.h + 120) {
        Object.assign(s, this.makeScenery(false));
        s.dist -= range;
      }
    }
    if (this.hasEffect('trail')) this.spawnTrail();
    this.updateWeather(dt);
    this.updatePedestrian(dt);
    this.updateTraffic(dt);
    if (!this.running) return;
    const pending = this.lines.filter((l) => l.state === 'pending');
    if (this.level.endless && pending.length < 8) this.extendPattern();
    if (pending.length === 0) {
      const last = this.lines[this.lines.length - 1];
      if (this.lineY(last) > this.wheelY + 80) {
        this.stats.score = this.score;
        this.finish(true);
      }
    }
  }

  extendPattern() {
    const last = this.lines[this.lines.length - 1];
    const chunk = buildPattern(
      {
        ...this.level,
        lines: 20,
        gapMin: Math.max(230, this.level.gapMin - this.distance * 0.004),
        gapMax: Math.max(320, this.level.gapMax - this.distance * 0.004),
      },
      (Math.random() * 1e9) >>> 0,
      this.mode
    );
    const offset = last.dist + 400;
    for (const l of chunk) {
      this.lines.push({ type: l.type, dist: l.dist + offset, axle: l.axle, hits: { front: null, rear: null }, state: 'pending', result: null, flash: 0, glow: 0 });
    }
    this.remaining += chunk.length;
  }

  updateWeather(dt) {
    const rain = this.hasEffect('rain');
    const snow = this.hasEffect('snowfall');
    if (!rain && !snow) {
      this.drops = [];
      return;
    }
    const target = rain ? 90 : 60;
    while (this.drops.length < target) {
      this.drops.push({ x: Math.random() * this.w, y: Math.random() * this.h, s: rain ? 500 + Math.random() * 400 : 60 + Math.random() * 80, r: rain ? 0 : 2 + Math.random() * 3 });
    }
    for (const d of this.drops) {
      d.y += d.s * dt;
      d.x += (rain ? -60 : 20) * dt;
      if (d.y > this.h) {
        d.y = -10;
        d.x = Math.random() * this.w;
      }
    }
  }

  drawWeather() {
    const { ctx } = this;
    if (this.hasEffect('rain')) {
      ctx.strokeStyle = 'rgba(180,210,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const d of this.drops) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 6, d.y + 14);
      }
      ctx.stroke();
    } else if (this.hasEffect('snowfall')) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (const d of this.drops) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  updatePedestrian(dt) {
    const cw = this.lines.find((l) => l.type === 'crosswalk' && l.state === 'pending');
    if (cw && !this.ped) {
      const y = this.lineY(cw);
      if (y > this.wheelY - 750 && y < this.wheelY - 250) {
        const fromLeft = Math.random() < 0.5;
        this.ped = {
          line: cw,
          x: fromLeft ? this.roadX - 30 : this.roadX + this.roadW + 30,
          dir: fromLeft ? 1 : -1,
          y: y + 16,
          speed: 70 + Math.random() * 50,
          color: TRAFFIC_COLORS[(Math.random() * TRAFFIC_COLORS.length) | 0],
          phase: Math.random() * 6,
        };
      }
    }
    if (!this.ped) {
      this.autoStop = false;
      return;
    }
    if (this.ped.line.state !== 'pending') {
      this.ped = null;
      this.autoStop = false;
      return;
    }
    this.ped.y = this.lineY(this.ped.line) + 16;
    this.ped.x += this.ped.dir * this.ped.speed * dt;
    this.ped.phase += dt * 9;
    // la voiture freine AVANT le passage piéton dès que le piéton approche de la route
    // (et tant que la voiture n'a pas encore atteint la ligne) -> elle ne s'arrête plus AU MILIEU du passage
    const cwY = this.lineY(this.ped.line);
    const pedNearRoad = this.ped.x > this.roadX - 90 && this.ped.x < this.roadX + this.roadW + 90;
    this.autoStop = pedNearRoad && cwY >= this.wheelY - 240 && cwY <= this.wheelY + 80;
    const past = this.ped.dir > 0 ? this.ped.x > this.roadX + this.roadW + 34 : this.ped.x < this.roadX - 34;
    if (past) {
      this.ped = null;
      this.autoStop = false;
    }
  }

  updateTraffic(dt) {
    this.tOncoming -= dt;
    if (this.tOncoming <= 0) {
      this.tOncoming = 1.3 + Math.random() * 1.7;
      if (this.oncoming.length < 4) {
        this.oncoming.push({
          p: this.distance + this.h + 240 + Math.random() * 400,
          v: -(220 + Math.random() * 140),
          color: TRAFFIC_COLORS[(Math.random() * TRAFFIC_COLORS.length) | 0],
          w: 54 + Math.random() * 16,
        });
      }
    }
    for (const c of this.oncoming) c.p += c.v * dt;
    this.oncoming = this.oncoming.filter((c) => this.wheelY + this.distance - c.p < this.h + 260);
    let blocker = null;
    if (this.mode === 'pilote') {
      this.tSame -= dt;
      if (this.tSame <= 0) {
        this.tSame = 5 + Math.random() * 5;
        if (!this.sameDir.some((c) => !c.overtaken)) {
          this.sameDir.push({
            p: this.distance + 650 + Math.random() * 450,
            v: this.level.speed * (0.5 + Math.random() * 0.2),
            color: TRAFFIC_COLORS[(Math.random() * TRAFFIC_COLORS.length) | 0],
            w: 56 + Math.random() * 16,
            overtaken: false,
            grace: 0,
          });
        }
      }
      for (const c of this.sameDir) {
        if (!c.overtaken) c.p += c.v * dt;
      }
      for (const c of this.sameDir) {
        if (c.overtaken) continue;
        const sy = this.wheelY + this.distance - c.p;
        if (sy > this.wheelY + 120) continue;
        if (sy >= this.wheelY - BLOCK_RANGE) blocker = c;
      }
      this.blocker = blocker;
      if (blocker) blocker.grace += dt;
      if (this.lastOvertaken) {
        const sy = this.wheelY + this.distance - this.lastOvertaken.p;
        if (sy > this.wheelY + 180) {
          this.laneTarget = CAR_LANE;
          this.lastOvertaken = null;
        }
      }
      this.sameDir = this.sameDir.filter((c) => this.wheelY + this.distance - c.p < this.h + 300);
    } else {
      this.sameDir = [];
      this.blocker = null;
    }
    const trafficPenalty = blocker && blocker.grace > GRACE_SECONDS;
    if (trafficPenalty) {
      this.slow = Math.max(0, this.slow - dt * 0.45);
      this.slowCause = 'traffic';
      if (this.slow <= 0) {
        if (this.tutorial) {
          this.slow = 0.3;
        } else {
          this.stats.score = this.score;
          this.finish('traffic');
          return;
        }
      }
    } else if (this.autoStop) {
      this.slow = Math.max(0, this.slow - dt * 2.5);
      this.slowCause = 'pedestrian';
    } else if (this.slow < 1) {
      this.slow = Math.min(1, this.slow + dt * 1.5);
      this.slowCause = null;
    }
  }

  swipeLeft() {
    if (!this.running || this.paused || this.tutHold) return;
    this.pendingStray = 0;
    if (this.mode !== 'pilote') return;
    // dépassement autorisé DÈS que la voiture à doubler est visible à l'écran
    let target = this.blocker && !this.blocker.overtaken ? this.blocker : null;
    if (!target) {
      for (const c of this.sameDir) {
        if (c.overtaken) continue;
        const sy = this.wheelY + this.distance - c.p;
        if (sy < this.h + 60) {
          target = c;
          break;
        }
      }
    }
    if (target) {
      target.overtaken = true;
      this.lastOvertaken = target;
      this.laneTarget = ONCOMING_LANE;
      this.stats.overtakes++;
      const bonus = 50 + this.combo * 5;
      this.score += bonus;
      this.stats.score = this.score;
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.popups.push({ text: `DÉPASSEMENT +${bonus}`, y: this.wheelY - 120, life: 0.9, color: '#54f0ff' });
      this.shake = Math.max(this.shake, 4);
      this.audio.perfect?.();
      this.onJudge({ result: 'perfect', pts: bonus, combo: this.combo, score: this.score, overtake: true });
    }
  }

  spawnLine(type, distAhead) {
    this.lines.push({
      type,
      dist: this.distance + distAhead,
      axle: 'rear',
      hits: { front: null, rear: null },
      state: 'pending',
      result: null,
      flash: 0,
      glow: 0,
    });
  }

  forceBlocker() {
    this.sameDir.push({
      p: this.distance + 420,
      v: this.level.speed * 0.55,
      color: '#4f7ec9',
      w: 60,
      overtaken: false,
      grace: 0,
    });
  }

  resumeWithContinue() {
    this.stats.misses = 0;
    this.pendingContinue = false;
    this.paused = false;
    this.onMiss(0);
  }

  spawnTrail() {
    if (this.particles.length > 220) return;
    const cx = this.roadX + this.roadW * this.carXFrac;
    const cw = (MODELS[this.skin.model] || MODELS.berline).w;
    const onFire = this.hasEffect('fire') && this.combo >= 10;
    for (let i = 0; i < (onFire ? 3 : 2); i++) {
      this.particles.push({
        x: cx + (Math.random() - 0.5) * cw * 0.7,
        y: this.wheelY + 20 + Math.random() * 8,
        vx: (Math.random() - 0.5) * (onFire ? 60 : 30),
        vy: onFire ? 130 + Math.random() * 130 : 60 + Math.random() * 90,
        life: 0.4 + Math.random() * (onFire ? 0.45 : 0.3),
        max: 0.8,
        color: onFire
          ? (Math.random() < 0.5 ? '#ff7b2f' : '#ffd54a')
          : this.skin.rainbow
            ? `hsl(${Math.round((this.time * 300 + Math.random() * 60) % 360)},90%,60%)`
            : this.skin.color,
        size: onFire ? 5 + Math.random() * 5 : 3 + Math.random() * 4,
      });
    }
  }

  spawnConfetti() {
    const colors = ['#ffd54a', '#ff5c8a', '#54f0ff', '#7ee081', '#c792ff'];
    for (let i = 0; i < 24; i++) {
      this.confetti.push({
        x: this.roadX + this.roadW * this.carXFrac + (Math.random() - 0.5) * 80,
        y: this.wheelY - 40 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 160,
        vy: 120 + Math.random() * 160,
        rot: Math.random() * 6,
        size: 5 + Math.random() * 5,
        color: colors[i % colors.length],
        life: 1.2 + Math.random() * 0.5,
      });
    }
  }

  tap(zone = 'rear') {
    if (!this.running || this.paused || this.tutHold) return;
    const axle = this.mode === 'auto' ? 'rear' : zone;
    const speed = this.effSpeed;
    const missPx = (speed * this.windows.passable) / 1000;
    let best = null;
    let bestAd = Infinity;
    for (const line of this.lines) {
      if (line.state !== 'pending' || line.hits[axle]) continue;
      const ad = Math.abs(this.distance - line.dist + this.axleDelta(axle));
      if (ad < bestAd) {
        bestAd = ad;
        best = line;
      }
    }
    if (!best || bestAd > missPx) {
      this.audio.tap?.();
      this.pendingStray = 0.25;
      return;
    }
    const ay = this.lineAxleY(axle);
    const dy = this.distance - best.dist + this.axleDelta(axle);
    const dtMs = (dy / speed) * 1000;
    const result = judge(dtMs, this.windows);
    best.hits[axle] = result;
    best.state = this.axles.every((a) => best.hits[a]) ? 'resolved' : 'pending';
    if (best.state === 'resolved') this.remaining--;
    best.result = result;
    best.flash = 0.3;
    if (this.hasEffect('glow')) best.glow = 0.4;
    let pts = pointsFor(result, this.combo);
    let label = RESULT_STYLE[result].label;
    if (this.slowCause === 'traffic' && this.slow < 1) {
      pts = Math.max(1, Math.round(pts * 0.2));
      label = `RALENTI ${label}`;
    } else if (result === 'perfect') {
      // le combo ne monte QUE sur un PARFAIT (le dépassement compte aussi, voir swipeLeft)
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
    }
    this.score += pts;
    this.stats.score = this.score;
    this.stats.reactions.push(Math.abs(dtMs));
    if (result === 'perfect') this.stats.perfects++;
    else if (result === 'good') this.stats.goods++;
    else this.stats.passables++;
    this.popups.push({
      text: `${axle === 'front' ? 'AV ' : 'AR '}${label} +${pts}`,
      y: ay - 70,
      life: 0.8,
      color: RESULT_STYLE[result].color,
    });
    if (this.hasEffect('shake')) this.shake = 5;
    if (this.hasEffect('confetti') && result === 'perfect') this.spawnConfetti();
    this.audio[result]?.();
    if (result === 'perfect' && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    this.onJudge({ result, pts, combo: this.combo, score: this.score, axle, type: best.type });
  }

  finish(completedOrReason) {
    this.running = false;
    const completed = completedOrReason === true;
    const reason = typeof completedOrReason === 'string' ? completedOrReason : completed ? 'complete' : 'miss';
    this.stats.completed = completed;
    this.stats.reason = reason;
    this.audio[completed ? 'win' : 'fail']?.();
    this.onEnd({ ...this.stats, score: this.score, bestCombo: this.bestCombo, completed, reason }, this.level);
  }

  render() {
    const { ctx, w, h } = this;
    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    this.drawBackground();
    this.drawRoad();
    this.drawSpeedStreaks();
    this.drawLines();
    this.drawAxleGuides();
    this.drawTraffic();
    this.drawPedestrian();
    this.drawCar();
    this.drawWeather();
    this.drawParticles();
    this.drawPopups();
    ctx.restore();
    // effet vignette cinéma : assombrit les bords de l'écran
    if (this.hasEffect('vignette')) {
      const g = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.45, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.78);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(4,7,18,0.45)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  drawBackground() {
    const { ctx, w, h, theme } = this;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, theme.skyTop);
    g.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    if (theme.night) {
      ctx.fillStyle = '#e8ecff';
      for (const s of this.stars) {
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(this.time * 2 + s.x * 20));
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h * 0.5, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#f4f1de';
      ctx.beginPath();
      ctx.arc(w * 0.82, h * 0.1, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.skyTop;
      ctx.beginPath();
      ctx.arc(w * 0.82 - 8, h * 0.1 - 5, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const s of this.scenery) {
      const y = s.dist + this.distance;
      if (y < -160 || y > h + 160) continue;
      this.drawSceneryItem(s, w / 2 + s.x, y);
    }
  }

  drawSceneryItem(s, x, y) {
    const { ctx, theme } = this;
    const k = s.size;
    ctx.save();
    ctx.translate(x, y);
    if (s.kind === 'lamp') {
      ctx.fillStyle = '#2b2f3a';
      ctx.fillRect(-2.5 * k, -46 * k, 5 * k, 46 * k);
      ctx.fillRect(-2.5 * k, -48 * k, 15 * k, 4 * k);
      if (theme.night) {
        const g = ctx.createRadialGradient(12 * k, -45 * k, 2, 12 * k, -45 * k, 20 * k);
        g.addColorStop(0, 'rgba(255,230,150,0.85)');
        g.addColorStop(1, 'rgba(255,230,150,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(12 * k, -45 * k, 20 * k, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = theme.night ? '#ffe696' : '#cfd4dd';
      ctx.beginPath();
      ctx.arc(12 * k, -45 * k, 4.5 * k, 0, Math.PI * 2);
      ctx.fill();
    } else if (s.kind === 'trees') {
      ctx.fillStyle = '#6b4a2f';
      ctx.fillRect(-4 * k, -10 * k, 8 * k, 22 * k);
      ctx.fillStyle = s.hue > 0.5 ? '#2e7d43' : '#3f9e4d';
      ctx.beginPath();
      ctx.arc(0, -18 * k, 16 * k, 0, Math.PI * 2);
      ctx.arc(-9 * k, -10 * k, 11 * k, 0, Math.PI * 2);
      ctx.arc(9 * k, -10 * k, 11 * k, 0, Math.PI * 2);
      ctx.fill();
    } else if (s.kind === 'buildings' || s.kind === 'citynight') {
      const bw = 46 * k;
      const bh = (70 + s.hue * 60) * k;
      ctx.fillStyle = theme.night ? '#0c0f22' : s.hue > 0.5 ? '#9aa1ad' : '#b0a48f';
      ctx.fillRect(-bw / 2, -bh, bw, bh);
      const cols = 4;
      const rows = Math.floor(bh / 18);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const lit = theme.night ? ((r * 7 + c * 13 + Math.floor(s.hue * 100)) % 5) < 2 : false;
          ctx.fillStyle = theme.night ? (lit ? '#ffd76b' : '#1a2038') : '#5d6472';
          ctx.fillRect(-bw / 2 + 5 + c * ((bw - 10) / cols), -bh + 6 + r * 18, (bw - 14) / cols, 10);
        }
      }
    } else if (s.kind === 'cacti') {
      ctx.fillStyle = '#3e7d4e';
      rr(ctx, -6 * k, -34 * k, 12 * k, 34 * k, 6 * k);
      ctx.fill();
      rr(ctx, -16 * k, -26 * k, 8 * k, 12 * k, 4 * k);
      ctx.fill();
      rr(ctx, 8 * k, -30 * k, 8 * k, 14 * k, 4 * k);
      ctx.fill();
      ctx.fillStyle = '#e3c188';
      ctx.beginPath();
      ctx.arc(0, 0, 14 * k, 0, Math.PI * 2);
      ctx.fill();
    } else if (s.kind === 'pines') {
      ctx.fillStyle = '#2c5e3f';
      for (let i = 0; i < 3; i++) {
        const ty = -i * 16 * k;
        const tw = (34 - i * 8) * k;
        ctx.beginPath();
        ctx.moveTo(-tw / 2, ty);
        ctx.lineTo(0, ty - 22 * k);
        ctx.lineTo(tw / 2, ty);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-8 * k, -46 * k);
      ctx.lineTo(0, -62 * k);
      ctx.lineTo(8 * k, -46 * k);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  drawRoad() {
    const { ctx, w, h, theme, roadX, roadW } = this;
    ctx.fillStyle = theme.shoulder;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = theme.road;
    ctx.fillRect(roadX, 0, roadW, h);
    ctx.fillStyle = theme.edge;
    ctx.fillRect(roadX, 0, 5, h);
    ctx.fillRect(roadX + roadW - 5, 0, 5, h);
    ctx.fillStyle = theme.centerLine;
    const dashH = 32;
    const period = 64;
    const off = this.distance % period;
    for (let y = -period + off; y < h + period; y += period) {
      ctx.fillRect(roadX + roadW / 2 - 3, y, 6, dashH);
    }
  }

  drawSpeedStreaks() {
    if (!this.effSpeed || this.effSpeed < 460) return;
    const { ctx } = this;
    const n = Math.min(10, Math.floor((this.effSpeed - 460) / 60) + 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const x = this.roadX + 10 + (i % 2) * (this.roadW - 20);
      const y = ((this.distance * 2.2 + i * 211) % (this.h + 80)) - 40;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 46);
      ctx.stroke();
    }
  }

  drawLines() {
    const { ctx, roadX, roadW, theme } = this;
    const firstPending = this.lines.find((l) => l.state === 'pending');
    for (const line of this.lines) {
      const y = this.lineY(line);
      if (y < -90 || y > this.h + 90) continue;
      if (line.state === 'resolved') {
        const st = RESULT_STYLE[line.result] || RESULT_STYLE.passable;
        ctx.globalAlpha = Math.max(0, line.flash / 0.3) * 0.9;
        ctx.strokeStyle = st.color;
        ctx.fillStyle = st.color;
        this.drawLineShape(line.type, y, roadX, roadW, true);
        ctx.globalAlpha = 1;
      } else {
        const glow = line.glow > 0 && this.hasEffect('glow');
        if (glow) {
          ctx.save();
          ctx.shadowColor = theme.line;
          ctx.shadowBlur = 22;
          ctx.strokeStyle = theme.lineEdge;
          ctx.fillStyle = theme.lineEdge;
          this.drawLineShape(line.type, y, roadX, roadW, false);
          ctx.restore();
        }
        const rb = this.hasEffect('rainbow');
        const hue = Math.round((this.time * 160 + y * 0.6) % 360);
        ctx.strokeStyle = rb ? `hsl(${hue},70%,22%)` : theme.lineEdge;
        ctx.fillStyle = ctx.strokeStyle;
        this.drawLineShape(line.type, y, roadX, roadW, false, true);
        ctx.strokeStyle = rb ? `hsl(${hue},95%,65%)` : theme.line;
        ctx.fillStyle = ctx.strokeStyle;
        this.drawLineShape(line.type, y, roadX, roadW, false);
        if (this.access.colorblind) {
          const mx = roadX + roadW / 2;
          ctx.fillStyle = theme.lineEdge;
          ctx.strokeStyle = theme.lineEdge;
          ctx.lineWidth = 3;
          if (line.type === 'band') {
            ctx.fillRect(mx - 7, y - 7, 14, 14);
          } else if (line.type === 'chevron') {
            ctx.beginPath();
            ctx.moveTo(mx, y - 9);
            ctx.lineTo(mx + 9, y);
            ctx.lineTo(mx, y + 9);
            ctx.lineTo(mx - 9, y);
            ctx.closePath();
            ctx.fill();
          } else if (line.type === 'crosswalk') {
            ctx.beginPath();
            ctx.arc(mx, y, 8, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.moveTo(mx, y - 9);
            ctx.lineTo(mx + 9, y + 7);
            ctx.lineTo(mx - 9, y + 7);
            ctx.closePath();
            ctx.fill();
          }
        }
        const dRear = y - this.wheelY;
        const approachPulse = dRear > -30 && dRear < 260 ? 0.22 + 0.3 * Math.abs(Math.sin(this.time * 6)) : 0;
        const tutorialPulse = this.tutorial && line === firstPending ? 0.4 + 0.4 * Math.abs(Math.sin(this.time * 8)) : 0;
        const pulse = Math.max(approachPulse, tutorialPulse);
        if (pulse > 0) {
          ctx.save();
          ctx.globalAlpha = pulse;
          ctx.shadowColor = theme.line;
          ctx.shadowBlur = 18;
          ctx.strokeStyle = theme.line;
          ctx.fillStyle = theme.line;
          this.drawLineShape(line.type, y, roadX, roadW, false);
          ctx.restore();
        }
      }
    }
  }

  drawLineShape(type, y, roadX, roadW, filled, edgePass = false) {
    const { ctx } = this;
    const inset = edgePass ? 0 : 4;
    if (type === 'crosswalk') {
      const h = edgePass ? 40 : 32;
      for (let x = roadX + 8; x + 24 <= roadX + roadW - 8; x += 42) {
        ctx.fillRect(x, y - h / 2, 24, h);
      }
      return;
    }
    if (type === 'band') {
      const h = edgePass ? 30 : 24;
      ctx.fillRect(roadX + 6 + inset, y - h / 2, roadW - 12 - inset * 2, h);
      return;
    }
    if (type === 'chevron') {
      const lw = edgePass ? 18 : 12;
      ctx.lineWidth = lw;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      const x0 = roadX + 12;
      const x1 = roadX + roadW - 12;
      const step = 44;
      let up = true;
      ctx.moveTo(x0, y + (up ? -9 : 9));
      for (let x = x0 + step; x <= x1; x += step) {
        up = !up;
        ctx.lineTo(x, y + (up ? -9 : 9));
      }
      ctx.lineTo(x1, y);
      ctx.stroke();
      return;
    }
    const dashW = 34;
    const gap = 22;
    const h = edgePass ? 16 : 10;
    for (let x = roadX + 10; x + dashW <= roadX + roadW - 10; x += dashW + gap) {
      ctx.fillRect(x, y - h / 2, dashW, h);
    }
  }

  drawAxleGuides() {
    const { ctx, roadX, roadW, wheelY, frontAxleY, mode } = this;
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(roadX + 5, wheelY - 2, roadW - 10, 4);
    if (mode !== 'auto') {
      ctx.fillStyle = 'rgba(84,240,255,0.35)';
      ctx.fillRect(roadX + 5, frontAxleY - 2, roadW - 10, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('AR', roadX + 8, wheelY - 8);
      ctx.fillStyle = 'rgba(84,240,255,0.9)';
      ctx.fillText('AV', roadX + 8, frontAxleY - 8);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(roadX - 2, wheelY - 8);
    ctx.lineTo(roadX - 14, wheelY);
    ctx.lineTo(roadX - 2, wheelY + 8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(roadX + roadW + 2, wheelY - 8);
    ctx.lineTo(roadX + roadW + 14, wheelY);
    ctx.lineTo(roadX + roadW + 2, wheelY + 8);
    ctx.closePath();
    ctx.fill();
    if (this.mode === 'pilote' && this.blocker && !this.blocker.overtaken && this.blocker.grace > GRACE_SECONDS) {
      ctx.fillStyle = `rgba(255,60,60,${0.5 + 0.5 * Math.sin(this.time * 10)})`;
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⬅ SWIPE POUR DOUBLER !', roadX + roadW / 2, this.h * 0.3);
    }
    if (this.autoStop && this.ped) {
      ctx.fillStyle = 'rgba(126,224,129,0.9)';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🚶 Laisse passer le piéton…', roadX + roadW / 2, this.h * 0.3);
    }
  }

  drawTraffic() {
    const { ctx, roadX, roadW, wheelY, distance, h } = this;
    for (const c of this.oncoming) {
      const sy = wheelY + distance - c.p;
      if (sy < -160 || sy > h + 160) continue;
      drawTrafficCar(ctx, roadX + roadW * ONCOMING_LANE, sy, c.w, c.color, true);
    }
    for (const c of this.sameDir) {
      const sy = wheelY + distance - c.p;
      if (sy < -160 || sy > h + 160) continue;
      drawTrafficCar(ctx, roadX + roadW * CAR_LANE, sy, c.w, c.color, false);
    }
  }

  drawPedestrian() {
    const p = this.ped;
    if (!p) return;
    const { ctx } = this;
    const legSwing = Math.sin(p.phase) * 4;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 13, 9, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.color;
    rr(ctx, -5, -6, 10, 15, 4);
    ctx.fill();
    ctx.fillStyle = '#2b2f3a';
    ctx.fillRect(-4.5, 8 + legSwing, 4, 7);
    ctx.fillRect(0.5, 8 - legSwing, 4, 7);
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(0, -11, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawCar() {
    const { ctx, roadX, roadW, wheelY, skin, theme } = this;
    const m = MODELS[skin.model] || MODELS.berline;
    const cx = roadX + roadW * this.carXFrac;
    const bw = m.w;
    const tier = skin.cost >= 1200 ? 3 : skin.cost >= 600 ? 2 : 1;
    const bob = Math.sin(this.time * 9) * 1.5;
    const baseY = wheelY + bob;
    // effet fantôme : silhouette de la position précédente pendant un changement de voie
    if (this.hasEffect('ghost') && Math.abs((this.prevCarX ?? this.carXFrac) - this.carXFrac) > 0.01) {
      ctx.fillStyle = 'rgba(180,220,255,0.12)';
      rr(ctx, roadX + roadW * this.prevCarX - bw / 2, baseY - m.bodyH, bw, m.bodyH + 7, 13);
      ctx.fill();
    }
    let bodyColor = skin.color;
    if (skin.rainbow) bodyColor = `hsl(${Math.round((this.time * 240) % 360)},85%,55%)`;
    const isHex = skin.color.startsWith('#');
    const dark = skin.shine || !isHex ? 'rgba(0,0,0,0.42)' : shade(skin.color, -48);
    const light = skin.shine || !isHex ? 'rgba(255,255,255,0.5)' : shade(skin.color, 48);
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 13, bw * 0.64, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    if (theme.night) {
      const g = ctx.createRadialGradient(cx, baseY - m.bodyH, 10, cx, baseY - m.bodyH, 210);
      g.addColorStop(0, 'rgba(255,244,190,0.3)');
      g.addColorStop(1, 'rgba(255,244,190,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - bw * 0.32, baseY - m.bodyH + 6);
      ctx.lineTo(cx + bw * 0.32, baseY - m.bodyH + 6);
      ctx.lineTo(cx + bw * 0.95, baseY - m.bodyH - 210);
      ctx.lineTo(cx - bw * 0.95, baseY - m.bodyH - 210);
      ctx.closePath();
      ctx.fill();
    }
    const cabX = cx - bw * m.cabW / 2;
    const cabY = baseY - m.bodyH - m.cabH - 2;
    const cg = ctx.createLinearGradient(0, cabY, 0, cabY + m.cabH + 10);
    cg.addColorStop(0, light);
    cg.addColorStop(1, dark);
    ctx.fillStyle = cg;
    rr(ctx, cabX, cabY, bw * m.cabW, m.cabH + 10, 11);
    ctx.fill();
    const bg = ctx.createLinearGradient(0, baseY - m.bodyH - m.cabH, 0, baseY + 8);
    if (skin.shine) {
      const hg = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
      hg.addColorStop(0, '#f5c542');
      hg.addColorStop(0.5, '#fff3c4');
      hg.addColorStop(1, '#e0a92e');
      ctx.fillStyle = hg;
    } else {
      bg.addColorStop(0, light);
      bg.addColorStop(0.55, bodyColor);
      bg.addColorStop(1, dark);
      ctx.fillStyle = bg;
    }
    rr(ctx, cx - bw / 2, baseY - m.bodyH, bw, m.bodyH + 7, 13);
    ctx.fill();
    if (tier >= 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(cx - 4, baseY - m.bodyH + 3, 8, m.bodyH + 1);
    }
    ctx.fillStyle = '#bfe6ff';
    const winH = Math.max(12, m.cabH - 4);
    rr(ctx, cabX + 6, cabY + 5, bw * m.cabW - 12, winH, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,15,30,0.6)';
    ctx.lineWidth = 2;
    rr(ctx, cabX + 6, cabY + 5, bw * m.cabW - 12, winH, 5);
    ctx.stroke();
    ctx.fillStyle = 'rgba(10,15,30,0.5)';
    ctx.fillRect(cx - 1.5, cabY + 5, 3, winH);
    if (tier >= 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.moveTo(cabX + 9, cabY + 5);
      ctx.lineTo(cabX + 24, cabY + 5);
      ctx.lineTo(cabX + 12, cabY + 5 + winH);
      ctx.lineTo(cabX + 7, cabY + 5 + winH);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = dark;
    rr(ctx, cx - bw / 2 - 6, cabY + 9, 6, 9, 2);
    ctx.fill();
    rr(ctx, cx + bw / 2, cabY + 9, 6, 9, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(cx - bw * 0.3, baseY - m.bodyH + 4, bw * 0.6, 5);
    if (tier >= 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      rr(ctx, cx - bw / 2 + 3, baseY + 2, bw - 6, 6, 3);
      ctx.fill();
    }
    if (m.spoiler && tier >= 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(cx - bw * 0.4, baseY + 3, 5, 9);
      ctx.fillRect(cx + bw * 0.4 - 5, baseY + 3, 5, 9);
      ctx.fillStyle = bodyColor;
      rr(ctx, cx - bw * 0.48, baseY + 9, bw * 0.96, 6, 3);
      ctx.fill();
    }
    ctx.fillStyle = theme.night ? '#ffe9a8' : '#fff8dc';
    ctx.beginPath();
    ctx.ellipse(cx - bw * 0.3, baseY - m.bodyH + 3, 8, 4.5, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + bw * 0.3, baseY - m.bodyH + 3, 8, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff5c5c';
    ctx.beginPath();
    ctx.ellipse(cx - bw * 0.32, baseY + 4, 7, 3.5, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + bw * 0.32, baseY + 4, 7, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const sx of [-1, 1]) {
      const wx = cx + sx * bw * 0.42;
      ctx.fillStyle = '#14161f';
      ctx.beginPath();
      ctx.arc(wx, baseY, 12, 0, Math.PI * 2);
      ctx.fill();
      if (tier >= 2) {
        ctx.fillStyle = '#c9d2e0';
        ctx.beginPath();
        ctx.arc(wx, baseY, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#5d6472';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(wx - 5, baseY);
        ctx.lineTo(wx + 5, baseY);
        ctx.moveTo(wx, baseY - 5);
        ctx.lineTo(wx, baseY + 5);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#8a93a6';
        ctx.beginPath();
        ctx.arc(wx, baseY, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    this.drawRemainingBadge(cx, baseY, m);
  }

  drawRemainingBadge(cx, baseY, m) {
    const { ctx } = this;
    const label = this.level.endless ? '∞' : String(Math.max(0, this.remaining));
    ctx.font = 'bold 15px system-ui, sans-serif';
    const tw = ctx.measureText(label).width + 18;
    const px = cx - tw / 2;
    const py = baseY - m.bodyH - m.cabH - 28;
    ctx.fillStyle = 'rgba(13,18,38,0.88)';
    rr(ctx, px, py, tw, 23, 11);
    ctx.fill();
    ctx.strokeStyle = '#ffd54a';
    ctx.lineWidth = 1.5;
    rr(ctx, px, py, tw, 23, 11);
    ctx.stroke();
    ctx.fillStyle = '#ffd54a';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, py + 16);
  }

  drawParticles() {
    const { ctx } = this;
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.life / p.max), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const c of this.confetti) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.globalAlpha = Math.min(1, c.life);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  drawPopups() {
    const { ctx, roadX, roadW } = this;
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px system-ui, sans-serif';
    for (const p of this.popups) {
      ctx.globalAlpha = Math.min(1, p.life / 0.4);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 5;
      ctx.strokeText(p.text, roadX + roadW / 2, p.y);
      ctx.fillText(p.text, roadX + roadW / 2, p.y);
    }
    ctx.globalAlpha = 1;
  }
}
