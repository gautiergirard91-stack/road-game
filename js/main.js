import { LEVELS, THEMES, SKINS, EFFECTS, DIFFICULTIES, CURRENCIES, WINDOWS, ACHIEVEMENTS, THEME_SHOP, ENDLESS_LEVEL, PACKS, SOUND_PACKS } from './data.js';
import { Game, CAR_STYLE_LABEL, renderCarPreview, renderEffectPreview, renderThemePreview, renderPackPreview, renderSoundPreview } from './game.js';
import * as store from './store.js';
import { sfx, setEnabled, setMusicEnabled, unlockAudio, applySoundPack } from './audio.js';
import { coinsForResult, accuracy, avgReaction, continueCost, maxMissesFor, firstClearBonus, isPerfectClear, perfectClearBonus, dailyChallenge, weeklyQuests } from './core.js';
import { watchRewarded } from './ads.js';
import { Tutorial } from './tutorial.js';
import * as leaderboard from './leaderboard.js';
import * as cloudsave from './cloudsave.js';
import { renderGoogleButton, restoreGoogleSession, setAuthToken, getAuthToken, signOutGoogle, isGoogleAuthConfigured, getLastAuthError } from './auth.js';
import { logEvent } from './analytics.js';
import { VERSION } from './config.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

let save = store.load();
setEnabled(save.sound);
applySoundPack(save.soundPack || 'default');
const loginBonus = store.touchLogin();
if (loginBonus.reward > 0) {
  setTimeout(() => toast(`🔥 ${loginBonus.streak} jour${loginBonus.streak > 1 ? 's' : ''} de suite ! +${loginBonus.reward} 🪙`), 800);
}

let game = null;
let rafId = null;
let lastT = 0;
let currentScreen = 'screen-menu';
let currentLevel = null;

const hudScore = $('#hud-score');
const hudCombo = $('#hud-combo');
const hudLevel = $('#hud-level');
const hudLives = $('#hud-lives');

let continuesThisRun = 0;

const MODEL_LABEL = { berline: 'Berline', sport: 'Sport', citadine: 'Citadine', suv: '4x4', f1: 'Formule 1', camion: 'Camion', van: 'Fourgon', decapotable: 'Décapotable', kart: 'Kart', limo: 'Limousine', '2cv': '2CV', monster: 'Monster truck', supercar: 'Supercar' };

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderDifficultyPicker() {
  const el = $('#difficulty-picker');
  if (!el) return;
  el.innerHTML = '';
  for (const d of DIFFICULTIES) {
    const b = document.createElement('button');
    b.className = 'btn small diff-btn' + (save.difficulty === d.id ? ' active' : '');
    b.textContent = d.name;
    b.title = d.desc;
    b.addEventListener('click', () => {
      store.setDifficulty(d.id);
      sfx.click();
      renderDifficultyPicker();
    });
    el.appendChild(b);
  }
}

let lbFilter = 'all';
let lbLevelFilter = 'all';

function renderLbLevelFilter() {
  const el = $('#lb-level-filter');
  if (!el) return;
  el.innerHTML = '';
  const opts = [
    { id: 'all', name: 'Tous niveaux' },
    ...LEVELS.map((l) => ({ id: String(l.id), name: `${l.id}. ${l.name}` })),
    { id: String(ENDLESS_LEVEL.id), name: '∞ Survie' },
  ];
  for (const o of opts) {
    const b = document.createElement('button');
    b.className = 'btn small diff-btn' + (lbLevelFilter === o.id ? ' active' : '');
    b.textContent = o.name;
    b.addEventListener('click', () => {
      lbLevelFilter = o.id;
      sfx.click();
      renderLbLevelFilter();
      renderLeaderboard();
    });
    el.appendChild(b);
  }
}

function renderLbFilter() {
  const el = $('#lb-filter');
  if (!el) return;
  el.innerHTML = '';
  const opts = [{ id: 'all', name: 'Tous' }, ...DIFFICULTIES];
  for (const d of opts) {
    const b = document.createElement('button');
    b.className = 'btn small diff-btn' + (lbFilter === d.id ? ' active' : '');
    b.textContent = d.name;
    b.addEventListener('click', () => {
      lbFilter = d.id;
      sfx.click();
      renderLbFilter();
      renderLeaderboard();
    });
    el.appendChild(b);
  }
}

async function renderLeaderboard() {
  $('#lb-source').textContent = leaderboard.isOnline()
    ? 'Classement en ligne (Firebase)'
    : 'Classement local — configure Firebase dans js/config.js pour un classement en ligne (voir README)';
  const list = $('#leaderboard-list');
  list.innerHTML = '<div class="card-sub">Chargement…</div>';
  let top = [];
  try {
    top = await leaderboard.getTop(lbFilter, lbLevelFilter);
  } catch {
    top = [];
  }
  list.innerHTML = '';
  if (!top.length) {
    list.innerHTML = '<div class="card-sub">Aucun score pour l\'instant — joue une partie !</div>';
    return;
  }
  top.forEach((e, i) => {
    const row = document.createElement('div');
    row.className = 'card lb-row';
    const me = save.pseudo && e.pseudo === save.pseudo;
    row.innerHTML = `<span class="lb-rank">${i + 1}</span><span class="lb-name${me ? ' me' : ''}">${escapeHtml(e.pseudo || 'Anonyme')}</span><span class="lb-level">${escapeHtml(e.level || '')}</span><span class="lb-score">${e.score}</span>`;
    list.appendChild(row);
  });
}

