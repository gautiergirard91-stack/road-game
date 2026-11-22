import { LEVELS, THEMES, SKINS, EFFECTS, DIFFICULTIES, CURRENCIES, WINDOWS, ACHIEVEMENTS, THEME_SHOP, ENDLESS_LEVEL, PACKS, SOUND_PACKS } from './data.js';
import { Game, CAR_STYLE_LABEL, renderCarPreview, renderEffectPreview, renderThemePreview, renderPackPreview, renderSoundPreview } from './game.js';
import * as store from './store.js';
import { sfx, setEnabled, setMusicEnabled, unlockAudio, applySoundPack } from './audio.js';
import { coinsForResult, accuracy, avgReaction, continueCost, maxMissesFor, firstClearBonus, isPerfectClear, perfectClearBonus, dailyChallenge, weeklyQuests, fmtTime, zoneFromPoint, keyToAction, isNewerVersion } from './core.js';
import { watchRewarded } from './ads.js';
import { Tutorial } from './tutorial.js';
import * as leaderboard from './leaderboard.js';
import * as cloudsave from './cloudsave.js';
import { renderGoogleButton, restoreGoogleSession, setAuthToken, getAuthToken, signOutGoogle, isGoogleAuthConfigured, getLastAuthError, signInWithPopupGoogle } from './auth.js';
import { logEvent } from './analytics.js';
import { VERSION } from './config.js';

const $ = (sel) => document.querySelector(sel);

// v1.3.24 : câblage résistant — ne plante pas si un élément manque dans le HTML (mélange de versions SW)
function on(id, ev, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(ev, fn);
}

// v1.3.24 : une erreur JS au démarrage s'affiche à l'écran au lieu de laisser une page morte
window.addEventListener('error', (e) => {
  console.error(e.error || e.message);
  try {
    let d = document.getElementById('fatal-error');
    if (!d) {
      d = document.createElement('div');
      d.id = 'fatal-error';
      d.style.cssText = 'position:fixed;left:8px;bottom:8px;max-width:92vw;z-index:9999;background:#5c1620;color:#fff;font:12px/1.4 monospace;padding:8px 10px;border-radius:8px;white-space:pre-wrap';
      document.body.appendChild(d);
    }
    d.textContent = 'Erreur JS : ' + (e.message || String(e.error)) + ' (' + String(e.filename || '').split('/').pop() + ':' + e.lineno + ')';
  } catch { /* ignore */ }
});
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
      if (save.speedrun && d.id !== 'pilote') {
        store.setSpeedrun(false);
        renderModePicker();
        toast('Mode Speedrun désactivé (il se cale sur la difficulté Pilote)');
      }
      store.setDifficulty(d.id);
      sfx.click();
      renderDifficultyPicker();
    });
    el.appendChild(b);
  }
  renderModePicker();
}

