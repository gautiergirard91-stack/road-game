import { LEVELS, THEMES, SKINS, EFFECTS, DIFFICULTIES, CURRENCIES, WINDOWS, ACHIEVEMENTS, THEME_SHOP, ENDLESS_LEVEL, WEEKEND_LEVEL, PACKS, SOUND_PACKS } from './data.js';
import { Game, CAR_STYLE_LABEL, renderCarPreview, renderEffectPreview, renderThemePreview, renderPackPreview, renderSoundPreview } from './game.js';
import * as store from './store.js';
import { sfx, setEnabled, setMusicEnabled, unlockAudio, applySoundPack, setMusicCombo, musicSting, musicVictory, scheduleLineBeat, clearLineBeats, musicKick, musicLineAnchor } from './audio.js';
import { coinsForResult, accuracy, avgReaction, maxMissesFor, firstClearBonus, isPerfectClear, perfectClearBonus, dailyChallenge, weeklyQuests, fmtTime, zoneFromPoint, keyToAction, isNewerVersion, starsFor, endlessMilestones, isWeekend, weekendCoinMultiplier, filterFriendsByPseudo, canSubmitToLeaderboard, keyLabel, reactionBonus } from './core.js';
import { watchRewarded } from './ads.js';
import { Tutorial } from './tutorial.js';
import * as leaderboard from './leaderboard.js';
import * as cloudsave from './cloudsave.js';
import { restoreGoogleSession, setAuthToken, getAuthToken, signOutGoogle, isGoogleAuthConfigured, signInWithPopupGoogle } from './auth.js';
import { initAppCheck, installAppCheckFetch, appCheckDebug, warmAppCheck } from './appcheck.js';
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
      store.setDifficulty(d.id); // v1.3.68 : en speedrun on garde la difficulté choisie (plus de verrou)
      sfx.click();
      renderDifficultyPicker();
    });
    el.appendChild(b);
  }
}