function updateLives(m) {
  const max = maxMissesFor(save.difficulty);
  hudLives.textContent = '❤️'.repeat(Math.max(0, max - m)) + '🖤'.repeat(Math.min(m, max));
}

function showContinue() {
  const max = maxMissesFor(save.difficulty);
  $('#continue-title').textContent = `💥 ${game ? game.stats.misses : max}/${max} ratés !`;
  $('#btn-continue-coins').textContent = `Continuer — ${continueCost(continuesThisRun)} ${cur(save.difficulty).icon}`;
  $('#continue-overlay').classList.add('active');
}

function hideContinue() {
  $('#continue-overlay').classList.remove('active');
}

const effWindows = () => (save.wideWindows ? { perfect: 70, good: 150, passable: 240 } : WINDOWS);

// sauvegarde cloud keyed par uid Google si lié, sinon par pseudo
const accountKey = () => save.uid || save.pseudo;

function pushCloud() {
  if (leaderboard.isOnline() && accountKey()) cloudsave.save(accountKey(), store.snapshot(), getAuthToken());
}

const TUT_LEVEL = { ...ENDLESS_LEVEL, id: 0, name: 'Tutoriel', speed: 230, gapMin: 540, gapMax: 720, w: { dash: 1 }, pDouble: 0, endless: true };

let tut = null;
let tutActive = false;

function startTutorial() {
  tutActive = true;
  show('screen-game');
  $('#pause-overlay').classList.remove('active');
  $('#tut-banner').classList.remove('hidden');
  hudLevel.textContent = '👶 Tutoriel';
  hudScore.textContent = '0';
  hudCombo.textContent = '';
  continuesThisRun = 0;
  updateLives(0);
  logEvent('tutorial_start', {});
  game = new Game($('#game'), {
    level: TUT_LEVEL,
    skinId: save.skin,
    mode: 'auto',
    tutorial: true,
    windows: effWindows(),
    access: { colorblind: save.colorblind },
    effects: save.selectedEffects,
    audio: { tap: sfx.tap, perfect: sfx.perfect, good: sfx.good, passable: sfx.passable, fail: sfx.fail, win: sfx.win, miss: sfx.miss },
    onJudge: (e) => {
      hudScore.textContent = String(e.score);
      hudCombo.textContent = e.combo >= 2 ? `COMBO x${e.combo}` : '';
      tut?.onJudge(e);
    },
    onMiss: (m) => {
      updateLives(m);
      tut?.onMiss();
    },
    onThreshold: () => {},
    onEnd: () => {},
  });
  game.start();
  $('#hud-coins').textContent = `${cur('auto').icon} ${store.getWallet('auto')}`;
  tut = new Tutorial(
    game,
    { text: $('#tut-text'), dots: $('#tut-dots'), read: $('#tut-read'), slider: $('#tut-slider'), quit: $('#tut-quit') },
    () => {
      tutActive = false;
      tut = null;
      $('#tut-banner').classList.add('hidden');
      logEvent('tutorial_done', {});
      toast('🏁 Tutoriel terminé ! +200 🪙');
      refreshCoins();
      renderDifficultyPicker();
      renderLevels();
      show('screen-levels');
    },
    () => {
      // quitter avant la fin : tutorialDone reste false -> le tutoriel reviendra à la prochaine partie
      tutActive = false;
      tut = null;
      $('#tut-banner').classList.add('hidden');
      logEvent('tutorial_aborted', {});
      toast('Tutoriel interrompu — il te sera proposé à ta prochaine partie 👶');
      renderDifficultyPicker();
      renderLevels();
      show('screen-levels');
    }
  );
  lastT = performance.now();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function renderAchievements() {
  const list = $('#achievements-list');
  list.innerHTML = '';
  for (const a of ACHIEVEMENTS) {
    const unlocked = save.achievements.includes(a.id);
    const row = document.createElement('div');
    row.className = 'card lb-row' + (unlocked ? ' ach-done' : '');
    row.innerHTML = `<span class="lb-rank">${unlocked ? '🏅' : '🔒'}</span><div class="card-body"><div class="card-title">${a.name}</div><div class="card-sub">${a.desc} — +${a.reward} 🪙</div></div>`;
    list.appendChild(row);
  }
}

function checkAchievements(stats, level) {
  const ctx = { stats, level, totals: store.get().totals, mode: save.difficulty, best: save.best, trophies: store.get().trophies || {} };
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (!save.achievements.includes(a.id)) {
      let ok = false;
      try {
        ok = a.test(ctx);
      } catch {
        ok = false;
      }
      if (ok) {
        store.unlockAchievement(a.id);
        newly.push(a);
      }
    }
  }
  if (newly.length) {
    const reward = newly.reduce((s, a) => s + a.reward, 0);
    store.addCoins('auto', reward);
    toast(`🏅 Succès débloqué${newly.length > 1 ? 's' : ''} : ${newly.map((a) => a.name).join(', ')} (+${reward} 🪙)`);
  }
}

