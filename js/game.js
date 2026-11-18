import { THEMES, SKINS, WINDOWS } from './data.js';
import { buildPattern, judge, pointsFor } from './core.js';

const RESULT_STYLE = {
  perfect: { label: 'PARFAIT', color: '#ffd54a' },
  good: { label: 'BIEN', color: '#7ee081' },
  passable: { label: 'OK', color: '#9ecbff' },
};

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
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

export class Game {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.level = opts.level;
    this.theme = THEMES[opts.level.theme];
    this.skin = SKINS.find((s) => s.id === opts.skinId) || SKINS[0];
    this.effects = opts.effects || [];
    this.audio = opts.audio || {};
    this.onJudge = opts.onJudge || (() => {});
    this.onEnd = opts.onEnd || (() => {});
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
  }

  start() {
    const seed = (Date.now() % 2147483647) >>> 0;
    this.lines = buildPattern(this.level, seed).map((l) => ({
      type: l.type,
      dist: l.dist,
      state: 'pending',
      result: null,
      flash: 0,
      glow: 0,
    }));
    this.distance = 0;
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.stats = { perfects: 0, goods: 0, passables: 0, misses: 0, reactions: [], score: 0 };
    this.popups = [];
    this.particles = [];
    this.confetti = [];
    this.shake = 0;
    this.time = 0;
    this.running = true;
    this.paused = false;
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

  lineY(line) {
    return this.wheelY + this.distance - line.dist;
  }

  update(dt) {
    if (!this.running || this.paused) return;
    this.time += dt;
    const speed = this.level.speed;
    this.distance += speed * dt;
    const missPx = (speed * WINDOWS.passable) / 1000;
    for (const line of this.lines) {
      if (line.state !== 'pending') continue;
      if (this.lineY(line) - this.wheelY > missPx) {
        line.state = 'missed';
        this.stats.misses++;
        this.combo = 0;
        this.stats.score = this.score;
        this.finish(false);
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
    const range = this.h + 240;
    for (const s of this.scenery) {
      if (s.dist + this.distance > this.h + 120) {
        Object.assign(s, this.makeScenery(false));
        s.dist -= range;
      }
    }
    if (this.hasEffect('trail')) this.spawnTrail();
    const pending = this.lines.filter((l) => l.state === 'pending');
    if (pending.length === 0) {
      const last = this.lines[this.lines.length - 1];
      if (this.lineY(last) > this.wheelY + 80) {
        this.stats.score = this.score;
        this.finish(true);
      }
    }
  }

  spawnTrail() {
    const cx = this.roadX + this.roadW / 2;
    const cw = 62 * this.skin.width;
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
        x: this.roadX + Math.random() * this.roadW,
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

  tap() {
    if (!this.running || this.paused) return;
    const speed = this.level.speed;
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
      return;
    }
    const dy = this.distance - best.dist;
    const dtMs = (dy / speed) * 1000;
    const result = judge(dtMs);
    best.state = 'hit';
    best.result = result;
    best.flash = 0.3;
    if (this.hasEffect('glow')) best.glow = 0.4;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const pts = pointsFor(result, this.combo - 1);
    this.score += pts;
    this.stats.score = this.score;
    this.stats.reactions.push(Math.abs(dtMs));
    if (result === 'perfect') this.stats.perfects++;
    else if (result === 'good') this.stats.goods++;
    else this.stats.passables++;
    this.popups.push({
      text: `${RESULT_STYLE[result].label} +${pts}`,
      y: this.wheelY - 70,
      life: 0.8,
      color: RESULT_STYLE[result].color,
    });
    if (this.hasEffect('shake')) this.shake = 5;
    if (this.hasEffect('confetti') && result === 'perfect') this.spawnConfetti();
    this.audio[result]?.();
    this.onJudge({ result, pts, combo: this.combo, score: this.score });
  }

  finish(completed) {
    this.running = false;
    this.stats.completed = completed;
    this.audio[completed ? 'win' : 'fail']?.();
    this.onEnd({ ...this.stats, score: this.score, bestCombo: this.bestCombo, completed }, this.level);
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
    this.drawWheelGuide();
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

  drawWheelGuide() {
    const { ctx, roadX, roadW, wheelY } = this;
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(roadX + 5, wheelY - 2, roadW - 10, 4);
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
  }

  drawCar() {
    const { ctx, roadX, roadW, wheelY, skin, theme } = this;
    const cx = roadX + roadW / 2;
    const bw = 62 * skin.width;
    const bob = Math.sin(this.time * 9) * 1.5;
    const baseY = wheelY + bob;
    let bodyColor = skin.color;
    if (skin.rainbow) bodyColor = `hsl(${Math.round((this.time * 240) % 360)},85%,55%)`;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 12, bw * 0.62, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    if (theme.night) {
      const g = ctx.createRadialGradient(cx, baseY - 90, 10, cx, baseY - 90, 190);
      g.addColorStop(0, 'rgba(255,244,190,0.28)');
      g.addColorStop(1, 'rgba(255,244,190,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - bw * 0.32, baseY - 70);
      ctx.lineTo(cx + bw * 0.32, baseY - 70);
      ctx.lineTo(cx + bw * 0.9, baseY - 260);
      ctx.lineTo(cx - bw * 0.9, baseY - 260);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = skin.shine ? '#ffe9a0' : bodyColor;
    rr(ctx, cx - bw / 2, baseY - 78, bw, 72, 12);
    ctx.fill();
    ctx.fillStyle = bodyColor;
    rr(ctx, cx - bw / 2, baseY - 78, bw, 72, 12);
    ctx.fill();
    if (skin.shine) {
      const g = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
      g.addColorStop(0, '#f5c542');
      g.addColorStop(0.5, '#fff3c4');
      g.addColorStop(1, '#e0a92e');
      ctx.fillStyle = g;
      rr(ctx, cx - bw / 2, baseY - 78, bw, 72, 12);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    rr(ctx, cx - bw * 0.36, baseY - 108, bw * 0.72, 40, 10);
    ctx.fill();
    ctx.fillStyle = bodyColor;
    rr(ctx, cx - bw * 0.36, baseY - 110, bw * 0.72, 38, 10);
    ctx.fill();
    ctx.fillStyle = '#bfe6ff';
    rr(ctx, cx - bw * 0.27, baseY - 102, bw * 0.54, 20, 6);
    ctx.fill();
    ctx.fillStyle = theme.night ? '#ffe9a8' : '#fff8dc';
    ctx.beginPath();
    ctx.ellipse(cx - bw * 0.3, baseY - 74, 7, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + bw * 0.3, baseY - 74, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#14161f';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + sx * bw * 0.4, baseY, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8a93a6';
      ctx.beginPath();
      ctx.arc(cx + sx * bw * 0.4, baseY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#14161f';
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