// v1.3.19 : sélecteur de mode (Standard / Speedrun)
function renderModePicker() {
  const normal = $('#btn-mode-normal');
  const sr = $('#btn-mode-speedrun');
  if (!normal || !sr) return;
  normal.classList.toggle('active', !save.speedrun);
  sr.classList.toggle('active', !!save.speedrun);
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
  const opts = [{ id: 'all', name: 'Tous' }, ...DIFFICULTIES, { id: 'speedrun', name: '⏱ Speedrun' }]; // v1.3.31 : classement temps dédié
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
  const list = $('#leaderboard-list');
  list.innerHTML = '<div class="card-sub">Chargement…</div>';
  const isSr = lbFilter === 'speedrun'; // v1.3.31 : classement speedrun (temps, tri croissant)
  let top = [];
  try {
    top = isSr ? await leaderboard.getSpeedrunTop(lbLevelFilter) : await leaderboard.getTop(lbFilter, lbLevelFilter);
  } catch {
    top = [];
  }
  // v1.3.27 : diagnostic visible pour expliquer un classement "vide" (règles RTDB, réseau, etc.)
  const st = leaderboard.getLbStatus ? leaderboard.getLbStatus() : null;
  const srcEl = $('#lb-source');
  if (!leaderboard.isOnline()) {
    srcEl.textContent = 'Classement local — configure Firebase dans js/config.js pour un classement en ligne (voir README)';
  } else if (st && st.source === 'firebase') {
    srcEl.textContent = `${isSr ? '⏱ Classement speedrun' : 'Classement'} en ligne (Firebase) — ${st.count} ${isSr ? 'temps' : 'score(s)'} chargé(s)` + (st.error ? ` — ⚠ ${st.error}` : '');
  } else if (st && st.error) {
    srcEl.textContent = `⚠ ${isSr ? 'Speedrun' : 'Firebase'} injoignable ou refusé : ${st.error} — affichage local`;
  } else {
    srcEl.textContent = `${isSr ? '⏱ Classement speedrun' : 'Classement'} en ligne (Firebase) — aucun ${isSr ? 'temps' : 'score'} en ligne pour ce filtre, affichage local`;
  }
  // v1.3.28 : si les envois sont refusés (403…), on le dit aussi — sinon on croit que le nœud est juste vide
  if (st && st.writeError) srcEl.textContent += ` — ⚠ ${st.writeError}`;
  list.innerHTML = '';
  if (!top.length) {
    const hint = leaderboard.isOnline()
      ? (isSr
        ? 'Aucun temps speedrun en ligne — finis un niveau en mode ⏱ Speedrun ! (règles RTDB : nœud /speedrun, voir docs/FIREBASE.md)'
        : 'Vérifie les règles RTDB : ouvre ' + 'https://realtime-database-5fd49-default-rtdb.europe-west1.firebasedatabase.app/scores.json' + ' (doit répondre 200 avec des données ou null).')
      : (isSr ? 'Aucun temps pour l\'instant — joue en mode ⏱ Speedrun !' : 'Aucun score pour l\'instant — joue une partie !');
    list.innerHTML = `<div class="card-sub">${hint}</div>`;
    return;
  }
  top.forEach((e, i) => {
    const row = document.createElement('div');
    row.className = 'card lb-row';
    const me = save.pseudo && e.pseudo === save.pseudo;
    const right = isSr ? `⏱ ${fmtTime((e.timeMs || 0) / 1000)}` : e.score; // v1.3.31 : speedrun = temps formaté
    row.innerHTML = `<span class="lb-rank">${i + 1}</span><span class="lb-name${me ? ' me' : ''}">${escapeHtml(e.pseudo || 'Anonyme')}</span><span class="lb-level">${escapeHtml(e.level || '')}</span><span class="lb-score">${right}</span>`;
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
// v1.3.32 : cloud UNIQUEMENT keyed par uid Google (règles players: auth.uid == $id).
// Sans compte Google -> sauvegarde 100 % locale (le pseudo seul ne protège pas /players).
const accountKey = () => save.uid || '';

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
    access: { colorblind: save.colorblind, horizontalZones: save.horizontalZones },
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
    const bt = save.bestTime[l.id]; // v1.3.19 : record speedrun
    const medal = save.trophies[l.id] ? ' 🥇' : '';
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <canvas class="card-theme level-preview" aria-label="Aperçu ${l.name}"></canvas>
      <div class="card-body">
        <div class="card-title">${l.endless ? '∞' : l.id}. ${l.name}${medal}</div>
        <div class="card-sub">${THEMES[l.theme].name} · ${l.endless ? 'vitesse croissante' : `vitesse ${l.speed} · ${l.lines} lignes`}</div>
        <div class="card-best">${best ? `🏆 Record : ${best}` : ''}${bt ? `${best ? ' · ' : ''}⏱ ${fmtTime(bt / 1000)}` : ''}</div>
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
        ensurePseudoThen(() => startLevel(l)); // v1.3.29 : pseudo obligatoire avant de jouer
      }
    });
    // v1.3.18 : aperçu réel du thème du niveau (mini route canvas, comme en boutique)
    renderThemePreview(card.querySelector('canvas.level-preview'), l.theme, 52, 52);
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
        toast(`${e.name} acheté ! Tape « Activer » pour l'utiliser`); // v1.3.28 : jamais activé automatiquement
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
  hudScore.textContent = save.speedrun ? '0:00.00' : '0';
  hudCombo.textContent = '';
  continuesThisRun = 0;
  updateLives(0);
  $('#hud-coins').textContent = `${cur(save.difficulty).icon} ${store.getWallet(save.difficulty)}`;
  logEvent('level_start', { level: level.id, mode: save.difficulty });
  game = new Game($('#game'), {
    level,
    skinId: save.skin,
    mode: save.speedrun ? 'pilote' : save.difficulty,
    speedrun: save.speedrun, // v1.3.19 : mode speedrun (chrono + vitesse bonus)
    themeOverride: save.themeOverride || undefined,
    windows: effWindows(),
    access: { colorblind: save.colorblind, horizontalZones: save.horizontalZones },
    effects: save.selectedEffects,
    audio: { tap: sfx.tap, perfect: sfx.perfect, good: sfx.good, passable: sfx.passable, fail: sfx.fail, win: sfx.win, miss: sfx.miss },
    onJudge: (e) => {
      hudScore.textContent = save.speedrun && game ? fmtTime(game.elapsed) : String(e.score);
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

// v1.3.19 : speedrun — compte à rebours de 10 s avant le niveau suivant
let nextTimer = null;
function cancelNextCountdown() {
  if (nextTimer) {
    clearInterval(nextTimer);
    nextTimer = null;
  }
  const el = $('#over-next');
  if (el) el.classList.add('hidden');
}
function startNextCountdown(nextLevel) {
  cancelNextCountdown();
  const el = $('#over-next');
  if (!el || !nextLevel) return;
  el.classList.remove('hidden');
  let left = 10;
  const countEl = $('#over-count');
  const barEl = $('#over-count-bar');
  if (countEl) countEl.textContent = '10';
  if (barEl) barEl.style.width = '100%';
  nextTimer = setInterval(() => {
    left -= 0.1;
    const s = Math.max(0, left);
    if (countEl) countEl.textContent = String(Math.ceil(s));
    if (barEl) barEl.style.width = `${(s / 10) * 100}%`;
    if (s <= 0) {
      cancelNextCountdown();
      startLevel(nextLevel);
    }
  }, 100);
}

function onGameEnd(stats, level) {
  hideContinue();
  const sr = Boolean(game && game.speedrun); // v1.3.19 : mode speedrun actif sur cette partie
  const firstClear = !!stats.completed && !save.best[level.id];
  const isRecord = store.setBest(level.id, stats.score);
  const isTimeRecord = sr && stats.completed ? store.setBestTime(level.id, stats.timeMs || 0) : false;
  store.addTotals({ runs: 1, perfects: stats.perfects, overtakes: stats.overtakes || 0 });
  // v1.3.17 : niveau "terminé" = partie complétée en entier (débloque l'achat du suivant)
  if (stats.completed) store.markCleared(level.id);
  checkAchievements(stats, level);
  logEvent('game_over', { score: stats.score, level: level.id, mode: save.difficulty, completed: !!stats.completed, reason: stats.reason });
  if (!sr && save.pseudo) {
    // v1.3.19 : en speedrun le score est un temps -> pas de classement global (record local bestTime)
    // v1.3.29 : envoi systématique dès qu'un pseudo existe (opt-in retiré, classement par défaut)
    leaderboard
      // v1.3.32 : uid + jeton -> règles RTDB vérifient uid == auth.uid (anti-usurpation)
      .submitScore({ pseudo: save.pseudo, uid: save.uid || '', score: stats.score, level: level.name, levelId: level.id, mode: save.difficulty, date: Date.now() }, getAuthToken())
      .catch(() => {});
  }
  if (sr && stats.completed && save.pseudo) {
    // v1.3.31 : classement speedrun dédié (nœud /speedrun/<levelId>, temps en ms, tri croissant)
    leaderboard
      .submitSpeedrun(level.id, { pseudo: save.pseudo, uid: save.uid || '', timeMs: stats.timeMs || 0, level: level.name, levelId: level.id, mode: 'pilote', date: Date.now() }, getAuthToken())
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
      if (save.pseudo) {
        // v1.3.29 : plus d'opt-in, envoi systématique
        leaderboard.submitChallengeScore(dc.id, { pseudo: save.pseudo, uid: save.uid || '', score: stats.score, mode: dc.mode, date: Date.now() }, getAuthToken()).catch(() => {});
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
  $('#over-title').textContent = sr && stats.completed
    ? `⏱ ${fmtTime((stats.timeMs || 0) / 1000)} — Niveau terminé !`
    : stats.completed
      ? '🏁 Niveau terminé !'
      : reason === 'traffic'
        ? '🚦 Bloqué dans les bouchons !'
        : '💥 3 ratés !';
  $('#over-record').classList.toggle('hidden', !isRecord && !isTimeRecord);
  $('#over-trophy').classList.toggle('hidden', !perfectClear);
  const scoreLabel = document.querySelector('#screen-over .score-label');
  if (sr) {
    $('#over-score').textContent = fmtTime((stats.timeMs || 0) / 1000);
    if (scoreLabel) scoreLabel.textContent = 'temps (speedrun ⏱)';
  } else {
    $('#over-score').textContent = stats.score;
    if (scoreLabel) scoreLabel.textContent = 'points';
  }
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
    // v1.3.19 : speedrun + niveau terminé -> compte à rebours 10 s vers le niveau suivant
    if (sr && stats.completed) {
      const next = LEVELS.find((l) => l.id === level.id + 1);
      if (next) startNextCountdown(next);
      else $('#over-title').textContent = '🏁 Speedrun terminé — bravo !';
    } else {
      cancelNextCountdown();
    }
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
    if (game.speedrun) hudScore.textContent = fmtTime(game.elapsed); // v1.3.19 : le HUD affiche le chrono
  }
  if (tut && currentScreen === 'screen-game') tut.tick();
}

window.addEventListener('error', (e) => {
  logEvent('js_error', { message: String(e.message || '') });
});

on('btn-play', 'click', () => {
  sfx.click();
  if (!save.tutorialDone) {
    ensurePseudoThen(() => startTutorial()); // v1.3.29 : pseudo obligatoire avant la 1ʳᵉ partie
    return;
  }
  renderDifficultyPicker();
  renderLevels();
  show('screen-levels');
});
on('btn-achievements', 'click', () => {
  sfx.click();
  renderAchievements();
  show('screen-achievements');
});
on('btn-achievements-back', 'click', () => {
  sfx.click();
  show('screen-menu');
});
on('btn-access', 'click', () => {
  sfx.click();
  for (const [id, key] of [['opt-widewindows', 'wideWindows'], ['opt-colorblind', 'colorblind'], ['opt-zones-h', 'horizontalZones']]) {
    const el = document.getElementById(id);
    if (el) el.checked = !!save[key];
  }
  $('#access-modal').classList.remove('hidden');
  $('#access-modal').classList.add('active');
});
on('btn-access-close', 'click', () => {
  sfx.click();
  $('#access-modal').classList.add('hidden');
  $('#access-modal').classList.remove('active');
});
on('opt-widewindows', 'change', (e) => {
  store.setWideWindows(e.target.checked);
  toast(e.target.checked ? 'Fenêtres de timing élargies (accessibilité)' : 'Fenêtres de timing standard');
});
on('opt-colorblind', 'change', (e) => {
  store.setColorblind(e.target.checked);
  toast(e.target.checked ? 'Symboles ajoutés sur les lignes (mode daltonien)' : 'Mode standard');
});
on('opt-zones-h', 'change', (e) => {
  store.setHorizontalZones(e.target.checked);
  toast(e.target.checked ? '🔄 Zones gauche/droite : gauche = roues AV, droite = roues AR' : 'Zones haut/bas rétablies (haut = AV, bas = AR)');
});
on('btn-music', 'click', () => {
  store.setMusic(!save.music);
  setMusicEnabled(save.music && save.sound);
  updateMusicBtn();
  sfx.click();
});
on('btn-leaderboard', 'click', () => {
  sfx.click();
  renderLbFilter();
  renderLbLevelFilter();
  renderLeaderboard();
  show('screen-leaderboard');
});
on('btn-challenges', 'click', () => {
  sfx.click();
  renderChallenges();
  show('screen-challenges');
});
on('btn-challenges-back', 'click', () => {
  sfx.click();
  show('screen-menu');
});
on('btn-leaderboard-back', 'click', () => {
  sfx.click();
  show('screen-menu');
});
// v1.3.33 : termine la connexion Google (bouton GIS OU popup) : compte lié + jeton +
// chargement immédiat de la sauvegarde cloud et fusion (sinon la progression ne change
// pas à la connexion — bug « la page reste inchangée après connexion »).
async function completeGoogleSignIn(sess) {
  setAuthToken(sess.idToken);
  store.setGoogleAccount(sess.uid, sess.email, sess.refreshToken);
  sfx.coin();
  toast(`🔗 Compte Google lié : ${sess.email || sess.uid}`);
  updateGoogleStatus();
  const gsi = $('#gsi-btn');
  if (gsi) gsi.innerHTML = ''; // le bouton officiel disparaît une fois lié
  if (leaderboard.isOnline() && save.uid) {
    try {
      const remote = await cloudsave.load(save.uid, getAuthToken());
      if (remote && store.mergeRemote(remote)) {
        refreshCoins();
        renderLevels();
        renderShop();
        renderDifficultyPicker();
        toast('☁️ Progression synchronisée avec le cloud');
      }
    } catch (e) {
      console.warn('[auth] chargement cloud après connexion:', e);
    }
  }
  pushCloud();
}

function updateGoogleStatus() {
  const el = $('#google-status');
  const out = $('#btn-google-out');
  const popup = $('#btn-google-popup');
  if (popup) popup.classList.toggle('hidden', !isGoogleAuthConfigured() || !!save.uid);
  if (el) {
    el.textContent = save.uid
      ? `🔗 Compte Google lié : ${save.googleEmail || save.uid}`
      : isGoogleAuthConfigured()
        ? 'Connecte-toi avec Google : ta progression sera sauvegardée dans le cloud (sécurisé, liée à ton compte) sur tous tes appareils.'
        : 'Google Sign-In non configuré (clés dans js/config.js — voir docs/FIREBASE.md §5). Sans Google, la progression reste locale (cet appareil uniquement).';
  }
  if (out) out.classList.toggle('hidden', !save.uid);
}

// v1.3.29 : pseudo OBLIGATOIRE avant la première partie + classement par défaut (opt-in retiré)
let pseudoForced = false;
let pendingAfterPseudo = null;

function openPseudoModal(forced) {
  pseudoForced = !!forced;
  $('#pseudo-input').value = save.pseudo;
  updateGoogleStatus();
  const cancel = $('#btn-pseudo-cancel');
  if (cancel) cancel.classList.toggle('hidden', pseudoForced); // pas d'annulation si obligatoire
  const hint = $('#pseudo-hint');
  if (hint) {
    hint.textContent = pseudoForced
      ? 'Obligatoire : choisis un pseudo (16 caractères max) pour apparaître dans le classement mondial 🌍'
      : 'Ton pseudo est public : il apparaîtra dans le classement mondial 🌍';
  }
  const gsi = $('#gsi-btn');
  if (gsi && isGoogleAuthConfigured() && !save.uid) {
    gsi.innerHTML = '';
    renderGoogleButton(gsi)
      .then((sess) => {
        if (sess && sess.uid) {
          completeGoogleSignIn(sess); // v1.3.33 : inclut le chargement cloud + synchro
        } else {
          const why = getLastAuthError();
          toast(`❌ Bouton Google bloqué/annulé${why ? ' : ' + why : ''} — essaie le bouton « popup » en dessous (F12 console pour le détail)`, );
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
}

// À appeler avant de lancer une partie : si pas de pseudo, on ouvre la modale (obligatoire)
// et on exécute fn seulement après validation.
function ensurePseudoThen(fn) {
  if (save.pseudo) {
    fn();
    return;
  }
  pendingAfterPseudo = fn;
  openPseudoModal(true);
}

on('btn-pseudo', 'click', () => {
  sfx.click();
  openPseudoModal(false);
});
// v1.3.33 : repli si le bouton officiel GIS est bloqué (uBlock/Privacy Badger…) : popup SDK Firebase
on('btn-google-popup', 'click', () => {
  sfx.click();
  signInWithPopupGoogle()
    .then((sess) => {
      if (sess && sess.uid) completeGoogleSignIn(sess);
      else toast('❌ Connexion Google annulée');
    })
    .catch((err) => {
      console.error('[auth] popup error:', err);
      toast('❌ Connexion Google impossible : ' + (err && err.message ? err.message : 'erreur inconnue') + ' — vérifie les domaines autorisés (docs/FIREBASE.md §5)');
    });
});
on('btn-google-out', 'click', () => {
  signOutGoogle();
  store.clearGoogleAccount();
  sfx.click();
  updateGoogleStatus();
  toast('Compte Google délié — sauvegarde cloud désactivée, ta progression reste en local sur cet appareil.');
});
on('btn-pseudo-cancel', 'click', () => {
  if (pseudoForced) return; // v1.3.29 : pseudo obligatoire -> pas d'annulation
  sfx.click();
  $('#pseudo-modal').classList.add('hidden');
  $('#pseudo-modal').classList.remove('active');
});
on('btn-pseudo-save', 'click', () => {
  const p = $('#pseudo-input').value.trim().slice(0, 16);
  if (pseudoForced && !p) {
    toast('Choisis un pseudo pour jouer 🙂 (16 caractères max)');
    sfx.miss?.();
    return;
  }
  store.setPseudo(p);
  $('#pseudo-modal').classList.add('hidden');
  $('#pseudo-modal').classList.remove('active');
  sfx.coin();
  toast(p ? `Pseudo enregistré : ${p} — tu apparaîtras dans le classement 🌍` : 'Pseudo vide — il te sera redemandé à la prochaine partie');
  pushCloud();
  const fn = pendingAfterPseudo;
  pendingAfterPseudo = null;
  if (fn) fn();
});
on('btn-shop', 'click', () => {
  sfx.click();
  renderShop();
  showShopPage(shopCat);
  show('screen-shop');
});
on('btn-mode-normal', 'click', () => {
  store.setSpeedrun(false);
  sfx.click();
  renderModePicker();
});
on('btn-mode-speedrun', 'click', () => {
  store.setSpeedrun(true);
  store.setDifficulty('pilote'); // v1.3.19 : le speedrun se cale sur Pilote
  sfx.click();
  renderModePicker();
  renderDifficultyPicker();
  toast('⏱ Mode Speedrun : termine le niveau le plus vite possible ! (difficulté Pilote)');
});
on('btn-help', 'click', () => {
  sfx.click();
  ensurePseudoThen(() => startTutorial()); // v1.3.29 : pseudo obligatoire avant le tuto aussi
});
// v1.3.22 : replier/déplier la bannière du tutoriel (le texte ne bloque plus le haut de l'écran)
on('tut-fold', 'click', () => {
  sfx.click();
  const b = $('#tut-banner');
  const f = !b.classList.contains('folded');
  b.classList.toggle('folded', f);
  $('#tut-fold').textContent = f ? '▴' : '▾';
});
on('btn-sound', 'click', () => {
  store.setSound(!save.sound);
  setEnabled(save.sound);
  setMusicEnabled(save.music && save.sound);
  updateSoundBtn();
  sfx.click();
});
on('btn-levels-back', 'click', () => {
  sfx.click();
  show('screen-menu');
});
on('btn-shop-back', 'click', () => {
  sfx.click();
  show('screen-menu');
});
document.querySelectorAll('#shop-tabs .shop-tab').forEach((b) => {
  b.addEventListener('click', () => {
    sfx.click();
    showShopPage(b.dataset.cat);
  });
});

on('btn-pause', 'click', () => togglePause());
on('btn-resume', 'click', () => togglePause(false));
on('btn-quit', 'click', () => {
  if (game) game.running = false;
  $('#pause-overlay').classList.remove('active');
  renderLevels();
  show('screen-levels');
});
on('btn-retry', 'click', () => {
  sfx.click();
  cancelNextCountdown();
  if (currentLevel) startLevel(currentLevel);
});
on('btn-over-levels', 'click', () => {
  sfx.click();
  cancelNextCountdown(); // v1.3.19 : on quitte sans attendre le compte à rebours
  renderLevels();
  show('screen-levels');
});
on('btn-over-menu', 'click', () => {
  sfx.click();
  cancelNextCountdown();
  show('screen-menu');
});
on('btn-over-next', 'click', () => {
  sfx.click();
  const next = currentLevel ? LEVELS.find((l) => l.id === currentLevel.id + 1) : null;
  cancelNextCountdown();
  if (next) startLevel(next);
});
on('btn-continue-restart', 'click', () => {
  sfx.click();
  hideContinue();
  if (game) game.running = false;
  if (currentLevel) startLevel(currentLevel);
});
on('btn-continue-coins', 'click', () => {
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
on('btn-continue-ad', 'click', () => {
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
on('btn-continue-quit', 'click', () => {
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
  if (e.target.closest('button, input, select, textarea, a, label')) return; // ne pas taper le jeu quand on touche un contrôle
  // v1.3.21/v1.3.28 : option zones gauche/droite (gauche = AV, droite = AR) au lieu de haut/bas
  const zone = zoneFromPoint(e.clientX, e.clientY, window.innerWidth, window.innerHeight, save.horizontalZones);
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
  // v1.3.28 : UNE SEULE action par touche via keyToAction (sinon ArrowLeft = tap AV + swipe
  // quand les zones horizontales sont actives ; le swipe clavier passe sur ArrowDown/KeyS)
  const action = keyToAction(e.code, save.horizontalZones);
  if (action) {
    e.preventDefault();
    if (canPlay) {
      if (action === 'swipe') game.swipeLeft();
      else game.tap(action);
    }
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
  if (currentScreen !== 'screen-game') return;
  // v1.3.20 : ne JAMAIS empêcher le touchmove des contrôles (sinon le curseur du tuto
  // est coupé sur mobile et n'atteint pas 100 %)
  if (e.target.closest && e.target.closest('input, button, select, textarea, a, label')) return;
  e.preventDefault();
}, { passive: false });

refreshCoins();
updateSoundBtn();
updateMusicBtn();
setMusicEnabled(save.music && save.sound);
renderDifficultyPicker();
refreshStatus();
show('screen-menu');
checkServerVersion(); // v1.3.30 : sonde anti-SW-obsolète (démarrage uniquement)

// v1.3.30 : si le serveur sert une version plus récente que la page chargée (vieux SW en cache),
// on réinitialise proprement UNE FOIS par session : unregister SW + vidage des caches + reload.
// (localStorage = sauvegarde conservée volontairement ; "Clear site data" manuel ne sert plus
//  que si le stockage lui-même est corrompu)
async function resetSWAndReload() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (e) {
    console.warn('[sw] reset impossible:', e);
  }
  location.reload();
}

async function checkServerVersion() {
  try {
    // version.json n'est jamais caché par le SW (sw.js v1.3.30) -> on lit le vrai serveur
    const res = await fetch(`version.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    const serverV = data && data.version;
    if (!serverV || !isNewerVersion(serverV, VERSION)) return; // à jour (ou serveur plus vieux = dev)
    console.info(`[version] serveur v${serverV} > page chargée v${VERSION} -> reset SW proposé`);
    const banner = $('#version-banner');
    const txt = $('#version-banner-text');
    if (txt) txt.textContent = `🔄 Mise à jour dispo : v${serverV} (page : v${VERSION})`;
    if (banner) banner.classList.remove('hidden');
    if (!sessionStorage.getItem('roadtap_sw_reset_once')) {
      sessionStorage.setItem('roadtap_sw_reset_once', '1');
      await resetSWAndReload(); // auto, une seule fois par session
    }
  } catch {
    /* hors ligne : la sonde échoue silencieusement */
  }
}
on('btn-version-reset', 'click', () => {
  sfx.click();
  resetSWAndReload();
});

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