function refreshStatus() {
  $('#version-label').textContent = 'v' + VERSION;
  const el = $('#net-status');
  if (!navigator.onLine) {
    el.textContent = '🔴 Hors ligne';
    el.className = 'net-pill off';
    return;
  }
  if (!leaderboard.isOnline()) {
    el.textContent = '🟠 Local (serveur non configuré)';
    el.className = 'net-pill local';
    return;
  }
  el.textContent = '🟡 Connexion au serveur…';
  el.className = 'net-pill local';
  leaderboard.ping().then((ok) => {
    el.textContent = ok ? '🟢 En ligne — serveur OK' : '🟠 Serveur injoignable (mode local)';
    el.className = 'net-pill ' + (ok ? 'on' : 'local');
  });
}

function show(id) {
  currentScreen = id;
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  $('#hud').classList.toggle('hidden', id !== 'screen-game');
  // la bannière de tutoriel ne s'affiche que si un tutoriel est réellement actif
  $('#tut-banner').classList.toggle('hidden', id !== 'screen-game' || !tutActive);
  if (id === 'screen-menu') refreshStatus();
}

window.addEventListener('online', refreshStatus);
window.addEventListener('offline', refreshStatus);

const cur = (diff) => CURRENCIES[diff] || CURRENCIES.auto;

function refreshCoins() {
  const html = Object.entries(CURRENCIES).map(([id, c]) => `${c.icon} ${store.getWallet(id)}`).join(' · ');
  $$('.coins-display').forEach((el) => {
    el.innerHTML = html;
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

function updateMusicBtn() {
  $('#btn-music').textContent = save.music ? '🎵 Musique : ON' : '🎵 Musique : OFF';
}

async function renderChallenges() {
  const dc = dailyChallenge();
  const done = store.isChallengeDone(dc.id);
  const modeName = (DIFFICULTIES.find((d) => d.id === dc.mode) || {}).name || dc.mode;
  $('#challenge-streak').innerHTML = `
    <div class="card-body">
      <div class="card-title">🔥 Série de connexion : <b>${save.streak} jour${save.streak > 1 ? 's' : ''}</b></div>
      <div class="card-sub">Reviens chaque jour : jusqu'à +${7 * 25} 🪙 par jour (série plafonnée à 7).</div>
    </div>`;
  const dEl = $('#challenge-daily');
  dEl.innerHTML = '';
  const dCard = document.createElement('div');
  dCard.className = 'card';
  dCard.innerHTML = `
    <div class="card-body">
      <div class="card-title">${done ? '✅ Défi du jour terminé !' : '🎯 ' + dc.label}</div>
      <div class="card-sub">Niveau ${dc.levelId} · ${modeName} · récompense +${dc.reward} ${cur(dc.mode).icon}</div>
    </div>
    <button class="btn small">${done ? '✓' : '▶ Niveaux'}</button>`;
  dCard.querySelector('button').addEventListener('click', () => {
    if (done) return;
    sfx.click();
    store.setDifficulty(dc.mode);
    renderDifficultyPicker();
    renderLevels();
    show('screen-levels');
    toast(`Défi du jour : niveau ${dc.levelId} en ${modeName} — ${dc.label} !`);
  });
  dEl.appendChild(dCard);
  const qEl = $('#challenge-quests');
  qEl.innerHTML = '';
  for (const q of weeklyQuests()) {
    const qDone = !!save.quests.done[q.id];
    const prog = Math.min(save.quests.progress[q.kind] || 0, q.target);
    const row = document.createElement('div');
    row.className = 'card lb-row' + (qDone ? ' ach-done' : '');
    row.innerHTML = `<div class="card-body"><div class="card-title">${qDone ? '✅' : '🎯'} ${q.label}</div><div class="card-sub">${prog}/${q.target} · +${q.reward} 🪙</div><div class="quest-bar"><div style="width:${Math.round((100 * prog) / q.target)}%"></div></div></div>`;
    qEl.appendChild(row);
  }
  const lbEl = $('#challenge-lb');
  lbEl.innerHTML = '<div class="card-sub">Chargement…</div>';
  try {
    const top = await leaderboard.getChallengeTop(dc.id);
    lbEl.innerHTML = '';
    if (!top.length) {
      lbEl.innerHTML = '<div class="card-sub">Aucun score pour aujourd\'hui — sois le premier !</div>';
    } else {
      top.forEach((e, i) => {
        const row = document.createElement('div');
        row.className = 'card lb-row';
        row.innerHTML = `<span class="lb-rank">${i + 1}</span><span class="lb-name">${escapeHtml(e.pseudo || 'Anonyme')}</span><span class="lb-score">${e.score}</span>`;
        lbEl.appendChild(row);
      });
    }
  } catch {
    lbEl.innerHTML = '<div class="card-sub">Classement indisponible (hors ligne).</div>';
  }
}

function renderLevels() {
  const list = $('#levels-list');
  list.innerHTML = '';
  const allDone = LEVELS.every((lv) => store.isCleared(lv.id));
  for (const l of [ENDLESS_LEVEL, ...LEVELS]) {
    // Survie ∞ : débloquée seulement quand les 15 niveaux sont terminés au moins une fois
    const locked = l.endless ? !allDone : l.cost > 0 && !save.unlockedLevels.includes(l.id);
    // v1.3.17 : achat du niveau N autorisé seulement si le niveau N-1 a été TERMINÉ EN ENTIER
    const canBuy = !locked || l.id === 1 || store.isCleared(l.id - 1);
    const c = cur(l.diff || 'auto');
    const best = save.best[l.id];
    const medal = save.trophies[l.id] ? ' 🥇' : '';
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-theme theme-${l.theme}"></div>
      <div class="card-body">
        <div class="card-title">${l.endless ? '∞' : l.id}. ${l.name}${medal}</div>
        <div class="card-sub">${THEMES[l.theme].name} · ${l.endless ? 'vitesse croissante' : `vitesse ${l.speed} · ${l.lines} lignes`}</div>
        <div class="card-best">${best ? `🏆 Record : ${best}` : ''}</div>
      </div>
      <button class="btn small">${locked ? (l.endless ? '🔒 15 niveaux à finir' : canBuy ? `🔒 ${l.cost} ${c.icon}` : `🔒 termine le niveau ${l.id - 1} en entier`) : '▶ Jouer'}</button>`;
    card.querySelector('button').addEventListener('click', () => {
      sfx.click();
      if (locked) {
        if (l.endless) {
          toast('Termine les 15 niveaux (au moins une fois chacun) pour débloquer la Survie ∞ !');
          return;
        }
        if (!canBuy) {
          toast(`Termine d'abord le niveau ${l.id - 1} en entier !`);
          return;
        }
        if (store.spend(l.diff || 'auto', l.cost)) {
          store.unlockLevel(l.id);
          sfx.coin();
          logEvent('purchase', { item: `level:${l.id}`, cost: l.cost, currency: l.diff || 'auto' });
          // v1.3.17 : on débloque SANS lancer la partie (le bouton passe à "▶ Jouer")
          toast(`Niveau ${l.id} débloqué ! Clique sur ▶ Jouer pour lancer la partie.`);
          pushCloud();
          refreshCoins();
          renderLevels();
        } else {
          toast(`Il te manque ${l.cost - store.getWallet(l.diff || 'auto')} ${c.icon} (${c.name})`);
        }
      } else {
        startLevel(l);
      }
    });
    list.appendChild(card);
  }
}

