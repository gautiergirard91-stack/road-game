import { THEMES, SKINS, WINDOWS } from './data.js';
import { buildPattern, judge, pointsFor, maxMissesFor, axleDelta, mulberry32, levelSeed, makeInputBuffer } from './core.js';

const RESULT_STYLE = {
  perfect: { label: 'PARFAIT', color: '#ffd54a' },
  good: { label: 'BIEN', color: '#7ee081' },
  passable: { label: 'OK', color: '#9ecbff' },
};

export const MODELS = {
  // v1.3.14 : vue de dessus — bodyH = longueur de la voiture (toujours > w = largeur)
  citadine: { w: 46, bodyH: 92, cabW: 0.8, cabH: 34, spoiler: false },
  berline: { w: 52, bodyH: 110, cabW: 0.84, cabH: 44, spoiler: false },
  sport: { w: 54, bodyH: 102, cabW: 0.72, cabH: 32, spoiler: true },
  suv: { w: 60, bodyH: 116, cabW: 0.88, cabH: 50, spoiler: false },
  f1: { w: 64, bodyH: 122, cabW: 0.52, cabH: 24, spoiler: true },
  // v1.3.15 : nouveaux modèles top-down (box = caisse, open = cockpit ouvert, bigWheels = grosses roues)
  camion: { w: 64, bodyH: 128, cabW: 0.9, cabH: 30, spoiler: false, box: true },
  van: { w: 58, bodyH: 118, cabW: 0.78, cabH: 34, spoiler: false, box: true },
  decapotable: { w: 50, bodyH: 100, cabW: 0.78, cabH: 30, spoiler: false, open: true },
  kart: { w: 44, bodyH: 74, cabW: 0.7, cabH: 22, spoiler: false, open: true },
  limo: { w: 54, bodyH: 150, cabW: 0.9, cabH: 60, spoiler: false },
  '2cv': { w: 48, bodyH: 88, cabW: 0.86, cabH: 36, spoiler: false },
  monster: { w: 66, bodyH: 108, cabW: 0.8, cabH: 34, spoiler: false, bigWheels: true },
  supercar: { w: 56, bodyH: 106, cabW: 0.62, cabH: 28, spoiler: true },
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

// v1.3.12 : styles de rendu de la voiture (du photoréaliste au "blocs")
export const CAR_STYLES = ['photo', 'flat', 'neon', 'pixel', 'retro', 'toy', 'holo'];
export const CAR_STYLE_LABEL = {
  photo: '', // v1.3.50 : libellé 'photo' vidé — la boutique/garage n'affichent plus que le modèle
  flat: 'Blocs (classique)',
  neon: 'Néon',
  pixel: 'Pixel 8-bit',
  retro: 'Rétro 80s',
  toy: 'Jouet plastique',
  holo: 'Hologramme',
};

// Peint la voiture en VUE DE DESSUS : centrée en cx, arrière de la voiture au niveau baseY.
// m = MODELS[...] { w (largeur), bodyH (longueur), cabW, cabH, spoiler } ; col = { color, dark, light, shine, tier, time }
function paintCar(ctx, cx, baseY, m, col, style) {
  const bw = m.w;
  const len = m.bodyH;
  const top = baseY - len; // nez de la voiture (haut de l'écran)
  const cabW = bw * m.cabW;
  const cabX = cx - cabW / 2;
  const hoodR = top + len * 0.24; // fin du capot = pare-brise
  const roofF = top + len * 0.34; // début du toit
  const roofR = top + len * 0.66; // fin du toit
  const trunkF = top + len * 0.76; // lunette arrière
  const wheelScale = m.bigWheels ? 1.5 : 1;
  const wheelW = Math.max(8, bw * 0.17) * wheelScale;
  const wheelH = Math.max(14, len * 0.15) * wheelScale;
  const axleF = top + len * 0.17; // essieu avant
  const axleR = baseY - len * 0.13; // essieu arrière

  const glass = (y0, y1) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#dff1ff');
    g.addColorStop(1, '#5f83a8');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cabX + 4, y0);
    ctx.lineTo(cx + cabW / 2 - 4, y0);
    ctx.lineTo(cx + cabW / 2 - 2, y1);
    ctx.lineTo(cabX + 2, y1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,15,30,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  const drawWheel = (wx, wy) => {
    ctx.fillStyle = '#14161f';
    rr(ctx, wx - wheelW / 2, wy - wheelH / 2, wheelW, wheelH, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    rr(ctx, wx - wheelW / 2 + 1.5, wy - wheelH / 2 + 1.5, wheelW - 3, 3.5, 2);
    ctx.fill();
  };

  if (style === 'neon') {
    // v1.3.65 : pas de shadowBlur (trop lent sur mobile) — halo = trait translucide en plus
    ctx.save();
    ctx.fillStyle = '#0b0d16';
    rr(ctx, cx - bw / 2, top, bw, len, 12);
    ctx.fill();
    ctx.strokeStyle = col.color;
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.35;
    rr(ctx, cx - bw / 2, top, bw, len, 12);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2.5;
    rr(ctx, cx - bw / 2, top, bw, len, 12);
    ctx.stroke();
    ctx.fillStyle = 'rgba(84,240,255,0.85)';
    rr(ctx, cabX + 3, roofF, cabW - 6, roofR - roofF, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(84,240,255,0.6)';
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.4;
    rr(ctx, cabX + 3, roofF, cabW - 6, roofR - roofF, 5);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.strokeStyle = col.color;
    ctx.lineWidth = 2;
    for (const ay of [axleF, axleR]) {
      for (const sx of [-1, 1]) {
        ctx.strokeRect(cx + sx * (bw / 2 + wheelW * 0.35) - wheelW / 2, ay - wheelH / 2, wheelW, wheelH);
      }
    }
    ctx.restore();
    return;
  }

  if (style === 'holo') {
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = 'rgba(120,230,255,0.22)';
    rr(ctx, cx - bw / 2, top, bw, len, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(158,240,255,0.95)';
    ctx.lineWidth = 2;
    rr(ctx, cx - bw / 2, top, bw, len, 12);
    ctx.stroke();
    ctx.fillStyle = 'rgba(190,245,255,0.5)';
    rr(ctx, cabX + 3, roofF, cabW - 6, roofR - roofF, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(158,240,255,0.3)';
    ctx.lineWidth = 1;
    for (let y = top + 3; y < baseY; y += 4) {
      ctx.beginPath();
      ctx.moveTo(cx - bw / 2 + 3, y);
      ctx.lineTo(cx + bw / 2 - 3, y);
      ctx.stroke();
    }
    for (const ay of [axleF, axleR]) {
      for (const sx of [-1, 1]) {
        ctx.fillStyle = 'rgba(120,230,255,0.4)';
        rr(ctx, cx + sx * (bw / 2 + wheelW * 0.35) - wheelW / 2, ay - wheelH / 2, wheelW, wheelH, 3);
        ctx.fill();
      }
    }
    ctx.restore();
    return;
  }

  if (style === 'pixel') {
    const s = 4;
    const q = (v) => Math.round(v / s) * s;
    const bands = [
      [0.24, col.light],
      [0.10, '#bfe6ff'],
      [0.32, col.color],
      [0.10, '#7fa8cc'],
      [0.24, col.dark],
    ];
    let y = top;
    for (const [f, c] of bands) {
      ctx.fillStyle = c;
      ctx.fillRect(q(cx - bw / 2), q(y), q(bw), q(len * f) + 1);
      y += len * f;
    }
    ctx.fillStyle = '#14161f';
    for (const ay of [axleF, axleR]) {
      for (const sx of [-1, 1]) {
        ctx.fillRect(q(cx + sx * (bw / 2 + 3)) - 4, q(ay) - 6, 8, 12);
      }
    }
    ctx.fillStyle = '#fff8dc';
    ctx.fillRect(q(cx - bw * 0.3) - 4, q(top) + 2, 8, 5);
    ctx.fillRect(q(cx + bw * 0.3) - 4, q(top) + 2, 8, 5);
    return;
  }

  // ---- styles matière : photo / flat / retro / toy ----
  const round = style === 'toy' ? 16 : style === 'retro' ? 8 : 12;
  const bg = ctx.createLinearGradient(0, top, 0, baseY);
  if (col.shine) {
    bg.addColorStop(0, '#fff3c4');
    bg.addColorStop(0.5, '#f5c542');
    bg.addColorStop(1, '#e0a92e');
  } else if (style === 'photo') {
    bg.addColorStop(0, col.light);
    bg.addColorStop(0.25, col.color);
    bg.addColorStop(0.8, col.color);
    bg.addColorStop(1, col.dark);
  } else {
    bg.addColorStop(0, col.light);
    bg.addColorStop(0.5, col.color);
    bg.addColorStop(1, col.dark);
  }
  ctx.fillStyle = bg;
  rr(ctx, cx - bw / 2, top, bw, len, round);
  ctx.fill();

  if (style === 'photo') {
    ctx.save();
    rr(ctx, cx - bw / 2, top, bw, len, round);
    ctx.clip();
    const hg = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
    hg.addColorStop(0, 'rgba(255,255,255,0.22)');
    hg.addColorStop(0.5, 'rgba(255,255,255,0)');
    hg.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = hg;
    ctx.fillRect(cx - bw / 2, top, bw, len);
    // v1.3.36 : balayage spéculaire lent quand col.time > 0 (aperçus animés boutique/garage) ;
    // à time = 0 (rendu statique) rien n'est dessiné de plus -> rendu identique à avant
    const tt = Number.isFinite(col.time) ? col.time : 0;
    if (tt > 0) {
      const sx = cx - bw + ((tt * 22) % (bw * 2));
      const sg = ctx.createLinearGradient(sx - bw * 0.22, 0, sx + bw * 0.22, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(0.5, 'rgba(255,255,255,0.15)');
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(cx - bw / 2, top, bw, len);
    }
    const sg = ctx.createLinearGradient(0, top, 0, hoodR + 10);
    sg.addColorStop(0, 'rgba(255,255,255,0.4)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(cx - bw / 2, top, bw, hoodR - top + 10);
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(cx - bw * 0.3, top + 3, bw * 0.6, 4);
  }

  if (style === 'retro' || (m.spoiler && col.tier >= 2)) {
    ctx.fillStyle = style === 'retro' ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.65)';
    ctx.fillRect(cx - 7, top + 5, 5, len - 10);
    ctx.fillRect(cx + 2, top + 5, 5, len - 10);
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2 + 4, hoodR);
  ctx.lineTo(cx + bw / 2 - 4, hoodR);
  ctx.stroke();

  glass(hoodR + 1, roofF);
  if (m.box) {
    // caisse de camion / fourgon
    ctx.fillStyle = style === 'photo' ? col.light : col.color;
    rr(ctx, cx - bw / 2 + 3, top + len * 0.3, bw - 6, len * 0.68, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    rr(ctx, cx - bw / 2 + 3, top + len * 0.3, bw - 6, len * 0.68, 5);
    ctx.stroke();
  } else if (m.open) {
    // décapotable / kart : cockpit ouvert avec 2 sièges
    ctx.fillStyle = 'rgba(8,10,18,0.85)';
    rr(ctx, cabX + 3, roofF, cabW - 6, roofR - roofF, 5);
    ctx.fill();
    ctx.fillStyle = col.dark;
    rr(ctx, cabX + 6, roofF + 4, 8, 10, 3);
    ctx.fill();
    rr(ctx, cx + cabW / 2 - 14, roofF + 4, 8, 10, 3);
    ctx.fill();
  } else {
    glass(roofR, trunkF);
    ctx.fillStyle = col.shine ? '#ffe9a8' : style === 'photo' ? col.light : col.color;
    rr(ctx, cabX + 2, roofF, cabW - 4, roofR - roofF, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    rr(ctx, cabX + 2, roofF, cabW - 4, roofR - roofF, 6);
    ctx.stroke();
    if (style === 'photo') {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(cx, roofF + (roofR - roofF) * 0.3, cabW * 0.3, (roofR - roofF) * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (style === 'toy') {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(cx - bw * 0.15, top + len * 0.12, bw * 0.14, len * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (style === 'photo' || style === 'toy') {
    ctx.fillStyle = col.dark;
    rr(ctx, cx - bw / 2 - 5, roofF + 3, 5, 9, 2);
    ctx.fill();
    rr(ctx, cx + bw / 2, roofF + 3, 5, 9, 2);
    ctx.fill();
  }

  if (m.spoiler) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(cx - bw * 0.3, baseY - 4, 4, 8);
    ctx.fillRect(cx + bw * 0.3 - 4, baseY - 4, 4, 8);
    ctx.fillStyle = col.dark;
    rr(ctx, cx - bw * 0.62, baseY + 3, bw * 1.24, 7, 3);
    ctx.fill();
  }

  if (style === 'retro') {
    ctx.fillStyle = '#fff3b0';
    ctx.strokeStyle = '#c8ccd4';
    ctx.lineWidth = 2;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + sx * bw * 0.3, top + 7, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (style === 'photo') {
    for (const sx of [-1, 1]) {
      const hx = cx + sx * bw * 0.3;
      const hy = top + 6;
      const halo = ctx.createRadialGradient(hx, hy, 1, hx, hy, 10);
      halo.addColorStop(0, 'rgba(255,248,220,0.9)');
      halo.addColorStop(1, 'rgba(255,248,220,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(hx, hy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff8dc';
      ctx.beginPath();
      ctx.ellipse(hx, hy, 6, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#fff8dc';
    ctx.beginPath();
    ctx.ellipse(cx - bw * 0.3, top + 5, 6, 3.5, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + bw * 0.3, top + 5, 6, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ff5c5c';
  ctx.beginPath();
  ctx.ellipse(cx - bw * 0.32, baseY - 5, 6, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + bw * 0.32, baseY - 5, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  for (const ay of [axleF, axleR]) {
    drawWheel(cx - bw / 2 - wheelW * 0.35, ay);
    drawWheel(cx + bw / 2 + wheelW * 0.35, ay);
  }
}

// v1.3.13 : aperçu réel de la voiture dans la boutique — mini canvas rendu avec le même paintCar que le jeu
// v1.3.36 : t = temps (s) pour l'aperçu ANIMÉ (petit flottement + shine/rainbow qui bougent via paintCar) ;
// w/h optionnels (le garage affiche les voitures en plus grand). t=0 -> rendu statique.
export function renderCarPreview(canvas, skin, t = 0, w = 56, h = 64) {
  const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
  const cssW = w;
  const cssH = h;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  const m = MODELS[skin.model] || MODELS.berline;
  const totalH = m.bodyH + 18;
  const s = Math.min((cssW - 12) / m.w, (cssH - 12) / totalH);
  const isHex = (skin.color || '').startsWith('#');
  const bob = Math.sin(t * 3) * 1.5; // v1.3.36 : flottement quand animé
  ctx.save();
  ctx.translate(cssW / 2, cssH - 8 - 10 * s + bob);
  ctx.scale(s, s);
  paintCar(ctx, 0, 0, m, {
    color: skin.rainbow ? '#ff5c8a' : skin.color,
    dark: skin.shine || !isHex ? 'rgba(0,0,0,0.42)' : shade(skin.color, -48),
    light: skin.shine || !isHex ? 'rgba(255,255,255,0.5)' : shade(skin.color, 48),
    shine: Boolean(skin.shine),
    tier: 3,
    time: t, // v1.3.36 : transmis à paintCar (arc-en-ciel animé, reflets)
  }, skin.style || 'photo');
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(cssW / 2, cssH - 4 + bob * 0.3, m.w * 0.55 * s, 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

// v1.3.16 : aperçu réel d'un effet visuel dans la boutique (mini scène : route + ligne + effet)
// v1.3.36 : t = temps (s) pour l'aperçu ANIMÉ (pluie qui tombe, confettis, flammes…). t=0 -> statique.
export function renderEffectPreview(canvas, fx, t = 0) {
  const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
  const cssW = 56;
  const cssH = 64;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const tt = Number.isFinite(t) ? t : 0; // v1.3.36
  const id = fx.id;
  // fond : route verticale sombre
  const bg = ctx.createLinearGradient(0, 0, 0, cssH);
  bg.addColorStop(0, '#232c4d');
  bg.addColorStop(1, '#141a38');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.fillStyle = '#0d1130';
  ctx.fillRect(0, 0, 7, cssH);
  ctx.fillRect(cssW - 7, 0, 7, cssH);
  // ligne pointillée (arc-en-ciel ou lumineuse selon l'effet)
  const lineY = Math.round(cssH * 0.28);
  if (id === 'rainbow') {
    // v1.3.36 : les couleurs défilent quand animé
    for (let x = 9, i = 0; x < cssW - 9; x += 8, i++) {
      ctx.fillStyle = `hsl(${Math.round((i * 60 + tt * 120) % 360)},90%,65%)`;
      ctx.fillRect(x, lineY, 5, 3);
    }
  } else {
    if (id === 'glow') {
      ctx.shadowColor = '#ffd54a';
      ctx.shadowBlur = 9 + Math.sin(tt * 4) * 3; // v1.3.36 : halo qui pulse (9 à t=0)
    }
    ctx.fillStyle = '#f5f7ff';
    for (let x = 9; x < cssW - 9; x += 8) ctx.fillRect(x, lineY, 5, 3);
    ctx.shadowBlur = 0;
  }
  // v1.3.17 : PAS de voiture dans l'aperçu — seulement l'effet lui-même
  if (id === 'shake') {
    // la ligne "vibre" : 2 tracés fantômes décalés (v1.3.36 : le décalage oscille)
    const dx0 = Math.sin(tt * 20) * 2.5;
    ctx.fillStyle = '#f5f7ff';
    for (const dx of [-2.5 + dx0, 2.5 - dx0]) {
      ctx.globalAlpha = 0.35;
      for (let x = 9 + dx; x < cssW - 9; x += 8) ctx.fillRect(x, lineY, 5, 3);
    }
    ctx.globalAlpha = 1;
  }
  if (id === 'ghost') {
    // silhouette fantôme de l'ancienne position (v1.3.36 : opacité qui pulse)
    ctx.fillStyle = `rgba(180,220,255,${0.18 + 0.1 * Math.abs(Math.sin(tt * 2))})`;
    rr(ctx, cssW / 2 - 20, cssH * 0.55, 13, 26, 6);
    ctx.fill();
  }
  // l'effet par-dessus
  if (id === 'trail') {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = `rgba(158,203,255,${0.5 - i * 0.08})`;
      ctx.beginPath();
      // v1.3.36 : les particules remontent le long de la route quand animé
      const y = cssH - 1 - ((i * 3.2 + tt * 40) % (cssH * 0.55));
      ctx.arc(cssW / 2 + Math.sin(tt * 2 + i * 1.7) * 3, y, Math.max(0.6, 2.2 - i * 0.25), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === 'confetti') {
    const cols = ['#ff5c8a', '#ffd54a', '#7ee081', '#54f0ff', '#c792ff'];
    for (let i = 0; i < 9; i++) {
      ctx.save();
      // v1.3.36 : les confettis tombent et tournent quand animé
      ctx.translate(10 + ((i * 37) % (cssW - 20)), 6 + ((i * 23 + tt * 26) % Math.round(cssH * 0.4)));
      ctx.rotate(i * 0.7 + tt * 2);
      ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(-2, -1, 4, 2);
      ctx.restore();
    }
  } else if (id === 'rain') {
    ctx.strokeStyle = 'rgba(130,180,255,0.55)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const x = 8 + ((i * 29) % (cssW - 16));
      const y = (i * 17 + tt * 130) % cssH; // v1.3.36 : la pluie tombe
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + 7);
      ctx.stroke();
    }
  } else if (id === 'snowfall') {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 12; i++) {
      // v1.3.36 : les flocons tombent et oscillent quand animé
      const x = 6 + ((i * 31) % (cssW - 12)) + Math.sin(tt * 2 + i) * 2;
      const y = (i * 19 + tt * 24) % cssH;
      ctx.beginPath();
      ctx.arc(x, y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === 'fire') {
    for (let i = 0; i < 3; i++) {
      const fx0 = cssW / 2 + (i - 1) * 5;
      const hgt = 8 + ((i * 13 + tt * 12) % 6); // v1.3.36 : flammes qui dansent
      ctx.fillStyle = i % 2 ? '#ff9f1c' : '#ff5c1c';
      ctx.beginPath();
      ctx.moveTo(fx0 - 2.5, cssH - 1);
      ctx.lineTo(fx0, cssH - 1 - hgt);
      ctx.lineTo(fx0 + 2.5, cssH - 1);
      ctx.closePath();
      ctx.fill();
    }
  } else if (id === 'vignette') {
    const vr = cssH * (0.75 + Math.sin(tt * 2) * 0.05); // v1.3.36 : respiration de la vignette
    const vg = ctx.createRadialGradient(cssW / 2, cssH / 2, 8, cssW / 2, cssH / 2, vr);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, cssW, cssH);
  }
}

function previewSetup(canvas, w = 56, h = 64) {
  const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
  const cssW = w;
  const cssH = h;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, cssW, cssH };
}

// v1.3.17 : aperçu d'un thème de route (mini route avec les VRAIES couleurs du thème)
// v1.3.36 : t = temps (s) optionnel — la ligne centrale défile et les étoiles scintillent (t=0 -> statique)
export function renderThemePreview(canvas, themeId, w, h, t = 0) {
  const th = THEMES[themeId] || THEMES.autoroute;
  const { ctx, cssW, cssH } = previewSetup(canvas, w, h);
  const tt = Number.isFinite(t) ? t : 0; // v1.3.36
  const horizon = cssH * 0.42;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, th.skyTop);
  sky.addColorStop(1, th.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, cssW, horizon);
  if (th.night) {
    for (let i = 0; i < 8; i++) {
      // v1.3.36 : scintillement des étoiles quand animé
      ctx.fillStyle = `rgba(255,255,255,${0.45 + 0.45 * Math.abs(Math.sin(tt * 3 + i))})`;
      ctx.beginPath();
      ctx.arc(4 + ((i * 23) % (cssW - 8)), (i * 11) % Math.round(horizon * 0.9), 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // bas-côté + route
  ctx.fillStyle = th.shoulder;
  ctx.fillRect(0, horizon, cssW, cssH * 0.08);
  ctx.fillStyle = th.road;
  ctx.fillRect(0, horizon + cssH * 0.08, cssW, cssH);
  // bandes de rive + ligne centrale (v1.3.36 : défile vers le bas quand animé)
  ctx.fillStyle = th.edge;
  ctx.fillRect(0, horizon + cssH * 0.08, 4, cssH);
  ctx.fillRect(cssW - 4, horizon + cssH * 0.08, 4, cssH);
  ctx.fillStyle = th.centerLine;
  const scroll = (tt * 40) % 10;
  for (let y = horizon + cssH * 0.1 + scroll; y < cssH; y += 10) ctx.fillRect(cssW / 2 - 1.5, y, 3, 6);
  // la ligne blanche du jeu
  ctx.fillStyle = th.line;
  for (let x = 10; x < cssW - 10; x += 8) ctx.fillRect(x, Math.round(cssH * 0.74), 5, 3);
  // décor selon le type de thème
  if (th.scenery === 'trees' || th.scenery === 'pines') {
    ctx.fillStyle = th.night ? '#0e2a1e' : '#2e7d46';
    for (let i = 0; i < 3; i++) {
      const x = 9 + i * 18;
      const hgt = 9 + ((i * 5) % 5);
      ctx.beginPath();
      ctx.moveTo(x, horizon - hgt);
      ctx.lineTo(x + 5, horizon);
      ctx.lineTo(x - 5, horizon);
      ctx.closePath();
      ctx.fill();
    }
  } else if (th.scenery === 'buildings' || th.scenery === 'citynight') {
    for (let i = 0; i < 3; i++) {
      const x = 6 + i * 17;
      const hgt = 10 + ((i * 7) % 8);
      ctx.fillStyle = th.night ? '#0d1230' : '#7d8698';
      ctx.fillRect(x, horizon - hgt, 12, hgt);
      if (th.night) {
        // v1.3.36 : fenêtres qui scintillent quand animé
        ctx.fillStyle = `rgba(255,213,74,${0.5 + 0.5 * Math.abs(Math.sin(tt * 2.5 + i * 2))})`;
        ctx.fillRect(x + 2, horizon - hgt + 2, 2, 2);
        ctx.fillRect(x + 7, horizon - hgt + 5, 2, 2);
      }
    }
  } else if (th.scenery === 'cacti') {
    ctx.fillStyle = '#3e8e5a';
    for (let i = 0; i < 2; i++) {
      const x = 12 + i * 30;
      ctx.fillRect(x, horizon - 9, 4, 9);
      ctx.fillRect(x - 3, horizon - 7, 3, 2);
      ctx.fillRect(x + 4, horizon - 6, 3, 2);
    }
  }
}

// v1.3.17 : aperçu d'un pack = un cadeau
// v1.3.36 : t = temps (s) — le cadeau pulse doucement et les étincelles scintillent (t=0 -> statique)
export function renderPackPreview(canvas, pack, t = 0) {
  const { ctx, cssW, cssH } = previewSetup(canvas);
  const tt = Number.isFinite(t) ? t : 0; // v1.3.36
  ctx.fillStyle = '#1c2450';
  ctx.fillRect(0, 0, cssW, cssH);
  const pulse = 1 + Math.sin(tt * 2) * 0.05; // v1.3.36 : pulsation (1 à t=0)
  ctx.save();
  ctx.translate(cssW / 2, cssH / 2);
  ctx.scale(pulse, pulse);
  ctx.translate(-cssW / 2, -cssH / 2);
  const bx = cssW / 2 - 16;
  const by = cssH / 2 - 6;
  const bw2 = 32;
  const bh = 22;
  ctx.fillStyle = '#e0393e';
  rr(ctx, bx, by, bw2, bh, 4);
  ctx.fill();
  ctx.fillStyle = '#ff5c5c';
  rr(ctx, bx - 3, by - 6, bw2 + 6, 8, 3);
  ctx.fill();
  ctx.fillStyle = '#ffd54a';
  ctx.fillRect(cssW / 2 - 3, by - 6, 6, bh + 6);
  ctx.fillRect(bx, by + bh / 2 - 3, bw2, 6);
  ctx.strokeStyle = '#ffd54a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cssW / 2 - 5, by - 8, 5, Math.PI * 0.9, Math.PI * 1.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cssW / 2 + 5, by - 8, 5, Math.PI * 1.1, Math.PI * 0.1);
  ctx.stroke();
  ctx.restore();
  // v1.3.36 : étincelles qui scintillent quand animé
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.65 * Math.abs(Math.sin(tt * 3 + i * 1.7))})`;
    ctx.fillRect(8 + ((i * 29) % (cssW - 16)), 8 + ((i * 17) % (cssH - 16)), 2, 2);
  }
}

// v1.3.17 : aperçu d'un pack de sons = haut-parleur + ondes (carrées pour l'arcade)
// v1.3.36 : t = temps (s) — les ondes oscillent quand animé (t=0 -> statique)
export function renderSoundPreview(canvas, sp, t = 0) {
  const { ctx, cssW, cssH } = previewSetup(canvas);
  const tt = Number.isFinite(t) ? t : 0; // v1.3.36
  ctx.fillStyle = '#1c2450';
  ctx.fillRect(0, 0, cssW, cssH);
  const cx = cssW / 2 - 10;
  const cy = cssH / 2;
  ctx.fillStyle = '#cfd8ea';
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 5);
  ctx.lineTo(cx - 3, cy - 5);
  ctx.lineTo(cx + 4, cy - 13);
  ctx.lineTo(cx + 4, cy + 13);
  ctx.lineTo(cx - 3, cy + 5);
  ctx.lineTo(cx - 10, cy + 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - 13, cy - 8, 4, 16);
  const col = sp.id === 'arcade' ? '#7ee081' : sp.id === 'synthwave' ? '#c792ff' : '#54f0ff';
  ctx.strokeStyle = col;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  if (sp.id === 'arcade') {
    for (let i = 0; i < 3; i++) {
      // v1.3.36 : barres d'égaliseur qui dansent quand animé
      const wob = Math.sin(tt * 4 + i) * 1.5;
      ctx.strokeRect(cx + 8 + i * 7, cy - 4 - i * 3 - wob, 5, 8 + i * 6);
    }
  } else {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      // v1.3.36 : rayon des ondes qui oscille quand animé
      ctx.arc(cx + 7, cy, 6 + i * 6 + Math.sin(tt * 4 - i) * 1.5, -0.9, 0.9);
      ctx.stroke();
    }
  }
}

function drawTrafficCar(ctx, x, y, w, color, down) {
  ctx.save();
  ctx.translate(x, y);
  if (down) ctx.scale(1, -1);
  const h = w * 1.9; // v1.3.14 : vue de dessus, la voiture est plus longue que large
  const m = { w, bodyH: h, cabW: 0.82, cabH: 30, spoiler: false };
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 6, w * 0.6, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  paintCar(ctx, 0, h / 2, m, {
    color,
    dark: shade(color, -48),
    light: shade(color, 48),
    shine: false,
    tier: 1,
    time: 0,
  }, 'flat');
  ctx.restore();
}

export class Game {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.level = opts.level;
    this.theme = THEMES[opts.themeOverride] || THEMES[opts.level.theme];
    this.skin = SKINS.find((s) => s.id === opts.skinId) || SKINS[0];
    this.speedrun = !!opts.speedrun;
    this.training = !!opts.training; // v1.3.82 #1 : entraînement = vies infinies
    this.inputBuffer = makeInputBuffer(120); // v1.3.82 #2 : buffer d'input (coyote 120 ms)
    // v1.3.54 : le speedrun n'a QU'UNE SEULE difficulté : Permis A (fixée côté UI aussi)
    this.mode = opts.mode || 'auto'; // v1.3.68 : le speedrun se joue dans la difficulté choisie (plus de verrou Permis A)
    // v1.3.51 : niveaux déterministes — rand seedé (seed fixe par niveau+mode), reset dans start()
    this.rand = mulberry32(levelSeed(this.level ? this.level.id : 0, this.mode));
    this.replay = { seed: levelSeed(this.level ? this.level.id : 0, this.mode), mode: this.mode, taps: [] }; // v1.3.79 : enregistrement du run (replay vérifiable #30)
    this.replayPlay = opts.replay || null; // v1.3.79 : mode lecture — les taps du replay sont rejoués automatiquement
    this.replayIdx = 0;
    this.chunkN = 0;
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
    // v1.3.51 : seed FIXE par (niveau, mode) -> le même niveau est identique à chaque partie
    // (speedrun-friendly). Le trafic/les piétons utilisent le même rand seedé (reset ici).
    const seed = levelSeed(this.level.id, this.mode);
    this.rand = mulberry32(seed);
    this.chunkN = 0;
    if (!this.replayPlay) this.replay.taps = []; // v1.3.79 : nouveau run -> nouvel enregistrement de taps
    this.replayIdx = 0;
    this.lines = buildPattern(this.level, seed, this.mode).map((l, i) => ({ _gi: i, // v1.3.82 #3 : index pour le fantôme du record
      type: l.type,
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
    this.stats = { perfects: 0, goods: 0, passables: 0, misses: 0, overtakes: 0, reactions: [], reactionsSigned: [], score: 0, lines: 0 } // v1.3.78 : dtMs signés (biais ±ms); // v1.3.35 : lignes résolues (paliers Survie ∞)
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
    this.bonusSpeed = 0; // v1.3.19 : vitesse accumulée (speedrun)
    this.penaltyMs = 0;
    this.lastResolveMs = null; // v1.3.78 : timeMs figé à la résolution de la dernière ligne (dernier tap), pas à la frame du +80 px // v1.3.77 : pénalités de temps — raté +0,5 s, continuer +2 s (mode unique)
    this.elapsed = 0; // v1.3.19 : chrono (s)
    this.carXFrac = CAR_LANE;
    this.prevCarX = CAR_LANE;
    this.laneTarget = CAR_LANE;
    this.blocker = null;
    this.oncoming = [];
    this.sameDir = [];
    this.danger = 0; // v1.3.76 : alerte voiture de face (0..1) quand le joueur est à gauche
    this.tOncoming = 1.2;
    this.tSame = 4;
    this.ped = null;
    this.autoStop = false;
    this.drops = [];
    this.maxMisses = this.training ? Infinity : maxMissesFor(this.mode); // v1.3.82 #1 : entraînement = vies infinies
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
      // v1.3.65 : en tutoriel le raté compte VRAIMENT (perte de ❤ affichée dans le HUD,
      // sting, vibration) — mais on ne déclenche JAMAIS l'écran de fin pendant le tutoriel.
      this.stats.misses++;
      this.combo = 0;
      this.popups.push({ text: 'RATÉ −1 ❤', y: ay - 70, life: 0.9, color: '#ff5c5c' });
      if (!this.access.reduceAnims) this.shake = 8; // v1.3.80 #15
      this.audio.miss?.();
      if (typeof navigator !== 'undefined' && navigator.vibrate && this.access.vibrate !== false) navigator.vibrate(80); // v1.3.82 #7 : raté = longue vibration (off si option off)
      this.onMiss(this.stats.misses);
      return;
    }
    this.stats.misses++;
    this.combo = 0;
    this.penaltyMs += 500; // v1.3.77 : raté = +0,5 s au chrono (mode unique, toujours)
    this.replay.taps.push({ a: axle, miss: 1, t: Math.round(this.time * 1000) }); // v1.3.79 : raté enregistré dans le replay
    if (this.speedrun) {
      // v1.3.19 : un raté = TOUTE la vitesse accumulée est perdue
      this.bonusSpeed = 0;
      this.popups.push({ text: '⚡ VITESSE PERDUE !', y: ay - 100, life: 0.9, color: '#ff9f1c' });
    }
    this.popups.push({ text: 'RATÉ +0,5 s', y: ay - 70, life: 0.9, color: '#ff5c5c' });
    if (!this.access.reduceAnims) this.shake = 8; // v1.3.80 #15
    this.audio.miss?.();
    if (typeof navigator !== 'undefined' && navigator.vibrate && this.access.vibrate !== false) navigator.vibrate(80); // v1.3.82 #7 : raté = longue vibration (off si option off)
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
    if (this.replayPlay) {
      // v1.3.79 : mode lecture — rejoue les taps enregistrés à leur instant d'origine
      const nowMs = this.time * 1000;
      while (this.replayIdx < this.replayPlay.taps.length && this.replayPlay.taps[this.replayIdx].t <= nowMs) {
        const tp = this.replayPlay.taps[this.replayIdx++];
        if (tp.miss) this.registerMiss(null, tp.a);
        else this.tap(tp.a, true);
      }
    }
    if (this.speedrun) this.elapsed += dt; // le chrono ne tourne pas en pause/tuto (return ci-dessus)
    const baseSpeed = this.level.endless
      ? Math.min(this.level.speed + this.distance * 0.02, this.level.speed * 2.4)
      : this.level.speed;
    this.effSpeed = (baseSpeed + (this.speedrun ? this.bonusSpeed : 0)) * this.slow;
    this.distance += this.effSpeed * dt;
    // v1.3.43 : pendant un arrêt pour piéton (autoStop), la ligne du passage piéton ne doit JAMAIS
    // dépasser les roues AV — la voiture s'arrête AVANT le passage (fix « roues avant dessus » à
    // haute vitesse, ex. speedrun) : on bloque la distance pour que lineY <= frontAxleY - 6
    if (this.autoStop) {
      const cw = this.lines.find((l) => l.type === 'crosswalk' && l.state === 'pending');
      if (cw) {
        const maxDist = cw.dist + (this.frontAxleY - 6) - this.wheelY;
        if (this.distance > maxDist) this.distance = maxDist;
      }
    }
    // v1.3.46 : beat style Geometry Dash — un « tic » audio est calé EXACTEMENT sur l'arrivée de
    // chaque ligne à l'essieu (t = (dist - axleDelta - distance) / effSpeed) -> on peut jouer à l'oreille
    if (this.effSpeed > 1) {
      for (const line of this.lines) {
        if (line.state !== 'pending') continue;
        for (const axle of this.axles) {
          const t = (line.dist - this.axleDelta(axle) - this.distance) / this.effSpeed;
          // v1.3.76 : la MUSIQUE s'ancre sur la ligne quand elle atteint les roues (rear) — une fois par ligne
          if (axle === 'rear' && !line.anchored && t <= 0.04 && t > -0.06) {
            line.anchored = true;
            if (typeof this.audio.musicAnchor === 'function') this.audio.musicAnchor();
          }
          if (line.hits[axle]) continue;
          if (this.access.lineBeat && typeof this.audio.lineBeat === 'function' && t < 0.7) this.audio.lineBeat(t, line.dist + ':' + axle); // v1.3.91 : fenêtre sans borne basse (frame sautée = bip quand même) + optionnel (access.lineBeat)
          if (this.access.hitMarker) { // v1.3.80 : #27 — flash quand la ligne passe EXACTEMENT sous l'essieu (0 ms)
            const ad = this.distance - line.dist + this.axleDelta(axle);
            line._hmAd = line._hmAd || {};
            const prev = line._hmAd[axle];
            if (prev !== undefined && ((prev < 0 && ad >= 0) || (prev > 0 && ad <= 0))) line.flash = Math.max(line.flash || 0, 0.18);
            line._hmAd[axle] = ad;
          }
        }
      }
    }
    const missPx = (this.effSpeed * this.windows.passable) / 1000;
    for (const line of this.lines) {
      if (line.state !== 'pending') continue;
      // v1.3.43 : la voiture cède le passage (autoStop, quasi à l'arrêt) -> la ligne piéton ne fait
      // PAS perdre de cœur (le tap reste possible, voir tap())
      if (line.type === 'crosswalk' && this.autoStop && this.effSpeed <= 1) continue;
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
          this.stats.lines++; // v1.3.35
          if (this.remaining === 0) this.lastResolveMs = (this.elapsed + this.penaltyMs / 1000) * 1000; // v1.3.78 : dernier tap
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
    // v1.3.41 : retour un peu plus franc aussi (6 au lieu de 4) pour passer moins de temps entre les voies
    const laneRate = this.laneTarget === ONCOMING_LANE ? 18 : 6;
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
      levelSeed(`${this.level.id}#${++this.chunkN}`, this.mode), // v1.3.51 : tronçons déterministes aussi
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
        const fromLeft = this.rand() < 0.5; // v1.3.51 : seedé
        this.ped = {
          line: cw,
          x: fromLeft ? this.roadX - 30 : this.roadX + this.roadW + 30,
          dir: fromLeft ? 1 : -1,
          y: y + 16,
          speed: 70 + this.rand() * 50,
          color: TRAFFIC_COLORS[(this.rand() * TRAFFIC_COLORS.length) | 0],
          phase: this.rand() * 6,
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
    const playerLeft = this.carXFrac < 0.6;
    if (this.tOncoming <= 0) {
      this.tOncoming = 1.3 + this.rand() * 1.7;
      // v1.3.76 : les voitures de face spawnent AUSSI quand le joueur est à gauche (c'est le danger
      // du dépassement manuel) — avec un lead ≥ ~1050 px = fenêtre d'action ~1,5-2,5 s
      if (this.oncoming.length < 4) {
        const lead = playerLeft ? 1050 + this.rand() * 800 : 240 + this.rand() * 400;
        this.oncoming.push({
          p: this.distance + this.h + lead,
          v: -(220 + this.rand() * 140),
          color: TRAFFIC_COLORS[(this.rand() * TRAFFIC_COLORS.length) | 0],
          w: 54 + this.rand() * 16,
        });
      }
    }
    for (const c of this.oncoming) c.p += c.v * dt;
    this.oncoming = this.oncoming.filter((c) => this.wheelY + this.distance - c.p < this.h + 260);
    // v1.3.76 : collision frontale — joueur à gauche + voiture de face au même niveau = crash
    if (this.carXFrac < 0.5) {
      for (const c of this.oncoming) {
        if (Math.abs(this.distance - c.p) < 58) {
          if (this.tutorial) { this.slow = Math.max(this.slow, 0.3); break; } // tuto : pas de mort
          this.stats.score = this.score;
          this.finish('oncoming');
          return;
        }
      }
    }
    // v1.3.76 : indicateur d'alerte 0..1 = proximité d'une voiture de face (quand on est à gauche)
    this.danger = 0;
    if (playerLeft) {
      for (const c of this.oncoming) {
        const rel = this.distance - c.p; // <0 = la voiture de face est devant
        if (rel > -750 && rel < 60) this.danger = Math.max(this.danger, (rel + 750) / 810);
      }
    }
    let blocker = null;
    if (this.mode === 'pilote') {
      this.tSame -= dt;
      if (this.tSame <= 0) {
        this.tSame = 5 + this.rand() * 5;
        // v1.3.76 : jamais 2 voitures d'affilée dans la file de droite à moins de 520 px
        if (!this.sameDir.some((c) => c.p > this.distance - 400 && c.p < this.distance + 520)) {
          this.sameDir.push({
            p: this.distance + 650 + this.rand() * 450,
            v: this.level.speed * (0.5 + this.rand() * 0.2),
            color: TRAFFIC_COLORS[(this.rand() * TRAFFIC_COLORS.length) | 0],
            w: 56 + this.rand() * 16,
            overtaken: false,
            grace: 0,
          });
        }
      }
      // v1.3.41 : une voiture doublée CONTINUE de rouler à sa propre vitesse (plus lente que le
      // joueur) -> elle retombe derrière naturellement au lieu d'être gelée et de glisser
      // à travers la voiture du joueur (bug visuel « le modèle traverse la voiture »)
      for (const c of this.sameDir) {
        c.p += c.v * dt;
      }
      for (const c of this.sameDir) {
        if (c.overtaken) continue;
        const sy = this.wheelY + this.distance - c.p;
        if (sy > this.wheelY + 120) continue;
        if (sy >= this.wheelY - BLOCK_RANGE) blocker = c;
      }
      this.blocker = blocker;
      if (blocker) blocker.grace += dt;
      // v1.3.76 : PLUS de retour automatique à droite — le joueur revient avec swipe → / flèche ➡ (swipeRight)
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
    if (this.replayPlay) return; // v1.3.79 : replay = lecture seule
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
      // on vide l'entre-sens devant la voiture : aucun chevauchement visuel pendant le dépassement
      this.oncoming = this.oncoming.filter((c) => this.wheelY + this.distance - c.p > this.h + 40);
      this.tOncoming = Math.max(this.tOncoming, 1.4); // v1.3.76 : fenêtre d'action acceptable (~1,4 s min)
      this.lastOvertaken = target;
      this.laneTarget = ONCOMING_LANE;
      this.stats.overtakes++;
      const bonus = 50 + this.combo * 5;
      this.score += bonus;
      this.stats.score = this.score;
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      if (this.speedrun) this.bonusSpeed = Math.min(this.bonusSpeed + 30, this.level.speed * 0.8); // dépassement = PARFAIT
      this.popups.push({ text: `DÉPASSEMENT +${bonus}`, y: this.wheelY - 120, life: 0.9, color: '#54f0ff' });
      if (!this.access.reduceAnims) this.shake = Math.max(this.shake, 4); // v1.3.80 #15
      this.audio.perfect?.();
      this.onJudge({ result: 'perfect', pts: bonus, combo: this.combo, score: this.score, overtake: true });
    }
  }

  // v1.3.76 : retour MANUEL dans la voie de droite (swipe → / flèche droite)
  swipeRight() {
    if (this.replayPlay) return; // v1.3.79 : replay = lecture seule
    if (!this.running || this.paused || this.tutHold) return;
    if (this.mode !== 'pilote') return;
    if (this.laneTarget >= CAR_LANE && this.carXFrac > 0.6) return; // déjà à droite
    this.laneTarget = CAR_LANE;
    this.lastOvertaken = null;
    this.popups.push({ text: '↩ VOIE DE DROITE', y: this.wheelY - 120, life: 0.7, color: '#8affc1' });
    this.audio.good?.();
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
      if (!this.access.reduceAnims) this.particles.push({ // v1.3.80 #15
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

  tap(zone = 'rear', auto = false, fromBuffer = false) {
    if (this.replayPlay && !auto) return; // v1.3.79 : en mode replay, les entrées joueur sont ignorées
    if (!this.running || this.paused || this.tutHold) return;
    const axle = this.mode === 'auto' ? 'rear' : zone;
    if (!auto && !fromBuffer && this.inputBuffer) this.inputBuffer.push(this.time * 1000, axle); // v1.3.82 #2 : on garde le tap (fenêtre 120 ms)
    const speed = this.effSpeed;
    // v1.3.27 : voiture à l'arrêt (piéton) -> effSpeed = 0 -> tout tap est un "clic dans le vide"
    // (sinon dtMs = 0/0 = NaN et le jugement crashait)
    if (!(speed > 0)) {
      // v1.3.43 : voiture arrêtée POUR UN PIÉTON (autoStop) -> on peut encore valider la ligne du
      // passage piéton (fenêtre large 320 px), au lieu d'un « clic dans le vide » qui fait perdre un cœur
      if (this.autoStop) {
        const cw = this.lines.find((l) => l.type === 'crosswalk' && l.state === 'pending' && !l.hits[axle]);
        if (cw) {
          const dy = this.distance - cw.dist + this.axleDelta(axle);
          if (Math.abs(dy) <= 320) {
            cw.hits[axle] = 'good';
            cw.state = this.axles.every((a) => cw.hits[a]) ? 'resolved' : 'pending';
            if (cw.state === 'resolved') {
              this.remaining--;
              this.stats.lines++;
              if (this.remaining === 0) this.lastResolveMs = (this.elapsed + this.penaltyMs / 1000) * 1000; // v1.3.78 : dernier tap
            }
            cw.result = 'good';
            this.replay.taps.push({ a: axle, cw: 1, t: Math.round(this.time * 1000) }); // v1.3.79 : passage piéton aussi enregistré
            cw.flash = this.access.reduceAnims ? 0 : 0.3; // v1.3.80 #15
            this.audio.good?.();
            this.popups.push({ text: `${axle === 'front' ? 'AV ' : 'AR '}PASSAGE CÉDÉ`, y: this.lineAxleY(axle) - 70, life: 0.8, color: RESULT_STYLE.good.color });
            this.onJudge({ result: 'good', pts: 0, combo: this.combo, score: this.score, axle, type: 'crosswalk' });
            return;
          }
        }
      }
      this.audio.tap?.();
      this.pendingStray = 0.25;
      return;
    }
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
      // v1.3.82 #2 : buffer d'input — un tap jusqu'à 120 ms avant la fenêtre est rejugé à son instant réel (coyote)
      const bt = (!auto && !fromBuffer && this.inputBuffer) ? this.inputBuffer.consume(this.time * 1000, axle) : null;
      if (bt != null) {
        const saveD = this.distance;
        this.distance = saveD - (this.effSpeed * (this.time * 1000 - bt)) / 1000;
        const hit = this.tap(axle, true, true);
        this.distance = saveD;
        if (hit) return true;
      }
      this.audio.tap?.();
      this.pendingStray = 0.25;
      return;
    }
    const ay = this.lineAxleY(axle);
    const dy = this.distance - best.dist + this.axleDelta(axle);
    const dtMs = (dy / speed) * 1000 - (this.access.latencyOffsetMs || 0); // v1.3.82 #5 : calibration latence (locale, hors classement si ≠ 0)
    const result = judge(dtMs, this.windows);
    if (!result) {
      // garde-fou : aucun jugement valide -> clic dans le vide
      this.audio.tap?.();
      this.pendingStray = 0.25;
      return;
    }
    best.hits[axle] = result;
    best.state = this.axles.every((a) => best.hits[a]) ? 'resolved' : 'pending';
    if (best.state === 'resolved') {
      this.remaining--;
      this.stats.lines++; // v1.3.35
      if (this.remaining === 0) this.lastResolveMs = (this.elapsed + this.penaltyMs / 1000) * 1000; // v1.3.78 : dernier tap
    }
    best.result = result;
    best.flash = this.access.reduceAnims ? 0 : 0.3; // v1.3.80 #15
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
      // v1.3.19 : speedrun — chaque PARFAIT ajoute de la vitesse (plafond +80 %)
      if (this.speedrun) this.bonusSpeed = Math.min(this.bonusSpeed + 30, this.level.speed * 0.8);
    }
    this.score += pts;
    this.stats.score = this.score;
    this.stats.reactions.push(Math.abs(dtMs));
    this.stats.reactionsSigned.push(dtMs); // v1.3.78 : dtMs signé conservé (biais ±ms)
    this.replay.taps.push({ a: axle, dt: Math.round(dtMs * 10) / 10, t: Math.round(this.time * 1000) }); // v1.3.79 : tap enregistré pour le replay
    if (result === 'perfect') this.stats.perfects++;
    else if (result === 'good') this.stats.goods++;
    else this.stats.passables++;
    this.popups.push({
      text: `${axle === 'front' ? 'AV ' : 'AR '}${label} +${pts}`,
      y: ay - 70,
      life: 0.8,
      color: RESULT_STYLE[result].color,
    });
    if (this.hasEffect('shake') && !this.access.reduceAnims) this.shake = 5; // v1.3.80 #15
    if (result === 'perfect' && typeof navigator !== 'undefined' && navigator.vibrate && this.access.vibrate !== false) navigator.vibrate([15, 15, 15]); // v1.3.82 #7 : PARFAIT = double pulsation
    if (this.hasEffect('confetti') && result === 'perfect') this.spawnConfetti();
    this.audio[result]?.();
    if (result === 'perfect' && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    this.onJudge({ result, pts, combo: this.combo, score: this.score, axle, type: best.type });
    return true; // v1.3.82 #2 : un jugement a eu lieu (buffer)
  }

  finish(completedOrReason) {
    this.running = false;
    const completed = completedOrReason === true;
    const reason = typeof completedOrReason === 'string' ? completedOrReason : completed ? 'complete' : 'miss';
    this.stats.completed = completed;
    this.stats.reason = reason;
    this.audio[completed ? 'win' : 'fail']?.();
    this.stats.timeMs = Math.round(this.lastResolveMs != null ? this.lastResolveMs : (this.elapsed + this.penaltyMs / 1000) * 1000); // v1.3.78 : figé au DERNIER TAP (résolution de la dernière ligne) — mesure équitable 60/120 Hz ; repli = comportement v1.3.77
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
    // v1.3.41 : z-order par profondeur — les voitures DEVANT le joueur (sy < wheelY, plus haut
    // = plus loin) sont dessinées AVANT la voiture du joueur ; celles DERRIÈRE (sy >= wheelY,
    // plus bas = plus proches du spectateur) APRÈS -> plus de « traversée » visuelle
    this.drawTraffic('ahead');
    this.drawPedestrian();
    this.drawZones();
    this.drawCar();
    this.drawTraffic('behind');
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
      if (this.access.ghost && this.access.ghost[line._gi] && typeof this.access.ghost[line._gi].dt === 'number' && this.access.ghost[line._gi].dt !== 0) {
        // v1.3.82 #3 : fantôme du record — petit repère à la position exacte du meilleur run sur cette ligne
        const gdx = (this.access.ghost[line._gi].dt / 1000) * this.effSpeed;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.arc(this.w / 2 + gdx, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
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
          // v1.3.65 : halo en alpha (PAS de shadowBlur : trop lent sur mobile -> freeze au tap)
          ctx.save();
          ctx.globalAlpha = Math.min(0.5, line.glow);
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
          // v1.3.65 : halo = 2 passes alpha (pas de shadowBlur -> plus de freeze quand on clique sur une ligne)
          ctx.save();
          ctx.globalAlpha = pulse * 0.4;
          ctx.strokeStyle = theme.line;
          ctx.fillStyle = theme.line;
          this.drawLineShape(line.type, y, roadX, roadW, false);
          ctx.globalAlpha = pulse;
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
    // v1.3.76 : alerte voiture de face quand on est à gauche (dépassement manuel)
    if (this.mode === 'pilote' && this.danger > 0.05) {
      ctx.fillStyle = `rgba(255,60,60,${0.45 + 0.55 * this.danger * Math.abs(Math.sin(this.time * 12))})`;
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ VOITURE DE FACE — SWIPE → / ➡ POUR REVENIR !', roadX + roadW / 2, this.h * 0.3);
    }
    if (this.autoStop && this.ped) {
      ctx.fillStyle = 'rgba(126,224,129,0.9)';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🚶 Laisse passer le piéton…', roadX + roadW / 2, this.h * 0.3);
    }
  }

  // v1.3.41 : phase 'ahead' = voitures devant le joueur (dessinées sous lui), 'behind' = derrière
  // (dessinées par-dessus, elles sont plus proches du spectateur)
  drawTraffic(phase = 'ahead') {
    const { ctx, roadX, roadW, wheelY, distance, h } = this;
    const wantBehind = phase === 'behind';
    const draw = (c, lane, down) => {
      const sy = wheelY + distance - c.p;
      if (sy < -160 || sy > h + 160) return;
      if (wantBehind !== sy >= wheelY) return; // filtre z-order
      drawTrafficCar(ctx, roadX + roadW * lane, sy, c.w, c.color, down);
    };
    for (const c of this.oncoming) draw(c, ONCOMING_LANE, true);
    for (const c of this.sameDir) draw(c, CAR_LANE, false);
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
    // ombre portée
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
    // v1.3.14 : voiture en VUE DE DESSUS, rendue par paintCar (7 styles)
    const carStyle = skin.style || 'photo';
    let bodyColor = skin.color;
    if (skin.rainbow) bodyColor = `hsl(${Math.round((this.time * 240) % 360)},85%,55%)`;
    const isHex = bodyColor.startsWith('#');
    paintCar(ctx, cx, baseY, m, {
      color: bodyColor,
      dark: skin.shine || !isHex ? 'rgba(0,0,0,0.42)' : shade(bodyColor, -48),
      light: skin.shine || !isHex ? 'rgba(255,255,255,0.5)' : shade(bodyColor, 48),
      shine: Boolean(skin.shine),
      tier,
      time: this.time,
    }, carStyle);
    this.drawRemainingBadge(cx, baseY, m);
  }

  // v1.3.22 : délimitation visuelle des zones de tap en Permis A / Pilote
  // (haut/bas par défaut, gauche/droite si access.horizontalZones)
  drawZones() {
    if (this.mode === 'auto') return; // une seule zone en Auto école
    const { ctx, w, h } = this;
    const horiz = Boolean(this.access && this.access.horizontalZones);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    if (horiz) {
      const x = w / 2;
      ctx.beginPath();
      ctx.moveTo(x, 76);
      ctx.lineTo(x, h - 30);
      ctx.stroke();
      ctx.fillText('AV ⬅', x - 36, 96);
      ctx.fillText('➡ AR', x + 36, 96);
    } else {
      const y = h / 2;
      ctx.beginPath();
      ctx.moveTo(16, y);
      ctx.lineTo(w - 16, y);
      ctx.stroke();
      ctx.fillText('▲ AV', w / 2, y - 8);
      ctx.fillText('▼ AR', w / 2, y + 22);
    }
    ctx.restore();
  }

  drawRemainingBadge(cx, baseY, m) {
    const { ctx } = this;
    const label = this.level.endless ? '∞' : String(Math.max(0, this.remaining));
    ctx.font = 'bold 15px system-ui, sans-serif';
    const tw = ctx.measureText(label).width + 18;
    const px = cx - tw / 2;
    const py = baseY - m.bodyH - 26;
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
