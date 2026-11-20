import { LEVELS, THEMES, SKINS, EFFECTS, DIFFICULTIES, CURRENCIES, WINDOWS, ACHIEVEMENTS, THEME_SHOP, ENDLESS_LEVEL } from './data.js';
import { Game } from './game.js';
import * as store from './store.js';
import { sfx, setEnabled, setMusicEnabled, unlockAudio } from './audio.js';
import { coinsForResult, accuracy, avgReaction, continueCost, maxMissesFor, firstClearBonus, isPerfectClear, perfectClearBonus } from './core.js';
import { watchRewarded } from './ads.js';
import { Tutorial } from './tutorial.js';
import * as leaderboard from './leaderboard.js';
import * as cloudsave from './cloudsave.js';
import { logEvent } from './analytics.js';
import { VERSION } from './config.js';

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
const hudLives = $('#hud-lives');

let continuesThisRun = 0;

const MODEL_LABEL = { berline: 'Berline', sport: 'Sport', citadine: 'Citadine' };

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
    top = await leaderboard.getTop(lbFilter);
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

function pushCloud() {
  if (leaderboard.isOnline() && save.pseudo) cloudsave.save(save.pseudo, store.snapshot());
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

function renderLevels() {
  const list = $('#levels-list');
  list.innerHTML = '';
  const allDone = LEVELS.every((lv) => (save.best[lv.id] || 0) > 0);
  for (const l of [ENDLESS_LEVEL, ...LEVELS]) {
    // Survie ∞ : débloquée seulement quand les 15 niveaux sont terminés au moins une fois
    const locked = l.endless ? !allDone : l.cost > 0 && !save.unlockedLevels.includes(l.id);
    // achat du niveau N autorisé seulement si le niveau N-1 a été terminé au moins une fois
    const canBuy = !locked || l.id === 1 || (save.best[l.id - 1] || 0) > 0;
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
      <button class="btn small">${locked ? (l.endless ? '🔒 15 niveaux à finir' : canBuy ? `🔒 ${l.cost} ${c.icon}` : `🔒 finis le niveau ${l.id - 1}`) : '▶ Jouer'}</button>`;
    card.querySelector('button').addEventListener('click', () => {
      sfx.click();
      if (locked) {
        if (l.endless) {
          toast('Termine les 15 niveaux (au moins une fois chacun) pour débloquer la Survie ∞ !');
          return;
        }
        if (!canBuy) {
          toast(`Termine d'abord le niveau ${l.id - 1} au moins une fois !`);
          return;
        }
        if (store.spend(l.diff || 'auto', l.cost)) {
          store.unlockLevel(l.id);
          sfx.coin();
          logEvent('purchase', { item: `level:${l.id}`, cost: l.cost, currency: l.diff || 'auto' });
          toast(`Niveau ${l.id} débloqué !`);
          pushCloud();
          refreshCoins();
          renderLevels();
          startLevel(l);
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
        <div class="card-sub">${MODEL_LABEL[s.model] || 'Berline'}</div>
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
        logEvent('purchase', { item: `skin:${s.id}`, cost: s.cost });
        toast(`${s.name} achetée et équipée !`);
        pushCloud();
      } else {
        toast(`Il te manque ${s.cost - store.getWallet('auto')} 🪙`);
        return;
      }
      refreshCoins();
      renderShop();
    });
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
        <div class="swatch fx">🎨</div>
        <div class="card-body">
          <div class="card-title">${t.name}</div>
          <div class="card-sub">${t.desc}</div>
        </div>
        <button class="btn small">${active ? '✓ Activé' : owned ? 'Activer' : `${t.cost} 🪙`}</button>`;
      card.querySelector('button').addEventListener('click', () => {
        if (!owned) {
          if (store.buyTheme(t.id, t.cost)) {
            sfx.coin();
            logEvent('purchase', { item: `theme:${t.id}`, cost: t.cost });
            toast(`${t.name} acheté !`);
            pushCloud();
          } else {
            toast(`Il te manque ${t.cost - store.getWallet('auto')} 🪙`);
            return;
          }
        } else {
          store.setThemeOverride(t.id);
          sfx.click();
        }
        refreshCoins();
        renderShop();
      });
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
        logEvent('purchase', { item: `effect:${e.id}`, cost: e.cost });
        toast(`${e.name} acheté et activé !`);
        pushCloud();
      } else {
        toast(`Il te manque ${e.cost - store.getWallet('auto')} 🪙`);
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
  checkAchievements(stats, level);
  logEvent('game_over', { score: stats.score, level: level.id, mode: save.difficulty, completed: !!stats.completed, reason: stats.reason });
  if (save.pseudo && save.leaderboardOptIn) {
    leaderboard
      .submitScore({ pseudo: save.pseudo, score: stats.score, level: level.name, mode: save.difficulty, date: Date.now() })
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
  renderLeaderboard();
  show('screen-leaderboard');
});
$('#btn-leaderboard-back').addEventListener('click', () => {
  sfx.click();
  show('screen-menu');
});
$('#btn-pseudo').addEventListener('click', () => {
  sfx.click();
  $('#pseudo-input').value = save.pseudo;
  $('#pseudo-modal').classList.remove('hidden');
  $('#pseudo-modal').classList.add('active');
  setTimeout(() => $('#pseudo-input').focus(), 50);
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

if (leaderboard.isOnline() && save.pseudo) {
  cloudsave.load(save.pseudo).then((remote) => {
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