// v1.3.10 : boutique paginée — une catégorie par page
const SHOP_CATS = ['skins', 'effects', 'themes', 'packs', 'sounds'];
let shopCat = 'skins';

function showShopPage(cat) {
  if (!SHOP_CATS.includes(cat)) cat = 'skins';
  shopCat = cat;
  document.querySelectorAll('#shop-tabs .shop-tab').forEach((b) => b.classList.toggle('active', b.dataset.cat === cat));
  document.querySelectorAll('#screen-shop .shop-page').forEach((p) => p.classList.toggle('active', p.dataset.cat === cat));
  const sc = $('#screen-shop');
  if (sc) sc.scrollTop = 0;
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
      <canvas class="swatch car-preview" aria-label="Aperçu ${s.name}"></canvas>
      <div class="card-body">
        <div class="card-title">${s.name}</div>
        <div class="card-sub">${MODEL_LABEL[s.model] || 'Berline'} · ${CAR_STYLE_LABEL[s.style || 'photo']}</div>
      </div>
      <button class="btn small">${selected ? '✓ Équipée' : owned ? 'Équiper' : `${s.cost} ${cur(s.currency || 'auto').icon}`}</button>`;
    card.querySelector('button').addEventListener('click', () => {
      if (selected) return;
      if (owned) {
        store.selectSkin(s.id);
        sfx.click();
      } else if (store.buySkin(s.id, s.cost, s.currency || 'auto')) {
        store.selectSkin(s.id);
        sfx.coin();
        logEvent('purchase', { item: `skin:${s.id}`, cost: s.cost });
        toast(`${s.name} achetée et équipée !`);
        pushCloud();
      } else {
        toast(`Il te manque ${s.cost - store.getWallet(s.currency || 'auto')} ${cur(s.currency || 'auto').icon}`);
        return;
      }
      refreshCoins();
      renderShop();
    });
    renderCarPreview(card.querySelector('canvas.car-preview'), s);
    skinsEl.appendChild(card);
  }
  const thEl = $('#shop-themes');
  if (thEl) {
    thEl.innerHTML = '';
    for (const t of THEME_SHOP) {
      const owned = save.themes.includes(t.id);
      const active = save.themeOverride === t.id;
      const card = document.createElement('div');
      card.className = 'card shop-card';
      card.innerHTML = `
        <canvas class="swatch th-preview" aria-label="Aperçu ${t.name}"></canvas>
        <div class="card-body">
          <div class="card-title">${t.name}</div>
          <div class="card-sub">${t.desc}</div>
        </div>
        <button class="btn small">${active ? '✓ Activé' : owned ? 'Activer' : `${t.cost} ${cur(t.currency || 'auto').icon}`}</button>`;
      card.querySelector('button').addEventListener('click', () => {
        if (!owned) {
          if (store.buyTheme(t.id, t.cost, t.currency || 'auto')) {
            sfx.coin();
            logEvent('purchase', { item: `theme:${t.id}`, cost: t.cost });
            toast(`${t.name} acheté !`);
            pushCloud();
          } else {
            toast(`Il te manque ${t.cost - store.getWallet(t.currency || 'auto')} ${cur(t.currency || 'auto').icon}`);
            return;
          }
        } else {
          store.setThemeOverride(t.id);
          sfx.click();
        }
        refreshCoins();
        renderShop();
      });
      renderThemePreview(card.querySelector('canvas.th-preview'), t.id);
      thEl.appendChild(card);
    }
  }
  const fxEl = $('#shop-effects');
  fxEl.innerHTML = '';
  for (const e of EFFECTS) {
    const owned = save.effects.includes(e.id);
    const active = save.selectedEffects.includes(e.id);
    const card = document.createElement('div');
    card.className = 'card shop-card';
    card.innerHTML = `
      <canvas class="swatch fx-preview" aria-label="Aperçu ${e.name}"></canvas>
      <div class="card-body">
        <div class="card-title">${e.name}</div>
        <div class="card-sub">${e.desc}</div>
      </div>
      <button class="btn small">${active ? '✓ Activé' : owned ? 'Activer' : `${e.cost} ${cur(e.currency || 'auto').icon}`}</button>`;
    card.querySelector('button').addEventListener('click', () => {
      if (active) {
        store.toggleEffect(e.id);
        sfx.click();
      } else if (owned) {
        store.toggleEffect(e.id);
        sfx.click();
      } else if (store.buyEffect(e.id, e.cost, e.currency || 'auto')) {
        sfx.coin();
        logEvent('purchase', { item: `effect:${e.id}`, cost: e.cost });
        toast(`${e.name} acheté et activé !`);
        pushCloud();
      } else {
        toast(`Il te manque ${e.cost - store.getWallet(e.currency || 'auto')} ${cur(e.currency || 'auto').icon}`);
        return;
      }
      refreshCoins();
      renderShop();
    });
    renderEffectPreview(card.querySelector('canvas.fx-preview'), e);
    fxEl.appendChild(card);
  }
  renderPacks();
  renderSoundPacks();
}

function renderPacks() {
  const el = $('#shop-packs');
  if (!el) return;
  el.innerHTML = '';
  for (const p of PACKS) {
    const owned = save.packs.includes(p.id);
    const c = cur(p.currency || 'auto');
    const card = document.createElement('div');
    card.className = 'card shop-card';
    card.innerHTML = `
      <canvas class="swatch pk-preview" aria-label="Aperçu ${p.name}"></canvas>
      <div class="card-body">
        <div class="card-title">${p.name}</div>
        <div class="card-sub">${p.desc}</div>
      </div>
      <button class="btn small">${owned ? '✓ Acheté' : `${p.cost} ${c.icon}`}</button>`;
    card.querySelector('button').addEventListener('click', () => {
      if (owned) return;
      if (store.buyPack(p)) {
        sfx.coin();
        logEvent('purchase', { item: `pack:${p.id}`, cost: p.cost, currency: p.currency || 'auto' });
        toast(`${p.name} acheté ! Contenus débloqués 🎉`);
        pushCloud();
      } else {
        toast(`Il te manque ${p.cost - store.getWallet(p.currency || 'auto')} ${c.icon}`);
        return;
      }
      refreshCoins();
      renderShop();
    });
    renderPackPreview(card.querySelector('canvas.pk-preview'), p);
    el.appendChild(card);
  }
}

function renderSoundPacks() {
  const el = $('#shop-sounds');
  if (!el) return;
  el.innerHTML = '';
  for (const sp of SOUND_PACKS) {
    const owned = save.soundPacks.includes(sp.id);
    const active = save.soundPack === sp.id;
    const c = cur(sp.currency || 'auto');
    const card = document.createElement('div');
    card.className = 'card shop-card';
    card.innerHTML = `
      <canvas class="swatch snd-preview" aria-label="Aperçu ${sp.name}"></canvas>
      <div class="card-body">
        <div class="card-title">${sp.name}</div>
        <div class="card-sub">${sp.desc}</div>
      </div>
      <button class="btn small">${active ? '✓ Actif' : owned ? 'Activer' : `${sp.cost} ${c.icon}`}</button>`;
    card.querySelector('button').addEventListener('click', () => {
      if (active) return;
      if (owned) {
        store.selectSoundPack(sp.id);
        applySoundPack(sp.id);
        sfx.click();
      } else if (store.buySoundPack(sp)) {
        store.selectSoundPack(sp.id);
        applySoundPack(sp.id);
        sfx.coin();
        logEvent('purchase', { item: `soundpack:${sp.id}`, cost: sp.cost, currency: sp.currency || 'auto' });
        toast(`${sp.name} acheté et activé !`);
        pushCloud();
      } else {
        toast(`Il te manque ${sp.cost - store.getWallet(sp.currency || 'auto')} ${c.icon}`);
        return;
      }
      refreshCoins();
      renderShop();
    });
    renderSoundPreview(card.querySelector('canvas.snd-preview'), sp);
    el.appendChild(card);
  }
}

function startLevel(level) {
  currentLevel = level;
  show('screen-game');
  $('#pause-overlay').classList.remove('active');
  hudLevel.textContent = `${level.id}. ${level.name}`;
  hudScore.textContent = '0';
  hudCombo.textContent = '';
  continuesThisRun = 0;
  updateLives(0);
  $('#hud-coins').textContent = `${cur(save.difficulty).icon} ${store.getWallet(save.difficulty)}`;
  logEvent('level_start', { level: level.id, mode: save.difficulty });
  game = new Game($('#game'), {
    level,
    skinId: save.skin,
    mode: save.difficulty,
    themeOverride: save.themeOverride || undefined,
    windows: effWindows(),
    access: { colorblind: save.colorblind },
    effects: save.selectedEffects,
    audio: { tap: sfx.tap, perfect: sfx.perfect, good: sfx.good, passable: sfx.passable, fail: sfx.fail, win: sfx.win, miss: sfx.miss },
    onJudge: (e) => {
      hudScore.textContent = String(e.score);
      hudCombo.textContent = e.combo >= 2 ? `COMBO x${e.combo}` : '';
    },
    onMiss: (m) => updateLives(m),
    onThreshold: showContinue,
    onEnd: onGameEnd,
  });
  game.start();
  lastT = performance.now();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function onGameEnd(stats, level) {
  hideContinue();
  const firstClear = !!stats.completed && !save.best[level.id];
  const isRecord = store.setBest(level.id, stats.score);
  store.addTotals({ runs: 1, perfects: stats.perfects, overtakes: stats.overtakes || 0 });
  // v1.3.17 : niveau "terminé" = partie complétée en entier (débloque l'achat du suivant)
  if (stats.completed) store.markCleared(level.id);
  checkAchievements(stats, level);
  logEvent('game_over', { score: stats.score, level: level.id, mode: save.difficulty, completed: !!stats.completed, reason: stats.reason });
  if (save.pseudo && save.leaderboardOptIn) {
    leaderboard
      .submitScore({ pseudo: save.pseudo, score: stats.score, level: level.name, levelId: level.id, mode: save.difficulty, date: Date.now() })
      .catch(() => {});
  }
  pushCloud();
  let coins = coinsForResult(stats, level, stats.completed);
  let clearBonus = 0;
  if (firstClear) {
    clearBonus = firstClearBonus(level);
    coins += clearBonus;
  }
  const perfectClear = !!stats.completed && isPerfectClear(stats);
  if (perfectClear) store.setTrophy(level.id);
  if (coins > 0) {
    store.addCoins(save.difficulty, coins);
    sfx.coin();
  }
  $('#hud-coins').textContent = `${cur(save.difficulty).icon} ${store.getWallet(save.difficulty)}`;
  // défi du jour (même défi pour tous, dérivé de la date)
  const dc = dailyChallenge();
  if (!store.isChallengeDone(dc.id) && save.difficulty === dc.mode && level.id === dc.levelId) {
    let ok = false;
    if (dc.kind === 'score') ok = stats.score >= dc.target;
    else if (dc.kind === 'perfects') ok = stats.perfects >= dc.target;
    else if (dc.kind === 'combo') ok = stats.bestCombo >= dc.target;
    else if (dc.kind === 'overtakes') ok = (stats.overtakes || 0) >= dc.target;
    else if (dc.kind === 'complete') ok = !!stats.completed;
    if (ok) {
      store.markChallengeDone(dc.id);
      store.addCoins(dc.mode, dc.reward);
      refreshCoins();
      toast(`🎯 Défi du jour réussi : « ${dc.label} » → +${dc.reward} ${cur(dc.mode).icon}`);
      if (save.pseudo && save.leaderboardOptIn) {
        leaderboard.submitChallengeScore(dc.id, { pseudo: save.pseudo, score: stats.score, mode: dc.mode, date: Date.now() }).catch(() => {});
      }
      pushCloud();
    }
  }
  // quêtes de la semaine (progression cumulée)
  const doneQuests = store.addQuestProgress({
    runs: 1,
    perfects: stats.perfects,
    overtakes: stats.overtakes || 0,
    score: stats.score,
    complete: stats.completed ? 1 : 0,
  });
  for (const q of doneQuests) {
    store.addCoins('auto', q.reward);
    refreshCoins();
    toast(`✅ Quête terminée : « ${q.label} » → +${q.reward} 🪙`);
  }
  const reason = stats.reason;
  $('#over-title').textContent = stats.completed
    ? '🏁 Niveau terminé !'
    : reason === 'traffic'
      ? '🚦 Bloqué dans les bouchons !'
      : '💥 3 ratés !';
  $('#over-record').classList.toggle('hidden', !isRecord);
  $('#over-trophy').classList.toggle('hidden', !perfectClear);
  $('#over-score').textContent = stats.score;
  const avg = avgReaction(stats);
  $('#over-stats').innerHTML = `
    <div><b>${stats.perfects}</b><span>Parfaits</span></div>
    <div><b>${stats.goods}</b><span>Bien</span></div>
    <div><b>${stats.passables}</b><span>OK</span></div>
    <div><b>${stats.misses}/${maxMissesFor(save.difficulty)}</b><span>Manquées</span></div>
    <div><b>${stats.overtakes || 0}</b><span>Dépassements</span></div>
    <div><b>${stats.bestCombo}</b><span>Meilleur combo</span></div>
    <div><b>${avg !== null ? avg + ' ms' : '—'}</b><span>Réaction moy.</span></div>
    <div><b>${accuracy(stats)} %</b><span>Précision</span></div>`;
  const ci = cur(save.difficulty).icon;
  $('#over-coins').textContent =
    `+${coins} ${ci} gagnées` +
    (firstClear ? ` (dont +${clearBonus} ${ci} de premier clear ! 🎉)` : '') +
    (perfectClear ? ` — 🥇 FULL PARFAIT ! +${perfectClearBonus(level)} ${ci} et médaille du niveau !` : '');
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
  if (game && currentScreen === 'screen-game' && !document.hidden) {
    game.update(dt);
    game.render();
  }
  if (tut && currentScreen === 'screen-game') tut.tick();
}

window.addEventListener('error', (e) => {
  logEvent('js_error', { message: String(e.message || '') });
});

$('#btn-play').addEventListener('click', () => {
  sfx.click();
  if (!save.tutorialDone) {
    startTutorial();
    return;
  }
  renderDifficultyPicker();
  renderLevels();
  show('screen-levels');
});
$('#btn-achievements').addEventListener('click', () => {
  sfx.click();
  renderAchievements();
  show('screen-achievements');
});
$('#btn-achievements-back').addEventListener('click', () => {
  sfx.click();
  show('screen-menu');
});
$('#btn-access').addEventListener('click', () => {
  sfx.click();
  $('#opt-widewindows').checked = !!save.wideWindows;
  $('#opt-colorblind').checked = !!save.colorblind;
  $('#access-modal').classList.remove('hidden');
  $('#access-modal').classList.add('active');
});
$('#btn-access-close').addEventListener('click', () => {
  sfx.click();
  $('#access-modal').classList.add('hidden');
  $('#access-modal').classList.remove('active');
});
$('#opt-widewindows').addEventListener('change', (e) => {
  store.setWideWindows(e.target.checked);
  toast(e.target.checked ? 'Fenêtres de timing élargies (accessibilité)' : 'Fenêtres de timing standard');
});
$('#opt-colorblind').addEventListener('change', (e) => {
  store.setColorblind(e.target.checked);
  toast(e.target.checked ? 'Symboles ajoutés sur les lignes (mode daltonien)' : 'Mode standard');
});
$('#btn-music').addEventListener('click', () => {
  store.setMusic(!save.music);
  setMusicEnabled(save.music && save.sound);
  updateMusicBtn();
  sfx.click();
});
$('#btn-leaderboard').addEventListener('click', () => {
  sfx.click();
  renderLbFilter();
  renderLbLevelFilter();
  renderLeaderboard();
  show('screen-leaderboard');
});
$('#btn-challenges').addEventListener('click', () => {
  sfx.click();
  renderChallenges();
  show('screen-challenges');
});
$('#btn-challenges-back').addEventListener('click', () => {
  sfx.click();
  show('screen-menu');
});
$('#btn-leaderboard-back').addEventListener('click', () => {
  sfx.click();
  show('screen-menu');
});
function updateGoogleStatus() {
  const el = $('#google-status');
  const out = $('#btn-google-out');
  if (el) {
    el.textContent = save.uid
      ? `🔗 Compte Google lié : ${save.googleEmail || save.uid}`
      : isGoogleAuthConfigured()
        ? 'Connecte-toi avec Google : ta progression sera synchronisée sur tous tes appareils.'
        : 'Google Sign-In non configuré (clés dans js/config.js — voir docs/FIREBASE.md §5).';
  }
  if (out) out.classList.toggle('hidden', !save.uid);
}

$('#btn-pseudo').addEventListener('click', () => {
  sfx.click();
  $('#pseudo-input').value = save.pseudo;
  updateGoogleStatus();
  const gsi = $('#gsi-btn');
  if (gsi && isGoogleAuthConfigured() && !save.uid) {
    gsi.innerHTML = '';
    renderGoogleButton(gsi)
      .then((sess) => {
        if (sess && sess.uid) {
          setAuthToken(sess.idToken);
          store.setGoogleAccount(sess.uid, sess.email, sess.refreshToken);
          gsi.innerHTML = ''; // le bouton Google disparaît une fois lié
          sfx.coin();
          toast(`🔗 Compte Google lié : ${sess.email || sess.uid}`);
          updateGoogleStatus();
          pushCloud();
        } else {
          const why = getLastAuthError();
          toast(`❌ Connexion Google refusée${why ? ' : ' + why : ' — réessaie (F12 console + onglet Réseau pour le détail)'}`, );
        }
      })
      .catch((err) => {
        console.error('[auth] sign-in error:', err);
        toast('❌ Connexion Google impossible : ' + (err && err.message ? err.message : 'erreur inconnue'));
      });
  }
  $('#pseudo-modal').classList.remove('hidden');
  $('#pseudo-modal').classList.add('active');
  setTimeout(() => $('#pseudo-input').focus(), 50);
});
$('#btn-google-out').addEventListener('click', () => {
  signOutGoogle();
  store.clearGoogleAccount();
  sfx.click();
  updateGoogleStatus();
  toast('Compte Google délié — la sauvegarde repasse sur ton pseudo.');
});
$('#btn-pseudo-cancel').addEventListener('click', () => {
  sfx.click();
  $('#pseudo-modal').classList.add('hidden');
  $('#pseudo-modal').classList.remove('active');
});
$('#btn-pseudo-save').addEventListener('click', () => {
  const p = $('#pseudo-input').value.trim().slice(0, 16);
  store.setPseudo(p);
  $('#pseudo-modal').classList.add('hidden');
  $('#pseudo-modal').classList.remove('active');
  sfx.coin();
  toast(p ? `Pseudo enregistré : ${p}` : 'Pseudo supprimé — tu n\'apparaîtras plus dans le classement');
});
$('#optin-lb').addEventListener('change', (e) => {
  store.setLeaderboardOptIn(e.target.checked);
  sfx.click();
  toast(e.target.checked ? 'Tu apparaîtras dans le classement' : 'Tu n\'apparaîtras plus dans le classement');
});
$('#btn-shop').addEventListener('click', () => {
  sfx.click();
  renderShop();
  showShopPage(shopCat);
  show('screen-shop');
});
$('#btn-help').addEventListener('click', () => {
  sfx.click();
  startTutorial();
});
$('#btn-sound').addEventListener('click', () => {
  store.setSound(!save.sound);
  setEnabled(save.sound);
  setMusicEnabled(save.music && save.sound);
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
document.querySelectorAll('#shop-tabs .shop-tab').forEach((b) => {
  b.addEventListener('click', () => {
    sfx.click();
    showShopPage(b.dataset.cat);
  });
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
$('#btn-continue-restart').addEventListener('click', () => {
  sfx.click();
  hideContinue();
  if (game) game.running = false;
  if (currentLevel) startLevel(currentLevel);
});
$('#btn-continue-coins').addEventListener('click', () => {
  const cost = continueCost(continuesThisRun);
  if (store.spend(save.difficulty, cost)) {
    continuesThisRun++;
    sfx.coin();
    logEvent('continue_purchased', { cost, currency: save.difficulty });
    hideContinue();
    game?.resumeWithContinue();
  } else {
    toast(`Il te manque ${cost - store.getWallet(save.difficulty)} ${cur(save.difficulty).icon}`);
  }
});
$('#btn-continue-ad').addEventListener('click', () => {
  hideContinue();
  watchRewarded((ok) => {
    if (ok && game && game.running) {
      continuesThisRun++;
      logEvent('ad_watched', { reward: 'continue' });
      game.resumeWithContinue();
    } else if (game) {
      game.finish(false);
    }
  });
});
$('#btn-continue-quit').addEventListener('click', () => {
  hideContinue();
  if (game) game.finish(false);
});

let pointerStart = null;
let pointerLast = null;
let swipeFired = false;

const canPlayNow = () => currentScreen === 'screen-game' && game && game.running && !game.paused && !game.tutHold;

// Le swipe vers la gauche est détecté dès 40 px de déplacement (pointermove),
// au relâchement (pointerup) ET à l'annulation (pointercancel) : fiable sur
// téléphone même si le navigateur interrompt le geste par un pointercancel.
function trySwipe(x) {
  if (!pointerStart || swipeFired) return;
  if (x - pointerStart.x < -40) {
    swipeFired = true;
    if (canPlayNow()) game.swipeLeft();
  }
}

window.addEventListener('pointerdown', (e) => {
  unlockAudio();
  pointerStart = { x: e.clientX, y: e.clientY };
  pointerLast = pointerStart;
  swipeFired = false;
  if (!canPlayNow()) return;
  if (e.target.closest('button')) return;
  const zone = e.clientY < window.innerHeight / 2 ? 'front' : 'rear';
  game.tap(zone);
});

window.addEventListener('pointermove', (e) => {
  if (!pointerStart) return;
  pointerLast = { x: e.clientX, y: e.clientY };
  trySwipe(e.clientX);
});

window.addEventListener('pointerup', (e) => {
  trySwipe(e.clientX);
  pointerStart = null;
  pointerLast = null;
  swipeFired = false;
});

window.addEventListener('pointercancel', () => {
  if (pointerLast) trySwipe(pointerLast.x);
  pointerStart = null;
  pointerLast = null;
  swipeFired = false;
});

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const canPlay = canPlayNow();
  if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'Enter') {
    e.preventDefault();
    if (canPlay) game.tap('rear');
  }
  if (e.code === 'ArrowUp') {
    e.preventDefault();
    if (canPlay) game.tap('front');
  }
  if (e.code === 'ArrowLeft') {
    e.preventDefault();
    if (canPlay) game.swipeLeft();
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
updateMusicBtn();
setMusicEnabled(save.music && save.sound);
renderDifficultyPicker();
$('#optin-lb').checked = !!save.leaderboardOptIn;
refreshStatus();
show('screen-menu');

// restauration silencieuse de la session Google au démarrage
if (save.uid && save.googleRefresh) {
  restoreGoogleSession(save.googleRefresh).then((sess) => {
    if (sess) {
      setAuthToken(sess.idToken);
      store.setGoogleAccount(sess.uid, sess.email || save.googleEmail, sess.refreshToken);
    }
    if (leaderboard.isOnline() && accountKey()) {
      cloudsave.load(accountKey(), getAuthToken()).then((remote) => {
        if (remote && store.mergeRemote(remote)) {
          refreshCoins();
          renderLevels();
          renderShop();
          toast('☁️ Progression synchronisée avec le cloud');
        }
      });
    }
  });
} else if (leaderboard.isOnline() && accountKey()) {
  cloudsave.load(accountKey(), getAuthToken()).then((remote) => {
    if (remote && store.mergeRemote(remote)) {
      refreshCoins();
      renderLevels();
      renderShop();
      toast('☁️ Progression synchronisée avec le cloud');
    }
  });
}
rafId = requestAnimationFrame(loop);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
