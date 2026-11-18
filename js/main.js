import { LEVELS, THEMES, SKINS, EFFECTS } from './data.js';
import { Game } from './game.js';
import * as store from './store.js';
import { sfx, setEnabled, unlockAudio } from './audio.js';
import { coinsForResult, accuracy, avgReaction } from './core.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

let save = store.load();
setEnabled(save.sound);

let game = null;
let rafId = null;
let lastT = 0;
let currentScreen = 'screen-menu';
let currentLevel = null;

const hudScore = $('#hud-score');
const hudCombo = $('#hud-combo');
const hudLevel = $('#hud-level');

function show(id) {
  currentScreen = id;
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  $('#hud').classList.toggle('hidden', id !== 'screen-game');
}

function refreshCoins() {
  $$('.coins-display').forEach((el) => {
    el.textContent = `🪙 ${save.coins}`;
  });
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

function updateSoundBtn() {
  $('#btn-sound').textContent = save.sound ? '🔊 Son : ON' : '🔇 Son : OFF';
}

function renderLevels() {
  const list = $('#levels-list');
  list.innerHTML = '';
  for (const l of LEVELS) {
    const locked = !save.unlockedLevels.includes(l.id);
    const best = save.best[l.id];
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-theme theme-${l.theme}"></div>
      <div class="card-body">
        <div class="card-title">${l.id}. ${l.name}</div>
        <div class="card-sub">${THEMES[l.theme].name} · vitesse ${l.speed} · ${l.lines} lignes</div>
        <div class="card-best">${best ? `🏆 Record : ${best}` : ''}</div>
      </div>
      <button class="btn small">${locked ? `🔒 ${l.cost} 🪙` : '▶ Jouer'}</button>`;
    card.querySelector('button').addEventListener('click', () => {
      sfx.click();
      if (locked) {
        if (store.spend(l.cost)) {
          store.unlockLevel(l.id);
          sfx.coin();
          toast(`Niveau ${l.id} débloqué !`);
          refreshCoins();
          renderLevels();
          startLevel(l);
        } else {
          toast(`Il te manque ${l.cost - save.coins} pièces 🪙`);
        }
      } else {
        startLevel(l);
      }
    });
    list.appendChild(card);
  }
}

function renderShop() {
  const skinsEl = $('#shop-skins');
  skinsEl.innerHTML = '';
  for (const s of SKINS) {
    const owned = save.skins.includes(s.id);
    const selected = save.skin === s.id;
    const card = document.createElement('div');
    card.className = 'card shop-card';
    card.innerHTML = `
      <div class="swatch" style="background:${s.rainbow ? 'linear-gradient(90deg,#ff5c8a,#ffd54a,#7ee081,#54f0ff,#c792ff)' : s.color}"></div>
      <div class="card-body">
        <div class="card-title">${s.name}</div>
        <div class="card-sub">${s.width > 1 ? 'Grosse voiture' : s.width < 1 ? 'Voiture compacte' : 'Standard'}</div>
      </div>
      <button class="btn small">${selected ? '✓ Équipée' : owned ? 'Équiper' : `${s.cost} 🪙`}</button>`;
    card.querySelector('button').addEventListener('click', () => {
      if (selected) return;
      if (owned) {
        store.selectSkin(s.id);
        sfx.click();
      } else if (store.buySkin(s.id, s.cost)) {
        store.selectSkin(s.id);
        sfx.coin();
        toast(`${s.name} achetée et équipée !`);
      } else {
        toast(`Il te manque ${s.cost - save.coins} pièces 🪙`);
        return;
      }
      refreshCoins();
      renderShop();
    });
    skinsEl.appendChild(card);
  }
  const fxEl = $('#shop-effects');
  fxEl.innerHTML = '';
  for (const e of EFFECTS) {
    const owned = save.effects.includes(e.id);
    const active = save.selectedEffects.includes(e.id);
    const card = document.createElement('div');
    card.className = 'card shop-card';
    card.innerHTML = `
      <div class="swatch fx">✨</div>
      <div class="card-body">
        <div class="card-title">${e.name}</div>
        <div class="card-sub">${e.desc}</div>
      </div>
      <button class="btn small">${active ? '✓ Activé' : owned ? 'Activer' : `${e.cost} 🪙`}</button>`;
    card.querySelector('button').addEventListener('click', () => {
      if (active) {
        store.toggleEffect(e.id);
        sfx.click();
      } else if (owned) {
        store.toggleEffect(e.id);
        sfx.click();
      } else if (store.buyEffect(e.id, e.cost)) {
        sfx.coin();
        toast(`${e.name} acheté et activé !`);
      } else {
        toast(`Il te manque ${e.cost - save.coins} pièces 🪙`);
        return;
      }
      refreshCoins();
      renderShop();
    });
    fxEl.appendChild(card);
  }
}

function startLevel(level) {
  currentLevel = level;
  show('screen-game');
  $('#pause-overlay').classList.remove('active');
  hudLevel.textContent = `${level.id}. ${level.name}`;
  hudScore.textContent = '0';
  hudCombo.textContent = '';
  game = new Game($('#game'), {
    level,
    skinId: save.skin,
    effects: save.selectedEffects,
    audio: { tap: sfx.tap, perfect: sfx.perfect, good: sfx.good, passable: sfx.passable, fail: sfx.fail, win: sfx.win },
    onJudge: (e) => {
      hudScore.textContent = String(e.score);
      hudCombo.textContent = e.combo >= 2 ? `COMBO x${e.combo}` : '';
    },
    onEnd: onGameEnd,
  });
  game.start();
  lastT = performance.now();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function onGameEnd(stats, level) {
  const isRecord = store.setBest(level.id, stats.score);
  const coins = coinsForResult(stats, level, stats.completed);
  if (coins > 0) {
    store.addCoins(coins);
    sfx.coin();
  }
  $('#over-title').textContent = stats.completed ? '🏁 Niveau terminé !' : '💥 Ligne manquée !';
  $('#over-record').classList.toggle('hidden', !isRecord);
  $('#over-score').textContent = stats.score;
  const avg = avgReaction(stats);
  $('#over-stats').innerHTML = `
    <div><b>${stats.perfects}</b><span>Parfaits</span></div>
    <div><b>${stats.goods}</b><span>Bien</span></div>
    <div><b>${stats.passables}</b><span>OK</span></div>
    <div><b>${stats.bestCombo}</b><span>Meilleur combo</span></div>
    <div><b>${avg !== null ? avg + ' ms' : '—'}</b><span>Réaction moy.</span></div>
    <div><b>${accuracy(stats)} %</b><span>Précision</span></div>`;
  $('#over-coins').textContent = `+${coins} 🪙 gagnées`;
  setTimeout(() => {
    refreshCoins();
    show('screen-over');
  }, 650);
}

function togglePause(force) {
  if (!game || !game.running) return;
  game.paused = force !== undefined ? force : !game.paused;
  $('#pause-overlay').classList.toggle('active', game.paused);
}

function loop(t) {
  rafId = requestAnimationFrame(loop);
  const dt = Math.min(0.05, lastT ? (t - lastT) / 1000 : 0);
  lastT = t;
  if (game && currentScreen === 'screen-game') {
    game.update(dt);
    game.render();
  }
}

$('#btn-play').addEventListener('click', () => {
  sfx.click();
  renderLevels();
  show('screen-levels');
});
$('#btn-shop').addEventListener('click', () => {
  sfx.click();
  renderShop();
  show('screen-shop');
});
$('#btn-help').addEventListener('click', () => {
  sfx.click();
  $('#help-modal').classList.remove('hidden');
  $('#help-modal').classList.add('active');
});
$('#btn-help-close').addEventListener('click', () => {
  sfx.click();
  $('#help-modal').classList.add('hidden');
  $('#help-modal').classList.remove('active');
});
$('#btn-sound').addEventListener('click', () => {
  store.setSound(!save.sound);
  setEnabled(save.sound);
  updateSoundBtn();
  sfx.click();
});
$('#btn-levels-back').addEventListener('click', () => {
  sfx.click();
  show('screen-menu');
});
$('#btn-shop-back').addEventListener('click', () => {
  sfx.click();
  show('screen-menu');
});
$('#btn-pause').addEventListener('click', () => togglePause());
$('#btn-resume').addEventListener('click', () => togglePause(false));
$('#btn-quit').addEventListener('click', () => {
  if (game) game.running = false;
  $('#pause-overlay').classList.remove('active');
  renderLevels();
  show('screen-levels');
});
$('#btn-retry').addEventListener('click', () => {
  sfx.click();
  if (currentLevel) startLevel(currentLevel);
});
$('#btn-over-levels').addEventListener('click', () => {
  sfx.click();
  renderLevels();
  show('screen-levels');
});
$('#btn-over-menu').addEventListener('click', () => {
  sfx.click();
  show('screen-menu');
});

window.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (currentScreen !== 'screen-game' || !game || !game.running || game.paused) return;
  if (e.target.closest('button')) return;
  game.tap();
});

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'Enter') {
    e.preventDefault();
    if (currentScreen === 'screen-game' && game && game.running && !game.paused) game.tap();
  }
  if (e.code === 'KeyP' && currentScreen === 'screen-game') togglePause();
  if (e.code === 'Escape' && currentScreen === 'screen-game') togglePause();
});

window.addEventListener('resize', () => {
  if (game) game.resize();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game && game.running && !game.paused) togglePause(true);
});

document.addEventListener('touchmove', (e) => {
  if (currentScreen === 'screen-game') e.preventDefault();
}, { passive: false });

refreshCoins();
updateSoundBtn();
show('screen-menu');
rafId = requestAnimationFrame(loop);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