let lbFilter = 'all';
let lbLevelFilter = 'all';
let lbSort = 'score';
let hudTimer = null; // v1.3.77 : rafraîchit le chrono du HUD (mode unique) // v1.3.70 : tri du classement — 'score' (défaut) ou 'time'
// v1.3.65 : les filtres du classement (difficulté/mode, niveau, onglet amis) sont MÉMORISÉS et
// restaurés à la réouverture de la page — le joueur retrouve ses filtres.
// v1.3.36 : portée du classement — 'all' (tous les joueurs) ou 'friends' (amis par pseudo)
let lbScope = 'all';
const LB_FILTERS_KEY = 'roadtap_lb_filters_v1';
let lbFiltersLoaded = false;
function loadLbFilters() {
  try {
    const raw = localStorage.getItem(LB_FILTERS_KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    if (o && typeof o === 'object') {
      if (typeof o.filter === 'string') lbFilter = o.filter;
      if (typeof o.level === 'string') lbLevelFilter = o.level;
      if (typeof o.scope === 'string') lbScope = o.scope;
      if (o.sort === 'score' || o.sort === 'time' || o.sort === 'reaction') lbSort = o.sort; // v1.3.70/73
      lbFiltersLoaded = true;
    }
  } catch { /* ignore */ }
}
function saveLbFilters() {
  try {
    localStorage.setItem(LB_FILTERS_KEY, JSON.stringify({ filter: lbFilter, level: lbLevelFilter, scope: lbScope, sort: lbSort })); // v1.3.70 : + sort
  } catch { /* ignore */ }
}
loadLbFilters();


// v1.3.36 : onglets 🌍 Tous / 👥 Amis au-dessus des filtres
function renderLbScope() {
  const el = $('#lb-scope');
  if (!el) return;
  el.innerHTML = '';
  const opts = [
    { id: 'all', name: '🌍 Tous' },
    { id: 'friends', name: `👥 Amis${save.friends && save.friends.length ? ` (${save.friends.length})` : ''}` },
  ];
  for (const o of opts) {
    const b = document.createElement('button');
    b.className = 'btn small diff-btn' + (lbScope === o.id ? ' active' : '');
    b.textContent = o.name;
    b.addEventListener('click', () => {
      lbScope = o.id;
      saveLbFilters();
      sfx.click();
      renderLbScope();
      renderFriends();
      renderLeaderboard();
    });
    el.appendChild(b);
  }
  const bar = $('#friends-bar');
  if (bar) bar.classList.toggle('hidden', lbScope !== 'friends');
}

// v1.3.36 : puces des amis (✕ = retirer) — amis = pseudos, PAS les contacts Google du téléphone
function renderFriends() {
  const el = $('#friends-list');
  if (!el) return;
  el.innerHTML = '';
  if (!save.friends.length) {
    el.innerHTML = '<div class="card-sub">Aucun ami pour l\'instant — ajoute un pseudo ci-dessus.</div>';
    return;
  }
  for (const f of save.friends) {
    const chip = document.createElement('button');
    chip.className = 'friend-chip';
    chip.title = `Retirer ${f} de tes amis`;
    chip.innerHTML = `${escapeHtml(f)} <b>✕</b>`;
    chip.addEventListener('click', () => {
      store.removeFriend(f);
      sfx.click();
      pushCloud();
      renderLbScope();
      renderFriends();
      renderLeaderboard();
    });
    el.appendChild(chip);
  }
}

function addFriendFromInput() {
  const inp = $('#friend-input');
  const v = String(inp && inp.value || '').trim();
  if (!v) {
    toast('Entre le pseudo d\'un ami 👥');
    return;
  }
  if (save.pseudo && v.toLowerCase() === save.pseudo.toLowerCase()) {
    toast('Tu ne peux pas t\'ajouter toi-même 😉');
    inp.value = '';
    return;
  }
  if (store.addFriend(v)) {
    sfx.coin();
    toast(`👥 ${v} ajouté à tes amis — retrouve-le dans l'onglet Amis`);
    pushCloud();
    inp.value = '';
    renderLbScope();
    renderFriends();
    renderLeaderboard();
  } else {
    toast('Ce pseudo est déjà dans ta liste d\'amis');
  }
}

function renderLbLevelFilter() {
  const el = $('#lb-level-filter');
  if (!el) return;
  el.innerHTML = '';
  const opts = [
    { id: 'all', name: '🌐 Tous niveaux' }, // v1.3.67 : option explicite — à l'ouverture un filtre est TOUJOURS sélectionné
    ...LEVELS.map((l) => ({ id: String(l.id), name: `${l.id}. ${l.name}` })),
    { id: String(ENDLESS_LEVEL.id), name: '∞ Survie' },
    { id: String(WEEKEND_LEVEL.id), name: '🎉 Week-end' }, // v1.3.46 : l'événement week-end a son propre filtre dans le classement
  ];
  for (const o of opts) {
    const b = document.createElement('button');
    b.className = 'btn small diff-btn' + (lbLevelFilter === o.id ? ' active' : '');
    b.textContent = o.name;
    b.addEventListener('click', () => {
      lbLevelFilter = o.id;
      saveLbFilters(); // v1.3.65
      sfx.click();
      renderLbLevelFilter();
      renderLeaderboard();
    });
    el.appendChild(b);
  }
}

// v1.3.70/73 : tri du classement (persisté) — cycle 🏁 Score → ⏱ Temps → ⚡ Réaction
function lbSortLabel() {
  return lbSort === 'time' ? 'Trier : ⏱ Temps' : lbSort === 'reaction' ? 'Trier : ⚡ Réaction' : 'Trier : 🏁 Score';
}
on('lb-sort', 'click', () => {
  lbSort = lbSort === 'score' ? 'time' : lbSort === 'time' ? 'reaction' : 'score'; // v1.3.73 : cycle à 3
  saveLbFilters();
  sfx.click();
  const b = $('#lb-sort');
  if (b) b.textContent = lbSortLabel();
  renderLeaderboard();
});

function renderLbFilter() {
  const el = $('#lb-filter');
  if (!el) return;
  el.innerHTML = '';
  const opts = [...DIFFICULTIES, { id: 'reaction', name: '⚡ Réaction' }]; // v1.3.68 : onglet Speedrun retiré (les temps s'affichent en colonne dans chaque difficulté) — v1.3.50 : plus d'option « Tous »
  for (const d of opts) {
    const b = document.createElement('button');
    b.className = 'btn small diff-btn' + (lbFilter === d.id ? ' active' : '');
    b.textContent = d.name;
    b.addEventListener('click', () => {
      lbFilter = d.id;
      saveLbFilters(); // v1.3.65
      sfx.click();
      renderLbFilter();
      renderLeaderboard();
    });
    el.appendChild(b);
  }
}

// v1.3.67 : nom du niveau affiché = LEVEL_NAMES[levelId] (les vieilles entrées ont level brut ex. 'L 1')
const LEVEL_NAME_BY_ID = { ...Object.fromEntries(LEVELS.map((l) => [l.id, l.name])), [ENDLESS_LEVEL.id]: ENDLESS_LEVEL.name, [WEEKEND_LEVEL.id]: WEEKEND_LEVEL.name };
const levelLabel = (e) => (e && e.levelId != null && LEVEL_NAME_BY_ID[Number(e.levelId)]) || (e && e.level) || '';

async function renderLeaderboard() {
  const list = $('#leaderboard-list');
  list.innerHTML = '<div class="card-sub">Chargement…</div>';
  const isSr = lbFilter === 'speedrun'; // v1.3.31 : classement speedrun (temps, tri croissant)
  const isReact = lbFilter === 'reaction'; // v1.3.48 : classement par temps de réaction moyen (croissant)
  let top = [];
  let timeByPlayer = null; // v1.3.68 : map joueur -> meilleur temps speedrun (colonne ⏱)
  let timeLevelByPlayer = null; // v1.3.74 : map joueur -> { timeMs, levelId } du meilleur temps (niveau affiché en « Tous niveaux »)
  try {
    if (isReact) {
      // v1.3.48 : « ⚡ Réaction » — meilleur temps de réaction moyen de tout le monde (tri croissant avgMs)
      const all = await leaderboard.getAll('all');
      let arr = all.filter((e) => typeof e.avgMs === 'number' && Number.isFinite(e.avgMs));
      arr = leaderboard.filterLevel(arr, lbLevelFilter);
      if (lbScope === 'friends') arr = filterFriendsByPseudo(arr, save.friends);
      top = leaderboard.dedupeByPlayer(arr, 'reaction').sort((a, b) => a.avgMs - b.avgMs); // v1.3.67
    } else if (lbScope === 'friends') {
      // v1.3.36 : on récupère TOUT le classement (sans limite) puis on filtre par pseudos d'amis côté client
      const all = await leaderboard.getAll(lbFilter); // v1.3.70 : mode = onglet actif
      top = leaderboard.dedupeByPlayer(filterFriendsByPseudo(leaderboard.filterLevel(all, lbLevelFilter), save.friends), 'score'); // v1.3.67
    } else {
      // v1.3.68/70 : la difficulté active filtre (même avec un niveau choisi) ; on garde TOUT pour trier après
      const all = await leaderboard.getAll(lbFilter);
      top = leaderboard.dedupeByPlayer(leaderboard.filterLevel(all, lbLevelFilter), 'score');
      // v1.3.68 : colonne temps — meilleur temps speedrun de chaque joueur (même difficulté, même filtre niveau)
      try {
        const srAll = await leaderboard.getSpeedrunAll(); // v1.3.74 : toutes les entrées (plus de dedupe global)
        timeByPlayer = leaderboard.buildTimeMap(srAll, lbFilter, lbLevelFilter);
        timeLevelByPlayer = leaderboard.buildTimeLevelMap(srAll, lbFilter, lbLevelFilter);
      } catch { timeByPlayer = null; timeLevelByPlayer = null; }
    }
    // v1.3.70 : tri Score (défaut) ou Temps — on voit le meilleur score ET le meilleur temps
    if (!isReact) top = leaderboard.sortLbRows(top, lbSort, timeByPlayer);
    top = top.slice(0, 50);
  } catch {
    top = [];
  }
  // v1.3.27 : diagnostic visible pour expliquer un classement "vide" (règles RTDB, réseau, etc.)
  const st = leaderboard.getLbStatus ? leaderboard.getLbStatus() : null;
  const srcEl = $('#lb-source');
  if (!leaderboard.isOnline()) {
    srcEl.textContent = 'Classement local — configure Firebase dans js/config.js pour un classement en ligne (voir README)';
  } else if (st && st.source === 'firebase') {
    srcEl.textContent = `${isSr ? '⏱ Classement speedrun' : isReact ? '⚡ Classement réaction' : 'Classement'} en ligne (Firebase) — ${st.count} ${isSr ? 'temps' : isReact ? 'réactions' : 'score(s)'} chargé(s)${lbLevelFilter !== 'all' || lbScope === 'friends' ? ` — ${top.length} affiché(s) ici` : ''}` + (st.error ? ` — ⚠ ${st.error}` : ''); // v1.3.67 : compte = lignes affichées quand filtre actif
  } else if (st && st.error) {
    srcEl.textContent = `⚠ ${isSr ? 'Speedrun' : 'Firebase'} injoignable ou refusé : ${st.error} — affichage local`;
  } else {
    srcEl.textContent = `${isSr ? '⏱ Classement speedrun' : isReact ? '⚡ Classement réaction' : 'Classement'} en ligne (Firebase) — aucun ${isSr ? 'temps' : isReact ? 'réactions' : 'score'} en ligne pour ce filtre, affichage local`;
  }
  // v1.3.28 : si les envois sont refusés (403…), on le dit aussi — sinon on croit que le nœud est juste vide
  if (st && st.writeError) srcEl.textContent += ` — ⚠ ${st.writeError}`;
  // v1.3.37 : sans compte Google, on ne peut PAS apparaître dans le classement (accès anonyme retiré)
  if (!save.uid) srcEl.textContent = '🔒 Connecte ton compte Google (bouton « ✏️ Mon pseudo ») pour apparaître dans le classement — l\'accès anonyme est retiré. ' + srcEl.textContent;
  // v1.3.45 : fenêtres de timing élargies actives -> non éligible au classement en ligne
  if (save.wideWindows) srcEl.textContent += ' — ♿ fenêtres élargies actives : tes scores n\'apparaissent pas dans le classement en ligne.';
  list.innerHTML = '';
  if (!top.length) {
    // v1.3.36 : message dédié quand on cherche dans ses amis
    if (lbScope === 'friends' && !save.friends.length) {
      list.innerHTML = '<div class="card-sub">Ajoute d\'abord des amis (pseudos) ci-dessus 👥, puis reviens ici.</div>';
      return;
    }
    if (lbScope === 'friends') {
      list.innerHTML = '<div class="card-sub">Aucun de tes amis n\'a encore de score ici — invite-les à jouer ! 🎮</div>';
      return;
    }
    // v1.3.67 : filtre niveau actif + rien -> message dédié (l'indice « règles » ne sert que sans filtre)
    const lvlName = LEVEL_NAME_BY_ID[Number(lbLevelFilter)] || lbLevelFilter;
    const hint = lbLevelFilter !== 'all'
      ? (leaderboard.isOnline()
          ? `Aucun ${isSr ? 'temps' : 'score'} en ligne pour « ${lvlName} » — joue ce niveau pour passer 1er ! 🏁`
          : `Aucun ${isSr ? 'temps' : 'score'} local pour « ${lvlName} » — joue une partie !`)
      : leaderboard.isOnline()
        ? (isSr
          ? 'Aucun temps speedrun en ligne — finis un niveau en mode ⏱ Speedrun ! (règles RTDB : nœud /speedrun, voir docs/FIREBASE.md)'
          : 'Vérifie les règles RTDB : ouvre ' + 'https://realtime-database-5fd49-default-rtdb.europe-west1.firebasedatabase.app/scores.json' + ' (doit répondre 200 avec des données ou null).')
        : (isSr ? 'Aucun temps pour l\'instant — joue en mode ⏱ Speedrun !' : isReact ? 'Aucune réaction enregistrée — joue une partie !' : 'Aucun score pour l\'instant — joue une partie !');
    list.innerHTML = `<div class="card-sub">${hint}</div>`;
    return;
  }
  top.forEach((e, i) => {
    const row = document.createElement('div');
    row.className = 'card lb-row';
    const me = save.pseudo && e.pseudo === save.pseudo;
    const right = isSr ? `⏱ ${fmtTime((e.timeMs || 0) / 1000)}` : isReact ? `⚡ ${e.avgMs} ms` : (typeof e.avgMs === 'number' ? `${e.score} · ⚡${e.avgMs}ms` : e.score); // v1.3.31/v1.3.48
    // v1.3.68 : colonne temps à côté du score (sauf onglet réaction) — '—' si le joueur n'a pas de temps speedrun ici
    const tms = (!isReact && !isSr && timeByPlayer) ? timeByPlayer.get(leaderboard.playerKey(e)) : undefined;
    const tlvl = (!isReact && !isSr && timeLevelByPlayer) ? timeLevelByPlayer.get(leaderboard.playerKey(e)) : undefined; // v1.3.74
    const tSuffix = (lbLevelFilter === 'all' && tlvl && tlvl.levelId != null) ? ` · niv. ${tlvl.levelId}` : ''; // v1.3.74 : niveau du temps affiché en « Tous niveaux »
    const timeCell = (!isReact && !isSr) ? `<span class="lb-time">${typeof tms === 'number' ? '⏱ ' + fmtTime(tms / 1000) + tSuffix : '—'}</span>` : '';
    row.innerHTML = `<span class="lb-rank">${i + 1}</span><span class="lb-name${me ? ' me' : ''}">${escapeHtml(e.pseudo || 'Anonyme')}</span><span class="lb-level">${escapeHtml(levelLabel(e))}</span><span class="lb-score">${right}</span>${timeCell}`;
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
  $('#btn-continue-coins').textContent = 'Continuer — +2 s ⏱'; // v1.3.77 : pénalité de temps au lieu de pièces
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

// v1.3.37 : pushCloud en PULL-MERGE-PUSH — le PUT écrase tout le nœud /players/<uid>, donc si on
// pousse sans avoir d'abord fusionné le cloud, on efface la progression faite sur l'autre appareil
// (cause « tel ≠ PC »). On lit le distant, on merge (max par champ), puis on pousse le snapshot fusionné.
// keepalive:true côté cloudsave + appels sur pagehide/visibilitychange = la sauvegarde part même si
// l'app est fermée juste après une partie (mobile).
async function pushCloud() {
  if (!leaderboard.isOnline() || !accountKey()) return;
  try {
    const remote = await cloudsave.load(accountKey(), getAuthToken());
    if (remote) store.mergeRemote(remote);
    cloudsave.save(accountKey(), store.snapshot(), getAuthToken());
  } catch {
    /* push best-effort : la prochaine ouverture refera la synchro */
  }
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
    access: { colorblind: save.colorblind, horizontalZones: !save.verticalZones },
    effects: save.selectedEffects,
    audio: { tap: sfx.tap, perfect: sfx.perfect, good: sfx.good, passable: sfx.passable, fail: sfx.fail, win: sfx.win, miss: sfx.miss, lineBeat: scheduleLineBeat, musicAnchor: musicLineAnchor }, // v1.3.46 : beat GD calé sur chaque ligne
    onJudge: (e) => {
      hudScore.textContent = String(e.score);
      hudCombo.textContent = e.combo >= 2 ? `COMBO x${e.combo}` : '';
      setMusicCombo(e.combo || 0); // v1.3.42 : la musique monte avec le combo
      tut?.onJudge(e);
    },
    onMiss: (m) => {
      updateLives(m);
      musicSting(); // v1.3.42 : mini-thème d'échec + intensité remise à 0
      setMusicCombo(0);
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
  const ctx = { stats, level, totals: store.get().totals, mode: save.difficulty, best: store.bestFlat(), trophies: store.get().trophies || {}, bestTime: store.get().bestTime || {}, wallets: store.get().wallets || {}, friends: save.friends || [], streak: save.streak || 0 }; // v1.3.44 best aplati ; v1.3.66 : + bestTime/wallets/friends/streak pour les nouveaux succès
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

// v1.3.69 : le 1er ping au chargement peut arriver AVANT que le jeton App Check soit prêt
// (cold start) -> 401 sous Enforce alors que tout va bien. On attend le jeton (warmAppCheck)
// puis on re-tente UNE fois avant d'afficher l'état.
async function pingServer() {
  let ok = await leaderboard.ping(getAuthToken());
  let p = leaderboard.getPingStatus();
  if (!ok && p && p.reason === 'http-401') {
    try { await warmAppCheck(); } catch { /* ignore */ }
    ok = await leaderboard.ping(getAuthToken());
    p = leaderboard.getPingStatus();
  }
  return { ok, p };
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
  pingServer().then(({ ok, p }) => { // v1.3.69 : ping + retry 401 si jeton App Check pas encore prêt
    // v1.3.58 : on affiche la CAUSE (HTTP xxx / réseau / ms) et pas juste « injoignable »
    if (ok && p) {
      el.textContent = `🟢 En ligne — ${p.ms} ms`;
      el.className = 'net-pill on';
      leaderboard.flushQueue(getAuthToken(), save.uid); // v1.3.66 : en ligne -> on vide la file
    } else {
      el.textContent = p && p.reason && p.reason.startsWith('http-') ? `🟠 HTTP ${p.status} (mode local)` : '🔴 Injoignable (mode local)';
      el.className = 'net-pill local';
    }
  });
}

// v1.3.36 : bannière d'événement week-end sur le menu (visible UNIQUEMENT samedi/dimanche)
function updateWeekendBanner() {
  const b = $('#weekend-banner');
  if (!b) return;
  const we = isWeekend();
  b.classList.toggle('hidden', !we);
  const txt = $('#weekend-banner-text');
  if (txt && we) txt.textContent = '🎉 Week-end : pièces ×2 + niveau spécial « Week-end doré » dans ▶ Jouer !';
}

function show(id) {
  currentScreen = id;
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  const gc = $('#game');
  if (gc) gc.classList.toggle('hidden', id !== 'screen-game'); // v1.3.66 : canvas visible UNIQUEMENT en jeu (sinon sa dernière frame transparaît sous les menus)
  $('#hud').classList.toggle('hidden', id !== 'screen-game');
  // la bannière de tutoriel ne s'affiche que si un tutoriel est réellement actif
  $('#tut-banner').classList.toggle('hidden', id !== 'screen-game' || !tutActive);
  if (id === 'screen-menu') {
    refreshStatus();
    updateWeekendBanner();
  }
}

window.addEventListener('online', () => { // v1.3.66 : de retour en ligne -> on vide la file hors ligne vers le serveur (si connecté)
  refreshStatus();
  leaderboard.flushQueue(getAuthToken(), save.uid).then((n) => {
    if (n > 0) toast(`☁️ ${n} résultat(s) hors ligne envoyé(s) au classement`);
  });
});
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
  // v1.3.53 : plus de bouton son dans le menu principal -> uniquement ⚙️ Paramètres
  const bs = $('#btn-set-sound');
  if (bs) bs.textContent = save.sound ? '🔊 Son : ON' : '🔇 Son : OFF';
}

function updateMusicBtn() {
  // v1.3.53 : plus de bouton musique dans le menu principal -> uniquement ⚙️ Paramètres
  const bm = $('#btn-set-music');
  if (bm) bm.textContent = save.music ? '🎵 Musique : ON' : '🎵 Musique : OFF';
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
  // v1.3.36 : niveau spécial de l'événement week-end, affiché UNIQUEMENT samedi/dimanche (core.isWeekend)
  const levelsShown = [ENDLESS_LEVEL, ...(isWeekend() ? [WEEKEND_LEVEL] : []), ...LEVELS];
  for (const l of levelsShown) {
    // Survie ∞ : débloquée seulement quand les 15 niveaux sont terminés au moins une fois
    const locked = l.endless ? !allDone : l.cost > 0 && !save.unlockedLevels.includes(l.id);
    // v1.3.17 : achat du niveau N autorisé seulement si le niveau N-1 a été TERMINÉ EN ENTIER
    const canBuy = !locked || l.id === 1 || store.isCleared(l.id - 1);
    const c = cur(l.diff || 'auto');
    const best = store.getBest(save.difficulty, l.id); // v1.3.44 : record isolé par difficulté (mode joué)
    const bt = store.getBestTime(save.difficulty, l.id); // v1.3.19/v1.3.44 : record speedrun, par difficulté
    const medal = save.trophies[l.id] ? ' 🥇' : '';
    const starsTxt = save.stars[l.id] ? ' ' + '⭐'.repeat(Math.min(3, save.stars[l.id])) : ''; // v1.3.35
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <canvas class="card-theme level-preview" aria-label="Aperçu ${l.name}"></canvas>
      <div class="card-body">
        <div class="card-title">${l.weekend ? '🎉 ' : ''}${l.endless ? '∞' : l.id}. ${l.name}${medal}${starsTxt}</div>
        <div class="card-sub">${THEMES[l.theme].name} · ${l.weekend ? 'événement week-end : pièces ×2 !' : l.endless ? 'vitesse croissante' : `vitesse ${l.speed} · ${l.lines} lignes`}</div>
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

// v1.3.36 : aperçus ANIMÉS — registre des canvas à redessiner à chaque frame.
// La boucle rAF ne les anime que sur les écrans boutique/garage (et onglet visible) ;
// partout ailleurs on garde un rendu statique (t=0) pour ne pas brûler de CPU.
let previewAnims = [];
function clearPreviews() {
  previewAnims = [];
}
function registerPreview(canvas, fn) {
  if (!canvas) return;
  previewAnims.push({ canvas, fn });
  try {
    fn(0); // rendu statique immédiat (si l'écran est caché, l'animation ne démarre pas)
  } catch {
    /* canvas indisponible */
  }
}

function showShopPage(cat) {
  if (!SHOP_CATS.includes(cat)) cat = 'skins';
  shopCat = cat;
  document.querySelectorAll('#shop-tabs .shop-tab').forEach((b) => b.classList.toggle('active', b.dataset.cat === cat));
  document.querySelectorAll('#screen-shop .shop-page').forEach((p) => p.classList.toggle('active', p.dataset.cat === cat));
  const sc = $('#screen-shop');
  if (sc) sc.scrollTop = 0;
}

function renderShop() {
  clearPreviews(); // v1.3.36 : on repart d'un registre propre (les anciens canvas sont remplacés)
  const skinsEl = $('#shop-skins');
  skinsEl.innerHTML = '';
  for (const s of SKINS) {
    const owned = save.skins.includes(s.id);
    const selected = save.skin === s.id;
    const card = document.createElement('div');
    card.className = 'card shop-card';
    // v1.3.50 : le libellé 'photo' est vidé (CAR_STYLE_LABEL.photo = '')
    card.innerHTML = `
      <canvas class="swatch car-preview" aria-label="Aperçu ${s.name}"></canvas>
      <div class="card-body">
        <div class="card-title">${s.name}</div>
        <div class="card-sub">${[MODEL_LABEL[s.model] || 'Berline', CAR_STYLE_LABEL[s.style || 'photo']].filter(Boolean).join(' · ')}</div>
      </div>
      <button class="btn small">${selected ? '✓ Équipée' : owned ? 'Équiper' : (s.cost > 0 ? `${s.cost} ${cur(s.currency || 'auto').icon}` : '🏆 Survie ∞ 50 lignes')}</button>`;
    card.querySelector('button').addEventListener('click', () => {
      if (selected) return;
      if (owned) {
        store.selectSkin(s.id);
        sfx.click();
      } else if ((s.cost || 0) <= 0 && s.id !== 'default') {
        toast('🏆 Atteins 50 lignes en Survie ∞ pour débloquer cette voiture');
        return;
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
    const cv = card.querySelector('canvas.car-preview'); // v1.3.36 : aperçu animé
    registerPreview(cv, (tt) => renderCarPreview(cv, s, tt));
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
      const cv = card.querySelector('canvas.th-preview'); // v1.3.36 : aperçu animé
      registerPreview(cv, (tt) => renderThemePreview(cv, t.id, undefined, undefined, tt));
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
    const cv = card.querySelector('canvas.fx-preview'); // v1.3.36 : aperçu animé
    registerPreview(cv, (tt) => renderEffectPreview(cv, e, tt));
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
    const cv = card.querySelector('canvas.pk-preview'); // v1.3.36 : aperçu animé
    registerPreview(cv, (tt) => renderPackPreview(cv, p, tt));
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
    const cv = card.querySelector('canvas.snd-preview'); // v1.3.36 : aperçu animé
    registerPreview(cv, (tt) => renderSoundPreview(cv, sp, tt));
    el.appendChild(card);
  }
}

// --- v1.3.36 : Garage (purement visuel) — toutes les voitures possédées, tap = équiper ---
function renderGarage() {
  clearPreviews(); // v1.3.36 : les aperçus du garage sont animés eux aussi
  const list = $('#garage-list');
  if (!list) return;
  list.innerHTML = '';
  const owned = SKINS.filter((s) => save.skins.includes(s.id));
  if (!owned.length) {
    list.innerHTML = '<div class="card-sub">Aucune voiture… la berline grise est pourtant déjà à toi 😉</div>';
    return;
  }
  for (const s of owned) {
    const selected = save.skin === s.id;
    const card = document.createElement('div');
    card.className = 'card shop-card garage-card' + (selected ? ' selected' : '');
    // v1.3.50 : le libellé 'photo' est vidé (CAR_STYLE_LABEL.photo = '')
    card.innerHTML = `
      <canvas class="swatch garage-preview" aria-label="Aperçu ${s.name}"></canvas>
      <div class="card-body">
        <div class="card-title">${selected ? '✓ ' : ''}${escapeHtml(s.name)}</div>
        <div class="card-sub">${[MODEL_LABEL[s.model] || 'Berline', CAR_STYLE_LABEL[s.style || 'photo']].filter(Boolean).join(' · ')}</div>
      </div>
      <button class="btn small">${selected ? '✓ Équipée' : 'Équiper'}</button>`;
    card.querySelector('button').addEventListener('click', () => {
      if (selected) return;
      if (store.selectSkin(s.id)) {
        sfx.click();
        toast(`🚗 ${s.name} équipée !`);
        pushCloud();
        renderGarage();
      }
    });
    // v1.3.36 : aperçu animé, affiché en plus grand dans le garage (72×84)
    const cv = card.querySelector('canvas.garage-preview');
    registerPreview(cv, (tt) => renderCarPreview(cv, s, tt, 72, 84));
    list.appendChild(card);
  }
  // v1.3.49 : le garage montre AUSSI les effets et thèmes achetés
  const fxEl = $('#garage-effects');
  if (fxEl) {
    fxEl.innerHTML = '';
    const ownedFx = EFFECTS.filter((e) => save.effects.includes(e.id));
    if (!ownedFx.length) {
      fxEl.innerHTML = '<div class="card-sub">Aucun effet acheté pour l\'instant — voir la boutique 🛒</div>';
    }
    for (const e of ownedFx) {
      const active = save.selectedEffects.includes(e.id);
      const card = document.createElement('div');
      card.className = 'card shop-card garage-card' + (active ? ' selected' : '');
      card.innerHTML = `
        <canvas class="swatch fx-preview" aria-label="Aperçu ${escapeHtml(e.name)}"></canvas>
        <div class="card-body">
          <div class="card-title">${active ? '✓ ' : ''}${escapeHtml(e.name)}</div>
          <div class="card-sub">${escapeHtml(e.desc)}</div>
        </div>
        <button class="btn small">${active ? '✓ Activé' : 'Activer'}</button>`;
      card.querySelector('button').addEventListener('click', () => {
        store.toggleEffect(e.id);
        sfx.click();
        toast(active ? `${e.name} désactivé` : `${e.name} activé !`);
        pushCloud();
        renderGarage();
      });
      registerPreview(card.querySelector('canvas.fx-preview'), (tt) => renderEffectPreview(card.querySelector('canvas.fx-preview'), e, tt));
      fxEl.appendChild(card);
    }
  }
  const thEl = $('#garage-themes');
  if (thEl) {
    thEl.innerHTML = '';
    const ownedTh = THEME_SHOP.filter((t) => save.themes.includes(t.id));
    if (!ownedTh.length) {
      thEl.innerHTML = '<div class="card-sub">Aucun thème acheté pour l\'instant — voir la boutique 🛒</div>';
    }
    for (const t of ownedTh) {
      const active = save.themeOverride === t.id;
      const card = document.createElement('div');
      card.className = 'card shop-card garage-card' + (active ? ' selected' : '');
      card.innerHTML = `
        <canvas class="swatch th-preview" aria-label="Aperçu ${escapeHtml(t.name)}"></canvas>
        <div class="card-body">
          <div class="card-title">${active ? '✓ ' : ''}${escapeHtml(t.name)}</div>
          <div class="card-sub">${escapeHtml(t.desc)}</div>
        </div>
        <button class="btn small">${active ? '✓ Activé' : 'Activer'}</button>`;
      card.querySelector('button').addEventListener('click', () => {
        store.setThemeOverride(t.id);
        sfx.click();
        toast(active ? `Thème ${t.name} retiré (thème du niveau)` : `Thème ${t.name} activé !`);
        pushCloud();
        renderGarage();
      });
      const cv = card.querySelector('canvas.th-preview');
      registerPreview(cv, (tt) => renderThemePreview(cv, t.id, undefined, undefined, tt));
      thEl.appendChild(card);
    }
  }
}

function startLevel(level) {
  currentLevel = level;
  setMusicCombo(0); // v1.3.42 : nouvelle partie -> intensité musicale à 0  unlockAudio(); // v1.3.65 : contexte audio repris ici (geste « Jouer ») -> pas de freeze au 1er tap
  setMusicEnabled(save.music && save.sound); // v1.3.65 : musique ON dès le début de la partie
  musicKick(); // v1.3.65 : resynchronise le séquenceur -> la musique démarre immédiatement

  clearLineBeats(); // v1.3.46 : on annule les beats de ligne de la partie précédente
  show('screen-game');
  $('#pause-overlay').classList.remove('active');
  hudLevel.textContent = `${level.id}. ${level.name}`;
  hudScore.textContent = '0';
  const ht0 = $('#hud-time'); if (ht0) ht0.textContent = '0:00.00';
  clearInterval(hudTimer); // v1.3.77 : chrono live dans le HUD (mode unique)
  hudTimer = setInterval(() => { const t = $('#hud-time'); if (t && game) t.textContent = fmtTime(game.elapsed + (game.penaltyMs || 0) / 1000); }, 100);
  hudCombo.textContent = '';
  continuesThisRun = 0;
  updateLives(0);
  $('#hud-coins').textContent = `${cur(save.difficulty).icon} ${store.getWallet(save.difficulty)}`;
  logEvent('level_start', { level: level.id, mode: save.difficulty });
  game = new Game($('#game'), {
    level,
    skinId: save.skin,
    mode: save.difficulty, // v1.3.68 : speedrun dans la difficulté choisie (plus de verrou Permis A)
    speedrun: true, // v1.3.77 : mode unique — chrono + pénalités + vitesse bonus TOUJOURS actifs
    themeOverride: save.themeOverride || undefined,
    windows: effWindows(),
    access: { colorblind: save.colorblind, horizontalZones: !save.verticalZones },
    effects: save.selectedEffects,
    audio: { tap: sfx.tap, perfect: sfx.perfect, good: sfx.good, passable: sfx.passable, fail: sfx.fail, win: sfx.win, miss: sfx.miss, lineBeat: scheduleLineBeat, musicAnchor: musicLineAnchor }, // v1.3.46 : beat GD calé sur chaque ligne
    onJudge: (e) => {
      hudScore.textContent = String(e.score); // v1.3.77 : le score reste l'affichage principal, le chrono est dans #hud-time
      hudCombo.textContent = e.combo >= 2 ? `COMBO x${e.combo}` : '';
      setMusicCombo(e.combo || 0); // v1.3.42 : tempo/couches montent avec les PARFAIT
    },
    onMiss: (m) => {
      updateLives(m);
      musicSting(); // v1.3.42 : raté = sting + retour au calme
      setMusicCombo(0);
    },
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
  clearInterval(hudTimer); hudTimer = null; // v1.3.77
  // v1.3.42 : thème de fin — victoire = arpège montant, défaite = sting ; combo remis à 0
  if (stats.completed) musicVictory();
  else musicSting();
  setMusicCombo(0);
  const sr = Boolean(game && game.speedrun); // v1.3.19 : mode speedrun actif sur cette partie
  // v1.3.44/v1.3.54 : records isolés par difficulté — clé "mode:levelId" avec le mode RÉELLEMENT joué
  const runMode = (game && game.mode) || save.difficulty;
  const firstClear = !!stats.completed && !store.getBest(runMode, level.id);
  const isRecord = store.setBest(runMode, level.id, stats.score);
  const isTimeRecord = stats.completed ? store.setBestTime(runMode, level.id, stats.timeMs || 0) : false; // v1.3.77 : record de temps à chaque niveau terminé
  store.addTotals({ runs: 1, perfects: stats.perfects, overtakes: stats.overtakes || 0 });
  // v1.3.17 : niveau "terminé" = partie complétée en entier (débloque l'achat du suivant)
  if (stats.completed) store.markCleared(level.id); // v1.3.77 : un seul mode — terminé = terminé
  // v1.3.35 : étoiles du niveau (1 terminé / 2 si >=60% PARFAIT / 3 full parfait) — on garde le max
  const stars = stats.completed ? starsFor(stats) : 0;
  if (stars > (save.stars[level.id] || 0)) store.setStars(level.id, stars);
  // v1.3.35 : paliers Survie ∞ — pièces à chaque palier de lignes, skin or + médaille à 50
  if (level.endless) {
    const prevBest = save.endlessBest || 0;
    const nowLines = Math.max(prevBest, stats.lines || 0);
    if (nowLines > prevBest) {
      store.setEndlessBest(nowLines);
      for (const ms of endlessMilestones(prevBest, nowLines)) {
        store.addCoins('auto', ms.coins);
        toast(`🏁 Survie ∞ : palier ${ms.m} lignes atteint ! +${ms.coins} 🪙`);
        if (ms.skin) {
          store.grantSkin('endless_or');
          store.setTrophy(99);
          toast('🏆 50 lignes en Survie ∞ : voiture « Survie d’or » + médaille débloquées ! 🎉');
        }
      }
      refreshCoins();
    }
  }
  checkAchievements(stats, level);
  logEvent('game_over', { score: stats.score, level: level.id, mode: save.difficulty, completed: !!stats.completed, reason: stats.reason });
  // v1.3.37 : envoi UNIQUEMENT si compte Google lié (uid) — l'accès anonyme au classement est retiré
  // (règles RTDB v1.3.37 : auth != null requis ; leaderboard.submitScore refuse sinon et garde en local)
  // v1.3.71 : promesse d'envoi conservée pour ATTENDRE la fin de l'écriture avant de lire le rang
  let submitP = null;
  if (canSubmitToLeaderboard(save)) { // v1.3.77 : mode unique — le score est TOUJOURS envoyé (v1.3.45 : wideWindows exclus)
    // v1.3.19 : en speedrun le score est un temps -> pas de classement global (record local bestTime)
    submitP = leaderboard
      // v1.3.32 : uid + jeton -> règles RTDB vérifient uid == auth.uid (anti-usurpation)
      .submitScore({ pseudo: save.pseudo, uid: save.uid || '', score: stats.score, level: level.name, levelId: level.id, mode: save.difficulty, date: Date.now(), avgMs: avgReaction(stats) ?? undefined }, getAuthToken()) // v1.3.48 : avgMs envoyé au classement
      .then(() => {
        // v1.3.70 : si le serveur refuse l'écriture (403…), on le dit tout de suite
        const st2 = leaderboard.getLbStatus();
        if (st2 && st2.writeError) toast(`⚠️ Envoi refusé : ${st2.writeError}`);
      })
      .catch(() => {});
  }
  // v1.3.68 : si le résultat n'est PAS envoyé au classement en ligne, on dit POURQUOI (sinon « mon score n'apparaît pas »)
  if (!canSubmitToLeaderboard(save)) {
    if (save.wideWindows) toast('♿ Fenêtres élargies actives : résultat gardé en local, hors classement en ligne');
    else if (!save.uid) toast('🔒 Connecte Google (« ✏️ Mon pseudo ») pour apparaître dans le classement en ligne — résultat gardé en local');
  }
  let submitSrP = null;
  if (stats.completed && canSubmitToLeaderboard(save)) { // v1.3.77 : le temps aussi, dès que le niveau est terminé
    // v1.3.31 : classement speedrun dédié (nœud /speedrun/<levelId>, temps en ms, tri croissant)
    submitSrP = leaderboard
      .submitSpeedrun(level.id, { pseudo: save.pseudo, uid: save.uid || '', timeMs: stats.timeMs || 0, level: level.name, levelId: level.id, mode: runMode, date: Date.now() }, getAuthToken()) // v1.3.54 : mode réel (permisA en speedrun)
      .catch(() => {});
  }
  // v1.3.70/77 : place du joueur au classement avec le score ET le temps du run (mode unique)
  (async () => {
    const el = $('#over-rank');
    if (!el) return;
    el.textContent = '';
    if (!canSubmitToLeaderboard(save)) return; // le toast d'éligibilité (v1.3.68) explique déjà pourquoi
    try {
      const key = leaderboard.playerKey({ uid: save.uid, pseudo: save.pseudo });
      const modeName = (DIFFICULTIES.find((d) => d.id === runMode) || {}).name || runMode;
      // v1.3.71 : attendre la fin des envois (POST + éventuel flush file) AVANT de lire
      if (submitP) await submitP;
      if (submitSrP) await submitSrP;
      const readRank = async () => {
        const all = await leaderboard.getAll(runMode);
        const arr = leaderboard.dedupeByPlayer(leaderboard.filterLevel(all, String(level.id)), 'score').sort((a, b) => (b.score || 0) - (a.score || 0));
        return arr.findIndex((e) => leaderboard.playerKey(e) === key);
      };
      const readTimeRank = async () => {
        const srAll = await leaderboard.getSpeedrunAll();
        const sarr = leaderboard.dedupeByPlayer(leaderboard.filterLevel(srAll, String(level.id)).filter((e) => !e.mode || e.mode === runMode), 'speedrun').sort((a, b) => a.timeMs - b.timeMs);
        return sarr.findIndex((e) => leaderboard.playerKey(e) === key);
      };
      let i = -1;
      try { i = await readRank(); } catch { i = -1; }
      if (i < 0) { // v1.3.71 : 2e lecture après 1,2 s (propagation) avant le repli
        await new Promise((r) => setTimeout(r, 1200));
        try { i = await readRank(); } catch { i = -1; }
      }
      let j = -1;
      if (stats.completed) { try { j = await readTimeRank(); } catch { j = -1; } }
      const st2 = leaderboard.getLbStatus();
      const parts = [];
      if (i >= 0) parts.push(`🏁 ${stats.score} pts → #${i + 1} au classement — ${level.name} (${modeName})`);
      else if (st2 && st2.writeError) parts.push(`⚠️ envoi refusé par le serveur — hors classement en ligne (${st2.writeError})`);
      else parts.push('🏁 score pas encore visible en ligne (local ?) — ouvre le classement');
      if (stats.completed) parts.push(j >= 0 ? `⏱ ${fmtTime((stats.timeMs || 0) / 1000)} → #${j + 1} au classement speedrun — ${level.name} (${modeName})` : '⏱ temps pas encore visible en ligne…');
      el.textContent = parts.join(' · ') + (leaderboard.isOnline() ? '' : ' — classement local (envoyé à la reconnexion)');
    } catch { /* lecture KO -> on laisse vide */ }
  })();
  pushCloud();
  let coins = coinsForResult(stats, level, stats.completed);
  let clearBonus = 0;
  if (firstClear) {
    clearBonus = firstClearBonus(level);
    coins += clearBonus;
  }
  // v1.3.36 : événement week-end — TOUTES les pièces de la partie sont doublées samedi/dimanche
  const weMult = weekendCoinMultiplier();
  if (weMult > 1) coins = Math.round(coins * weMult);
  // v1.3.48 : récompense selon le taux de réaction du résultat (avg ms + précision)
  const rb = reactionBonus(coins, stats);
  if (rb.coins > 0) coins += rb.coins;
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
      if (canSubmitToLeaderboard(save)) { // v1.3.45 : idem (wideWindows exclu aussi)
        // v1.3.37 : idem — défi du jour réservé aux comptes Google connectés
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
  $('#over-title').textContent = stats.completed
    ? `⏱ ${fmtTime((stats.timeMs || 0) / 1000)} — Niveau terminé !`
    : stats.completed
      ? '🏁 Niveau terminé !'
      : reason === 'traffic'
        ? '🚦 Bloqué dans les bouchons !'
        : reason === 'oncoming' // v1.3.76 : voiture de face (resté à gauche)
          ? '💥 Voiture de face ! Reviens à droite avec →'
          : '💥 3 ratés !';
  $('#over-record').classList.toggle('hidden', !isRecord && !isTimeRecord);
  $('#over-trophy').classList.toggle('hidden', !perfectClear);
  const scoreLabel = document.querySelector('#screen-over .score-label');
  $('#over-score').textContent = stats.score;
  if (scoreLabel) scoreLabel.textContent = 'points';
  const ot = $('#over-time'); // v1.3.77 : mode unique — score + chrono affichés tous les deux
  if (ot) ot.textContent = `⏱ ${fmtTime((stats.timeMs || 0) / 1000)}${isTimeRecord ? ' — 🏆 nouveau record !' : ''}`;
  const avg = avgReaction(stats);
  $('#over-stats').innerHTML = `
    <div><b>${stats.perfects}</b><span>Parfaits</span></div>
    <div><b>${stats.goods}</b><span>Bien</span></div>
    <div><b>${stats.passables}</b><span>OK</span></div>
    <div><b>${stats.misses}/${maxMissesFor(save.difficulty)}</b><span>Manquées</span></div>
    <div><b>${stats.overtakes || 0}</b><span>Dépassements</span></div>
    <div><b>${avg !== null ? avg + ' ms' : '—'}</b><span>Réaction moy.</span></div>
    <div><b>${accuracy(stats)} %</b><span>Précision</span></div>
    ${level.endless
      ? `<div><b>${stats.lines || 0}</b><span>Lignes (record ${Math.max(save.endlessBest || 0, stats.lines || 0)})</span></div>`
      : `<div><b>${stars > 0 ? '⭐'.repeat(stars) : '—'}</b><span>Étoiles du niveau</span></div>`}`;
  const ci = cur(save.difficulty).icon;
  $('#over-coins').textContent =
    `+${coins} ${ci} gagnées` +
    (firstClear ? ` (dont +${clearBonus} ${ci} de premier clear ! 🎉)` : '') +
    (perfectClear ? ` — 🥇 FULL PARFAIT ! +${perfectClearBonus(level)} ${ci} et médaille du niveau !` : '') +
    (rb.pct > 0 ? ` — ⚡ réactivité +${rb.pct}% (${rb.avgMs} ms moy., ${rb.acc}%)` : '') + // v1.3.48
    (weMult > 1 ? ` — 🎉 week-end : pièces ×${weMult} !` : '');
  setTimeout(() => {
    refreshCoins();
    show('screen-over');
    // v1.3.19 : speedrun + niveau terminé -> compte à rebours 10 s vers le niveau suivant
    if (stats.completed) {
      const next = LEVELS.find((l) => l.id === level.id + 1);
      if (next) startNextCountdown(next);
      else $('#over-title').textContent = '🏁 Bravo, niveau terminé !';
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
  // v1.3.36 : aperçus animés de la boutique/garage — uniquement sur ces écrans et onglet visible
  if (!document.hidden && previewAnims.length && (currentScreen === 'screen-shop' || currentScreen === 'screen-garage')) {
    const ts = t / 1000;
    for (const p of previewAnims) {
      try {
        p.fn(ts);
      } catch {
        /* un aperçu en échec ne bloque pas la boucle */
      }
    }
  }
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
// v1.3.56 : les options d'accessibilité n'existent plus qu'à UN seul endroit : le menu Paramètres (préfixe 's-').
// (La modale "♿ Accessibilité" du menu et le bloc pause ont été supprimés : v1.3.50 / v1.3.52.)
const ACCESS_OPTS = [
  { id: 'opt-widewindows', key: 'wideWindows', set: (v) => store.setWideWindows(v), on: 'Fenêtres de timing élargies (accessibilité)', off: 'Fenêtres de timing standard' },
  { id: 'opt-colorblind', key: 'colorblind', set: (v) => store.setColorblind(v), on: 'Symboles ajoutés sur les lignes (mode daltonien)', off: 'Mode standard' },
  { id: 'opt-zones-h', key: 'verticalZones', set: (v) => store.setVerticalZones(v), on: '⬆⬇ Zones haut/bas : haut = roues AV, bas = roues AR', off: '🔀 Zones gauche/droite (défaut) : gauche = roues AV ⬅, droite = roues AR ➡' },
];
function syncAccessCheckboxes(prefix) {
  for (const o of ACCESS_OPTS) {
    const el = document.getElementById(prefix + o.id);
    if (el) el.checked = !!save[o.key];
  }
}
function wireAccessCheckboxes(prefix) {
  for (const o of ACCESS_OPTS) {
    on(prefix + o.id, 'change', (e) => {
      o.set(e.target.checked);
      toast(e.target.checked ? o.on : o.off);
      syncAccessCheckboxes('s-');
    });
  }
}
wireAccessCheckboxes('s-'); // v1.3.47 : menu Paramètres (seul endroit depuis v1.3.56)

// --- v1.3.47 : menu Paramètres (accessibilité + audio + touches + version + serveur) ---
const ACTION_NAMES = { front: 'Roues AV', rear: 'Roues AR', swipe: 'Dépasser (swipe)', retry: 'Recommencer le niveau' }; // v1.3.49 : retry
let keyCapture = null; // action en cours de capture de touche, ou null

function renderSettings() {
  syncAccessCheckboxes('s-');
  updateSoundBtn();
  updateMusicBtn();
  const kf = $('#btn-key-front');
  const kr = $('#btn-key-rear');
  const ks = $('#btn-key-swipe');
  const kt = $('#btn-key-retry');
  if (kf) kf.textContent = keyLabel(save.keys.front);
  if (kr) kr.textContent = keyLabel(save.keys.rear);
  if (ks) ks.textContent = keyLabel(save.keys.swipe);
  if (kt) kt.textContent = keyLabel(save.keys.retry); // v1.3.49
  const hint = $('#key-capture-hint');
  if (hint) {
    hint.textContent = keyCapture
      ? `⌨️ Appuie sur une touche pour « ${ACTION_NAMES[keyCapture]} »… (Échap = annuler)`
      : 'Clique sur une touche puis appuie sur la touche de ton choix. Échap = annuler.';
  }
  const v = $('#set-version');
  if (v) v.textContent = `Version v${VERSION}`;
  updateServerStatus();
}

// v1.3.58 : texte explicite de la CAUSE quand le serveur semble « injoignable »
function serverStatusText(ok, p, ac) {
  if (ok && p) {
    const acTxt = ac && ac.configured ? ` · App Check ${ac.tokenOk === true ? '🟢 token OK' : ac.tokenOk === false ? '🔴 token INDISPONIBLE' : '🟡 non testé'}` : '';
    return `🟢 Firebase en ligne — ping ${p.ms} ms${acTxt}`;
  }
  // v1.3.59 : un 401 a DEUX causes possibles — la sonde auth (ping avec jeton) les départage :
  // sonde OK = règles exigent auth en lecture ; sonde KO = App Check Enforce sans token valide.
  // v1.3.62 : on ajoute l'état du token App Check (obtenu ou pas + erreur) pour cibler la cause.
  const acTxt = ac && ac.configured
    ? ` · App Check ${ac.appIdMissing ? '🔴 FIREBASE_APP_ID manquant — copier l\'ID d\'application de l\'app web (Firebase → ⚙️ Paramètres du projet → Vos applications) dans js/config.js' : ac.tokenOk === true ? '🟢 token OK' : ac.tokenOk === false ? `🔴 token KO (${ac.lastError || 'erreur inconnue'})` : '🟡 non testé'}`
    : '';
  if (p && p.reason === 'http-401') {
    if (p.authProbe && p.authProbe.ok) return '🟠 HTTP 401 anonyme mais OK connecté — les RÈGLES exigent auth en lecture : republier database.rules.json (scores/speedrun/challenges en ".read": true) — mode local' + acTxt;
    return '🟠 HTTP 401 même connecté — App Check Enforce actif sans token valide : la clé 6Lf7vCwu… doit être enregistrée dans Firebase → App Check → Apps (app web) + reCAPTCHA Enterprise API activée + roadtap.uk autorisé — mode local' + acTxt;
  }
  if (p && p.reason === 'http-403') {
    if (p.authProbe && p.authProbe.ok) return '🟠 HTTP 403 anonyme mais OK connecté — les RÈGLES refusent la lecture publique : republier database.rules.json — mode local' + acTxt;
    return '🟠 Firebase refuse (HTTP 403) — règles RTDB : scores/speedrun/challenges doivent garder ".read": true (voir database.rules.json) — mode local' + acTxt;
  }
  if (p && p.reason && p.reason.startsWith('http-')) return `🟠 Firebase répond HTTP ${p.status} — mode local (voir docs/FIREBASE.md §9)` + acTxt;
  if (p && p.reason === 'network') return `🔴 Firebase injoignable (réseau/DNS/CORS — ${p.error || 'essaie sans bloqueur d\'extensions'}) — mode local` + acTxt;
  return '🔴 Serveur injoignable (mode local)' + acTxt;
}

async function updateServerStatus() {
  const el = $('#set-server');
  const hostEl = $('#set-host');
  if (!el) return;
  // v1.3.58 : on teste AUSSI notre propre hébergement (version.json same-origin, jamais caché
  // par le SW) pour distinguer « notre site ne répond pas » de « Firebase refuse ».
  if (hostEl) hostEl.textContent = '🏠 Hébergement : vérification…';
  try {
    const r = await fetch(`version.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      if (hostEl) hostEl.textContent = `🏠 Hébergement : 🟢 OK${d && d.version ? ` (v${d.version} déployée)` : ''}`;
    } else if (hostEl) hostEl.textContent = `🏠 Hébergement : 🟠 HTTP ${r.status}`;
  } catch {
    if (hostEl) hostEl.textContent = '🏠 Hébergement : 🔴 injoignable (hors ligne ?)';
  }
  if (!navigator.onLine) {
    el.textContent = '🔴 Hors ligne (navigateur) — progression locale uniquement';
    return;
  }
  if (!leaderboard.isOnline()) {
    el.textContent = '🟡 Mode local (serveur non configuré) — voir docs/FIREBASE.md';
    return;
  }
  el.textContent = '🟡 Firebase : connexion au serveur…';
  const { ok, p } = await pingServer(); // v1.3.69 : sonde auth + retry 401 si jeton pas prêt
  const st = leaderboard.getLbStatus();
  let ac = null;
  try { ac = appCheckDebug(); } catch { ac = null; }
  el.textContent = serverStatusText(ok, p, ac) + (ok && st && st.writeError ? ` (⚠ ${st.writeError})` : '');
}

let settingsFrom = 'menu'; // 'menu' | 'pause' — d'où vient l'ouverture des Paramètres
on('btn-settings', 'click', () => {
  sfx.click();
  settingsFrom = 'menu';
  renderSettings();
  show('screen-settings');
});
on('btn-settings-back', 'click', () => {
  sfx.click();
  keyCapture = null;
  if (settingsFrom === 'pause' && game && game.running) {
    // v1.3.52 : on revient à la pause (la partie reste en pause derrière)
    show('screen-game');
    $('#pause-overlay').classList.add('active');
  } else {
    show('screen-menu');
  }
});
// v1.3.52 : la pause embarque le menu Paramètres en entier
on('btn-pause-settings', 'click', () => {
  sfx.click();
  settingsFrom = 'pause';
  renderSettings();
  show('screen-settings');
});
on('btn-set-sound', 'click', () => {
  store.setSound(!save.sound);
  setEnabled(save.sound);
  setMusicEnabled(save.music && save.sound);
  updateSoundBtn();
  sfx.click();
});
on('btn-set-music', 'click', () => {
  store.setMusic(!save.music);
  setMusicEnabled(save.music && save.sound);
  updateMusicBtn();
  sfx.click();
});
on('btn-set-refresh', 'click', () => {
  sfx.click();
  updateServerStatus();
});
for (const [btnId, action] of [['btn-key-front', 'front'], ['btn-key-rear', 'rear'], ['btn-key-swipe', 'swipe'], ['btn-key-retry', 'retry']]) { // v1.3.49 : retry
  on(btnId, 'click', () => {
    sfx.click();
    keyCapture = action;
    renderSettings();
  });
}

on('btn-leaderboard', 'click', () => {
  sfx.click();
  // v1.3.65 : on RESTAURE les filtres mémorisés ; sinon (1re fois) défaut = difficulté courante
  if (!lbFiltersLoaded) {
    lbFilter = save.difficulty;
    lbLevelFilter = 'all';
    saveLbFilters();
  }
  if (lbFilter === 'speedrun') { lbFilter = save.difficulty; saveLbFilters(); } // v1.3.68 : onglet speedrun supprimé -> on retombe sur la difficulté courante
  const sortBtn = $('#lb-sort'); // v1.3.70 : label du tri courant
  if (sortBtn) sortBtn.textContent = lbSortLabel(); // v1.3.73
  leaderboard.flushQueue(getAuthToken(), save.uid); // v1.3.66 : file hors ligne vidée si possible
  renderLbScope(); // v1.3.36 : onglets 🌍 Tous / 👥 Amis
  renderFriends();
  renderLbFilter();
  renderLbLevelFilter();
  renderLeaderboard();
  show('screen-leaderboard');
});
// v1.3.36 : ajout d'un ami par pseudo (la liste est synchronisée avec le cloud)
on('btn-friend-add', 'click', () => {
  sfx.click();
  addFriendFromInput();
});
on('friend-input', 'keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addFriendFromInput();
  }
});
on('btn-garage', 'click', () => {
  sfx.click();
  show('screen-garage'); // v1.3.66 : on affiche AVANT de rendre (aperçus canvas)
  renderGarage(); // v1.3.36 : garage purement visuel
});
on('btn-garage-back', 'click', () => {
  sfx.click();
  show('screen-menu');
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
// v1.3.33/v1.3.40 : termine la connexion Google : compte lié + jeton + chargement immédiat
// de la sauvegarde cloud et FUSION avec la progression locale (anonyme) — mergeRemote fait
// max/union par champ. Il n'existe pas de « profil anonyme » côté serveur (players est keyed
// par uid et auth-only depuis v1.3.32) : la save locale devient simplement la copie de travail
// du compte, et on renvoie le snapshot fusionné (pushCloud en pull-merge-push).
async function completeGoogleSignIn(sess) {
  setAuthToken(sess.idToken);
  store.setGoogleAccount(sess.uid, sess.email, sess.refreshToken);
  sfx.coin();
  // v1.3.37 : si la modale forcée est ouverte, on pré-remplit le pseudo depuis le compte Google
  const pmodal = $('#pseudo-modal');
  const pinp = $('#pseudo-input');
  if (pmodal && !pmodal.classList.contains('hidden') && pinp && !save.pseudo) {
    const base = String(sess.displayName || (sess.email || '').split('@')[0] || 'Joueur').replace(/\s+/g, '');
    pinp.value = base.slice(0, 16);
  }
  updatePseudoSaveState();
  toast(`🔗 Compte Google lié : ${sess.email || sess.uid}`);
  updateGoogleStatus();
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
  store.backupKeysForAccount(); // v1.3.57 : les touches fusionnées (cloud) sont aussi calées sur le compte en local
  leaderboard.flushQueue(getAuthToken(), save.uid).then((n) => { // v1.3.66 : résultats hors ligne -> serveur
    if (n > 0) toast(`☁️ ${n} résultat(s) hors ligne envoyé(s) au classement`);
  });
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
  updatePseudoSaveState(); // v1.3.37 : bouton Enregistrer désactivé tant que pas Google+pseudo (mode forcé)
  // v1.3.38 : UN SEUL bouton Google dans la modale : « 🔑 Connexion Google » (btn-google-popup,
  // affiché par updateGoogleStatus quand pas encore connecté) — plus de bouton GIS « Continuer en tant que ».
  $('#pseudo-modal').classList.remove('hidden');
  $('#pseudo-modal').classList.add('active');
  setTimeout(() => $('#pseudo-input').focus(), 50);
}

// v1.3.40 : on peut JOUER SANS compte Google (progression 100 % locale sur l'appareil).
// Google n'est obligatoire QUE pour (a) garder sa progression dans le cloud (synchro tel ↔ PC)
// et (b) apparaître dans le classement (règles RTDB auth != null, envois réservés aux comptes liés).
// Le pseudo reste obligatoire avant de jouer.
function ensurePseudoThen(fn) {
  if (save.pseudo) {
    fn();
    return;
  }
  pendingAfterPseudo = fn;
  openPseudoModal(true);
}

// v1.3.40 : état du bouton "Enregistrer" — en mode forcé, seul le PSEUDO est requis pour jouer
// (Google reste facultatif : cloud + classement uniquement)
function updatePseudoSaveState() {
  const btn = $('#btn-pseudo-save');
  const inp = $('#pseudo-input');
  if (btn) btn.disabled = Boolean(pseudoForced && !String(inp && inp.value || '').trim());
  const hint = $('#pseudo-hint');
  if (hint) {
    hint.textContent = pseudoForced
      ? save.uid
        ? '✔ Compte Google lié — choisis un pseudo (16 car. max) pour apparaître dans le classement 🌍'
        : 'Choisis un pseudo (16 car. max) pour jouer. Facultatif : « 🔑 Connexion Google » ci-dessus pour garder ta progression dans le cloud (téléphone ↔ PC) et apparaître dans le classement 🌍.'
      : 'Ton pseudo est public dans le classement 🌍 — connecte ton compte Google (« 🔑 Connexion Google » ci-dessus) pour y figurer et synchroniser ta progression.';
  }
}

on('btn-pseudo', 'click', () => {
  sfx.click();
  openPseudoModal(false);
});
// v1.3.38 : UNIQUE bouton de connexion Google — popup SDK Firebase chargé depuis gstatic
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
  // v1.3.40 : à la déconnexion, on repart de 0 EN LOCAL (le cloud players/<uid> est conservé
  // tel quel : à la reconnexion, la save locale fusionne avec, mergeRemote = max par champ).
  // v1.3.57 : resetProgress conserve la config (touches, accessibilité, son/musique) — seule la
  // progression repart de 0.
  store.resetProgress();
  sfx.click();
  updateGoogleStatus();
  updatePseudoSaveState();
  refreshCoins();
  renderDifficultyPicker();
  renderLevels();
  renderShop();
  $('#pseudo-modal').classList.add('hidden');
  $('#pseudo-modal').classList.remove('active');
  toast('🔓 Compte Google délié — progression locale remise à 0 (tes touches et réglages sont conservés). Reconnecte-toi pour retrouver ton cloud.');
});
on('btn-pseudo-cancel', 'click', () => {
  if (pseudoForced) return; // v1.3.29 : pseudo obligatoire -> pas d'annulation
  sfx.click();
  $('#pseudo-modal').classList.add('hidden');
  $('#pseudo-modal').classList.remove('active');
});
on('pseudo-input', 'input', () => updatePseudoSaveState()); // v1.3.37 : réactive Enregistrer dès qu'un pseudo est tapé
on('btn-pseudo-save', 'click', () => {
  // v1.3.40 : plus besoin de Google pour jouer — seul le pseudo est obligatoire en mode forcé
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
  toast(p ? (save.uid ? `Pseudo enregistré : ${p} — tu apparaîtras dans le classement 🌍` : `Pseudo enregistré : ${p} — connecte Google (🔑) pour apparaître dans le classement 🌍 et garder ta progression dans le cloud`) : 'Pseudo vide — il te sera redemandé à la prochaine partie');
  pushCloud();
  const fn = pendingAfterPseudo;
  pendingAfterPseudo = null;
  if (fn) fn();
});
on('btn-shop', 'click', () => {
  sfx.click();
  show('screen-shop'); // v1.3.66 : on affiche AVANT de rendre (les aperçus canvas ont besoin de l'écran visible)
  renderShop();
  showShopPage(shopCat);
});
// v1.3.77 : plus de sélecteur Standard/Speedrun — un seul mode (score + chrono + pénalités de temps)
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
// v1.3.45 : « Recommencer » directement depuis le menu pause
on('btn-pause-retry', 'click', () => {
  sfx.click();
  togglePause(false);
  cancelNextCountdown();
  if (currentLevel) startLevel(currentLevel);
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
  // v1.3.77 : mode unique — continuer = +2 s au chrono (plus de coût en pièces)
  continuesThisRun++;
  if (game) game.penaltyMs = (game.penaltyMs || 0) + 2000;
  sfx.coin();
  logEvent('continue_time_penalty', { penaltyMs: 2000 });
  hideContinue();
  game?.resumeWithContinue();
  const t = $('#hud-time');
  if (t && game) t.textContent = fmtTime(game.elapsed + game.penaltyMs / 1000);
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
  const dx = x - pointerStart.x;
  if (dx < -40) {
    swipeFired = true;
    if (canPlayNow()) game.swipeLeft();
  } else if (dx > 40) {
    swipeFired = true; // v1.3.76 : swipe → = retour manuel à droite
    if (canPlayNow()) game.swipeRight();
  }
}

// v1.3.49 : boutons de SOURIS bindables (MouseLeft/Middle/Right)
const MOUSE_CODES = { 0: 'MouseLeft', 1: 'MouseMiddle', 2: 'MouseRight' };
window.addEventListener('pointerdown', (e) => {
  const mcode = MOUSE_CODES[e.button];
  // capture de touche depuis les Paramètres : un clic souris bind aussi
  if (keyCapture && mcode) {
    e.preventDefault();
    const action = keyCapture;
    keyCapture = null;
    if (store.setKey(action, mcode)) {
      sfx.coin();
      toast(`⌨️ « ${keyLabel(mcode)} » = ${ACTION_NAMES[action] || action}`);
    } else {
      sfx.miss?.();
      toast('Ce bouton est déjà utilisé par une autre action');
    }
    renderSettings();
    return;
  }
  // en jeu : un bouton de souris bindé déclenche son action (et bloque le tap de zone pour ce clic)
  if (mcode && save.keys && Object.values(save.keys).includes(mcode) && currentScreen === 'screen-game' && game && game.running) {
    const action = keyToAction(mcode, !save.verticalZones, save.keys);
    if (action) {
      e.preventDefault();
      e.stopImmediatePropagation(); // évite le double tap via le handler de zones ci-dessous
      if (action === 'swipe') game.swipeLeft();
      else if (action === 'swipeRight') game.swipeRight(); // v1.3.76 : retour manuel à droite
      else if (action === 'retry') { cancelNextCountdown(); if (currentLevel) startLevel(currentLevel); }
      else game.tap(action);
    }
  }
}, true); // capture : avant le handler global de zones

// v1.3.52 : en jeu, on bloque le menu contextuel (clic droit souris / appui long) —
// sinon binder le clic droit ouvrirait le menu contextuel Windows au lieu de jouer
window.addEventListener('contextmenu', (e) => {
  if (currentScreen === 'screen-game') e.preventDefault();
});

window.addEventListener('pointerdown', (e) => {
  unlockAudio();
  pointerStart = { x: e.clientX, y: e.clientY };
  pointerLast = pointerStart;
  swipeFired = false;
  if (!canPlayNow()) return;
  if (e.target.closest('button, input, select, textarea, a, label')) return; // ne pas taper le jeu quand on touche un contrôle
  // v1.3.21/v1.3.28 : option zones gauche/droite (gauche = AV, droite = AR) au lieu de haut/bas
  const zone = zoneFromPoint(e.clientX, e.clientY, window.innerWidth, window.innerHeight, !save.verticalZones);
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
  // v1.3.47 : capture d'une touche depuis le menu Paramètres (Échap = annuler)
  if (keyCapture) {
    e.preventDefault();
    const action = keyCapture;
    keyCapture = null;
    if (e.code !== 'Escape') {
      if (store.setKey(action, e.code)) {
        sfx.coin();
        toast(`⌨️ « ${keyLabel(e.code)} » = ${ACTION_NAMES[action] || action}`);
      } else {
        sfx.miss?.();
        toast('Cette touche est déjà utilisée par une autre action');
      }
    }
    renderSettings();
    return;
  }
  const canPlay = canPlayNow();
  // v1.3.75 : on tape dans un champ (pseudo, ami…) -> la touche va au champ, jamais au jeu
  // (avant : preventDefault bloquait le 1er appui, seules les répétitions passaient = « faut rester appuyé »)
  const te = e.target;
  if (te && (te.tagName === 'INPUT' || te.tagName === 'TEXTAREA' || te.tagName === 'SELECT' || te.isContentEditable)) return;
  // v1.3.28 : UNE SEULE action par touche via keyToAction (sinon ArrowLeft = tap AV + swipe
  // quand les zones horizontales sont actives ; le swipe clavier passe sur ArrowDown/KeyS)
  // v1.3.47 : les touches choisies dans Paramètres priment (save.keys)
  const action = keyToAction(e.code, !save.verticalZones, save.keys);
  if (action) {
    e.preventDefault();
    if (action === 'retry') {
      // v1.3.49/v1.3.53 : touche « recommencer » — en jeu (même en pause) ET sur l'écran de fin
      if ((currentScreen === 'screen-game' || currentScreen === 'screen-over') && currentLevel) {
        cancelNextCountdown();
        startLevel(currentLevel);
      }
    } else if (canPlay) {
      if (action === 'swipe') game.swipeLeft();
      else if (action === 'swipeRight') game.swipeRight(); // v1.3.76 : retour manuel à droite
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
  // v1.3.37 : on pousse la sauvegarde cloud dès que l'onglet passe en arrière-plan
  if (document.hidden) pushCloud();
});
// v1.3.37 : idem à la fermeture de l'app (keepalive côté cloudsave permet au PUT de partir quand même)
window.addEventListener('pagehide', () => pushCloud());

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
initAppCheck(); // v1.3.34 : App Check (reCAPTCHA v3) — dégrade gracieusement si indisponible
installAppCheckFetch(); // pose le header X-Firebase-AppCheck sur tous les appels REST RTDB
warmAppCheck(); // v1.3.69 : préchauffe le jeton App Check au boot (fire-and-forget) — évite un faux 401 au 1er ping
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
          store.backupKeysForAccount(); // v1.3.57 : touches du compte calées en local aussi
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
      store.backupKeysForAccount(); // v1.3.57 : touches du compte calées en local aussi
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
