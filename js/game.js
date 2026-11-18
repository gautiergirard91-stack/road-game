import { THEMES, SKINS, WINDOWS } from './data.js';
import { buildPattern, judge, pointsFor, maxMissesFor } from './core.js';

const RESULT_STYLE = {
  perfect: { label: 'PARFAIT', color: '#ffd54a' },
  good: { label: 'BIEN', color: '#7ee081' },
  passable: { label: 'OK', color: '#9ecbff' },
};

const MODELS = {
  citadine: { w: 56, bodyH: 62, cabW: 0.66, cabH: 34, spoiler: false },
  berline: { w: 70, bodyH: 82, cabW: 0.72, cabH: 40, spoiler: false },
  sport: { w: 75, bodyH: 60, cabW: 0.58, cabH: 27, spoiler: true },
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
    this.theme = THEMES[opts.level.theme];
    this.skin = SKINS.find((s) => s.id === opts.skinId) || SKINS[0];
    this.mode = opts.mode || 'auto';
    this.effects = opts.effects || [];
    this.audio = opts.audio || {};
    this.onJudge = opts.onJudge || (() => {});
    this.onEnd = opts.onEnd || (() => {});
    this.onMiss = opts.onMiss || (() => {});
    this.onThreshold = opts.onThreshold || (() => {});
    this.running = false;
    this.paused = false;
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
    this.frontAxleY = this.wheelY - 64;
  }

  start() {
    const seed = (Date.now() % 2147483647) >>> 0;
    this.lines = buildPattern(this.level, seed, this.mode).map((l) => ({
      type: l.type,
      dist: l.dist,
      axle: l.axle,
      state: 'pending',
      result: null,
      flash: 0,
      glow: 0,
    }));
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
    this.pendingContinue = false;
    this.pendingStray = 0;
    this.slow = 1;
    this.effSpeed = this.level.speed;
    this.maxMisses = maxMissesFor(this.mode);
    const mm = MODELS[this.skin.model] || MODELS.berline;
    this.frontAxleY = this.wheelY - mm.bodyH + 18;
    this.carXFrac = CAR_LANE;
    this.blocker = null;
    this.oncoming = [];
    this.sameDir = [];
    this.tOncoming = 1.2;
    this.tSame = 4;
    this.scenery = [];
    for (let i = 0; i < 14; i++) this.scenery.push(this.makeScenery(true));
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
    };
  }

  hasEffect(id) {
    return this.effects.includes(id);
  }

  lineAxleY(line) {
    return this.mode !== 'auto' && line.axle === 'front' ? this.frontAxleY : this.wheelY;
  }

  lineY(line) {
    return this.lineAxleY(line) + this.distance - line.dist;
  }

  registerMiss(line) {
    if (line) line.state = 'missed';
    const ay = line ? this.lineAxleY(line) : this.wheelY;
    this.stats.misses++;
    this.combo = 0;
    this.popups.push({ text: 'RATÉ', y: ay - 70, life: 0.9, color: '#ff5c5c' });
    this.shake = 8;
    this.audio.miss?.();
    this.onMiss(this.stats.misses);
    if (this.stats.misses >= this.maxMisses && !this.pendingContinue) {
      this.pendingContinue = true;
      this.paused = true;
      this.onThreshold();
    }
  }

  update(dt) {
    if (!this.running || this.paused) return;
    this.time += dt;
    this.slow = Math.min(1, this.slow);
    this.effSpeed = this.level.speed * this.slow;
    this.distance += this.effSpeed * dt;
    const missPx = (this.effSpeed * WINDOWS.passable) / 1000;
    for (const line of this.lines) {
      if (line.state !== 'pending') continue;
      if (this.lineY(line) - this.lineAxleY(line) > missPx) {
        this.registerMiss(line);
        return;
      }
    }
    if (this.pendingStray > 0) {
      this.pendingStray -= dt;
      if (this.pendingStray <= 0) {
        this.pendingStray = 0;
        this.registerMiss(null);
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
    this.carXFrac += (CAR_LANE - this.carXFrac) * Math.min(1, dt * 3.5);
    const range = this.h + 240;
    for (const s of this.scenery) {
      if (s.dist + this.distance > this.h + 120) {
        Object.assign(s, this.makeScenery(false));
        s.dist -= range;
      }
    }
    if (this.hasEffect('trail')) this.spawnTrail();
    this.updateTraffic(dt);
    if (!this.running) return;
    const pending = this.lines.filter((l) => l.state === 'pending');
    if (pending.length === 0) {
      const last = this.lines[this.lines.length - 1];
      if (this.lineY(last) > this.lineAxleY(last) + 80) {
        this.stats.score = this.score;
        this.finish(true);
      }
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
    if (this.mode !== 'pilote') {
      this.sameDir = [];
      this.blocker = null;
      return;
    }
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
          lane: 'right',
        });
      }
    }
    for (const c of this.sameDir) {
      if (!c.overtaken) c.p += c.v * dt;
    }
    let blocker = null;
    for (const c of this.sameDir) {
      if (c.overtaken) continue;
      const sy = this.wheelY + this.distance - c.p;
      if (sy > this.wheelY + 120) continue;
      if (sy >= this.wheelY - BLOCK_RANGE) blocker = c;
    }
    this.blocker = blocker;
    if (blocker) {
      blocker.grace += dt;
      if (blocker.grace > GRACE_SECONDS) {
        this.slow = Math.max(0, this.slow - dt * 0.45);
        if (this.slow <= 0) {
          this.stats.score = this.score;
          this.finish('traffic');
          return;
        }
      }
    } else if (this.slow < 1) {
      this.slow = Math.min(1, this.slow + dt * 1.5);
    }
    this.sameDir = this.sameDir.filter((c) => this.wheelY + this.distance - c.p < this.h + 300);
  }

  swipeLeft() {
    if (!this.running || this.paused) return;
    this.pendingStray = 0;
    if (this.mode === 'pilote' && this.blocker && !this.blocker.overtaken) {
      this.blocker.overtaken = true;
      this.blocker.lane = 'left';
      this.stats.overtakes++;
      const bonus = 50 + this.combo * 5;
      this.score += bonus;
      this.stats.score = this.score;
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.popups.push({ text: `DÉPASSEMENT +${bonus}`, y: this.wheelY - 120, life: 0.9, color: '#54f0ff' });
      this.carXFrac = ONCOMING_LANE;
      this.shake = Math.max(this.shake, 4);
      this.audio.perfect?.();
      this.onJudge({ result: 'perfect', pts: bonus, combo: this.combo, score: this.score });
    }
  }

  resumeWithContinue() {
    this.stats.misses = 0;
    this.pendingContinue = false;
    this.paused = false;
    this.onMiss(0);
  }

  spawnTrail() {
    const cx = this.roadX + this.roadW * this.carXFrac;
    const cw = (MODELS[this.skin.model] || MODELS.berline).w;
    for (let i = 0; i < 2; i++) {
      this.particles.push({
        x: cx + (Math.random() - 0.5) * cw * 0.7,
        y: this.wheelY + 20 + Math.random() * 8,
        vx: (Math.random() - 0.5) * 30,
        vy: 60 + Math.random() * 90,
        life: 0.5 + Math.random() * 0.3,
        max: 0.8,
        color: this.skin.rainbow
          ? `hsl(${Math.round((this.time * 300 + Math.random() * 60) % 360)},90%,60%)`
          : this.skin.color,
        size: 3 + Math.random() * 4,
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
    if (!this.running || this.paused) return;
    const speed = this.effSpeed;
    const missPx = (speed * WINDOWS.passable) / 1000;
    let best = null;
    let bestAd = Infinity;
    for (const line of this.lines) {
      if (line.state !== 'pending') continue;
      const ad = Math.abs(this.distance - line.dist);
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
    if (this.mode !== 'auto' && best.axle !== zone) {
      this.registerMiss(best);
      return;
    }
    const ay = this.lineAxleY(best);
    const dy = this.lineY(best) - ay;
    const dtMs = (dy / speed) * 1000;
    const result = judge(dtMs);
    best.state = 'hit';
    best.result = result;
    best.flash = 0.3;
    if (this.hasEffect('glow')) best.glow = 0.4;
    let pts = pointsFor(result, this.combo);
    let label = RESULT_STYLE[result].label;
    if (this.slow < 1) {
      pts = Math.max(1, Math.round(pts * 0.2));
      label = `RALENTI ${label}`;
    } else {
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
      text: `${label} +${pts}`,
      y: ay - 70,
      life: 0.8,
      color: RESULT_STYLE[result].color,
    });
    if (this.hasEffect('shake')) this.shake = 5;
    if (this.hasEffect('confetti') && result === 'perfect') this.spawnConfetti();
    this.audio[result]?.();
    this.onJudge({ result, pts, combo: this.combo, score: this.score });
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
    this.drawLines();
    this.drawAxleGuides();
    this.drawTraffic();
    this.drawCar();
    this.drawParticles();
    this.drawPopups();
    ctx.restore();
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
    if (theme.scenery === 'trees') {
      ctx.fillStyle = '#6b4a2f';
      ctx.fillRect(-4 * k, -10 * k, 8 * k, 22 * k);
      ctx.fillStyle = s.hue > 0.5 ? '#2e7d43' : '#3f9e4d';
      ctx.beginPath();
      ctx.arc(0, -18 * k, 16 * k, 0, Math.PI * 2);
      ctx.arc(-9 * k, -10 * k, 11 * k, 0, Math.PI * 2);
      ctx.arc(9 * k, -10 * k, 11 * k, 0, Math.PI * 2);
      ctx.fill();
    } else if (theme.scenery === 'buildings' || theme.scenery === 'citynight') {
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
    } else if (theme.scenery === 'cacti') {
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
    } else if (theme.scenery === 'pines') {
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

  drawLines() {
    const { ctx, roadX, roadW, theme } = this;
    for (const line of this.lines) {
      const y = this.lineY(line);
      if (y < -90 || y > this.h + 90) continue;
      if (line.state === 'hit') {
        const st = RESULT_STYLE[line.result];
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
        ctx.strokeStyle = theme.lineEdge;
        ctx.fillStyle = theme.lineEdge;
        this.drawLineShape(line.type, y, roadX, roadW, false, true);
        ctx.strokeStyle = theme.line;
        ctx.fillStyle = theme.line;
        this.drawLineShape(line.type, y, roadX, roadW, false);
      }
    }
  }

  drawLineShape(type, y, roadX, roadW, filled, edgePass = false) {
    const { ctx } = this;
    const inset = edgePass ? 0 : 4;
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
      const lane = c.lane === 'left' ? ONCOMING_LANE : CAR_LANE;
      drawTrafficCar(ctx, roadX + roadW * lane, sy, c.w, c.color, false);
    }
  }

  drawCar() {
    const { ctx, roadX, roadW, wheelY, skin, theme } = this;
    const m = MODELS[skin.model] || MODELS.berline;
    const cx = roadX + roadW * this.carXFrac;
    const bw = m.w;
    const tier = skin.cost >= 1200 ? 3 : skin.cost >= 600 ? 2 : 1;
    const bob = Math.sin(this.time * 9) * 1.5;
    const baseY = wheelY + bob;
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
