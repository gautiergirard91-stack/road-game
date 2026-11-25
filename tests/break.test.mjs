import assert from 'node:assert/strict';

// ============================================================================
// tests/break.test.mjs — TEST ADVERSARIAL ("essayer de casser le jeu comme un joueur")
// Objectif : aucune entrée corrompue (localStorage, réseau, stats, level bidouillé)
// ne doit JAMAIS faire planter le jeu ni produire du NaN.
// ============================================================================

// --- stubs navigateur minimaux ---
Object.defineProperty(globalThis, 'window', {
  value: { innerWidth: 390, innerHeight: 844, devicePixelRatio: 2, matchMedia: () => ({ matches: false }) },
  configurable: true,
});
const mem = {};
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => {
    mem[k] = String(v);
  },
  removeItem: (k) => {
    delete mem[k];
  },
};

const core = await import('../js/core.js');
const { WINDOWS, LEVELS } = await import('../js/data.js');
const store = await import('../js/store.js');
const lb = await import('../js/leaderboard.js');
const { Game } = await import('../js/game.js');
lb._setWriteGap(0); // tests : rate-limit client désactivé par défaut (testé à part en section BC)

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  passed++;
  console.log(`  ok - ${name}`);
}

// ---------------------------------------------------------------- canvas stub
function makeCtx() {
  return new Proxy(
    {},
    {
      get(t, k) {
        if (k === 'measureText') return () => ({ width: 10 });
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
        return () => {};
      },
      set() {
        return true;
      },
    }
  );
}
const makeCanvas = () => ({ getContext: () => makeCtx(), style: {}, width: 0, height: 0 });
function makeGame(level, mode, extra = {}) {
  return new Game(makeCanvas(), {
    level,
    mode,
    skinId: 'default',
    effects: [],
    audio: {},
    windows: WINDOWS,
    access: { lineBeat: true }, // v1.3.91 : bip 0 ms activé dans les tests (optionnel côté joueur)
    onJudge() {},
    onMiss() {},
    onThreshold() {},
    onEnd() {},
    ...extra,
  });
}

console.log('A. localStorage corrompu');
{
  mem['roadtap_save_v1'] = '{json cassé !!!';
  let s;
  assert.doesNotThrow(() => (s = store.load()), 'load() ne doit pas throw sur JSON cassé');
  ok('JSON cassé -> défauts', s.wallets.auto === 0 && s.difficulty === 'auto' && s.unlockedLevels.includes(1));

  mem['roadtap_save_v1'] = JSON.stringify({
    trophies: 5,
    wallets: 'beaucoup',
    difficulty: 42,
    pseudo: 12345,
    unlockedLevels: 'niveau 15 svp',
    skins: 7,
    best: [1, 2, 3],
    cleared: 'oui',
    speedrun: 'oui',
    horizontalZones: 1,
    streak: 'infini',
    quests: 'x',
    totals: null,
  });
  assert.doesNotThrow(() => (s = store.load()), 'load() ne doit pas throw sur les mauvais types');
  ok(
    'mauvais types -> sanitize',
    typeof s.trophies === 'object' &&
      s.wallets.auto === 0 &&
      s.difficulty === 'auto' &&
      s.pseudo === '' &&
      Array.isArray(s.unlockedLevels) &&
      s.unlockedLevels.includes(1) &&
      s.skins.includes('default') &&
      typeof s.best === 'object' &&
      s.speedrun === false &&
      typeof s.streak === 'number'
  );
  // les setters doivent rester sûrs après une save corrompue
  assert.doesNotThrow(() => {
    store.setBest('auto', 3, 100); // v1.3.44 : signature (mode, levelId, score)
    store.setTrophy(3);
    store.markCleared(3);
    store.addCoins('auto', 50);
    store.addCoins('auto', NaN); // ne doit pas rendre le wallet NaN
    store.spend('pilote', 10); // fonds insuffisants -> false
    store.setBestTime('auto', 3, 12345); // v1.3.44 : (mode, levelId, ms)
    store.setSpeedrun(true);
    store.setVerticalZones(true);
    store.setPseudo(98765);
  });
  ok('setters sûrs après save corrompue', store.getWallet('auto') === 50 && Number.isFinite(store.getWallet('auto')));
  ok('markCleared/isCleared', store.isCleared(3) === true && store.isCleared(4) === false);
  ok('setBest/setTrophy persistés (clé "auto:3")', store.get().best['auto:3'] === 100 && store.get().trophies[3] === true);
  ok('pseudo tronqué et stringifié', store.get().pseudo === '' || typeof store.get().pseudo === 'string');

  mem['roadtap_save_v1'] = 'null';
  assert.doesNotThrow(() => store.load());
  mem['roadtap_save_v1'] = '42';
  assert.doesNotThrow(() => store.load());
  mem['roadtap_save_v1'] = '"une string"';
  assert.doesNotThrow(() => store.load());
  ok('load() tolère null / nombre / string', true);
}

console.log('B. mergeRemote avec données distantes corrompues');
{
  store.load();
  assert.strictEqual(store.mergeRemote(null), false);
  assert.strictEqual(store.mergeRemote('garbage'), false);
  assert.strictEqual(store.mergeRemote(42), false);
  assert.doesNotThrow(() => store.mergeRemote({ packs: 5, quests: 'x', best: 'non', wallets: { auto: 'bcp' }, trophies: [1, 2], cleared: 'oui' }));
  ok('mergeRemote garbage -> pas de throw', true);
  assert.strictEqual(store.mergeRemote({ wallets: { auto: 500 }, cleared: { 2: true }, best: { 2: 900 } }), true);
  ok('mergeRemote valide -> merge', store.getWallet('auto') === 500 && store.isCleared(2) && store.get().best[2] === 900);
  assert.doesNotThrow(() => store.mergeRemote({ quests: { weekKey: 1, progress: 'x' }, totals: 'x', soundPacks: null }));
  ok('mergeRemote champs partiels bizarres -> pas de throw', true);
}

console.log('C. core : judge / fmtTime / pointsFor / buildPattern (valeurs extrêmes)');
{
  ok('judge(NaN) -> null', core.judge(NaN) === null);
  ok('judge(Infinity) -> null', core.judge(Infinity) === null && core.judge(-Infinity) === null);
  ok('judge(0) -> perfect', core.judge(0) === 'perfect');
  ok('judge(46) -> good (borne 45)', core.judge(46) === 'good');
  ok('judge(161) -> null (hors fenêtre)', core.judge(161) === null);
  ok('fmtTime(NaN) -> 0:00.00', core.fmtTime(NaN) === '0:00.00');
  ok('fmtTime(-5) -> 0:00.00', core.fmtTime(-5) === '0:00.00');
  ok('fmtTime(Infinity) -> 0:00.00', core.fmtTime(Infinity) === '0:00.00');
  ok('fmtTime(65.5) -> 1:05.50', core.fmtTime(65.5) === '1:05.50');
  ok('pointsFor(null) -> 0 (pas NaN)', core.pointsFor(null, 0) === 0);
  ok('pointsFor("perfect", NaN) -> 100', core.pointsFor('perfect', NaN) === 100);
  ok('coinsForResult({}) -> 0 (pas NaN)', core.coinsForResult({}, { id: 1 }, false) === 0);
  ok('isPerfectClear({}) -> false', core.isPerfectClear({}) === false);
  ok('isPerfectClear stats NaN -> false', core.isPerfectClear({ perfects: NaN, goods: 0, passables: 0, misses: 0 }) === false);

  const t0 = Date.now();
  const p1 = core.buildPattern({ lines: 0, w: {}, gapMin: 10, gapMax: 5 }, 1); // gaps inversés, poids vides
  ok('buildPattern level dégénéré -> 1 ligne, pas de hang', p1.length === 1 && Date.now() - t0 < 1000);
  const p2 = core.buildPattern({ lines: 1e9, w: { dash: 1 }, gapMin: 500, gapMax: 700 }, 1); // boucle infinie potentielle
  ok('buildPattern lines=1e9 -> plafonné à 10000', p2.length === 10000 && Date.now() - t0 < 2000);
  const p3 = core.buildPattern({ lines: NaN, w: { dash: 1 }, gapMin: 500, gapMax: 700 }, 1);
  ok('buildPattern lines=NaN -> 1 ligne', p3.length === 1);
  const p4 = core.buildPattern({ lines: 50, w: { dash: 1 }, gapMin: 700, gapMax: 100 }, 7); // gapMax < gapMin
  const gapsOk = p4.every((l, i, a) => i === 0 || l.dist > a[i - 1].dist);
  ok('buildPattern gaps inversés -> distances toujours croissantes', gapsOk);
}

console.log('D. game : régression du crash NaN (tap avec voiture à l\'arrêt)');
{
  const game = makeGame(LEVELS[0], 'auto');
  game.start();
  // voiture arrêtée (piéton) pile sur une ligne : avant v1.3.27 -> dtMs = 0/0 = NaN -> crash
  game.effSpeed = 0;
  game.slow = 0;
  const line = game.lines[0];
  game.distance = line.dist; // roue exactement SUR la ligne
  assert.doesNotThrow(() => game.tap('rear'), 'tap à l\'arrêt sur une ligne ne doit pas throw');
  ok('tap à l\'arrêt -> clic dans le vide (pendingStray)', Math.abs(game.pendingStray - 0.25) < 1e-9);
  ok('aucun jugement émis', game.stats.perfects + game.stats.goods + game.stats.passables === 0);

  // cas normal : ligne pile sous les roues, voiture qui roule -> PARFAIT
  const game2 = makeGame(LEVELS[0], 'auto');
  game2.start();
  game2.effSpeed = LEVELS[0].speed;
  const l2 = game2.lines[0];
  game2.distance = l2.dist;
  game2.tap('rear');
  ok('tap précis -> perfect', game2.stats.perfects === 1 && l2.hits.rear === 'perfect');
}

console.log('E. speedrun : plafond de vitesse bonus et reset sur raté');
{
  const game = makeGame(LEVELS[0], 'pilote', { speedrun: true });
  game.start();
  // 300 parfaits d'affilée : bonusSpeed doit rester plafonné à +80 % de la vitesse de base
  for (let i = 0; i < 300; i++) {
    game.lines.push({ type: 'dash', dist: game.distance, axle: 'rear', state: 'pending', hits: { front: false, rear: false } });
    game.tap('rear');
  }
  const cap = game.level.speed * 0.8;
  ok('bonusSpeed plafonné à +80 %', game.bonusSpeed <= cap + 1e-9 && game.bonusSpeed > cap - 1, `bonus=${game.bonusSpeed} cap=${cap}`);
  game.slow = 1;
  game.update(1 / 60);
  ok('effSpeed <= 1.8x base', game.effSpeed <= game.level.speed * 1.8 + 1e-6, `eff=${game.effSpeed} base=${game.level.speed}`);

  // un raté remet toute la vitesse accumulée à zéro
  game.bonusSpeed = 150;
  game.registerMiss(null, 'rear');
  ok('miss en speedrun -> bonusSpeed = 0', game.bonusSpeed === 0);
}

console.log('F. leaderboard : réseau cassé / HTTP 401 / données corrompues côté serveur');
{
  globalThis.fetch = async () => {
    throw new Error('network down');
  };
  const r1 = await lb.getTop('all');
  ok('fetch qui throw -> fallback local, pas de throw', Array.isArray(r1));
  const st1 = lb.getLbStatus();
  ok('statut signale l\'erreur réseau', st1.source === 'local' && typeof st1.error === 'string' && st1.error.length > 0);

  globalThis.fetch = async () => ({ ok: false, status: 401 });
  const r2 = await lb.getTop('auto');
  const st2 = lb.getLbStatus();
  ok('HTTP 401 -> fallback local + erreur "401" visible', Array.isArray(r2) && st2.source === 'local' && st2.error.includes('401'));

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      a: { pseudo: 'X', score: 'abc', level: 'L', mode: 'auto', date: 1 }, // score corrompu
      b: { pseudo: 'Y', score: 500, level: 'L', mode: 'auto', date: 2 },
      c: 'garbage', // entrée non objet
      d: { pseudo: 'Z', score: 1e9, level: 'L', mode: 'auto', date: 3 },
    }),
  });
  const r3 = await lb.getTop('auto');
  const st3 = lb.getLbStatus();
  ok('données distantes corrompues -> filtrées/triées sans crash', r3.length === 3 && r3[0].pseudo === 'Z' && r3[0].score === 1e9);
  ok('score "abc" coercé en 0', r3.find((e) => e.pseudo === 'X').score === 0);
  ok('statut firebase + count', st3.source === 'firebase' && st3.count === 4 && st3.error === null);

  // écriture refusée -> fallback local + erreur explicite (avec jeton : v1.3.37 sans jeton = repli local direct)
  globalThis.fetch = async () => ({ ok: false, status: 403 });
  const r4 = await lb.submitScore({ pseudo: 'Moi', uid: 'uid9', score: 10, level: 'L', levelId: 1, mode: 'auto', date: Date.now() }, 'TOK403');
  const st4 = lb.getLbStatus();
  ok('écriture HTTP 403 -> score local + writeError "403"', Array.isArray(r4) && st4.writeError && st4.writeError.includes('403'));
  ok('le score soumis est bien en local', r4.some((e) => e.pseudo === 'Moi'));

  delete globalThis.fetch;
}

console.log('G. v1.3.28 : zones gauche/droite (mapping pur) + effets jamais auto-activés + erreur d\'écriture LB persistante');
{
  // --- zoneFromPoint : gauche/droite si option ON, haut/bas sinon, gardes NaN ---
  ok('zone gauche -> front (horizontal ON)', core.zoneFromPoint(100, 500, 390, 844, true) === 'front');
  ok('zone droite -> rear (horizontal ON)', core.zoneFromPoint(300, 500, 390, 844, true) === 'rear');
  ok('zone haut -> front (horizontal OFF)', core.zoneFromPoint(200, 100, 390, 844, false) === 'front');
  ok('zone bas -> rear (horizontal OFF)', core.zoneFromPoint(200, 700, 390, 844, false) === 'rear');
  ok('zoneFromPoint NaN -> rear (pas de crash)', core.zoneFromPoint(NaN, NaN, 390, 844, true) === 'rear');

  // --- keyToAction v1.3.76 : Z=AV, S=AR, flèches G/D = changements de voie (toutes orientations) ---
  ok('DEFAULT_KEYS v1.3.76 = Z/S/ArrowLeft/R', core.DEFAULT_KEYS.front === 'KeyZ' && core.DEFAULT_KEYS.rear === 'KeyS' && core.DEFAULT_KEYS.swipe === 'ArrowLeft' && core.DEFAULT_KEYS.retry === 'KeyR');
  ok('KeyZ -> front, KeyS -> rear', core.keyToAction('KeyZ', true) === 'front' && core.keyToAction('KeyS', false) === 'rear');
  ok('ArrowLeft -> swipe et ArrowRight -> swipeRight (horiz ON et OFF)', core.keyToAction('ArrowLeft', true) === 'swipe' && core.keyToAction('ArrowLeft', false) === 'swipe' && core.keyToAction('ArrowRight', true) === 'swipeRight' && core.keyToAction('ArrowRight', false) === 'swipeRight');
  ok('fallbacks : ArrowUp -> front, Space/ArrowDown/Enter -> rear, KeyR -> retry', core.keyToAction('ArrowUp', false) === 'front' && core.keyToAction('Space', false) === 'rear' && core.keyToAction('ArrowDown', true) === 'rear' && core.keyToAction('Enter', false) === 'rear' && core.keyToAction('KeyR', false) === 'retry');
  ok('touche inconnue -> null', core.keyToAction('KeyQ', true) === null);

  // --- effets : JAMAIS activés automatiquement ---
  mem['roadtap_save_v1'] = JSON.stringify({});
  store.load();
  ok('save fraîche -> aucun effet sélectionné', store.get().selectedEffects.length === 0);
  store.addCoins('auto', 10000);
  ok('buyEffect -> possédé mais PAS sélectionné', store.buyEffect('shake', 600, 'auto') === true && store.get().effects.includes('shake') && !store.get().selectedEffects.includes('shake'));
  ok('toggleEffect active un effet possédé', (store.toggleEffect('shake'), store.get().selectedEffects.includes('shake')));
  ok('toggleEffect retire', (store.toggleEffect('shake'), !store.get().selectedEffects.includes('shake')));
  store.grantEffect('glow'); // chemin pack
  ok('grantEffect (pack) -> possédé mais PAS sélectionné', store.get().effects.includes('glow') && !store.get().selectedEffects.includes('glow'));
  ok('toggleEffect sur effet NON possédé = no-op', (store.toggleEffect('fire'), !store.get().selectedEffects.includes('fire')));
  const { PACKS } = await import('../js/data.js');
  ok('buyPack -> contenus débloqués, rien d\'activé', store.buyPack(PACKS[0]) === true && store.get().effects.includes('shake') && store.get().selectedEffects.length === 0);

  // --- leaderboard : l'erreur d'écriture reste visible après une lecture réussie ---
  // (jeton passé : depuis v1.3.37, submitScore SANS jeton ne fait aucun POST et pose le writeError "Google requis")
  globalThis.fetch = async () => ({ ok: false, status: 403 });
  await lb.submitScore({ pseudo: 'Moi', uid: 'uid9', score: 5, level: 'L', levelId: 1, mode: 'auto', date: 1 }, 'TOK403');
  ok('submit 403 -> writeError enregistrée', lb.getLbStatus().writeError && lb.getLbStatus().writeError.includes('403'));
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ a: { pseudo: 'Y', score: 50, mode: 'auto' } }) });
  await lb.getTop('auto'); // lecture OK ensuite
  const st = lb.getLbStatus();
  ok('lecture OK après 403 -> writeError TOUJOURS visible', st.source === 'firebase' && st.count === 1 && st.writeError && st.writeError.includes('403'));
  delete globalThis.fetch;
}

console.log('H. v1.3.29 : contrat des règles RTDB (corps du POST) + nœud scores absent');
{
  // Le POST de submitScore doit contenir EXACTEMENT les champs exigés par les règles
  // (validation au niveau $mode/$id : hasChildren(['pseudo','score','level','mode','date'])).
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), method: opts && opts.method, body: opts && opts.body ? JSON.parse(opts.body) : null });
    return { ok: true, json: async () => null };
  };
  await lb.submitScore({ pseudo: 'Test', uid: 'uidT', score: 123, level: 'Premiers tours', levelId: 1, mode: 'auto', date: 42 }, 'TOK_H'); // v1.3.37 : jeton requis
  const captured = calls.find((c) => c.method === 'POST'); // submitScore refait un getTop('all') après -> on isole le POST
  ok('POST vers /scores/auto.json', captured && captured.url.includes('/scores/auto.json') && captured.method === 'POST');
  const b = captured && captured.body;
  ok('corps du POST = contrat des règles (5 champs requis présents)', b && ['pseudo', 'score', 'level', 'mode', 'date'].every((k) => k in b));
  ok('bornes des règles respectées (score <= 1e6, pseudo <= 16)', b && b.score <= 1000000 && String(b.pseudo).length <= 16);

  // nœud scores absent (null) -> lecture OK mais vide -> fallback local, pas de crash
  globalThis.fetch = async () => ({ ok: true, json: async () => null });
  const r = await lb.getTop('all');
  const st = lb.getLbStatus();
  ok('scores.json = null -> fallback local, source local', Array.isArray(r) && st.source === 'local' && typeof st.error === 'string');
  delete globalThis.fetch;
}

console.log('I. v1.3.30 : comparaison de versions (sonde anti-SW-obsolète)');
{
  ok('parseVersion("1.3.30") = [1,3,30]', JSON.stringify(core.parseVersion('1.3.30')) === '[1,3,30]');
  ok('parseVersion("abc") = [0,0,0] (pas de crash)', JSON.stringify(core.parseVersion('abc')) === '[0,0,0]');
  ok('isNewerVersion("1.3.30","1.3.29") = true', core.isNewerVersion('1.3.30', '1.3.29') === true);
  ok('isNewerVersion("1.3.29","1.3.30") = false', core.isNewerVersion('1.3.29', '1.3.30') === false);
  ok('isNewerVersion("1.3.29","1.3.29") = false (pas de boucle de reload)', core.isNewerVersion('1.3.29', '1.3.29') === false);
  ok('isNewerVersion("2.0.0","1.9.9") = true', core.isNewerVersion('2.0.0', '1.9.9') === true);
  ok('isNewerVersion("1.3.29","abc") = true (serveur connu > version illisible)', core.isNewerVersion('1.3.29', 'abc') === true);
  ok('isNewerVersion("abc","1.3.29") = false', core.isNewerVersion('abc', '1.3.29') === false);
}

console.log('J. v1.3.31 : classement speedrun dédié (contrat POST, tri croissant, filtre niveau, nœud null)');
{
  // contrat du POST /speedrun/<levelId> : champs exigés par les règles + bornes timeMs
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), method: opts && opts.method, body: opts && opts.body ? JSON.parse(opts.body) : null });
    return { ok: true, json: async () => null };
  };
  await lb.submitSpeedrun(3, { pseudo: 'Test', uid: 'uidT', timeMs: 45320, level: 'Double file', date: 9 }, 'TOK_J'); // v1.3.37 : jeton requis
  const post = calls.find((c) => c.method === 'POST');
  ok('POST vers /speedrun/3.json', post && post.url.includes('/speedrun/3.json'));
  ok('corps = contrat règles speedrun (pseudo/timeMs/level/date + bornes, mode fallback = auto depuis v1.3.68)', post && ['pseudo', 'timeMs', 'level', 'date'].every((k) => k in post.body) && post.body.timeMs >= 1000 && post.body.timeMs <= 3600000 && post.body.mode === 'auto');

  // tri CROISSANT sur timeMs + entrées corrompues filtrées + filtre par niveau
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      1: { a: { pseudo: 'A', timeMs: 60000, level: 'Premiers tours', levelId: 1, date: 1 }, b: { pseudo: 'B', timeMs: 30000, level: 'Premiers tours', levelId: 1, date: 2 } },
      2: { c: { pseudo: 'C', timeMs: 20000, level: 'Accélération', levelId: 2, date: 3 }, d: 'garbage', e: { pseudo: 'D', timeMs: 'abc' } },
    }),
  });
  const all = await lb.getSpeedrunTop('all');
  ok('tri croissant : C(20s) < B(30s) < A(60s), garbage/NaN filtrés', all.length === 3 && all[0].pseudo === 'C' && all[1].pseudo === 'B' && all[2].pseudo === 'A');
  ok('statut firebase + count', lb.getLbStatus().source === 'firebase' && lb.getLbStatus().count === 5);
  const only1 = await lb.getSpeedrunTop('1');
  ok('filtre niveau 1 -> uniquement A et B', only1.length === 2 && only1.every((e) => e.levelId === 1));

  // nœud speedrun absent (null) -> fallback local sans crash
  globalThis.fetch = async () => ({ ok: true, json: async () => null });
  const empty = await lb.getSpeedrunTop('all');
  ok('speedrun.json = null -> fallback local, source local', Array.isArray(empty) && lb.getLbStatus().source === 'local');

  // écriture refusée -> fallback local + writeError visible
  globalThis.fetch = async () => ({ ok: false, status: 403 });
  await lb.submitSpeedrun(1, { pseudo: 'Moi', uid: 'uid9', timeMs: 50000, level: 'L', date: 1 }, 'TOK403'); // v1.3.37 : jeton requis pour atteindre le 403
  ok('écriture speedrun 403 -> writeError + local', lb.getLbStatus().writeError && lb.getLbStatus().writeError.includes('403') && lb.getLbStatus().writeError.includes('speedrun'));
  delete globalThis.fetch;
}

console.log('K. v1.3.32 : anti-usurpation — idToken en ?auth= et uid dans le corps quand connecté');
{
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), method: opts && opts.method, body: opts && opts.body ? JSON.parse(opts.body) : null });
    return { ok: true, json: async () => null };
  };
  // connecté Google : jeton passé -> ?auth= présent + uid dans le corps (règle uid == auth.uid)
  await lb.submitScore({ pseudo: 'Moi', uid: 'uid123', score: 10, level: 'L', levelId: 1, mode: 'auto', date: 1 }, 'ID_TOKEN_ABC');
  const authed = calls.find((c) => c.method === 'POST');
  ok('submitScore avec idToken -> ?auth=ID_TOKEN_ABC dans l\'URL', authed && authed.url.includes('?auth=ID_TOKEN_ABC'));
  ok('corps contient uid (contrat règle auth.uid)', authed && authed.body.uid === 'uid123');
  ok('contrat 5 champs toujours présent', authed && ['pseudo', 'score', 'level', 'mode', 'date'].every((k) => k in authed.body));
  // v1.3.37 : anonyme -> PLUS AUCUN POST réseau (accès anonyme retiré), repli local direct
  calls.length = 0;
  await lb.submitScore({ pseudo: 'Anon', score: 5, level: 'L', levelId: 1, mode: 'auto', date: 2 });
  const anon = calls.find((c) => c.method === 'POST');
  ok('sans idToken -> AUCUN POST (anonyme retiré v1.3.37), repli local', !anon);
  // speedrun aussi
  calls.length = 0;
  await lb.submitSpeedrun(2, { pseudo: 'Moi', uid: 'uid123', timeMs: 40000, level: 'L', date: 3 }, 'TOK');
  const sr = calls.find((c) => c.method === 'POST');
  ok('submitSpeedrun avec idToken -> ?auth= + uid dans le corps', sr && sr.url.includes('?auth=TOK') && sr.body.uid === 'uid123');
  delete globalThis.fetch;
}

console.log('M. v1.3.35 : étoiles par niveau + paliers Survie ∞ + skin récompense non achetable');
{
  // starsFor : 0 si pas terminé, 1 terminé, 2 si >=60% PARFAIT, 3 si full parfait
  ok('starsFor non terminé -> 0', core.starsFor({ completed: false, perfects: 10 }) === 0);
  ok('starsFor terminé sans parfait -> 1', core.starsFor({ completed: true, perfects: 0, goods: 5, passables: 5, misses: 0 }) === 1);
  ok('starsFor terminé 60% parfaits -> 2', core.starsFor({ completed: true, perfects: 6, goods: 4, passables: 0, misses: 0 }) === 2);
  ok('starsFor full parfait -> 3', core.starsFor({ completed: true, perfects: 10, goods: 0, passables: 0, misses: 0 }) === 3);
  ok('starsFor stats NaN -> sûr', core.starsFor({ completed: true, perfects: NaN }) === 1);

  // endlessMilestones : paliers franchis entre prev et next
  const ms = core.endlessMilestones(5, 55);
  ok('paliers 5->55 = [10,25,50]', ms.length === 3 && ms.map((x) => x.m).join(',') === '10,25,50');
  ok('palier 50 = skin + coins 250', ms[2].skin === true && ms[2].coins === 250);
  ok('aucun palier si record inchangé', core.endlessMilestones(60, 60).length === 0);
  ok('paliers NaN sûrs', core.endlessMilestones(NaN, Infinity).length === 0);

  // store : setStars/setEndlessBest gardent le max ; skin récompense non achetable
  mem['roadtap_save_v1'] = JSON.stringify({ stars: { 1: 2 }, endlessBest: 30 });
  store.load();
  ok('sanitize garde stars/endlessBest', store.get().stars[1] === 2 && store.get().endlessBest === 30);
  store.setStars(1, 1);
  ok('setStars garde le max (1 -> reste 2)', store.get().stars[1] === 2);
  store.setStars(2, 3);
  ok('setStars nouveau niveau -> 3', store.get().stars[2] === 3);
  store.setEndlessBest(20);
  ok('setEndlessBest garde le max', store.get().endlessBest === 30);
  store.setEndlessBest(80);
  ok('setEndlessBest nouveau record', store.get().endlessBest === 80);
  ok('buySkin coût 0 (récompense) refusé', store.buySkin('endless_or', 0, 'auto') === false && !store.get().skins.includes('endless_or'));
  store.grantSkin('endless_or');
  ok('grantSkin débloque la récompense', store.get().skins.includes('endless_or'));
  // snapshot/mergeRemote incluent stars + endlessBest
  ok('snapshot inclut stars/endlessBest', store.snapshot().stars[2] === 3 && store.snapshot().endlessBest === 80);
  ok('mergeRemote fusionne stars (max) et endlessBest', (store.mergeRemote({ stars: { 2: 1, 5: 3 }, endlessBest: 10 }), store.get().stars[2] === 3 && store.get().stars[5] === 3 && store.get().endlessBest === 80));
}

console.log('N. v1.3.36 : garage / événement week-end / classement amis / aperçus animés (purs + store + leaderboard)');
{
  // --- week-end : dates fixes (21/11/2026 = samedi, 22 = dimanche, 23 = lundi) ---
  const sat = new Date(2026, 10, 21);
  const sun = new Date(2026, 10, 22);
  const mon = new Date(2026, 10, 23);
  ok('isWeekend samedi -> true', core.isWeekend(sat) === true);
  ok('isWeekend dimanche -> true', core.isWeekend(sun) === true);
  ok('isWeekend lundi -> false', core.isWeekend(mon) === false);
  ok('isWeekend entrée invalide -> false (PAS de fallback sur "maintenant")', core.isWeekend(new Date('nope')) === false && core.isWeekend('samedi') === false && core.isWeekend(null) === false);
  ok('weekendCoinMultiplier samedi/dimanche -> 2', core.weekendCoinMultiplier(sat) === 2 && core.weekendCoinMultiplier(sun) === 2);
  ok('weekendCoinMultiplier lundi -> 1', core.weekendCoinMultiplier(mon) === 1);

  // --- WEEKEND_LEVEL (niveau spécial week-end) ---
  const dataMod = await import('../js/data.js');
  ok('WEEKEND_LEVEL : id 100, coût 0, flag weekend', dataMod.WEEKEND_LEVEL.id === 100 && dataMod.WEEKEND_LEVEL.cost === 0 && dataMod.WEEKEND_LEVEL.weekend === true);
  ok('WEEKEND_LEVEL hors de LEVELS (ne change ni le déblocage Survie ∞ ni les succès)', !dataMod.LEVELS.some((l) => l.id === 100));
  ok('le thème du niveau week-end existe dans THEMES', !!dataMod.THEMES[dataMod.WEEKEND_LEVEL.theme]);

  // --- filterFriendsByPseudo (classement amis, casse/espaces ignorés, robuste) ---
  const entries = [
    { pseudo: 'Speedy', score: 100 },
    { pseudo: 'speedy2', score: 90 },
    { pseudo: 'Bob', score: 80 },
    { pseudo: 'alice', score: 70 },
    { pseudo: '', score: 1 },
    null,
  ];
  const fr = core.filterFriendsByPseudo(entries, ['Speedy', ' ALICE ']);
  ok('filterFriendsByPseudo insensible à la casse + trim', fr.length === 2 && fr[0].pseudo === 'Speedy' && fr[1].pseudo === 'alice');
  ok('filterFriendsByPseudo entrées corrompues -> [] sans plantage', core.filterFriendsByPseudo(null, null).length === 0 && core.filterFriendsByPseudo('x', 'y').length === 0 && core.filterFriendsByPseudo(entries, 'pasuntableau').length === 0);

  // --- store.friends ---
  mem['roadtap_save_v1'] = JSON.stringify({ friends: ['Speedy', 'speedy', '  Bob  ', 42, 'x'.repeat(30)] });
  store.load();
  ok('sanitize friends : dédup insensible à la casse, trim, 16 car. max, non-string virés', store.get().friends.join('|') === 'Speedy|Bob|' + 'x'.repeat(16));
  ok('addFriend nouveau -> true', store.addFriend('Alice') === true && store.get().friends.includes('Alice'));
  ok('addFriend doublon (casse différente) -> false', store.addFriend('ALICE') === false);
  ok('addFriend vide -> false', store.addFriend('   ') === false);
  ok('removeFriend existant -> true, puis -> false', store.removeFriend('bob') === true && store.removeFriend('bob') === false);
  ok('snapshot inclut friends (synchro cloud)', Array.isArray(store.snapshot().friends) && store.snapshot().friends.includes('Alice'));
  store.mergeRemote({ friends: ['alice', 'Zoe'] });
  ok('mergeRemote : union des amis, dédup insensible à la casse', store.get().friends.includes('Alice') && store.get().friends.includes('Zoe') && store.get().friends.filter((f) => f.toLowerCase() === 'alice').length === 1);

  // --- leaderboard.getAll / getSpeedrunAll (stub fetch) ---
  mem['roadtap_leaderboard_local_v1'] = '[]';
  mem['roadtap_speedrun_local_v1'] = '[]';
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/scores/auto.json')) {
      const data = {};
      for (let i = 0; i < 25; i++) data['k' + i] = { pseudo: 'P' + i, score: i * 10, mode: 'auto', levelId: 1, level: 'L1', date: i };
      return { ok: true, json: async () => data };
    }
    if (u.includes('/speedrun.json')) {
      return { ok: true, json: async () => ({ 1: { a: { pseudo: 'A', timeMs: 5000, levelId: 1 }, b: { pseudo: 'B', timeMs: 3000, levelId: 1 } }, 2: { c: { pseudo: 'C', timeMs: 4000, levelId: 2 } } }) };
    }
    return { ok: true, json: async () => null };
  };
  const all = await lb.getAll('all');
  ok('getAll : 25 entrées retournées (> TOP=20, SANS limite) triées desc', all.length === 25 && all[0].score === 240 && all[24].score === 0);
  ok('getAll : statut firebase renseigné', lb.getLbStatus().source === 'firebase' && lb.getLbStatus().count === 25);
  ok('getAll filtre par mode', (await lb.getAll('pilote')).length === 0);
  const frAll = core.filterFriendsByPseudo(await lb.getAll('auto'), ['p5']);
  ok('getAll + filterFriendsByPseudo : P5 retrouvé dans le classement amis', frAll.length === 1 && frAll[0].pseudo === 'P5');
  const srAll = await lb.getSpeedrunAll();
  ok('getSpeedrunAll : tri croissant, sans limite', srAll.length === 3 && srAll[0].pseudo === 'B' && srAll[2].pseudo === 'A');
  ok('filterLevel exporté (filtrage par levelId)', lb.filterLevel([{ levelId: 1 }, { levelId: 2 }], '1').length === 1);
  globalThis.fetch = async () => { throw new Error('offline'); };
  ok('getAll hors ligne -> repli local sans plantage', Array.isArray(await lb.getAll('auto')));
  delete globalThis.fetch;
}

console.log('O. v1.3.37 : compte Google obligatoire (anonyme retiré) + synchro cloud réparée');
{
  // --- règles RTDB : plus d'écriture anonyme sur scores/speedrun/challenges ---
  const fs = await import('node:fs');
  const rules = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules;
  for (const node of ['scores', 'speedrun', 'challenges']) {
    const child = Object.keys(rules[node]).find((k) => k.startsWith('$'));
    const idLevel = Object.keys(rules[node][child]).find((k) => k.startsWith('$'));
    const w = rules[node][child][idLevel]['.write'];
    ok(`règles ${node} : auth != null requis (accès anonyme retiré)`, w.includes('auth != null') && !w.includes('auth == null'));
    ok(`règles ${node} : anti-usurpation (auth.uid) + création seule (!data.exists) conservées`, w.includes('auth.uid') && w.includes('!data.exists()'));
  }

  // --- cloudsave : la clé uid ne doit PAS être lowercasée (règle auth.uid == $id est sensible à la casse) ---
  const cs = await import('../js/cloudsave.js');
  const seen = [];
  globalThis.fetch = async (url, opts) => {
    seen.push({ url: String(url), method: opts && opts.method, keepalive: Boolean(opts && opts.keepalive) });
    return { ok: true, json: async () => null };
  };
  await cs.load('Uid_MixedCase_ABC123', 'TOK');
  ok('cloudsave.load : URL contient l\'uid TEL QUEL (pas de lowercase -> plus de 403)', seen[0].url.includes('/players/Uid_MixedCase_ABC123.json') && seen[0].url.includes('?auth=TOK') && !seen[0].url.includes('uid_mixedcase'));
  await cs.save('Uid_MixedCase_ABC123', { wallets: { auto: 5 } }, 'TOK');
  ok('cloudsave.save : PUT + keepalive (le push survit à la fermeture de l\'app)', seen[1].method === 'PUT' && seen[1].keepalive === true && seen[1].url.includes('/players/Uid_MixedCase_ABC123.json'));

  // --- envois leaderboard SANS jeton -> aucun POST, repli local, diagnostic explicite ---
  mem['roadtap_leaderboard_local_v1'] = '[]';
  mem['roadtap_speedrun_local_v1'] = '[]';
  const posts = [];
  globalThis.fetch = async (url, opts) => {
    if (opts && opts.method === 'POST') posts.push(String(url));
    return { ok: true, json: async () => null };
  };
  const r1 = await lb.submitScore({ pseudo: 'Anon', uid: '', score: 42, level: 'L', levelId: 1, mode: 'auto', date: 1 });
  ok('submitScore sans jeton -> AUCUN POST réseau (anonyme retiré)', posts.length === 0);
  ok('submitScore sans jeton -> repli local', Array.isArray(r1) && r1.some((e) => e.pseudo === 'Anon' && e.score === 42));
  ok('submitScore sans jeton -> writeError mentionne Google', String(lb.getLbStatus().writeError || '').includes('Google'));
  const r2 = await lb.submitSpeedrun(1, { pseudo: 'Anon', uid: '', timeMs: 30000, level: 'L', date: 2 });
  ok('submitSpeedrun sans jeton -> aucun POST, repli local temps', posts.length === 0 && Array.isArray(r2) && r2.some((e) => e.timeMs === 30000));
  ok('submitChallengeScore sans jeton -> false + writeError', (await lb.submitChallengeScore('2026-11-22', { pseudo: 'A', uid: '', score: 1, mode: 'auto', date: 1 })) === false && String(lb.getLbStatus().writeError || '').includes('Google'));
  // avec jeton -> POST avec ?auth= (anti-régression)
  await lb.submitScore({ pseudo: 'Moi', uid: 'uid1', score: 7, level: 'L', levelId: 1, mode: 'auto', date: 3 }, 'TOK2');
  ok('submitScore AVEC jeton -> POST ?auth=TOK2 (inchangé)', posts.length === 1 && posts[0].includes('?auth=TOK2'));
  delete globalThis.fetch;
}

console.log('P. v1.3.38 : UN SEUL bouton Google « Connexion Google » (plus de « Continuer en tant que », plus de « (popup) » et plus de gsi-btn)');
{
  const fs2 = await import('node:fs');
  const html = fs2.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const mainSrc = fs2.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const authSrc = fs2.readFileSync(new URL('../js/auth.js', import.meta.url), 'utf8');
  ok('index.html : bouton libellé « Connexion Google » SANS « (popup) »', html.includes('Connexion Google') && !html.includes('(popup)'));
  ok('index.html : plus de conteneur gsi-btn', !html.includes('gsi-btn'));
  ok('main.js : plus aucune référence gsi-btn / renderGoogleButton / getLastAuthError', !mainSrc.includes('gsi-btn') && !mainSrc.includes('renderGoogleButton') && !mainSrc.includes('getLastAuthError'));
  ok('auth.js : plus de rendu GIS one-tap (continue_with / renderButton)', !authSrc.includes('continue_with') && !authSrc.includes('renderGoogleButton') && !authSrc.includes('accounts.google.com/gsi'));
  ok('auth.js : le popup SDK (signInWithPopupGoogle) reste le seul chemin de connexion', authSrc.includes('signInWithPopupGoogle') && mainSrc.includes('signInWithPopupGoogle'));
  ok('main.js : le bouton btn-google-popup reste câblé', mainSrc.includes("on('btn-google-popup'"));
}

console.log('Q. v1.3.39 : options d\'accessibilité aussi dans le menu pause (préfixe p-, synchronisées avec la modale)');
{
  const fs3 = await import('node:fs');
  const html = fs3.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const mainSrc = fs3.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  // v1.3.52 : les options d'accessibilité ont QUITTÉ la pause (elles vivent dans ⚙️ Paramètres, préfixe s-)
  const pauseHtml = html.slice(html.indexOf('id="pause-overlay"'), html.indexOf('id="continue-overlay"'));
  ok('plus de p-opt-* dans la pause (remplacé par le bouton Paramètres)', !pauseHtml.includes('p-opt-') && pauseHtml.includes('btn-pause-settings'));
  ok("main.js : panneau câblé UNIQUEMENT sur 's-' Paramètres (v1.3.56 : plus de préfixe '' modale)", !mainSrc.includes("wireAccessCheckboxes('');") && mainSrc.includes("wireAccessCheckboxes('s-');"));
  // comportement : les setters persistent et partent dans le snapshot cloud
  mem['roadtap_save_v1'] = '{}';
  store.load();
  store.setWideWindows(true);
  store.setColorblind(true);
  store.setVerticalZones(true);
  ok('setters accessibilité persistés (wideWindows/colorblind/verticalZones)', store.get().wideWindows === true && store.get().colorblind === true && store.get().verticalZones === true);
  ok('verticalZones part dans le snapshot cloud (synchro multi-appareils)', store.snapshot().verticalZones === true);
  ok('wideWindows/colorblind restent des préférences d\'appareil locales (par design, pas dans le snapshot)', !('wideWindows' in store.snapshot()) && !('colorblind' in store.snapshot()));
  store.setWideWindows(false);
  store.setColorblind(false);
  store.setVerticalZones(false);
  ok('désactivation persistée', store.get().wideWindows === false && store.get().colorblind === false && store.get().verticalZones === false);
}

console.log('R. v1.3.40 : jouer SANS compte (local), Google requis seulement pour cloud+classement, reset à 0 à la déconnexion, fusion à la reconnexion');
{
  const fs4 = await import('node:fs');
  const mainSrc = fs4.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');

  // on joue avec seulement un pseudo (plus besoin d'uid)
  ok('ensurePseudoThen : v1.3.84 jouer requiert connexion Google (uid) ET pseudo', /function ensurePseudoThen\(fn\) \{\s*\/\/ v1\.3\.84[\s\S]*?if \(save\.uid && save\.pseudo\) \{/.test(mainSrc));
  ok('plus de ensureAccountThen (Google plus obligatoire pour jouer)', !mainSrc.includes('ensureAccountThen'));
  ok('le classement exige toujours un compte lié (garde canSubmitToLeaderboard, v1.3.45)', mainSrc.includes('canSubmitToLeaderboard(save)'));
  ok('main.js : déconnexion (btn-google-out) appelle store.resetProgress()', /on\('btn-google-out'[\s\S]*?store\.resetProgress\(\)/.test(mainSrc));

  // resetProgress : repart de 0, garde les prefs matérielles de l'appareil
  mem['roadtap_save_v1'] = JSON.stringify({
    wallets: { auto: 5000, permisA: 300, pilote: 100 }, skins: ['default', 'sport'], skin: 'sport',
    pseudo: 'Testeur', uid: 'uidABC', unlockedLevels: [1, 2, 3], cleared: { 1: true },
    sound: false, music: false, wideWindows: true, colorblind: true, friends: ['Bob'],
  });
  store.load();
  store.resetProgress();
  const s = store.get();
  ok('resetProgress : progression à 0 (wallets/skins/pseudo/uid/niveaux/cleared/friends)', s.wallets.auto === 0 && s.wallets.permisA === 0 && s.wallets.pilote === 0 && s.skins.join(',') === 'default' && s.skin === 'default' && s.pseudo === '' && s.uid === '' && s.unlockedLevels.join(',') === '1' && !s.cleared[1] && s.friends.length === 0);
  ok('resetProgress : préférences matérielles conservées (son/musique/wideWindows/colorblind)', s.sound === false && s.music === false && s.wideWindows === true && s.colorblind === true);
  ok('resetProgress : persisté dans localStorage', JSON.parse(mem['roadtap_save_v1']).wallets.auto === 0 && JSON.parse(mem['roadtap_save_v1']).wideWindows === true);
  // reconnexion : la save locale à 0 fusionne avec le cloud (max/union) -> progression cloud retrouvée
  store.mergeRemote({ wallets: { auto: 5000, permisA: 300, pilote: 100 }, skins: ['default', 'sport'], unlockedLevels: [1, 2, 3], cleared: { 1: true }, uid: 'uidABC' });
  ok('reconnexion : fusion local(0) + cloud -> progression cloud retrouvée (max/union)', store.get().wallets.auto === 5000 && store.get().skins.includes('sport') && store.get().unlockedLevels.length === 3 && store.get().cleared[1] === true);
}

console.log('S. v1.3.41 : dépassement retravaillé (z-order ahead/behind + voiture doublée qui roule) + speedrun dans toutes les difficultés');
{
  // --- z-order : drawTraffic('ahead'/'behind') filtre selon sy vs wheelY ---
  const rec = [];
  const recCtx = new Proxy({}, {
    get(t, k) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (k === 'measureText') return () => ({ width: 10 });
      return () => { rec.push(String(k)); };
    },
    set() { return true; },
  });
  const g = makeGame(LEVELS[10], 'pilote');
  g.ctx = recCtx;
  g.wheelY = 600; g.h = 800; g.distance = 0; g.roadX = 100; g.roadW = 400;
  g.oncoming = [];
  const carAhead = { p: 500, v: 100, color: '#fff', w: 60, overtaken: false, grace: 0 };   // sy = 100 < wheelY
  const carBehind = { p: -300, v: 100, color: '#fff', w: 60, overtaken: false, grace: 0 }; // sy = 900 >= wheelY
  g.sameDir = [carAhead];
  rec.length = 0; g.drawTraffic('ahead');
  const aheadCount = rec.filter((x) => x === 'ellipse').length;
  rec.length = 0; g.drawTraffic('behind');
  const behindCount0 = rec.filter((x) => x === 'ellipse').length;
  g.sameDir = [carBehind];
  rec.length = 0; g.drawTraffic('ahead');
  const aheadCount2 = rec.filter((x) => x === 'ellipse').length;
  rec.length = 0; g.drawTraffic('behind');
  const behindCount = rec.filter((x) => x === 'ellipse').length;
  ok('z-order : voiture devant -> dessinée en phase ahead, PAS en behind', aheadCount > 0 && behindCount0 === 0);
  ok('z-order : voiture derrière -> dessinée en phase behind, PAS en ahead', behindCount > 0 && aheadCount2 === 0);

  // --- la voiture doublée n'est plus gelée : elle continue de rouler ---
  const g2 = makeGame(LEVELS[10], 'pilote');
  g2.start();
  g2.forceBlocker();
  const car = g2.sameDir[0];
  car.overtaken = true;
  const p0 = car.p;
  g2.updateTraffic(0.1);
  ok('voiture doublée continue de rouler (p augmente même overtaken)', car.p > p0);

  // --- swipeLeft : dépassement complet (cible marquée, voie changée, entre-sens vidé) ---
  const g3 = makeGame(LEVELS[10], 'pilote');
  g3.start();
  g3.forceBlocker();
  const c3 = g3.sameDir[0];
  c3.p = g3.distance + 100; // sy = wheelY - 100 -> visible
  g3.oncoming = [{ p: g3.distance + 900, v: -300, color: '#fff', w: 60 }];
  g3.swipeLeft();
  ok('swipeLeft : cible marquée overtaken + compteur + lastOvertaken + laneTarget=voie inverse', c3.overtaken === true && g3.stats.overtakes === 1 && g3.lastOvertaken === c3 && g3.laneTarget < 0.5);
  ok('swipeLeft : entre-sens vidé devant (plus de voiture en sens inverse pendant le dépassement)', g3.oncoming.length === 0);

  // --- speedrun dans toutes les difficultés ---
  // v1.3.68 : speedrun dans toutes les difficultés
  ok('speedrun en auto -> mode auto conservé', makeGame(LEVELS[0], 'auto', { speedrun: true }).mode === 'auto');
  ok('speedrun en pilote -> mode pilote conservé', makeGame(LEVELS[0], 'pilote', { speedrun: true }).mode === 'pilote');
  ok('speedrun en permisA -> permisA', makeGame(LEVELS[0], 'permisA', { speedrun: true }).mode === 'permisA');

  // --- submitSpeedrun transmet le vrai mode joué ---
  const posts2 = [];
  globalThis.fetch = async (url, opts) => {
    if (opts && opts.method === 'POST') posts2.push({ url: String(url), body: JSON.parse(opts.body) });
    return { ok: true, json: async () => null };
  };
  await lb.submitSpeedrun(3, { pseudo: 'T', uid: 'u1', timeMs: 45320, level: 'L', date: 9, mode: 'auto' }, 'TOK_S');
  ok('submitSpeedrun transmet mode=auto (pas forcément pilote)', posts2.length === 1 && posts2[0].body.mode === 'auto');
  delete globalThis.fetch;
}

console.log('T. v1.3.42 : musique adaptative — tempo/intensité/couches selon le combo, bit de tap qui monte, sting/victoire sans crash headless');
{
  const audio = await import('../js/audio.js');
  ok('comboIntensity : 0->0, 8->0.5, 16+->1 (capé), NaN/négatif->0', audio.comboIntensity(0) === 0 && audio.comboIntensity(8) === 0.5 && audio.comboIntensity(99) === 1 && audio.comboIntensity(NaN) === 0 && audio.comboIntensity(-5) === 0);
  ok('musicTempo : monte avec le combo, borné 96..160 BPM', audio.musicTempo(0) === 96 && audio.musicTempo(8) === 128 && audio.musicTempo(16) === 160 && audio.musicTempo(999) === 160);
  ok('tapFreq : le bit de chaque pression monte (300 -> 600 -> 1200 Hz capé)', audio.tapFreq(0) === 300 && audio.tapFreq(12) === 600 && audio.tapFreq(999) === audio.tapFreq(24) && audio.tapFreq(24) === 1200);
  const l0 = audio.musicLayers(0);
  const lMax = audio.musicLayers(30);
  ok('musicLayers : combo 0 -> aucune couche, combo max -> tout', l0.kick === false && l0.bass === false && l0.arp === false && lMax.kick === true && lMax.hat16 === true && lMax.snare === true && lMax.bass === true && lMax.pad === true && lMax.arp === true);
  audio.setMusicCombo(10);
  ok('setMusicCombo + getMusicState cohérents', audio.getMusicState().combo === 10 && audio.getMusicState().tempo === audio.musicTempo(10));
  audio.setMusicCombo(999);
  ok('setMusicCombo clamp à 99', audio.getMusicState().combo === 99);
  audio.musicSting();
  ok('musicSting remet le combo à 0 (la musique se calme après un raté)', audio.getMusicState().combo === 0);
  // headless : pas d'AudioContext -> aucun crash, aucun timer qui fuit
  audio.setMusicEnabled(true);
  audio.setMusicEnabled(false);
  audio.musicSting();
  audio.musicVictory();
  audio.sfx.tap();
  audio.sfx.perfect();
  ok('setMusicEnabled/sting/victory/sfx headless (sans AudioContext) -> pas de crash', true);
  ok('getMusicState expose on=false après arrêt', audio.getMusicState().on === false);
}

console.log('U. v1.3.43 : passage piéton à haute vitesse — arrêt AVANT le passage (pas roues dessus), tap à l\'arrêt pour piéton = validé, pas de cœur perdu');
{
  const mkCwGame = () => {
    const events = { judge: [] };
    // niveau 1 (pas de crosswalk dans le pattern) pour contrôler exactement la ligne piéton
    const g = makeGame(LEVELS[0], 'permisA', { onJudge: (e) => events.judge.push(e) });
    g.start();
    const cw = { type: 'crosswalk', dist: g.distance + 600, axle: 'rear', hits: { front: null, rear: null }, state: 'pending', result: null, flash: 0, glow: 0 };
    g.lines = [cw]; // on isole la ligne piéton des lignes du pattern
    g.ped = { line: cw, x: g.roadX + 50, dir: 1, y: g.wheelY - 100, speed: 100, color: '#fff', phase: 0 };
    g.autoStop = true;
    g.slow = 0; // voiture arrêtée
    return { g, cw, events };
  };

  // 1) clamp : même avec une distance énorme, la ligne ne dépasse pas les roues AV
  {
    const { g, cw } = mkCwGame();
    g.distance = cw.dist + (g.frontAxleY - 6) - g.wheelY + 800;
    g.update(1 / 60);
    ok('clamp autoStop : lineY <= frontAxleY - 6 (arrêt AVANT le passage)', g.lineY(cw) <= g.frontAxleY - 6 + 1e-6);
    ok('clamp : aucun cœur perdu sur la ligne piéton à l\'arrêt', g.stats.misses === 0 && cw.state === 'pending');
  }

  // 2) tap à l'arrêt POUR un piéton -> la ligne du passage est validée (good), pas de miss
  {
    const { g, cw, events } = mkCwGame();
    g.distance = cw.dist + (g.frontAxleY - 6) - g.wheelY; // ligne juste avant les roues AV
    g.update(1 / 60);
    g.tap('front');
    ok('tap AV à l\'arrêt (autoStop) -> ligne piéton validée « good », 0 miss', cw.hits.front === 'good' && g.stats.misses === 0);
    ok('onJudge émis avec type=crosswalk (étape tuto compatible)', events.judge.some((e) => e.type === 'crosswalk' && e.result === 'good'));
  }

  // 3) régression : tap à l'arrêt SANS piéton = toujours un clic dans le vide (puis -1 cœur)
  {
    const { g } = mkCwGame();
    g.autoStop = false;
    g.ped = null;
    g.tap('rear');
    ok('tap à l\'arrêt sans piéton -> stray immédiat', g.pendingStray > 0 && g.stats.misses === 0);
    g.update(0.3);
    ok('... et le stray fait bien perdre un cœur ensuite', g.stats.misses === 1);
  }

  // 4) sans arrêt piéton, une ligne piéton manquée fait toujours perdre un cœur (pas de passe-droit)
  {
    const { g, cw } = mkCwGame();
    g.autoStop = false;
    g.ped = null;
    g.slow = 1;
    g.distance = cw.dist + 500; // ligne déjà passée
    g.update(1 / 60);
    ok('ligne piéton manquée SANS autoStop -> miss (règle normale conservée)', g.stats.misses >= 1);
  }
}

console.log('V. v1.3.44 : records best/bestTime isolés par difficulté (clé "mode:levelId") + migration des anciennes clés + mergeRemote');
{
  mem['roadtap_save_v1'] = JSON.stringify({ best: { 3: 5000 }, bestTime: { 3: 42000 } }); // legacy : clé = levelId seul
  store.load();
  const s = store.get();
  ok('migration best : ancienne clé copiée dans les 3 difficultés, clé legacy supprimée', s.best['auto:3'] === 5000 && s.best['permisA:3'] === 5000 && s.best['pilote:3'] === 5000 && s.best['3'] === undefined);
  ok('migration bestTime (min) copiée dans les 3 difficultés', s.bestTime['auto:3'] === 42000 && s.bestTime['permisA:3'] === 42000 && s.bestTime['pilote:3'] === 42000 && s.bestTime['3'] === undefined);
  store.setBest('auto', 3, 6000);
  store.setBest('pilote', 3, 4000); // inférieur au migré (5000) -> pas de record
  ok('setBest isolé par mode + max', store.getBest('auto', 3) === 6000 && store.getBest('pilote', 3) === 5000 && store.getBest('permisA', 3) === 5000);
  ok('setBest refuse un score inférieur (retour false)', store.setBest('auto', 3, 100) === false && store.getBest('auto', 3) === 6000);
  store.setBestTime('auto', 3, 40000);
  ok('setBestTime isolé par mode + min', store.getBestTime('auto', 3) === 40000 && store.getBestTime('pilote', 3) === 42000 && store.getBestTime('permisA', 3) === 42000);
  ok('bestFlat : max de toutes les difficultés par niveau (vue succès)', store.bestFlat()['3'] === 6000);
  store.mergeRemote({ best: { 'auto:3': 9000, 'pilote:3': 1000 }, bestTime: { 'auto:3': 30000 } });
  ok('mergeRemote cloud : best max / bestTime min sur clés "mode:level"', store.getBest('auto', 3) === 9000 && store.getBest('pilote', 3) === 5000 && store.getBestTime('auto', 3) === 30000);
  ok('bestKey compose "mode:levelId"', store.bestKey('pilote', 7) === 'pilote:7');
}

console.log('W. v1.3.45 : wideWindows hors classement en ligne (garde client + filtre affichage + règle serveur) + « Recommencer » dans la pause');
{
  const fs5 = await import('node:fs');
  const html = fs5.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const mainSrc = fs5.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const rules = fs5.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8');
  const core = await import('../js/core.js');

  ok('canSubmitToLeaderboard : pseudo+uid sans wideWindows -> true', core.canSubmitToLeaderboard({ pseudo: 'A', uid: 'u1', wideWindows: false }) === true);
  ok('... wideWindows=true -> false (exclu du classement)', core.canSubmitToLeaderboard({ pseudo: 'A', uid: 'u1', wideWindows: true }) === false);
  ok('... sans uid / sans pseudo / null -> false', !core.canSubmitToLeaderboard({ pseudo: 'A', wideWindows: false }) && !core.canSubmitToLeaderboard({ uid: 'u', wideWindows: false }) && !core.canSubmitToLeaderboard(null));
  ok('main.js : les 3 envois (score/speedrun/défi) passent par canSubmitToLeaderboard', (mainSrc.match(/canSubmitToLeaderboard\(save\)/g) || []).length >= 3);

  mem['roadtap_leaderboard_local_v1'] = JSON.stringify([
    { pseudo: 'Normal', score: 500, mode: 'auto' },
    { pseudo: 'Wide', score: 9999, mode: 'auto', wideWindows: true },
  ]);
  const top = await lb.getTopLocal();
  ok('getTopLocal exclut les entrées wideWindows (le 9999 n\'est pas affiché)', top.length === 1 && top[0].pseudo === 'Normal');
  mem['roadtap_speedrun_local_v1'] = JSON.stringify([
    { pseudo: 'Normal', timeMs: 50000, levelId: 1 },
    { pseudo: 'Wide', timeMs: 1000, levelId: 1, wideWindows: true },
  ]);
  const srTop = await lb.getSpeedrunTop('all');
  ok('getSpeedrunTop exclut aussi wideWindows', srTop.every((e) => e.pseudo !== 'Wide'));

  ok('database.rules.json : les 3 règles .write rejettent wideWindows==true', (rules.match(/wideWindows'\)\.val\(\) != true/g) || []).length === 4); // v1.3.81 : + nœud seasons

  const pauseHtml = html.slice(html.indexOf('id="pause-overlay"'), html.indexOf('id="continue-overlay"'));
  ok('index.html : #btn-pause-retry présent UNE FOIS et dans pause-overlay', (html.match(/id="btn-pause-retry"/g) || []).length === 1 && pauseHtml.includes('btn-pause-retry'));
  ok('main.js : btn-pause-retry câblé (recommencer = startLevel(currentLevel))', mainSrc.includes("on('btn-pause-retry'") && /on\('btn-pause-retry'[\s\S]*?startLevel\(currentLevel\)/.test(mainSrc));
}

console.log('X. v1.3.46 : beat GD calé sur chaque ligne (lineBeat) + niveau week-end dans le filtre du classement');
{
  const beats = [];
  const g = makeGame(LEVELS[0], 'permisA', { audio: { lineBeat: (t, key) => beats.push([t, key]) } });
  g.start();
  const line = { type: 'dash', dist: g.distance + 150, axle: 'rear', hits: { front: null, rear: null }, state: 'pending', result: null, flash: 0, glow: 0 };
  g.lines = [line];
  g.update(1 / 60);
  const frontBeat = beats.find(([t, k]) => k === line.dist + ':front');
  const rearBeat = beats.find(([t, k]) => k === line.dist + ':rear');
  ok('beat GD : tics programmés pour essieu AV et AR', !!frontBeat && !!rearBeat);
  const eff = g.effSpeed;
  ok('beat AV avant le beat AR, tous deux > 0', frontBeat[0] > 0 && rearBeat[0] > frontBeat[0]);
  ok('t_rear ≈ (dist - distance)/effSpeed (calage exact)', Math.abs(rearBeat[0] - (line.dist - g.distance) / eff) < 0.05);
  beats.length = 0;
  line.hits.front = 'perfect';
  g.update(1 / 60);
  ok('essieu déjà tapé -> plus de beat pour cet essieu (AR oui, AV non)', !beats.some(([, k]) => k === line.dist + ':front') && beats.some(([, k]) => k === line.dist + ':rear'));

  const audio = await import('../js/audio.js');
  audio.scheduleLineBeat(0.1, 'k1');
  audio.scheduleLineBeat(0.2, 'k1');
  audio.clearLineBeats();
  ok('scheduleLineBeat/clearLineBeats headless (sans AudioContext) -> pas de crash', true);

  const fs6 = await import('node:fs');
  const mainSrc = fs6.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  ok('renderLbLevelFilter inclut le niveau 🎉 Week-end (WEEKEND_LEVEL)', mainSrc.includes('String(WEEKEND_LEVEL.id)') && mainSrc.includes('Week-end'));
  ok('filterLevel("100") garde les entrées week-end du classement', lb.filterLevel([{ levelId: 100, score: 5 }, { levelId: 3, score: 9 }], '100').length === 1);
}

console.log('Y. v1.3.47 : menu Paramètres (accessibilité/audio/version/serveur) + touches personnalisables (save.keys)');
{
  const core = await import('../js/core.js');
  ok('DEFAULT_KEYS v1.3.76 = front Z / rear S / swipe ← / retry R', core.DEFAULT_KEYS.front === 'KeyZ' && core.DEFAULT_KEYS.rear === 'KeyS' && core.DEFAULT_KEYS.swipe === 'ArrowLeft' && core.DEFAULT_KEYS.retry === 'KeyR');
  ok('sanitizeKeys : corrompu -> défauts, partiel -> complété', core.sanitizeKeys(null).front === 'KeyZ' && core.sanitizeKeys({ front: 'KeyA', rear: 42 }).front === 'KeyA' && core.sanitizeKeys({ front: 'KeyA' }).rear === 'KeyS');
  ok('keyLabel lisible', core.keyLabel('ArrowUp') === '↑ Haut' && core.keyLabel('Space') === 'Espace' && core.keyLabel('KeyZ') === 'Z' && core.keyLabel('Digit5') === '5');
  ok('bindKey : rebind OK', core.bindKey(core.DEFAULT_KEYS, 'front', 'KeyA').front === 'KeyA');
  ok('bindKey : doublon refusé (null)', core.bindKey(core.DEFAULT_KEYS, 'front', 'KeyS') === null && core.bindKey(core.DEFAULT_KEYS, 'front', 'ArrowLeft') === null && core.bindKey(core.DEFAULT_KEYS, 'front', 'KeyR') === null);
  ok('keyToAction : touches perso priment', core.keyToAction('KeyA', false, { front: 'KeyA', rear: 'Space', swipe: 'ArrowLeft' }) === 'front');
  ok('keyToAction : repli mapping intégré si touche non perso', core.keyToAction('ArrowUp', false, { front: 'KeyA', rear: 'Space', swipe: 'ArrowLeft' }) === 'front' && core.keyToAction('ArrowRight', true, undefined) === 'swipeRight');

  mem['roadtap_save_v1'] = '{}';
  store.load();
  ok('save.keys défauts après load vide', store.get().keys.front === 'KeyZ' && store.get().keys.rear === 'KeyS');
  ok('setKey persiste (save + localStorage)', store.setKey('front', 'KeyZ') === true && store.get().keys.front === 'KeyZ' && JSON.parse(mem['roadtap_save_v1']).keys.front === 'KeyZ');
  ok('setKey doublon -> false, inchangé', store.setKey('rear', 'KeyZ') === false && store.get().keys.rear === 'KeyS');
  ok('snapshot inclut keys (cloud)', store.snapshot().keys.front === 'KeyZ');
  mem['roadtap_save_v1'] = JSON.stringify({ keys: { front: 'KeyP', rear: 'bogus' } });
  store.load();
  ok('sanitize keys : invalide -> défaut', store.get().keys.front === 'KeyP' && store.get().keys.rear === 'KeyS' && store.get().keys.swipe === 'ArrowLeft');
  store.mergeRemote({ keys: { front: 'KeyQ', rear: 'Enter', swipe: 'KeyX' } });
  ok('mergeRemote applique les touches du cloud', store.get().keys.front === 'KeyQ' && store.get().keys.swipe === 'KeyX');

  const fs7 = await import('node:fs');
  const html = fs7.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const mainSrc = fs7.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  let allIds = true;
  for (const id of ['screen-settings', 'btn-settings', 'btn-settings-back', 's-opt-widewindows', 's-opt-colorblind', 's-opt-zones-h', 'btn-set-sound', 'btn-set-music', 'btn-key-front', 'btn-key-rear', 'btn-key-swipe', 'key-capture-hint', 'set-version', 'set-server', 'btn-set-refresh']) {
    if ((html.match(new RegExp(`id="${id}"`, 'g')) || []).length !== 1) { allIds = false; console.log('  id manquant ou en double:', id); }
  }
  ok('index.html : les 15 IDs du menu Paramètres présents une fois', allIds);
  ok('main.js : btn-settings ouvre screen-settings', mainSrc.includes("on('btn-settings'") && mainSrc.includes("show('screen-settings')"));
  ok('main.js : 3e panneau accessibilité câblé (s-)', mainSrc.includes("wireAccessCheckboxes('s-')") && mainSrc.includes("syncAccessCheckboxes('s-')"));
  ok('main.js : capture de touche dans keydown + keyToAction(save.keys)', mainSrc.includes('keyCapture') && mainSrc.includes('keyToAction(e.code, !save.verticalZones, save.keys)'));
  ok('main.js : 3 boutons de rebinding câblés', mainSrc.includes("'btn-key-front'") && mainSrc.includes("'btn-key-rear'") && mainSrc.includes("'btn-key-swipe'"));
  ok('main.js : version + état serveur (ping avec jeton, v1.3.59) dans les paramètres', mainSrc.includes("$('#set-version')") && mainSrc.includes("$('#set-server')") && mainSrc.includes('leaderboard.ping(getAuthToken())'));
}

console.log('Z. v1.3.48 : « Meilleur combo » retiré de l\'écran de fin + récompense selon la réactivité + onglet ⚡ Réaction (avgMs) au classement');
{
  const core = await import('../js/core.js');
  const st = (perfects, goods, passables, misses, reactions) => ({ perfects, goods, passables, misses, reactions });
  // reactionBonus (pur)
  let rb = core.reactionBonus(1000, st(10, 0, 0, 0, [30, 30]));
  ok('reactionBonus : avg 30 ms + précision 100% -> +35%', rb.pct === 35 && rb.coins === 350);
  rb = core.reactionBonus(1000, st(8, 2, 0, 1, [60]));
  ok('reactionBonus : avg 60 ms, précision 91% (<100) -> +15%', rb.pct === 15 && rb.coins === 150 && rb.acc === 91);
  rb = core.reactionBonus(1000, st(5, 4, 0, 1, [200]));
  ok('reactionBonus : avg 200 ms + précision 90% -> +0%', rb.pct === 0 && rb.coins === 0);
  rb = core.reactionBonus(1000, st(5, 0, 0, 0, []));
  ok('reactionBonus : aucune réaction -> 0 (pas de NaN)', rb.coins === 0 && rb.avgMs === null);
  rb = core.reactionBonus(0, st(5, 0, 0, 0, [30]));
  ok('reactionBonus : coins=0 -> 0', rb.coins === 0);
  rb = core.reactionBonus(NaN, st(5, 0, 0, 0, [30]));
  ok('reactionBonus : coins NaN -> 0, pas de crash', rb.coins === 0);

  // écran de fin : plus de « Meilleur combo »
  const fs8 = await import('node:fs');
  const mainSrc = fs8.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  ok('main.js : « Meilleur combo » supprimé du over-stats', !mainSrc.includes('Meilleur combo'));
  ok('main.js : bonus réactivité câblé (reactionBonus + label ⚡)', mainSrc.includes('reactionBonus(coins, stats)') && mainSrc.includes('réactivité +${rb.pct}%'));

  // avgMs envoyé au classement (champ optionnel, hasChildren autorise les champs en plus)
  const posts3 = [];
  globalThis.fetch = async (url, opts) => {
    if (opts && opts.method === 'POST') posts3.push({ url: String(url), body: JSON.parse(opts.body) });
    return { ok: true, json: async () => null };
  };
  await lb.submitScore({ pseudo: 'T', uid: 'u1', score: 500, level: 'L', levelId: 1, mode: 'auto', date: 9, avgMs: 33 }, 'TOK_Z');
  await lb.submitScore({ pseudo: 'T', uid: 'u1', score: 500, level: 'L', levelId: 1, mode: 'auto', date: 9 }, 'TOK_Z');
  ok('submitScore envoie avgMs quand présent', posts3.length === 2 && posts3[0].body.avgMs === 33 && !('avgMs' in posts3[1].body));
  delete globalThis.fetch;

  // onglet ⚡ Réaction
  ok('main.js : onglet « reaction » dans le filtre + branche isReact (tri croissant avgMs)', mainSrc.includes("{ id: 'reaction', name: '⚡ Réaction' }") && mainSrc.includes('isReact') && mainSrc.includes("compareEntries(a, b, 'reaction')"));
  ok('main.js : lignes LB affichent ⚡ avgMs quand présent', mainSrc.includes('⚡${e.avgMs}ms'));
}

console.log('AA. v1.3.49 : touche « recommencer » bindable + boutons de souris bindables + garage (effets/thèmes achetés)');
{
  const core = await import('../js/core.js');
  ok('DEFAULT_KEYS inclut retry=KeyR', core.DEFAULT_KEYS.retry === 'KeyR' && core.KEY_ACTIONS.includes('retry'));
  ok('isValidKeyCode accepte les boutons souris (et pas n\'importe quoi)', core.isValidKeyCode('MouseLeft') && core.isValidKeyCode('MouseRight') && !core.isValidKeyCode('MouseBack'));
  ok('keyLabel souris', core.keyLabel('MouseLeft') === '🖱️ Clic gauche' && core.keyLabel('MouseMiddle') === '🖱️ Clic milieu');
  ok('keyToAction : KeyR -> retry (vertical + horizontal)', core.keyToAction('KeyR', false) === 'retry' && core.keyToAction('KeyR', true) === 'retry');
  ok('keyToAction : MouseLeft bindé -> front', core.keyToAction('MouseLeft', false, { front: 'MouseLeft', rear: 'Space', swipe: 'ArrowLeft', retry: 'KeyR' }) === 'front');
  ok('bindKey : retry sur MouseRight OK, doublon refusé', core.bindKey(core.DEFAULT_KEYS, 'retry', 'MouseRight').retry === 'MouseRight' && core.bindKey(core.DEFAULT_KEYS, 'retry', 'KeyS') === null);

  mem['roadtap_save_v1'] = '{}';
  store.load();
  ok('save.keys défaut inclut retry', store.get().keys.retry === 'KeyR');
  ok('setKey retry persisté', store.setKey('retry', 'KeyN') === true && store.get().keys.retry === 'KeyN');
  mem['roadtap_save_v1'] = JSON.stringify({ keys: { front: 'MouseLeft', retry: 42 } });
  store.load();
  ok('sanitize : MouseLeft gardé, retry invalide -> défaut', store.get().keys.front === 'MouseLeft' && store.get().keys.retry === 'KeyR');

  const fs9 = await import('node:fs');
  const html = fs9.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const mainSrc = fs9.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  ok('index.html : btn-key-retry + garage-effects + garage-themes présents', html.includes('id="btn-key-retry"') && html.includes('id="garage-effects"') && html.includes('id="garage-themes"'));
  ok('main.js : retry câblé (settings + keydown + souris) et garage effets/thèmes rendus', mainSrc.includes("'btn-key-retry', 'retry'") && mainSrc.includes('MOUSE_CODES') && mainSrc.includes("action === 'retry'") && mainSrc.includes("$('#garage-effects')") && mainSrc.includes("$('#garage-themes')"));
}

console.log('AB. v1.3.50 : « Photo réaliste » supprimé, tagline supprimée, btn-access hors du menu, accessibilité lisible (CSS), filtres « Tous » retirés du classement + bug filtre niveau 2 corrigé');
{
  const fsA = await import('node:fs');
  const html = fsA.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const mainSrc = fsA.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const gameSrc = fsA.readFileSync(new URL('../js/game.js', import.meta.url), 'utf8');
  const lbSrc = fsA.readFileSync(new URL('../js/leaderboard.js', import.meta.url), 'utf8');
  const css = fsA.readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');

  ok('plus de « Photo réaliste » (game.js label vide + templates filtrent)', !gameSrc.includes('Photo réaliste') && !mainSrc.includes('Photo réaliste') && mainSrc.includes('filter(Boolean).join'));
  const menuHtml = html.slice(html.indexOf('id="screen-menu"'), html.indexOf('id="screen-levels"'));
  ok('menu principal : tagline supprimée + bouton ♿ Accessibilité retiré', !menuHtml.includes('tagline') && !menuHtml.includes('id="btn-access"'));
  ok('access-modal retiré du HTML (v1.3.56 : modale morte nettoyée, accessibilité uniquement dans ⚙️ Paramètres)', !html.includes('id="access-modal"'));
  ok('CSS : options accessibilité lisibles dans Paramètres (16px + fond + case agrandie)', css.includes('.settings-panel label.lb-optin') && css.includes('font-size: 16px') && css.includes('scale(1.3)'));

  ok('main.js : « 🌐 Tous niveaux » ré-ajouté pour le filtre NIVEAU (v1.3.67), pas d\'option « Tous » pour la difficulté', mainSrc.includes("{ id: 'all', name: '🌐 Tous niveaux' }") && !mainSrc.includes("{ id: 'all', name: 'Tous' }"));
  ok('main.js : ouverture = filtres mémorisés (v1.3.65), sinon défaut difficulté courante + tous niveaux', mainSrc.includes('if (!lbFiltersLoaded)') && mainSrc.includes('lbFilter = save.difficulty;') && mainSrc.includes("lbLevelFilter = 'all';"));
  ok('main.js : filtre par niveau => getAll(lbFilter) + filterLevel côté client (v1.3.70, la difficulté filtre toujours)', mainSrc.includes('await leaderboard.getAll(lbFilter)') && mainSrc.includes('leaderboard.filterLevel(all, lbLevelFilter)'));
  ok('leaderboard.js : filterLevel tolérant (levelId string ou number)', lbSrc.includes('Number(e.levelId) === id'));

  // fonctionnel : filterLevel avec levelId en string fonctionne (cause possible du bug testeur)
  ok('filterLevel("2") matche levelId 2 (number) ET "2" (string)', lb.filterLevel([{ levelId: 2, score: 1 }, { levelId: '2', score: 2 }, { levelId: 3, score: 3 }], '2').length === 2);
}

console.log('AC. v1.3.51 : niveaux déterministes (seed fixe par niveau+mode) — speedrun-friendly');
{
  const core = await import('../js/core.js');
  ok('levelSeed stable + dépend du niveau et du mode', core.levelSeed(3, 'auto') === core.levelSeed(3, 'auto') && core.levelSeed(3, 'auto') !== core.levelSeed(3, 'pilote') && core.levelSeed(3, 'auto') !== core.levelSeed(4, 'auto'));
  const p1 = core.buildPattern(LEVELS[2], core.levelSeed(3, 'permisA'), 'permisA');
  const p2 = core.buildPattern(LEVELS[2], core.levelSeed(3, 'permisA'), 'permisA');
  ok('buildPattern : même seed -> pattern identique', JSON.stringify(p1) === JSON.stringify(p2));
  const p3 = core.buildPattern(LEVELS[2], core.levelSeed(3, 'permisA') + 1, 'permisA');
  ok('buildPattern : seed différent -> pattern différent', JSON.stringify(p1) !== JSON.stringify(p3));

  const g1 = makeGame(LEVELS[2], 'permisA');
  const g2 = makeGame(LEVELS[2], 'permisA');
  g1.start();
  g2.start();
  const sig = (g) => JSON.stringify(g.lines.map((l) => [l.type, l.dist, l.axle]));
  ok('2 parties même niveau+mode -> lignes identiques', sig(g1) === sig(g2));
  g1.extendPattern();
  g2.extendPattern();
  ok('tronçons suivants identiques aussi', sig(g1) === sig(g2));

  const t1 = makeGame(LEVELS[10], 'pilote');
  const t2 = makeGame(LEVELS[10], 'pilote');
  t1.start();
  t2.start();
  t1.tOncoming = 0; t2.tOncoming = 0; t1.tSame = 0; t2.tSame = 0;
  for (let i = 0; i < 120; i++) { t1.updateTraffic(1 / 60); t2.updateTraffic(1 / 60); }
  ok('trafic déterministe (mêmes voitures après les mêmes updates)', JSON.stringify(t1.oncoming) === JSON.stringify(t2.oncoming) && JSON.stringify(t1.sameDir) === JSON.stringify(t2.sameDir));

  const g3 = makeGame(LEVELS[0], 'auto');
  g3.start();
  for (let i = 0; i < 30; i++) g3.update(1 / 60);
  ok('30 updates sans crash avec le rand seedé', g3.running === true);
}

console.log('AD. v1.3.52 : pause embarque Paramètres (plus d\'accessibilité dans la pause) + anti menu contextuel (clic droit) en jeu');
{
  const fsB = await import('node:fs');
  const html = fsB.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const mainSrc = fsB.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const pauseHtml = html.slice(html.indexOf('id="pause-overlay"'), html.indexOf('id="continue-overlay"'));
  ok('pause-overlay : bouton ⚙️ Paramètres présent, bloc p-opt-* supprimé', pauseHtml.includes('id="btn-pause-settings"') && !pauseHtml.includes('p-opt-'));
  ok('plus aucun p-opt-* dans tout le HTML', !html.includes('p-opt-'));
  ok('settings conserve son panneau accessibilité (s-opt-*)', html.includes('id="s-opt-widewindows"') && html.includes('id="s-opt-colorblind"') && html.includes('id="s-opt-zones-h"'));
  ok('main.js : plus de câblage p-, btn-pause-settings -> screen-settings, retour pause si settingsFrom=pause', !mainSrc.includes("wireAccessCheckboxes('p-')") && !mainSrc.includes("syncAccessCheckboxes('p-')") && mainSrc.includes("on('btn-pause-settings'") && mainSrc.includes("show('screen-settings')") && mainSrc.includes("settingsFrom === 'pause'"));
  ok('main.js : contextmenu bloqué en jeu (clic droit ne ouvre plus le menu Windows)', /addEventListener\('contextmenu'[\s\S]*?currentScreen === 'screen-game'[\s\S]*?preventDefault/.test(mainSrc));
}

console.log('AE. v1.3.53 : Son/Musique retirés du menu principal (dans Paramètres) + touche « recommencer » aussi sur l\'écran de fin');
{
  const fsC = await import('node:fs');
  const html = fsC.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const mainSrc = fsC.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const menuHtml = html.slice(html.indexOf('id="screen-menu"'), html.indexOf('id="screen-levels"'));
  ok('menu principal : plus de btn-sound/btn-music (dans ⚙️ Paramètres)', !menuHtml.includes('id="btn-sound"') && !menuHtml.includes('id="btn-music"'));
  ok('Paramètres conserve btn-set-sound/btn-set-music', html.includes('id="btn-set-sound"') && html.includes('id="btn-set-music"'));
  ok('main.js : retry accepté en screen-game ET screen-over', mainSrc.includes("currentScreen === 'screen-game' || currentScreen === 'screen-over'"));
}

console.log('AF. v1.3.54 -> v1.3.68 : speedrun n\'est PLUS verrouillé à Permis A (toutes difficultés, Auto école comprise)');
{
  const fsD = await import('node:fs');
  const mainSrc = fsD.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const gameSrc = fsD.readFileSync(new URL('../js/game.js', import.meta.url), 'utf8');
  const html = fsD.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  ok('game.js : speedrun garde la difficulté demandée (plus de force permisA)', !gameSrc.includes("this.speedrun ? 'permisA'") && gameSrc.includes("this.mode = opts.mode || 'auto'"));
  ok('main.js : startLevel mode = difficulté choisie même en speedrun', mainSrc.includes('mode: save.difficulty,') && !mainSrc.includes("mode: save.speedrun ? 'permisA'"));
  ok('main.js : records/envois utilisent le mode réellement joué (runMode)', mainSrc.includes('const runMode = (game && game.mode) || save.difficulty;') && mainSrc.includes('store.setBest(runMode, level.id') && mainSrc.includes('mode: runMode'));
  ok('main.js : plus de verrou : ni setDifficulty(\'permisA\') forcé, ni picker bloqué en speedrun', !mainSrc.includes("store.setDifficulty('permisA');") && !mainSrc.includes("save.speedrun && d.id !== 'permisA'"));
  ok('index.html : v1.3.77 — plus de sélecteur de mode (btn-mode-* supprimés)', !html.includes('btn-mode-speedrun') && !html.includes('btn-mode-normal'));
}

console.log('AG. v1.3.55 : écrans scrollables (safe center + overflow-y) et topbar sticky -> bouton retour toujours accessible (garage)');
{
  const fsE = await import('node:fs');
  const css = fsE.readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  ok('CSS : .screen.active scrollable (overflow-y auto + safe center)', /\.screen\.active\s*\{[^}]*overflow-y:\s*auto/.test(css) && css.includes('justify-content: safe center'));
  ok('CSS : .topbar sticky top 0 avec fond opaque (bouton retour visible en scrollant)', /\.topbar\s*\{[^}]*position:\s*sticky[^}]*top:\s*0/s.test(css) && /\.topbar\s*\{[^}]*background:\s*#0d1226/s.test(css));
}

console.log('AH. v1.3.56 : nettoyage check de nuit (modale/boutons/CSS morts retirés, contrat speedrun = permisA)');
{
  const fsF = await import('node:fs');
  const html = fsF.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const mainSrc = fsF.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const css = fsF.readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  const lbSrc = fsF.readFileSync(new URL('../js/leaderboard.js', import.meta.url), 'utf8');

  ok('HTML : modale access-modal + opt-* (préfixe vide) + btn-access-close supprimés', !html.includes('id="access-modal"') && !html.includes('id="opt-widewindows"') && !html.includes('id="opt-colorblind"') && !html.includes('id="opt-zones-h"') && !html.includes('id="btn-access-close"'));
  ok('HTML : btn-access / btn-sound / btn-music absents (menu principal épuré, réglages dans ⚙️ Paramètres)', !html.includes('id="btn-access"') && !html.includes('id="btn-sound"') && !html.includes('id="btn-music"'));
  ok('HTML : accessibilité UNIQUEMENT via s-opt-* dans Paramètres', html.includes('id="s-opt-widewindows"') && html.includes('id="s-opt-colorblind"') && html.includes('id="s-opt-zones-h"'));
  ok('main.js : handlers morts supprimés (btn-access, btn-access-close, btn-sound, btn-music, #access-modal)', !mainSrc.includes("on('btn-access'") && !mainSrc.includes("on('btn-access-close'") && !mainSrc.includes("on('btn-sound'") && !mainSrc.includes("on('btn-music'") && !mainSrc.includes("$('#access-modal')"));
  ok("main.js : wiring accessibilité uniquement sur préfixe 's-' (plus de '' )", !mainSrc.includes("wireAccessCheckboxes('')") && !mainSrc.includes("syncAccessCheckboxes('')") && mainSrc.includes("wireAccessCheckboxes('s-')"));
  ok('CSS : .tagline et .pause-access supprimés', !css.includes('.tagline') && !css.includes('.pause-access'));
  ok("leaderboard.js : fallback mode speedrun = 'auto' (v1.3.68)", lbSrc.includes("mode: entry.mode || 'auto'") && !lbSrc.includes("mode: entry.mode || 'permisA'") && !lbSrc.includes("mode: entry.mode || 'pilote'"));

  // fonctionnel : submitSpeedrun sans entry.mode envoie bien mode=permisA dans le POST
  {
    const calls = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      calls.push({ url: String(url), body: opts && opts.body ? JSON.parse(opts.body) : null });
      return { ok: true, status: 200, json: async () => ({}) };
    };
    try {
      await lb.submitSpeedrun(3, { pseudo: 'Testeur', uid: 'u1', timeMs: 12345, level: 'Accélération', date: 1 }, 'TOK');
    } finally {
      if (origFetch === undefined) delete globalThis.fetch; else globalThis.fetch = origFetch;
    }
    const post = calls.find((c) => c.body && typeof c.body.timeMs === 'number');
    ok('submitSpeedrun(3, sans entry.mode) -> POST /speedrun/3.json avec body.mode === "auto" (v1.3.68)', !!post && post.body.mode === 'auto' && post.body.timeMs === 12345 && post.url.includes('/speedrun/3.json'));
  }
}

console.log('AI. v1.3.57 : touches sauvegardées AVEC LE COMPTE (backup local roadtap_keys_v1_<uid|pseudo>, conservées à la déconnexion, portées par le cloud)');
{
  const fsG = await import('node:fs');
  const mainSrc = fsG.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const storeSrc = fsG.readFileSync(new URL('../js/store.js', import.meta.url), 'utf8');

  // 1) dès qu'on rebind une touche avec un compte posé, la backup compte est écrite
  mem['roadtap_save_v1'] = '{}';
  store.load();
  store.setGoogleAccount('uid-abc', 'a@b.c', 'rt');
  store.setKey('front', 'KeyZ');
  ok('setKey écrit la backup compte roadtap_keys_v1_<uid>', !!mem['roadtap_keys_v1_uid-abc'] && JSON.parse(mem['roadtap_keys_v1_uid-abc']).front === 'KeyZ');

  // 2) au chargement, si la save principale a perdu les touches, elles sont restaurées depuis la backup du compte
  mem['roadtap_save_v1'] = JSON.stringify({ uid: 'uid-abc', pseudo: 'Testeur' }); // plus de keys -> défauts
  store.load();
  ok('load() restaure les touches du compte depuis la backup (CTRL+F5 / save perdue / clear partiel)', store.get().keys.front === 'KeyZ');

  // 3) déconnexion (resetProgress) : progression remise à 0 MAIS config (touches, zones) conservée
  store.setKey('rear', 'KeyM');
  store.setVerticalZones(true);
  store.addCoins('auto', 500);
  store.setBest('auto', 2, 999);
  store.resetProgress();
  ok('resetProgress : wallets/best remis à 0 MAIS keys + verticalZones conservés', store.get().wallets.auto === 0 && store.getBest('auto', 2) === 0 && store.get().keys.front === 'KeyZ' && store.get().keys.rear === 'KeyM' && store.get().verticalZones === true);

  // 4) le cloud continue de porter les touches (players/<uid>.keys)
  store.setKey('front', 'KeyP');
  ok('snapshot() inclut keys -> cloud players/<uid>.keys', store.snapshot().keys.front === 'KeyP');
  store.mergeRemote({ keys: { front: 'KeyQ', rear: 'Enter', swipe: 'ArrowLeft', retry: 'KeyR' } });
  ok('mergeRemote applique les touches du cloud (dernier appareil gagne)', store.get().keys.front === 'KeyQ' && store.get().keys.rear === 'Enter');

  // 5) wiring : backup calée après synchro cloud (connexion + restauration de session x2) + restore dans load()
  ok('main.js : backupKeysForAccount() appelé à la connexion et après chaque synchro cloud (>= 3 sites)', (mainSrc.match(/backupKeysForAccount\(\)/g) || []).length >= 3);
  ok("store.js : préfixe 'roadtap_keys_v1_' + restoreKeysForAccount() appelé dans load()", storeSrc.includes("'roadtap_keys_v1_'") && storeSrc.includes('restoreKeysForAccount();'));
}

console.log('AJ. v1.3.58 : diagnostic serveur détaillé — ping avec cause (ok/http-XXX/network + ms), App Check tokenOk, hébergement propre testé à part');
{
  const fsH = await import('node:fs');
  const html = fsH.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const mainSrc = fsH.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const lbSrc = fsH.readFileSync(new URL('../js/leaderboard.js', import.meta.url), 'utf8');
  const ac = await import('../js/appcheck.js');

  ok('HTML : ligne #set-host ajoutée dans ⚙️ Paramètres', html.includes('id="set-host"') && html.includes('id="set-server"'));
  ok('leaderboard.js : getPingStatus() exporté + ping() enregistre lastPing (ok/http/network)', lbSrc.includes('export function getPingStatus()') && lbSrc.includes("reason: 'http-' + res.status") && lbSrc.includes("reason: 'network'"));
  ok('main.js : updateServerStatus async + teste version.json (no-store) + getPingStatus + appCheckDebug + serverStatusText', mainSrc.includes('async function updateServerStatus()') && mainSrc.includes('hostEl') && mainSrc.includes("cache: 'no-store'") && mainSrc.includes('serverStatusText(') && mainSrc.includes('appCheckDebug()'));
  ok('main.js : serverStatusText distingue 401 (App Check/domaines) vs 403 (règles) vs réseau', mainSrc.includes("p.reason === 'http-401'") && mainSrc.includes("p.reason === 'http-403'") && mainSrc.includes("p.reason === 'network'"));

  // ping OK -> true + reason ok + ms mesuré
  const origFetch2 = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
  let okPing = await lb.ping();
  let ps = lb.getPingStatus();
  ok('ping OK -> true, reason=ok, status 200, ms nombre', okPing === true && ps.reason === 'ok' && ps.status === 200 && typeof ps.ms === 'number');
  // ping HTTP 401 (App Check Enforce sans token valide)
  globalThis.fetch = async () => ({ ok: false, status: 401 });
  okPing = await lb.ping();
  ps = lb.getPingStatus();
  ok('ping HTTP 401 -> false, reason=http-401 (diagnostic App Check)', okPing === false && ps.reason === 'http-401' && ps.status === 401);
  // ping réseau KO
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  okPing = await lb.ping();
  ps = lb.getPingStatus();
  ok('ping réseau KO -> false, reason=network, erreur conservée', okPing === false && ps.reason === 'network' && typeof ps.error === 'string' && ps.error.includes('Failed to fetch'));
  if (origFetch2 === undefined) delete globalThis.fetch; else globalThis.fetch = origFetch2;

  // appCheckDebug + appCheckHeader
  ac._setTokenProvider(async () => 'TOK');
  const h1 = await ac.appCheckHeader();
  ok('appCheckHeader (provider OK) -> header posé + appCheckDebug().tokenOk === true', h1['X-Firebase-AppCheck'] === 'TOK' && ac.appCheckDebug().tokenOk === true && ac.appCheckDebug().configured === true);
  ac._setTokenProvider(async () => { throw new Error('domain not authorized'); });
  const h2 = await ac.appCheckHeader();
  ok('token en échec -> header vide + tokenOk=false + lastError (cause « serveur injoignable »)', !h2['X-Firebase-AppCheck'] && ac.appCheckDebug().tokenOk === false && /domain not authorized/.test(ac.appCheckDebug().lastError || ''));
  ac._setTokenProvider(null);
}

console.log('AK. v1.3.59 : sur 401/403 le ping sonde AVEC jeton auth (authProbe) pour distinguer règles-auth vs App Check Enforce sans token');
{
  const fsI = await import('node:fs');
  const mainSrc = fsI.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const lbSrc = fsI.readFileSync(new URL('../js/leaderboard.js', import.meta.url), 'utf8');

  ok('leaderboard.js : ping(idToken) + authProbe enregistré sur 401/403', lbSrc.includes('export async function ping(idToken)') && lbSrc.includes('authProbe'));
  ok('main.js : ping(getAuthToken()) dans updateServerStatus ET refreshStatus (sonde auth active)', (mainSrc.match(/leaderboard\.ping\(getAuthToken\(\)\)/g) || []).length >= 2);
  ok('main.js : serverStatusText départage 401 sonde-ok (règles auth) vs sonde-ko (App Check)', mainSrc.includes("p.reason === 'http-401'") && mainSrc.includes('p.authProbe && p.authProbe.ok'));

  const origFetch3 = globalThis.fetch;
  const urls = [];
  // 401 anonyme, 200 avec auth=TOK -> cause = règles exigent auth en lecture
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    if (String(url).includes('auth=TOK')) return { ok: true, status: 200, json: async () => ({}) };
    return { ok: false, status: 401 };
  };
  let okP = await lb.ping('TOK');
  let ps = lb.getPingStatus();
  ok('ping 401 + sonde auth OK -> reason http-401, authProbe.ok=true, 2 requêtes (anonyme + auth)', okP === false && ps.reason === 'http-401' && ps.authProbe && ps.authProbe.ok === true && urls.some((u) => u.includes('auth=TOK')) && urls.length === 2);
  // 401 partout -> cause = App Check Enforce sans token
  globalThis.fetch = async () => ({ ok: false, status: 401 });
  await lb.ping('TOK');
  ps = lb.getPingStatus();
  ok('ping 401 + sonde auth 401 -> authProbe.ok=false, status 401 (App Check Enforce sans token)', ps.reason === 'http-401' && ps.authProbe && ps.authProbe.ok === false && ps.authProbe.status === 401);
  // sans jeton -> pas de sonde
  globalThis.fetch = async () => ({ ok: false, status: 403 });
  await lb.ping();
  ps = lb.getPingStatus();
  ok('ping 403 sans jeton -> authProbe null (pas de sonde)', ps.reason === 'http-403' && !ps.authProbe);
  // OK -> authProbe null et retour true
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
  okP = await lb.ping('TOK');
  ps = lb.getPingStatus();
  ok('ping OK -> true, reason ok, authProbe null (pas de sonde inutile)', okP === true && ps.reason === 'ok' && !ps.authProbe);
  if (origFetch3 === undefined) delete globalThis.fetch; else globalThis.fetch = origFetch3;
}

console.log('AL. v1.3.60 : la site key App Check = la clé Enterprise « roadtap ent » (6Lf7…) qui a roadtap.uk autorisé (sinon 401 sous Enforce)');
{
  const fsJ = await import('node:fs');
  const cfg = await import('../js/config.js');
  const ac = await import('../js/appcheck.js');
  const fireDoc = fsJ.readFileSync(new URL('../docs/FIREBASE.md', import.meta.url), 'utf8');

  ok('config : FIREBASE_APP_CHECK_SITE_KEY = 6Lf7vCwuAAAAAAamVJvl2tEUsDe-V6mEdVYDc1fW (clé « roadtap ent », domaines autorisés roadtap.uk/github.io/localhost)', cfg.FIREBASE_APP_CHECK_SITE_KEY === '6Lf7vCwuAAAAAAamVJvl2tEUsDe-V6mEdVYDc1fW');
  ok('config : plus aucune trace de l\'ancienne clé 6LecyCwu… hors commentaire', !/6LecyCwu[0-9A-Za-z_-]{10,}/.test(fsJ.readFileSync(new URL('../js/config.js', import.meta.url), 'utf8').replace(/\/\/[^\n]*/g, '')));
  ok('appcheck : isAppCheckEnabled() true avec cette clé', ac.isAppCheckEnabled() === true);
  ok('docs/FIREBASE.md : la clé 6Lf7… documentée + gotcha « configuration incomplète »', fireDoc.includes('6Lf7vCwuAAAAAAamVJvl2tEUsDe-V6mEdVYDc1fW') && fireDoc.includes('configuration incompl'));
}

console.log('AM. v1.3.62 : 401 même connecté = App Check Enforce sans token — l\'UI affiche maintenant l\'état du token (OK/KO + lastError), et appCheckHeader a un timeout borné');
{
  const fsK = await import('node:fs');
  const mainSrc = fsK.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const acSrc = fsK.readFileSync(new URL('../js/appcheck.js', import.meta.url), 'utf8');
  const ac = await import('../js/appcheck.js');

  ok('main.js : serverStatusText ajoute l\'état App Check (token KO + lastError) à TOUTES les branches d\'erreur', mainSrc.includes('🔴 token KO (${ac.lastError') && (mainSrc.match(/\+ acTxt/g) || []).length >= 5);
  ok('main.js : branche 401 cite la clé 6Lf7vCwu… + App Check → Apps (cause probable)', mainSrc.includes('6Lf7vCwu… doit être enregistrée dans Firebase → App Check → Apps'));
  ok('appcheck.js : timeout borné du token (_setTokenTimeoutMs + withTimeout via Promise.race)', acSrc.includes('tokenTimeoutMs') && acSrc.includes('export function _setTokenTimeoutMs') && acSrc.includes('withTimeout') && acSrc.includes('Promise.race'));

  // timeout : provider qui pend -> header vide, tokenOk=false, lastError=timeout, sans attendre 4s
  ac._setTokenTimeoutMs(60);
  ac._setTokenProvider(() => new Promise(() => {})); // ne résout jamais
  const t0 = Date.now();
  const h = await ac.appCheckHeader();
  const dt = Date.now() - t0;
  ok('appCheckHeader avec provider qui pend : retour {} en < 1s, tokenOk=false, lastError=timeout', !h['X-Firebase-AppCheck'] && ac.appCheckDebug().tokenOk === false && /timeout/.test(ac.appCheckDebug().lastError || '') && dt < 1000);
  ac._setTokenProvider(null);
  ac._setTokenTimeoutMs(4000);
}

console.log('AN. v1.3.63 : FIREBASE_APP_ID (ID d\'application de l\'app web) passé à initializeApp — sans lui l\'échange de jeton App Check renvoie 400 (throttled) → 401 sous Enforce');
{
  const fsL = await import('node:fs');
  const cfg = await import('../js/config.js');
  const acSrc = fsL.readFileSync(new URL('../js/appcheck.js', import.meta.url), 'utf8');
  const authSrc = fsL.readFileSync(new URL('../js/auth.js', import.meta.url), 'utf8');
  const mainSrc = fsL.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const ac = await import('../js/appcheck.js');

  ok('config.js : FIREBASE_APP_ID exporté (placeholder documenté, publique)', 'FIREBASE_APP_ID' in cfg && acSrc.includes('FIREBASE_APP_ID'));
  ok('appcheck.js : initializeApp reçoit appId: FIREBASE_APP_ID', acSrc.includes('appId: FIREBASE_APP_ID'));
  ok('auth.js : initializeApp reçoit aussi appId (même app web)', authSrc.includes('appId: FIREBASE_APP_ID'));
  ok('appcheck.js : sans appId, initAppCheck échoue proprement avec lastError explicite', acSrc.includes('FIREBASE_APP_ID manquant'));
  ok('appCheckDebug() : champ appIdMissing cohérent avec la config', ac.appCheckDebug().appIdMissing === !cfg.FIREBASE_APP_ID);
  ok('main.js : serverStatusText affiche le hint FIREBASE_APP_ID manquant si appIdMissing', mainSrc.includes('FIREBASE_APP_ID manquant'));

  // comportement : appId vide (placeholder) -> init null + header vide, jamais de throw
  if (!cfg.FIREBASE_APP_ID) {
    const h = await ac.appCheckHeader();
    ok('appId vide : appCheckHeader() -> {} sans throw + lastError mentionne FIREBASE_APP_ID', !h['X-Firebase-AppCheck'] && /FIREBASE_APP_ID/.test(ac.appCheckDebug().lastError || ''));
  }
}

console.log('AO. v1.3.65 : liste du joueur — tuto raccourci (9 étapes, ❤ réel, 3 lignes en Permis A, 2ème dépassement supprimé), max 1 passage piéton/niveau, filtres LB mémorisés, musique au lancement, plus de shadowBlur sur les lignes (anti-freeze)');
{
  const fsM = await import('node:fs');
  const coreSrc = fsM.readFileSync(new URL('../js/core.js', import.meta.url), 'utf8');
  const gameSrc = fsM.readFileSync(new URL('../js/game.js', import.meta.url), 'utf8');
  const mainSrc = fsM.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const tutSrc = fsM.readFileSync(new URL('../js/tutorial.js', import.meta.url), 'utf8');
  const audioSrc = fsM.readFileSync(new URL('../js/audio.js', import.meta.url), 'utf8');

  // ville : max 1 passage piéton par niveau (déterministe, sur plusieurs seeds)
  let maxCw = 0, anyCw = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const pat = core.buildPattern(LEVELS[3], seed, 'auto'); // niveau 4 « En ville » (crosswalk: true)
    const n = pat.filter((l) => l.type === 'crosswalk').length;
    maxCw = Math.max(maxCw, n); anyCw += n;
  }
  ok('ville : max 1 passage piéton par niveau sur 40 seeds (niveau 4)', maxCw <= 1 && anyCw >= 1);
  ok('core.js : cap crosswalk dans buildPattern (crosswalks < 1)', coreSrc.includes('crosswalks < 1'));

  // tuto
  ok('tutorial.js : 9 étapes, plus de « 2ème »/« 1er essai », okLines>=3, missStep −1 ❤️', tutSrc.includes('okLines >= 3') && !/2ème|1er essai/.test(tutSrc) && tutSrc.includes('missStep: true'));
  ok('game.js : tutoriel -> raté compte VRAIMENT (misses++ + onMiss(misses) + popup −1 ❤) mais return avant le game over', gameSrc.includes('if (this.tutorial) {') && gameSrc.includes('this.stats.misses++;') && gameSrc.includes('this.onMiss(this.stats.misses);') && gameSrc.includes('RATÉ −1 ❤'));

  // filtres LB persistés
  ok('main.js : filtres LB persistés (roadtap_lb_filters_v1) + restaurés à l’ouverture', mainSrc.includes("const LB_FILTERS_KEY = 'roadtap_lb_filters_v1'") && mainSrc.includes('loadLbFilters();') && mainSrc.includes('if (!lbFiltersLoaded)') && (mainSrc.match(/saveLbFilters\(\)/g) || []).length >= 4);

  // musique au lancement
  ok('audio.js : musicKick() exporté (reprend le contexte + resync séquenceur)', audioSrc.includes('export function musicKick(levelId)')); // v1.3.92 : signature avec levelId (thème du niveau)
  ok('main.js : startLevel -> unlockAudio + setMusicEnabled + musicKick (musique dès le début)', /function startLevel[\s\S]{0,700}unlockAudio\(\);[\s\S]{0,300}setMusicEnabled\(save\.music && save\.sound\);[\s\S]{0,80}musicKick\([^)]*\);/.test(mainSrc));

  // anti-freeze : plus de shadowBlur dans le rendu des lignes en jeu (pulse/glow/néon remplacés par alpha)
  const renderZone = gameSrc.slice(gameSrc.indexOf('drawLines'), gameSrc.indexOf('drawLineShape(type'));
  ok('game.js : plus de shadowBlur=18/22 dans le rendu des lignes (pulse/glow en alpha)', !/shadowBlur = (18|22)/.test(renderZone));
}

console.log('AP. v1.3.66 : liste du joueur (2/2) — prix boutique x3, affichage boutique/garage réparé (fuite // + canvas #game sous les menus), +13 succès, file hors-ligne -> serveur au retour en ligne');
{
  const fsN = await import('node:fs');
  const data = await import('../js/data.js');
  const mainSrc = fsN.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const lbSrc = fsN.readFileSync(new URL('../js/leaderboard.js', import.meta.url), 'utf8');
  const css = fsN.readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  const dataSrc = fsN.readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');

  // prix x3 (arrondi 50) côté boutique, niveaux inchangés
  ok('boutique : prix x3 arrondis (rouge 200->600, f1noire 6500->19500, effet trail 400->1200)', data.SKINS.find((x) => x.id === 'rouge').cost === 600 && data.SKINS.find((x) => x.id === 'f1noire').cost === 19500 && data.EFFECTS.find((x) => x.id === 'trail').cost === 1200);
  ok('niveaux : coûts de déblocage inchangés (niveau 2 = 150)', data.LEVELS.find((l) => l.id === 2).cost === 150);
  ok('cost: 0 préservé (skins gratuites)', data.SKINS.find((x) => x.id === 'default').cost === 0 && data.SKINS.find((x) => x.id === 'blocs').cost === 0);

  // affichage boutique/garage
  ok('main.js : plus de fuite de commentaire // dans les templates de cartes', !mainSrc.includes('</div> //'));
  ok('main.js : show() cache le canvas #game hors écran de jeu (plus de frame fantôme sous les menus)', mainSrc.includes("gc.classList.toggle('hidden', id !== 'screen-game')"));
  ok('css : #game.hidden { display:none }', css.includes('#game.hidden'));
  const shopH = mainSrc.slice(mainSrc.indexOf("on('btn-shop'"), mainSrc.indexOf("on('btn-mode-normal'"));
  const garH = mainSrc.slice(mainSrc.indexOf("on('btn-garage'"), mainSrc.indexOf("on('btn-garage-back'"));
  ok('main.js : ouverture boutique/garage = show() AVANT render (aperçus visibles)', shopH.indexOf("show('screen-shop')") > -1 && shopH.indexOf("show('screen-shop')") < shopH.indexOf('renderShop()') && garH.indexOf("show('screen-garage')") > -1 && garH.indexOf("show('screen-garage')") < garH.indexOf('renderGarage()'));
  ok('css : .shop-card .swatch n\'impose plus 52x52 (taille portée par canvas.swatch.*)', !/\.shop-card \.swatch \{[^}]*width: 52px/.test(css));

  // +13 succès (27 au total) + contexte enrichi
  ok('data.js : 27 succès (14 + 13 nouveaux v1.3.66)', data.ACHIEVEMENTS.length === 27);
  ok('main.js : checkAchievements enrichi (bestTime/wallets/friends/streak)', mainSrc.includes('bestTime: store.get().bestTime') && mainSrc.includes('streak: save.streak'));
  // les nouveaux succès ne plantent jamais (test() robuste sur ctx vide)
  const badCtx = { stats: {}, level: {}, totals: {}, mode: 'auto', best: {}, trophies: {}, bestTime: {}, wallets: {}, friends: [], streak: 0 };
  ok('tous les tests de succès passent sans throw sur ctx minimal', data.ACHIEVEMENTS.every((a) => { try { a.test(badCtx); return true; } catch { return false; } }));

  // file hors-ligne -> serveur
  ok('leaderboard.js : QUEUE_KEY roadtap_lb_queue_v1 + flushQueue exporté + enqueue dans submit*', lbSrc.includes("roadtap_lb_queue_v1") && lbSrc.includes('export async function flushQueue') && (lbSrc.match(/enqueue\('/g) || []).length >= 6);
  ok('main.js : flushQueue câblé (online + connexion + ouverture classement + ping OK)', (mainSrc.split('flushQueue(').length - 1) >= 4 && mainSrc.includes("addEventListener('online'"));

  // fonctionnel : submit sans jeton -> file ; flush avec jeton -> envoyé + file vidée + uid rattaché
  delete mem['roadtap_lb_queue_v1'];
  await lb.submitScore({ pseudo: 'HorsLigne', uid: '', score: 500, level: 'Accélération', levelId: 2, mode: 'auto', date: 1 }, null);
  ok('submitScore sans jeton -> mis en file (queueSize=1), gardé en local', lb.queueSize() === 1);
  const origF = globalThis.fetch;
  const posts = [];
  globalThis.fetch = async (url, opts) => {
    posts.push({ url: String(url), body: opts && opts.body ? JSON.parse(opts.body) : null });
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const sent = await lb.flushQueue('TOK', 'uid-9');
  const post = posts.find((c) => c.url.includes('/scores/auto.json') && c.body && c.body.score === 500);
  ok('flushQueue(TOK, uid) -> 1 envoyé, POST /scores/auto.json avec uid rattaché, file vidée', sent === 1 && lb.queueSize() === 0 && !!post && post.body.uid === 'uid-9');
  // flush sans jeton -> rien
  await lb.submitScore({ pseudo: 'Anon', uid: '', score: 1, level: 'X', levelId: 1, mode: 'auto', date: 2 }, null);
  const sent2 = await lb.flushQueue(null, '');
  ok('flushQueue sans jeton -> 0 envoyé, la file reste (attente connexion)', sent2 === 0 && lb.queueSize() === 1);
  if (origF === undefined) delete globalThis.fetch; else globalThis.fetch = origF;
}

console.log('AQ. v1.3.67 : classement — 1 entrée par joueur (meilleur score/temps/réaction), filtre niveau « 🌐 Tous niveaux » toujours sélectionné à l\'ouverture, libellés de niveau fiables, message dédié quand un niveau filtré est vide');
{
  const fsO = await import('node:fs');
  const mainSrc = fsO.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const lbSrc = fsO.readFileSync(new URL('../js/leaderboard.js', import.meta.url), 'utf8');

  // dédoublonnage : score (max), speedrun (min timeMs), réaction (min avgMs), clé uid > pseudo
  const dd = lb.dedupeByPlayer([
    { pseudo: 'GigG', uid: 'u1', score: 50, levelId: 1 },
    { pseudo: 'GigG', uid: 'u1', score: 3910, levelId: 3 },
    { pseudo: 'gigg', score: 9999, levelId: 1 }, // même joueur sans uid -> même clé pseudo (casse-insensible)
    { pseudo: 'Test', uid: 'u2', score: 10 },
    { pseudo: 'Test', uid: 'u2', score: 5 },
  ], 'score');
  ok('dedupe score : 1 entrée/joueur (clé uid sinon pseudo minuscule), meilleur score gardé', dd.length === 3 && dd.find((e) => e.uid === 'u1').score === 3910 && dd.find((e) => e.pseudo === 'gigg').score === 9999 && dd.find((e) => e.uid === 'u2').score === 10);
  const dds = lb.dedupeByPlayer([
    { pseudo: 'A', uid: 'u1', timeMs: 90000 }, { pseudo: 'A', uid: 'u1', timeMs: 60000 }, { pseudo: 'B', uid: 'u2', timeMs: 45000 },
  ], 'speedrun');
  ok('dedupe speedrun : meilleur temps (min timeMs) gardé', dds.length === 2 && dds.find((e) => e.pseudo === 'A').timeMs === 60000);
  const ddr = lb.dedupeByPlayer([
    { pseudo: 'A', avgMs: 80 }, { pseudo: 'A', avgMs: 35 }, { pseudo: 'B', avgMs: 50 },
  ], 'reaction');
  ok('dedupe réaction : meilleur avgMs (min) gardé', ddr.length === 2 && ddr.find((e) => e.pseudo === 'A').avgMs === 35);
  ok('dedupe : entrées sans pseudo ignorées', lb.dedupeByPlayer([{ score: 5 }, null, { pseudo: '', score: 1 }], 'score').length === 0);
  ok('leaderboard.js : dedupe intégré à sortDesc (score) ; speedrun = dedupe APRÈS filtre niveau (v1.3.74)', lbSrc.includes("dedupeByPlayer(arr.map(cleanEntry).filter(Boolean), 'score')") && lbSrc.includes('dedupeByPlayer(keep(') && !lbSrc.slice(lbSrc.indexOf('function sortAscTimeUnbounded'), lbSrc.indexOf('function sortAscTimeUnbounded') + 500).includes('dedupeByPlayer'));

  // filtre niveau : option « Tous niveaux » en tête + sélection visible
  ok('main.js : option { id: \'all\', name: \'🌐 Tous niveaux\' } en tête du filtre niveau', mainSrc.includes("{ id: 'all', name: '🌐 Tous niveaux' }"));
  ok('main.js : dedupe appliqué aussi aux onglets réaction et amis (2 branches)', (mainSrc.split('dedupeByPlayer(').length - 1) >= 2);

  // libellés + statut + message vide filtré
  ok('main.js : levelLabel (LEVEL_NAME_BY_ID[levelId] sinon e.level) utilisé dans les lignes', mainSrc.includes('levelLabel(e)') && mainSrc.includes('LEVEL_NAME_BY_ID'));
  ok('main.js : statut affiche « N affiché(s) ici » quand filtre actif', mainSrc.includes('affiché(s) ici'));
  ok('main.js : filtre niveau actif + vide -> message « Aucun ... pour « niveau » — joue ce niveau pour passer 1er ! »', mainSrc.includes('joue ce niveau pour passer 1er'));

  // fonctionnel : getTop en ligne dédoublonne (2 entrées même uid -> 1 ligne, meilleur score)
  const origF2 = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      x: { pseudo: 'GigG', uid: 'u1', score: 50, levelId: 1, level: 'Premiers tours', mode: 'auto' },
      y: { pseudo: 'GigG', uid: 'u1', score: 3910, levelId: 3, level: 'Double file', mode: 'auto' },
      z: { pseudo: 'Test', uid: 'u2', score: 10, levelId: 1, level: 'L 1', mode: 'auto' },
      w: { pseudo: 'Cheat', uid: 'u3', score: 5, wideWindows: true, levelId: 1, mode: 'auto' },
    }),
  });
  const top = await lb.getTop('auto', 'all');
  ok('getTop en ligne : dédoublonné (GigG 1x meilleur score 3910), wideWindows filtré, tri desc', top.length === 2 && top[0].pseudo === 'GigG' && top[0].score === 3910 && top[1].pseudo === 'Test');
  if (origF2 === undefined) delete globalThis.fetch; else globalThis.fetch = origF2;
}

console.log('AR. v1.3.68 : speedrun en Auto école (toutes difficultés), onglet Speedrun retiré du classement, colonnes score + ⏱ temps par difficulté, toast si score non envoyé');
{
  const fsP = await import('node:fs');
  const mainSrc = fsP.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const lbSrc = fsP.readFileSync(new URL('../js/leaderboard.js', import.meta.url), 'utf8');
  const css = fsP.readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');

  ok('leaderboard.js : playerKey (uid prioritaire, sinon pseudo minuscule)', lb.playerKey({ uid: 'u1', pseudo: 'A' }) === 'u:u1' && lb.playerKey({ pseudo: 'AbC' }) === 'p:abc' && lb.playerKey({}) === '');
  const tm = lb.buildTimeMap([
    { pseudo: 'A', uid: 'u1', timeMs: 90000, levelId: 2, mode: 'auto' },
    { pseudo: 'A', uid: 'u1', timeMs: 60000, levelId: 2, mode: 'auto' },
    { pseudo: 'A', uid: 'u1', timeMs: 30000, levelId: 2, mode: 'permisA' },
    { pseudo: 'B', uid: 'u2', timeMs: 45000, levelId: 3, mode: 'auto' },
  ], 'auto', '2');
  ok('buildTimeMap : meilleur temps (min) par joueur, filtré par difficulté ET niveau', tm.get('u:u1') === 60000 && !tm.has('u:u2'));
  const tmAll = lb.buildTimeMap([{ pseudo: 'A', uid: 'u1', timeMs: 90000, levelId: 2, mode: 'auto' }, { pseudo: 'A', uid: 'u1', timeMs: 50000, levelId: 5, mode: 'auto' }], 'auto', 'all');
  ok('buildTimeMap sans filtre niveau : meilleur temps global', tmAll.get('u:u1') === 50000);
  ok('dedupeByPlayer réutilise playerKey', lbSrc.includes('const key = playerKey(e);'));

  ok('main.js : plus d\'onglet speedrun dans le filtre difficulté du classement', !mainSrc.includes("{ id: 'speedrun', name: '⏱ Speedrun' }"));
  ok("main.js : filtre persisté 'speedrun' remis à la difficulté courante à l'ouverture", mainSrc.includes("if (lbFilter === 'speedrun') { lbFilter = save.difficulty; saveLbFilters(); }"));

  ok('main.js : getAll(lbFilter) + filterLevel(all, lbLevelFilter) (v1.3.70)', mainSrc.includes('await leaderboard.getAll(lbFilter)') && mainSrc.includes('leaderboard.filterLevel(all, lbLevelFilter)'));
  ok('main.js : buildTimeMap(getSpeedrunAll(), lbFilter, lbLevelFilter) appelé dans renderLeaderboard', mainSrc.includes('leaderboard.buildTimeMap(srAll, lbFilter, lbLevelFilter)') && mainSrc.includes('leaderboard.buildTimeLevelMap(srAll, lbFilter, lbLevelFilter)'));
  ok('main.js : cellule lb-time (⏱… ou —) ajoutée à chaque ligne hors réaction', mainSrc.includes('class="lb-time"') && mainSrc.includes('timeByPlayer.get(leaderboard.playerKey(e))'));
  ok('css : .lb-time stylé (colonne temps)', css.includes('.lb-time'));

  ok('main.js : fin de partie -> toast explicite si non éligible (wideWindows / pas de compte Google — v1.3.85 : envoyé à la connexion)', mainSrc.includes('résultat gardé en local, hors classement en ligne') && mainSrc.includes('ce résultat y sera envoyé et lié à ton compte')); // v1.3.85 toast anonyme
}

console.log('AS. v1.3.69 : faux 401 au 1er ping (jeton App Check pas encore prêt au chargement) -> warmAppCheck au boot + pingServer() avec retry 401 une fois');
{
  const fsQ = await import('node:fs');
  const mainSrc = fsQ.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const acSrc = fsQ.readFileSync(new URL('../js/appcheck.js', import.meta.url), 'utf8');
  const ac = await import('../js/appcheck.js');

  ok('appcheck.js : warmAppCheck() exporté (préchauffe le jeton, jamais de throw)', acSrc.includes('export async function warmAppCheck()'));
  ok('main.js : import warmAppCheck + appel au boot (fire-and-forget, après installAppCheckFetch)', mainSrc.includes('warmAppCheck } from \'./appcheck.js\'') && mainSrc.includes('warmAppCheck(); // v1.3.69'));
  ok('main.js : pingServer() — retry UNE fois sur http-401 après warmAppCheck', mainSrc.includes('async function pingServer()') && mainSrc.includes("p.reason === 'http-401'") && mainSrc.includes('ok = await leaderboard.ping(getAuthToken());'));
  ok('main.js : refreshStatus (pastille) ET updateServerStatus (Paramètres) passent par pingServer()', (mainSrc.match(/pingServer\(\)/g) || []).length >= 3);

  // fonctionnel : warmAppCheck ne plante pas headless (gstatic injoignable -> {} proprement)
  const dbg = await ac.warmAppCheck();
  ok('warmAppCheck() headless -> renvoie appCheckDebug() sans throw (tokenOk false ou null, lastError renseigné ou null)', typeof dbg === 'object' && 'tokenOk' in dbg && 'appIdMissing' in dbg);
}

console.log('AT. v1.3.70 : classement en 2 colonnes triables (Score ⇄ Temps persisté), rang du joueur affiché en fin de partie, toast si l\'envoi est refusé (403)');
{
  const fsR = await import('node:fs');
  const mainSrc = fsR.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const lbSrc = fsR.readFileSync(new URL('../js/leaderboard.js', import.meta.url), 'utf8');
  const html = fsR.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  // sortLbRows fonctionnel
  const timeMap = new Map([['u:u1', 60000], ['u:u2', 45000]]);
  const rows = [
    { pseudo: 'A', uid: 'u1', score: 9000 },   // meilleur score, temps 60s
    { pseudo: 'B', uid: 'u2', score: 100 },    // meilleur temps 45s
    { pseudo: 'C', uid: 'u3', score: 500 },    // pas de temps
  ];
  const byScore = lb.sortLbRows(rows, 'score', timeMap);
  const byTime = lb.sortLbRows(rows, 'time', timeMap);
  ok('sortLbRows score : tri desc (A, C, B)', byScore.map((r) => r.pseudo).join(',') === 'A,C,B');
  ok('sortLbRows time : joueurs avec temps d\'abord (asc), puis les autres par score (B, A, C)', byTime.map((r) => r.pseudo).join(',') === 'B,A,C');
  ok('sortLbRows sans map de temps en mode time -> repli tri score', lb.sortLbRows(rows, 'time', null).map((r) => r.pseudo).join(',') === 'A,C,B');

  // UI : bouton tri + persistance + colonnes
  ok('index.html : bouton #lb-sort + ligne #over-rank (écran de fin)', html.includes('id="lb-sort"') && html.includes('id="over-rank"'));
  ok('main.js : lbSort persisté dans roadtap_lb_filters_v1 + handler on(\'lb-sort\') + label MAJ à l\'ouverture', mainSrc.includes("let lbSort = 'score'") && mainSrc.includes('sort: lbSort') && mainSrc.includes("on('lb-sort', 'click'") && mainSrc.includes("$('#lb-sort')"));
  ok('main.js : renderLeaderboard trie via sortLbRows(top, lbSort, timeByPlayer) puis slice(0,50), branche normale = getAll(lbFilter)+dedupe', mainSrc.includes('leaderboard.sortLbRows(top, lbSort, timeByPlayer)') && mainSrc.includes('await leaderboard.getAll(lbFilter)') && mainSrc.includes("dedupeByPlayer(leaderboard.filterLevel(all, lbLevelFilter), 'score')"));

  // rang en fin de partie + toast si refus d'écriture
  ok('main.js : #over-rank rempli en fin de partie (getAll/getSpeedrunAll + playerKey + « #N au classement »)', mainSrc.includes("$('#over-rank')") && mainSrc.includes('au classement —') && mainSrc.includes('au classement speedrun —'));
  ok('main.js : toast « ⚠️ Envoi refusé » si writeError après submitScore', mainSrc.includes('Envoi refusé :'));
}


console.log('AU. v1.3.71 : rang écran de fin fiable — attendre la fin de l\'envoi (await submitP/submitSrP) + 2e lecture après 1,2 s avant le repli « pas encore visible »');
{
  const fsU = await import('node:fs');
  const mainSrc = fsU.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');

  ok('main.js : promesses d\'envoi capturées (let submitP / let submitSrP, assignées sur leaderboard)', mainSrc.includes('let submitP = null;') && mainSrc.includes('let submitSrP = null;') && mainSrc.includes('submitP = leaderboard') && mainSrc.includes('submitSrP = leaderboard'));
  ok('main.js : le bloc #over-rank ATTEND l\'envoi avant de lire le rang (await submitP / await submitSrP)', mainSrc.includes('await submitP') && mainSrc.includes('await submitSrP'));
  ok('main.js : lecture du rang factorisée (readRank) + 2e lecture après 1,2 s si non trouvé (setTimeout(r, 1200))', mainSrc.includes('readRank') && mainSrc.includes('setTimeout(r, 1200)') && mainSrc.includes('i = await readRank()'));
  ok('main.js : rang trouvé -> « #N au classement » ; hors ligne -> suffixe « classement local (envoyé à la reconnexion) »', mainSrc.includes('au classement —') && mainSrc.includes('classement local (envoyé à la reconnexion)'));
  ok('main.js : writeError -> ligne « hors classement en ligne » ; sinon repli « pas encore visible » inchangé', mainSrc.includes('hors classement en ligne') && mainSrc.includes('pas encore visible en ligne (local ?)') && mainSrc.includes('pas encore visible en ligne…'));
}


console.log('AV. v1.3.72 : le service worker ne touche plus aux requêtes cross-origin (Firebase) + cache HTTP désactivé (no-store) sur tous les GET RTDB -> classement toujours frais');
{
  const fsV = await import('node:fs');
  const swSrc = fsV.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const lbSrc = fsV.readFileSync(new URL('../js/leaderboard.js', import.meta.url), 'utf8');
  const csSrc = fsV.readFileSync(new URL('../js/cloudsave.js', import.meta.url), 'utf8');

  // SW : cross-origin ignoré AVANT toute interception (navigate comprise)
  ok('sw.js : early return cross-origin (if (!sameOrigin) return;) placé avant le handler navigate', swSrc.includes('if (!sameOrigin) return;') && swSrc.indexOf('if (!sameOrigin) return;') < swSrc.indexOf("e.request.mode === 'navigate'"));
  ok('sw.js : un seul calcul de url/sameOrigin (pas de doublon après le bloc navigate)', (swSrc.match(/const sameOrigin =/g) || []).length === 1);
  ok('sw.js : version.json toujours non intercepté + code toujours network-first (régressions v1.3.30/v1.3.24 intactes)', swSrc.includes("url.pathname.endsWith('/version.json')") && swSrc.includes('isCode'));

  // GET RTDB en no-store
  const n = (lbSrc.match(/cache: 'no-store'/g) || []).length;
  ok('leaderboard.js : cache: \'no-store\' sur les 11 GET RTDB (v1.3.81 seasons, v1.3.82 duels, v1.3.86 friendRequests x2) (ping x2, scores x2, challenges, speedrun x2)', n === 11);
  ok('leaderboard.js : les POST (submitScore/submitSpeedrun) restent des POST (non concernés par le cache)', (lbSrc.match(/method: 'POST'/g) || []).length >= 3);
  ok('cloudsave.js : GET players/<uid> en no-store (sauvegarde cloud fraîche)', csSrc.includes("fetch(url(`/players/${key(account)}`, idToken), { cache: 'no-store' })"));
}


console.log('AW. v1.3.73 : speedrun d\'un niveau verrouillé tant qu\'il n\'a pas été terminé en mode NORMAL + tri ⚡ Réaction (3e état du bouton Trier)');
{
  const fsW = await import('node:fs');
  const mainSrc = fsW.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const lbSrc = fsW.readFileSync(new URL('../js/leaderboard.js', import.meta.url), 'utf8');

  // tri réaction fonctionnel
  const rowsR = [
    { pseudo: 'A', uid: 'u1', score: 9000, avgMs: 40 },
    { pseudo: 'B', uid: 'u2', score: 100, avgMs: 23 },
    { pseudo: 'C', uid: 'u3', score: 500 }, // pas d'avgMs
  ];
  const byReac = lb.sortLbRows(rowsR, 'reaction', null);
  ok('sortLbRows reaction : avgMs croissant d\'abord (B 23ms, A 40ms), puis sans avgMs par score desc (C)', byReac.map((r) => r.pseudo).join(',') === 'B,A,C');
  ok('leaderboard.js : branche sort === \'reaction\' via compareEntries (v1.3.78 : avgMs asc, repli score desc, date)', lbSrc.includes("sort === 'reaction' ? 'reaction'") && lbSrc.includes('export function compareEntries'));

  // cycle de tri à 3 + persistance
  ok('main.js : cycle lbSort score→time→reaction→score + lbSortLabel() avec ⚡ Réaction', mainSrc.includes("lbSort === 'score' ? 'time' : lbSort === 'time' ? 'reaction' : 'score'") && mainSrc.includes('function lbSortLabel()') && mainSrc.includes('Trier : ⚡ Réaction'));
  ok('main.js : persistance accepte sort=\'reaction\' + label appliqué à l\'ouverture du classement', mainSrc.includes("o.sort === 'score' || o.sort === 'time' || o.sort === 'reaction'") && mainSrc.includes('sortBtn.textContent = lbSortLabel()'));

  // verrou speedrun : terminé = mode normal uniquement
  ok('main.js : v1.3.77 — markCleared sans condition de mode (un seul mode) + guard !isReplay (v1.3.90)', mainSrc.includes('if (stats.completed && !isReplay) store.markCleared(level.id);') && !mainSrc.includes('!sr) store.markCleared'));
  ok('main.js : v1.3.77 — gate speedrun SUPPRIMÉE (plus de srLocked / « Speedrun verrouillé » / save.speedrun)', !mainSrc.includes('srLocked') && !mainSrc.includes('Speedrun verrouillé') && !mainSrc.includes('save.speedrun'));
  ok('main.js : v1.3.77 — gate speedrun SUPPRIMÉE (plus de srLocked / « Speedrun verrouillé » / save.speedrun)', !mainSrc.includes('srLocked') && !mainSrc.includes('Speedrun verrouillé') && !mainSrc.includes('save.speedrun'));
}


console.log('AX. v1.3.74 : temps speedrun conservés PAR NIVEAU — getSpeedrunAll ne dédoublonne plus globalement, getSpeedrunTop filtre avant dedupe, colonne ⏱ affiche le niveau du temps en « Tous niveaux »');
{
  const fsX = await import('node:fs');
  const mainSrc = fsX.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const lbSrc = fsX.readFileSync(new URL('../js/leaderboard.js', import.meta.url), 'utf8');

  // fonctionnel : MÊME joueur, temps sur 3 niveaux -> tous conservés, filtres par niveau OK
  const origF = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      1: { a: { pseudo: 'GigG', uid: 'u1', timeMs: 14130, level: 'Premiers tours', levelId: 1, mode: 'auto', date: 1 } },
      2: { b: { pseudo: 'GigG', uid: 'u1', timeMs: 20380, level: 'Accélération', levelId: 2, mode: 'auto', date: 2 },
           b2: { pseudo: 'GigG', uid: 'u1', timeMs: 19990, level: 'Accélération', levelId: 2, mode: 'auto', date: 3 } },
      3: { c: { pseudo: 'GigG', uid: 'u1', timeMs: 25000, level: 'Double file', levelId: 3, mode: 'auto', date: 4 } },
    }),
  });
  const srAll = await lb.getSpeedrunAll();
  ok('getSpeedrunAll : 4 entrées conservées (plus de dedupe global) — les 3 niveaux du joueur restent', srAll.length === 4);
  ok('buildTimeMap par niveau : L1=14130, L2=19990 (min des 2), L3=25000', lb.buildTimeMap(srAll, 'auto', '1').get('u:u1') === 14130 && lb.buildTimeMap(srAll, 'auto', '2').get('u:u1') === 19990 && lb.buildTimeMap(srAll, 'auto', '3').get('u:u1') === 25000);
  ok('buildTimeMap « all » : meilleur temps global = 14130 (L1)', lb.buildTimeMap(srAll, 'auto', 'all').get('u:u1') === 14130);
  ok('buildTimeLevelMap « all » : niveau du meilleur temps = 1', lb.buildTimeLevelMap(srAll, 'auto', 'all').get('u:u1').levelId === 1 && lb.buildTimeLevelMap(srAll, 'auto', '2').get('u:u1').levelId === 2);
  const top2 = await lb.getSpeedrunTop('2');
  ok('getSpeedrunTop("2") : filtre AVANT dedupe -> 1 entrée (meilleur temps L2 = 19990)', top2.length === 1 && top2[0].timeMs === 19990 && top2[0].levelId === 2);
  const top1 = await lb.getSpeedrunTop('1');
  ok('getSpeedrunTop("1") : entrée L1 présente (14130)', top1.length === 1 && top1[0].timeMs === 14130);
  if (origF === undefined) delete globalThis.fetch; else globalThis.fetch = origF;

  // statique : cellule ⏱ avec suffixe « niv. N » en Tous niveaux
  ok('main.js : timeLevelByPlayer construit + suffixe « · niv. N » affiché seulement en lbLevelFilter === \'all\'', mainSrc.includes('let timeLevelByPlayer = null;') && mainSrc.includes("lbLevelFilter === 'all' && tlvl && tlvl.levelId != null") && mainSrc.includes('· niv. ${tlvl.levelId}'));
  ok('leaderboard.js : buildTimeLevelMap exporté (map joueur -> { timeMs, levelId, level })', lbSrc.includes('export function buildTimeLevelMap'));
}


console.log('AY. v1.3.75 : saisie clavier dans les champs (pseudo/ami) non bloquée par le handler jeu + ami supprimé ne revient pas (tombstones cloud)');
{
  const fsY = await import('node:fs');
  const mainSrc = fsY.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const storeSrc = fsY.readFileSync(new URL('../js/store.js', import.meta.url), 'utf8');

  // clavier : garde "champ de saisie" dans le handler keydown, AVANT keyToAction/preventDefault
  const guard = "tagName === 'INPUT'";
  ok('main.js : garde saisie (INPUT/TEXTAREA/SELECT/contentEditable) présente dans le handler keydown', mainSrc.includes(guard) && mainSrc.includes("te.isContentEditable"));
  const kd = mainSrc.slice(mainSrc.indexOf("window.addEventListener('keydown'"));
  ok('main.js : la garde est posée AVANT keyToAction (donc avant preventDefault) dans le handler', kd.indexOf(guard) < kd.indexOf('keyToAction(e.code') && kd.indexOf('if (e.repeat) return;') < kd.indexOf(guard));

  // amis : tombstones fonctionnels
  store.addFriend('AmiTest175');
  ok('addFriend ajoute', store.get().friends.some((f) => f.toLowerCase() === 'amitest175'));
  store.removeFriend('AmiTest175');
  ok('removeFriend retire + pose un tombstone', !store.get().friends.some((f) => f.toLowerCase() === 'amitest175') && store.get().deletedFriends.includes('amitest175'));
  store.mergeRemote({ friends: ['AmiTest175', 'AmiRestant'], deletedFriends: [] });
  ok('mergeRemote : l\'ami supprimé NE revient pas (tombstone), l\'autre oui', !store.get().friends.some((f) => f.toLowerCase() === 'amitest175') && store.get().friends.some((f) => f.toLowerCase() === 'amirestant') && store.get().deletedFriends.includes('amitest175'));
  store.addFriend('AmiTest175');
  ok('addFriend après suppression lève le tombstone', store.get().friends.some((f) => f.toLowerCase() === 'amitest175') && !store.get().deletedFriends.includes('amitest175'));
  store.removeFriend('AmiTest175');
  store.removeFriend('AmiRestant');
  ok('snapshot cloud inclut deletedFriends', JSON.stringify(store.snapshot()).includes('deletedFriends'));
  ok('store.js : defaults + sanitize + merge filtrent par tombstones', storeSrc.includes('deletedFriends: [],') && storeSrc.includes('!tomb.has(k)') && storeSrc.includes('save.deletedFriends.push(dk)'));
}


console.log('AZ. v1.3.76 : voies manuelles (swipe → / ➡ pour revenir, plus de retour auto) + alerte voiture de face + Z/S/flèches + zones gauche/droite par défaut + musique ancrée sur les lignes');
{
  const fsZ = await import('node:fs');
  const mainSrc = fsZ.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const gameSrc = fsZ.readFileSync(new URL('../js/game.js', import.meta.url), 'utf8');
  const audioSrc = fsZ.readFileSync(new URL('../js/audio.js', import.meta.url), 'utf8');
  const tutSrc = fsZ.readFileSync(new URL('../js/tutorial.js', import.meta.url), 'utf8');
  const storeSrc = fsZ.readFileSync(new URL('../js/store.js', import.meta.url), 'utf8');
  const html = fsZ.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  // voies manuelles
  ok('game.js : plus de retour auto (bloc lastOvertaken supprimé) + swipeRight() présent', !gameSrc.includes('if (sy > this.wheelY + 180)') && gameSrc.includes('swipeRight()') && gameSrc.includes("this.laneTarget = CAR_LANE;\n    this.lastOvertaken = null;"));
  ok('game.js : collision frontale finish(\'oncoming\') si joueur à gauche + voiture de face au même niveau', gameSrc.includes("this.finish('oncoming')") && gameSrc.includes('Math.abs(this.distance - c.p) < 58'));
  ok('game.js : indicateur danger (0..1) + spawn sens inverse avec lead ≥1050 px si joueur à gauche (fenêtre d\'action)', gameSrc.includes('this.danger = 0;') && gameSrc.includes('const lead = playerLeft ? 1050 + this.rand() * 800') && gameSrc.includes('tOncoming, 1.4'));
  ok('game.js : alerte visuelle ⚠ dessinée + jamais 2 voitures d\'affilée < 520 px même file', gameSrc.includes('⚠ VOITURE DE FACE') && gameSrc.includes('c.p < this.distance + 520'));
  ok('main.js : trySwipe gère GAUCHE (swipeLeft) et DROITE (swipeRight) + branches swipeRight clavier/souris', mainSrc.includes('dx > minSwipe') && mainSrc.includes('dx < -minSwipe') && mainSrc.includes('game.swipeRight()') && (mainSrc.match(/swipeRight\(\)/g) || []).length >= 3); // v1.3.80 : seuil réglable (bigTargets)
  ok('main.js : raison oncoming affichée à l\'écran de fin', mainSrc.includes("reason === 'oncoming'") && mainSrc.includes('Voiture de face'));

  // zones tactiles : défaut gauche/droite, option = haut/bas
  ok('store.js : verticalZones (défaut false = gauche/droite) + migration depuis horizontalZones + snapshot', storeSrc.includes('verticalZones: false,') && storeSrc.includes("!(parsed.horizontalZones === true)") && storeSrc.includes('verticalZones: save.verticalZones,'));
  ok('main.js : toutes les lectures passent par !save.verticalZones + option settings = haut/bas', !mainSrc.includes('save.horizontalZones') && mainSrc.includes("key: 'verticalZones'"));
  ok('index.html : label option = zones haut/bas (défaut gauche/droite)', html.includes('Zones <b>haut/bas</b>') && html.includes('gauche = AV'));

  // migration save
  mem['roadtap_save_v1'] = JSON.stringify({ horizontalZones: true });
  store.load();
  ok('migration : ancien horizontalZones=true -> verticalZones=false (gauche/droite)', store.get().verticalZones === false);
  mem['roadtap_save_v1'] = JSON.stringify({ horizontalZones: false });
  store.load();
  ok('migration : ancien horizontalZones=false -> verticalZones=true (haut/bas conservé)', store.get().verticalZones === true);
  mem['roadtap_save_v1'] = '{}';
  store.load();
  ok('défaut (save neuve) : verticalZones=false = zones gauche/droite', store.get().verticalZones === false);

  // musique ancrée sur les lignes
  ok('audio.js : musicLineAnchor exporté (pas du séquenceur + kick accent pile sur la ligne, re-ancrage lookahead)', audioSrc.includes('export function musicLineAnchor()') && audioSrc.includes('musicNext = t0 + 60 / musicTempo'));
  ok('game.js : musicAnchor appelé quand une ligne atteint les roues (rear, une fois par ligne)', gameSrc.includes('line.anchored = true') && gameSrc.includes('this.audio.musicAnchor()'));
  ok('main.js : musicAnchor passé au jeu (audio.musicAnchor)', mainSrc.includes('musicAnchor: musicLineAnchor'));

  // tutoriel MAJ
  ok('tutorial.js : plus de « revient toute seule » + nouveau texte SWIPE → + alerte ⚠ + zones par défaut G/D + Z/S', !tutSrc.includes('revient à droite toute seule') && tutSrc.includes('SWIPE →') && tutSrc.includes('voiture de face') && tutSrc.includes("verticalZones ? 'Haut") && tutSrc.includes('Z = roues AV'));
}


console.log('BA. v1.3.77 : MODE UNIQUE (standard+speedrun fusionnés) — chrono + pénalités de temps partout, plus de sélecteur de mode');
{
  const fsB = await import('node:fs');
  const mainSrc = fsB.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const gameSrc = fsB.readFileSync(new URL('../js/game.js', import.meta.url), 'utf8');
  const html = fsB.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  ok('index.html : plus de btn-mode-* + label « Mode unique » + HUD #hud-time + écran fin #over-time', !html.includes('btn-mode-speedrun') && !html.includes('btn-mode-normal') && html.includes('Mode unique') && html.includes('id="hud-time"') && html.includes('id="over-time"'));
  ok('main.js : plus de save.speedrun / srLocked / btn-mode / continueCost', !mainSrc.includes('save.speedrun') && !mainSrc.includes('srLocked') && !mainSrc.includes('btn-mode') && !mainSrc.includes('continueCost'));
  ok('main.js : startLevel passe speedrun: true (chrono + bonus vitesse actifs) + chrono live dans le HUD (setInterval #hud-time)', mainSrc.includes('speedrun: true,') && mainSrc.includes('hudTimer = setInterval') && mainSrc.includes("$('#hud-time')"));
  ok('main.js : onGameEnd envoie le score (toujours) ET le temps (si terminé) + markCleared sans !sr', mainSrc.includes('if (!isReplay && canSubmitToLeaderboard(save)) {') && mainSrc.includes('if (stats.completed && !isReplay && canSubmitToLeaderboard(save)) {') && mainSrc.includes('if (stats.completed && !isReplay) store.markCleared(level.id);'));
  ok('main.js : over-rank = rang score + rang temps (readRank + readTimeRank, join « · »), écran fin score + #over-time avec record', mainSrc.includes('readTimeRank') && mainSrc.includes("parts.join(' · ')") && mainSrc.includes("$('#over-time')") && mainSrc.includes('nouveau record'));
  ok('main.js : continuer = +2 s au chrono (penaltyMs += 2000, label « +2 s », plus de store.spend)', mainSrc.includes('game.penaltyMs = (game.penaltyMs || 0) + 2000') && mainSrc.includes('+2 s') && !mainSrc.includes('store.spend(save.difficulty, cost)'));
  ok('game.js : raté = +0,5 s (penaltyMs += 500, popup « RATÉ +0,5 s ») + timeMs final = elapsed + pénalités', gameSrc.includes('this.penaltyMs += 500;') && gameSrc.includes('RATÉ +0,5 s') && gameSrc.includes('(this.elapsed + this.penaltyMs / 1000)'));
}


console.log('BB. v1.3.78 : mesure au dernier tap + départage des égalités + anti-triche par niveau + indicateur ±ms (#28/#31/#4/#26)');
{
  const fsB2 = await import('node:fs');

  // --- core.biasReaction (pur, signé) ---
  assert.equal(core.biasReaction({ reactionsSigned: [10, -30, 20] }), 0);
  assert.equal(core.biasReaction({ reactionsSigned: [-40, -20] }), -30);
  assert.equal(core.biasReaction({ reactionsSigned: [] }), null);
  assert.equal(core.biasReaction({}), null);
  ok('biasReaction : moyenne signée arrondie (négatif = trop tôt), null si vide', true);

  // --- compareEntries : chaîne de départage officielle (#28) ---
  ok('compareEntries score : égalité de score -> avgMs croissant gagne',
    lb.compareEntries({ score: 100, avgMs: 40, date: 5 }, { score: 100, avgMs: 30, date: 9 }, 'score') > 0);
  ok('compareEntries score : égalité avgMs -> moins de misses gagne',
    lb.compareEntries({ score: 100, avgMs: 30, misses: 2, date: 9 }, { score: 100, avgMs: 30, misses: 1, date: 5 }, 'score') > 0);
  ok('compareEntries score : tout égal -> date la plus ancienne gagne (premier arrivé)',
    lb.compareEntries({ score: 100, avgMs: 30, misses: 1, date: 9 }, { score: 100, avgMs: 30, misses: 1, date: 5 }, 'score') > 0);
  ok('compareEntries time : égalité de timeMs -> avgMs croissant gagne (départage égalités de temps)',
    lb.compareEntries({ timeMs: 5000, avgMs: 50 }, { timeMs: 5000, avgMs: 20 }, 'time') > 0);
  ok('compareEntries time : égalité avgMs -> score desc ; joueur avec temps avant joueur sans temps',
    lb.compareEntries({ timeMs: 5000, avgMs: 20, score: 900 }, { timeMs: 5000, avgMs: 20, score: 100 }, 'time') < 0 &&
    lb.compareEntries({ timeMs: 5000 }, { score: 99999 }, 'time') < 0);
  {
    const m = new Map([['u:a', 5000], ['u:b', 5000]]);
    const rows = [{ pseudo: 'A', uid: 'a', score: 10, avgMs: 40 }, { pseudo: 'B', uid: 'b', score: 10, avgMs: 20 }];
    ok('sortLbRows time avec map : égalité de temps départagée à avgMs (B avant A)', lb.sortLbRows(rows, 'time', m).map((r) => r.pseudo).join(',') === 'B,A');
  }

  // --- game.js : lastResolveMs figé au dernier tap (3 sites de résolution) + dtMs signés ---
  const gameSrc = fsB2.readFileSync(new URL('../js/game.js', import.meta.url), 'utf8');
  ok('game.js : lastResolveMs init + figé aux 3 sites (remaining === 0)', gameSrc.includes('this.lastResolveMs = null;') && (gameSrc.match(/if \(this\.remaining === 0\) this\.lastResolveMs/g) || []).length === 3);
  ok('game.js : reactionsSigned.push(dtMs) + finish() priorise lastResolveMs', gameSrc.includes('this.stats.reactionsSigned.push(dtMs)') && gameSrc.includes('this.lastResolveMs != null ? this.lastResolveMs'));

  // --- submitSpeedrun transmet les nouveaux champs (départage + anti-triche + hash replay) ---
  {
    const posts = [];
    globalThis.fetch = async (url, opts) => { posts.push({ url: String(url), body: opts && opts.body ? JSON.parse(opts.body) : null }); return { ok: true, json: async () => null }; };
    await lb.submitSpeedrun(2, { pseudo: 'T', uid: 'u1', timeMs: 12000, level: 'L', date: 1, mode: 'auto', lines: 20, avgMs: 33, misses: 1, score: 800, biasMs: -12, hash: 'a'.repeat(64) }, 'TOK');
    const post = posts.find((p) => p.body);
    ok('submitSpeedrun transmet lines/avgMs/misses/score/biasMs/hash dans le POST', !!post && post.body.lines === 20 && post.body.avgMs === 33 && post.body.misses === 1 && post.body.score === 800 && post.body.biasMs === -12 && /^[0-9a-f]{64}$/.test(post.body.hash));
    delete globalThis.fetch;
  }

  // --- flushQueue : entrée refusée définitivement (HTTP 401/403, ex. pré-MAJ sans lines) -> abandonnée, file non bloquée ---
  {
    globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => null });
    localStorage.setItem('roadtap_lb_queue_v1', JSON.stringify([{ kind: 'score', payload: { pseudo: 'Old', score: 10, level: 'L', levelId: 1, mode: 'auto', date: 1 }, at: 1 }]));
    const sent = await lb.flushQueue('TOK403X', 'u9');
    ok('flushQueue : refus définitif règles (HTTP 403) -> entrée abandonnée, file vidée (anti-blocage)', sent === 1 && lb.queueSize() === 0);
    delete globalThis.fetch;
  }

  // --- règles RTDB : anti-triche par niveau + hash optionnel + garde-fous audit ---
  {
    const rules = JSON.parse(fsB2.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules;
    const wS = rules.scores['$mode']['$id']['.write'];
    const wR = rules.speedrun['$level']['$id']['.write'];
    ok("rules scores : hasChildren exige 'lines' + score <= lines*250 + hash 64 hex optionnel + avgMs/biasMs/misses bornés",
      wS.includes("'lines'") && wS.includes("newData.child('score').val() <= newData.child('lines').val() * 250") && wS.includes("matches(/^[0-9a-f]{64}$/)") && wS.includes("'biasMs'"));
    ok("rules speedrun : hasChildren exige 'lines' + timeMs >= lines*400 (borne basse anti-bot) + score <= lines*250 si présent",
      wR.includes("'lines'") && wR.includes("newData.child('timeMs').val() >= newData.child('lines').val() * 400") && wR.includes("newData.child('score').val() <= newData.child('lines').val() * 250"));
    ok("rules : !data.exists() + auth.uid conservés (audit §12) sur scores et speedrun", wS.includes('!data.exists()') && wS.includes('auth.uid') && wR.includes('!data.exists()') && wR.includes('auth.uid'));
  }

  // --- main.js : envois enrichis + départage écran de fin + indicateur ±ms ---
  const mainSrc2 = fsB2.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  ok('main.js : submitScore/submitSpeedrun envoient lines: linesCount + misses + biasMs (+ avgMs/score côté speedrun)',
    (mainSrc2.match(/lines: linesCount/g) || []).length >= 2 && (mainSrc2.match(/biasMs: biasReaction\(stats\)/g) || []).length === 2 && mainSrc2.includes('misses: stats.misses || 0'));
  ok('main.js : over-rank + branche reaction utilisent compareEntries (≥3 appels)', (mainSrc2.match(/compareEntries\(a, b, '(score|time|reaction)'\)/g) || []).length >= 3);
  ok('main.js : écran de fin affiche le biais signé ±ms (trop tôt / trop tard) #31', mainSrc2.includes("bias < 0 ? '−' : '+'") && mainSrc2.includes('trop tôt') && mainSrc2.includes('trop tard'));
}


console.log('BC. v1.3.79 : replays vérifiables (#30) — enregistrement taps, hash SHA-256 soumis, lecture replay, rate-limit client');
{
  const fsB3 = await import('node:fs');
  const gameSrc = fsB3.readFileSync(new URL('../js/game.js', import.meta.url), 'utf8');
  const mainSrc = fsB3.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const storeSrc = fsB3.readFileSync(new URL('../js/store.js', import.meta.url), 'utf8');
  const lbSrc = fsB3.readFileSync(new URL('../js/leaderboard.js', import.meta.url), 'utf8');
  const html = fsB3.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  ok('game.js : replay initialisé (seed+mode+taps) + replayPlay + rejoue auto dans update() + tap(zone, auto) protégé',
    gameSrc.includes('this.replay = { seed: levelSeed(') && gameSrc.includes('this.replayPlay = opts.replay || null;') && gameSrc.includes('while (this.replayIdx < this.replayPlay.taps.length') && gameSrc.includes("if (this.replayPlay && !auto) return;"));
  ok('game.js : taps enregistrés (tap dt signé, crosswalk, miss) + swipes bloqués en replay',
    (gameSrc.match(/this\.replay\.taps\.push\(/g) || []).length === 3 && gameSrc.includes("if (this.replayPlay) return; // v1.3.79 : replay = lecture seule"));
  ok('store.js : replays dans defaults + sanitize replayMap + getReplay/setReplay (garde le meilleur timeMs)',
    storeSrc.includes('replays: {}') && storeSrc.includes('function replayMap') && storeSrc.includes('export function getReplay') && storeSrc.includes('export function setReplay'));
  ok('store fonctionnel : setReplay garde le meilleur temps, getReplay relit', (() => {
    store.setReplay('auto', 1, { seed: 1, taps: [{ a: 'rear', dt: 0, t: 10 }], timeMs: 9000, score: 100 });
    store.setReplay('auto', 1, { seed: 1, taps: [{ a: 'rear', dt: 1, t: 20 }], timeMs: 12000, score: 50 });
    const r = store.getReplay('auto', 1);
    return r && r.timeMs === 9000 && r.taps.length === 1;
  })());
  ok('main.js : replayHash (SHA-256 crypto.subtle + repli FNV 64 hex) + hash ajouté aux 2 envois + lastRun + btn-replay',
    mainSrc.includes('crypto.subtle.digest') && (mainSrc.match(/hash: replayHashHex/g) || []).length === 2 && mainSrc.includes('let lastRun = null;') && mainSrc.includes("on('btn-replay', 'click'") && html.includes('id="btn-replay"'));
  ok('main.js : startLevel(level, replayRep) + badge ▶ REPLAY + entrée joueur ignorée en replay (pointerdown + clavier)',
    mainSrc.includes('function startLevel(level, replayRep = null)') && mainSrc.includes('▶ REPLAY ·') && mainSrc.includes('if (game && game.replayPlay) return; // v1.3.79 : replay = lecture seule') && mainSrc.includes("game.replayPlay && action !== 'retry'"));
  ok('leaderboard.js : rate-limit doux client — MIN_WRITE_GAP_MS 3000 + gap check dans submitScore ET submitSpeedrun + _setLastWriteAt exporté',
    lbSrc.includes('let MIN_WRITE_GAP_MS = 3000;') && (lbSrc.match(/Date\.now\(\) - lastOnlineWriteAt < MIN_WRITE_GAP_MS/g) || []).length === 4 && lbSrc.includes('export function _setWriteGap')); // v1.3.81 : + submitSeason
  {
    // fonctionnel : 2 submitScore rapprochées -> 1 seul POST, la 2e est en file (anti-flood #30d)
    const posts = [];
    globalThis.fetch = async (url, opts) => { if (opts && opts.method === 'POST') posts.push({ url: String(url), body: JSON.parse(opts.body) }); return { ok: true, json: async () => null }; };
    lb._setWriteGap(3000);
    lb._setLastWriteAt(0);
    localStorage.removeItem('roadtap_lb_queue_v1');
    await lb.submitScore({ pseudo: 'T', uid: 'u1', score: 100, level: 'L', levelId: 1, mode: 'auto', date: 1, lines: 10 }, 'TOK');
    await lb.submitScore({ pseudo: 'T', uid: 'u1', score: 200, level: 'L', levelId: 1, mode: 'auto', date: 2, lines: 10 }, 'TOK');
    ok('rate-limit fonctionnel : 2 envois < 3 s -> 1 POST + 1 en file', posts.length === 1 && posts[0].body.score === 100 && lb.queueSize() === 1);
    lb._setWriteGap(0);
    lb._setLastWriteAt(0);
    localStorage.removeItem('roadtap_lb_queue_v1');
    delete globalThis.fetch;
  }
  {
    // fonctionnel : replayHash via source main.js évalué ? non — on teste le contrat via crypto directement (node a crypto.subtle)
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('{"seed":1}'));
    const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    ok('contrat hash : SHA-256 -> 64 hex (règle RTDB matches(/^[0-9a-f]{64}$/))', /^[0-9a-f]{64}$/.test(hex));
  }
}


console.log('BD. v1.3.80 : accessibilité P0 — #6 gros doigts/swipe, #15 anims réduites, #16 contraste élevé, #17 taille texte, #19 ARIA, #27 marqueur 0 ms (hors LB), #29 infobulle');
{
  const fsB4 = await import('node:fs');
  const mainSrc = fsB4.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const gameSrc = fsB4.readFileSync(new URL('../js/game.js', import.meta.url), 'utf8');
  const coreSrc = fsB4.readFileSync(new URL('../js/core.js', import.meta.url), 'utf8');
  const storeSrc = fsB4.readFileSync(new URL('../js/store.js', import.meta.url), 'utf8');
  const dataSrc = fsB4.readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
  const html = fsB4.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = fsB4.readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  const rules = JSON.parse(fsB4.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules;

  ok('core.zoneFromPoint : paramètre ratio (défaut 0,5 ; gros doigts 0,6 -> zone AV élargie)', core.zoneFromPoint(10, 500, 100, 1000, true, 0.6) === 'front' && core.zoneFromPoint(59, 500, 100, 1000, true, 0.6) === 'front' && core.zoneFromPoint(61, 500, 100, 1000, true, 0.6) === 'rear' && core.zoneFromPoint(10, 500, 100, 1000, true) === 'front');
  ok('main.js : ratio 0,6 transmis si bigTargets + seuil swipe 25 px (trySwipe minSwipe)', mainSrc.includes('save.bigTargets ? 0.6 : 0.5') && mainSrc.includes('save.bigTargets ? 25 : 40') && mainSrc.includes('dx < -minSwipe') && mainSrc.includes('dx > minSwipe'));
  ok('store : bigTargets dans defaults + sanitize + setBigTargets', storeSrc.includes('bigTargets: false') && storeSrc.includes('s.bigTargets = bool(s.bigTargets)') && storeSrc.includes('export function setBigTargets'));

  ok('game.js : reduceAnims coupe shake/particules/flash', (gameSrc.match(/!this\.access\.reduceAnims/g) || []).length >= 5 && gameSrc.includes("this.access.reduceAnims ? 0 : 0.3"));
  ok('main.js : applyUiPrefs (dataset.textsize + body.reduce-anims) appelé au boot + select #s-opt-textsize câblé', mainSrc.includes('function applyUiPrefs()') && mainSrc.includes('applyUiPrefs();') && mainSrc.includes("on('s-opt-textsize', 'change'"));
  ok('css : body.reduce-anims coupe transitions/animations + html[data-textsize] règle la taille', css.includes('body.reduce-anims *') && css.includes("html[data-textsize='large'] body"));

  ok('data.js : THEMES.highcontrast (fond #000, ligne #fff) + prioritaire dans startLevel', dataSrc.includes("id: 'highcontrast'") && mainSrc.includes("save.highContrast ? 'highcontrast'"));

  ok('game.js : hitMarker — flash au franchissement dy=0 + access passé dans startLevel (2 sites)', gameSrc.includes('if (this.access.hitMarker)') && gameSrc.includes('(prev < 0 && ad >= 0)') && (mainSrc.match(/hitMarker: !!save\.hitMarker/g) || []).length === 2);
  ok('core.canSubmitToLeaderboard : hitMarker -> hors classement (comme wideWindows)', core.canSubmitToLeaderboard({ pseudo: 'a', uid: 'u', hitMarker: true }) === false && core.canSubmitToLeaderboard({ pseudo: 'a', uid: 'u' }) === true);
  ok("rules : clause aids != true ajoutée aux 3 noeuds écrits", rules.scores['$mode']['$id']['.write'].includes('aids') && rules.speedrun['$level']['$id']['.write'].includes('aids') && rules.challenges['$day']['$id']['.write'].includes('aids'));

  ok('main.js : toast() écrit aussi dans #sr-live (aria-live) + index.html : #sr-live + dialog aria-modal', mainSrc.includes("$('#sr-live')") && html.includes('id="sr-live"') && html.includes('aria-live="polite"') && html.includes('role="dialog"'));

  ok('index.html : modal-timing avec SVG explicatif (0 ms, ±45/100/160 symétrique) + 3 boutons + fermeture', html.includes('id="modal-timing"') && html.includes('<svg viewBox="0 0 320 200"') && html.includes('symétrique') && html.includes('id="btn-help-timing"') && html.includes('id="btn-help-timing-levels"') && html.includes('id="btn-hud-help"') && html.includes('id="btn-timing-close"'));
  ok('main.js : handlers modal (3 ouvertures + close + clic extérieur) + nouvelles options s-opt-* présentes dans le HTML',
    mainSrc.includes("on('btn-help-timing', 'click'") && mainSrc.includes("on('btn-hud-help', 'click'") && mainSrc.includes("on('btn-timing-close', 'click'") && ['s-opt-bigtargets', 's-opt-reduceanims', 's-opt-highcontrast', 's-opt-hitmarker', 's-opt-textsize'].every((id) => (mainSrc.includes(`'${id}'`) || mainSrc.includes(`'${id.replace('s-', '')}'`)) && html.includes(`id="${id}"`))); // v1.3.80 ACCESS_OPTS (préfixe 's-' ajouté au câblage)
}


console.log('BE. v1.3.81 : compétition visible + niveaux — #22 médailles, #23 tiers, #25 saison hebdo, #18 partage+rang animé, #14 défis, #13 niveau hebdo, #20 thèmes saison, #21 icône saison, #10 récompenses visibles, #9 courbe lissée, #12 boss');
{
  const fsB5 = await import('node:fs');
  const mainSrc = fsB5.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const coreSrc = fsB5.readFileSync(new URL('../js/core.js', import.meta.url), 'utf8');
  const dataSrc = fsB5.readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
  const storeSrc = fsB5.readFileSync(new URL('../js/store.js', import.meta.url), 'utf8');
  const lbSrc = fsB5.readFileSync(new URL('../js/leaderboard.js', import.meta.url), 'utf8');
  const html = fsB5.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const rules = JSON.parse(fsB5.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules;
  const manifest = JSON.parse(fsB5.readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  const swSrc = fsB5.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

  // #22 médailles + #23 tiers
  ok('store : medals (defaults+sanitize+get/set, meilleure gardée)', storeSrc.includes('medals: {}') && storeSrc.includes('s.medals = numMap(s.medals)') && storeSrc.includes('export function setMedal'));
  ok('store fonctionnel setMedal : or(1) conservé vs bronze(3)', (() => { store.setMedal('auto', 1, 3); store.setMedal('auto', 1, 1); store.setMedal('auto', 1, 2); return store.getMedal('auto', 1) === 1; })());
  ok('core.tierOf : Bronze->Légende selon les points de médailles (or=3 pts)', core.tierOf({}).id === 'bronze' && core.tierOf({ 'a:1': 1, 'a:2': 1 }).pts === 6 && (() => { const m = {}; for (let i = 0; i < 34; i++) m['k' + i] = 1; return core.tierOf(m).id === 'legende' && core.tierOf(m).pts === 102; })());
  ok('main.js : setMedal au rang top3 + updateTier + #menu-tier dans le HTML + médailles sur les cartes de niveaux', mainSrc.includes('store.setMedal(runMode, level.id, i + 1)') && mainSrc.includes('function updateTier()') && html.includes('id="menu-tier"') && mainSrc.includes("['🥇', '🥈', '🥉'][md - 1]"));

  // #25 saison hebdo
  ok('leaderboard.js : submitSeason + getSeasonAll (nœud /seasons/<week>/<mode>, rate-limit partagé)', lbSrc.includes('export async function submitSeason') && lbSrc.includes('/seasons/${week}/${modeOf(entry)}.json') && lbSrc.includes('export async function getSeasonAll'));
  ok('rules : nœud seasons (read public + write create-only/uid/lines/aids) + indexOn', rules.seasons && rules.seasons['$week']['$mode']['$id']['.write'].includes('!data.exists()') && rules.seasons['$week']['$mode']['$id']['.write'].includes('lines') && rules.seasons['$week']['$mode']['.indexOn'].includes('score'));
  ok('main.js : onglet 🗓️ Saison + branche isSeason (getSeasonAll(weekKey())) + envoi submitSeason à la fin de partie', mainSrc.includes("{ id: 'season', name: '🗓️ Saison' }") && mainSrc.includes('getSeasonAll(weekKey()') && mainSrc.includes('leaderboard.submitSeason(weekKey()'));

  // #18 écran de fin : partage + rang animé
  ok('main.js : btn-share (Web Share + repli presse-papiers) + lastShare + rang animé (#N compte)', mainSrc.includes("on('btn-share', 'click'") && mainSrc.includes('navigator.share') && mainSrc.includes('navigator.clipboard.writeText') && mainSrc.includes('let lastShare = null;') && mainSrc.includes('setInterval') && html.includes('id="btn-share"'));

  // #14 nouveaux défis du jour
  ok("core : CHALLENGE_KINDS + 'nomiss' + 'maxcombo' + main.js branches de validation", coreSrc.includes("id: 'nomiss'") && coreSrc.includes("id: 'maxcombo'") && mainSrc.includes("dc.kind === 'nomiss'") && mainSrc.includes("dc.kind === 'maxcombo'"));

  // #13 niveau hebdo + #10 récompenses visibles + #12 boss
  ok('data.js : WEEKLY_LEVEL (id 900, weekly) + niveaux 5/10/15 boss:true + thèmes halloween/noel/ete dans THEMES et THEME_SHOP',
    dataSrc.includes('export const WEEKLY_LEVEL') && dataSrc.includes('weekly: true') && (dataSrc.match(/boss: true/g) || []).length === 3 && dataSrc.includes("id: 'halloween'") && dataSrc.includes("id: 'noel'") && dataSrc.includes("id: 'ete'") && dataSrc.includes('Thème Halloween'));
  ok('main.js : WEEKLY_LEVEL affiché le week-end + carte avec bonus 1er clear / paliers Survie + 👹 boss', mainSrc.includes('[WEEKEND_LEVEL, WEEKLY_LEVEL]') && mainSrc.includes('firstClearBonus(l)') && mainSrc.includes('paliers 25/50/100') && mainSrc.includes("l.boss ? ' 👹'"));

  // #9 courbe lissée
  ok('core.buildPattern : gapMin plancher 260 + pDouble plafonné 0,35 (boss 0,45 min)', coreSrc.includes('Math.max(260, Number.isFinite(level.gapMin)') && coreSrc.includes('Math.min(level.pDouble || 0, 0.35)') && coreSrc.includes('Math.max(level.pDouble || 0, 0.45)'));

  // #21 icône saisonnière
  ok('main.js : applySeasonIcon (mois -> svg) au boot + 3 fichiers icons/*.svg + manifest + sw ASSETS', mainSrc.includes('function applySeasonIcon()') && mainSrc.includes('applySeasonIcon();') && manifest.icons.some((i) => i.src === 'icons/icon-halloween.svg') && swSrc.includes("'./icons/icon-noel.svg'") && fsB5.existsSync(new URL('../icons/icon-ete.svg', import.meta.url)));
}


console.log('BF. v1.3.82 : feel & social — #1 entraînement, #2 buffer/coyote, #3 fantôme record, #5 calibration latence, #7 vibration, #8 gaucher, #11 fenêtres adaptatives, #24 duels amis');
{
  const fsB6 = await import('node:fs');
  const mainSrc = fsB6.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const gameSrc = fsB6.readFileSync(new URL('../js/game.js', import.meta.url), 'utf8');
  const coreSrc = fsB6.readFileSync(new URL('../js/core.js', import.meta.url), 'utf8');
  const storeSrc = fsB6.readFileSync(new URL('../js/store.js', import.meta.url), 'utf8');
  const lbSrc = fsB6.readFileSync(new URL('../js/leaderboard.js', import.meta.url), 'utf8');
  const html = fsB6.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  ok('store : training/trainSpeed/vibrate/leftHanded/windowLevel/latencyOffsetMs (defaults + sanitize + setters)', storeSrc.includes('training: false') && storeSrc.includes('export function setTraining') && storeSrc.includes('export function setWindowLevel') && storeSrc.includes('export function setLatencyOffsetMs'));
  ok('game.js : training = vies infinies (maxMisses=Infinity) + inputBuffer créé', gameSrc.includes('this.training ? Infinity : maxMissesFor') && gameSrc.includes('makeInputBuffer(120)'));
  ok('main.js : startLevel ralenti en entraînement + badge 🎓 + toasts hors classement (training/windowLevel/latency) + effWindows 3 niveaux (#11)', mainSrc.includes('Math.max(60, Math.round(level.speed * (save.trainSpeed || 1)))') && mainSrc.includes('🎓 ENTRAÎNEMENT') && mainSrc.includes("save.windowLevel === 'large'") && mainSrc.includes("save.windowLevel === 'xlarge'") && mainSrc.includes('hors classement en ligne'));
  ok('core.canSubmitToLeaderboard : training / windowLevel!=standard / latencyOffsetMs -> hors classement', core.canSubmitToLeaderboard({ pseudo: 'a', uid: 'u', training: true }) === false && core.canSubmitToLeaderboard({ pseudo: 'a', uid: 'u', windowLevel: 'large' }) === false && core.canSubmitToLeaderboard({ pseudo: 'a', uid: 'u', latencyOffsetMs: 20 }) === false && core.canSubmitToLeaderboard({ pseudo: 'a', uid: 'u' }) === true);

  ok('core.makeInputBuffer : push/consume fenêtre 120 ms, consomme le tap', (() => { const b = core.makeInputBuffer(120); b.push(1000, 'rear'); b.push(1050, 'front'); return b.consume(1100, 'rear') === 1000 && b.consume(1100, 'rear') === null && b.consume(1100, 'front') === 1050 && b.consume(2000, 'front') === null; })());
  ok('game.js : tap bufferisé rejugé à son instant (fromBuffer, return true) + dtMs - latencyOffsetMs (#5)', gameSrc.includes('this.inputBuffer.consume(this.time * 1000, axle)') && gameSrc.includes('fromBuffer') && gameSrc.includes('return true;') && gameSrc.includes('(this.access.latencyOffsetMs || 0)'));

  ok('game.js : fantôme du record (access.ghost[line._gi]) + vibration patterns (#7)', gameSrc.includes('this.access.ghost[line._gi]') && gameSrc.includes('navigator.vibrate([15, 15, 15])') && gameSrc.includes('vibrate(80)'));
  ok('main.js : calibration (#5) btn-calibrate + calib-zone + setLatencyOffsetMs + gaucher (#8) pointer/swipe/flèches inversés',
    mainSrc.includes("on('btn-calibrate', 'click'") && mainSrc.includes("on('calib-zone', 'pointerdown'") && mainSrc.includes('store.setLatencyOffsetMs(off)') && mainSrc.includes('window.innerWidth - e.clientX') && mainSrc.includes('if (save.leftHanded) dx = -dx;') && mainSrc.includes("action === 'swipeRight'"));
  ok('index.html : nouvelles options (vibrate/lefty/training/trainspeed/windowlevel/calibrate/calib-zone/calib-hint) + #duels-list', ['s-opt-vibrate', 's-opt-lefty', 's-opt-training', 's-opt-trainspeed', 's-opt-windowlevel', 'btn-calibrate', 'calib-zone', 'calib-hint', 'duels-list'].every((id) => html.includes(`id="${id}"`)));

  ok('leaderboard.js : submitDuel + getDuels (nœud /challenges/duels.json, mode duel, rate-limit, no-store)', lbSrc.includes('export async function submitDuel') && lbSrc.includes('/challenges/duels.json') && lbSrc.includes('export async function getDuels') && lbSrc.includes("d.mode === 'duel'"));
  ok("main.js : bouton ⚔️ sur les lignes amis + renderDuels dans l'écran Défis + Relever -> startLevel", mainSrc.includes("lbScope === 'friends' && !me") && mainSrc.includes('leaderboard.submitDuel(') && mainSrc.includes('async function renderDuels()') && mainSrc.includes('renderDuels();'));
}


console.log('BG. v1.3.83 : le pseudo est sauvegardé dans le cloud et récupéré à la reconnexion');
{
  const fsB7 = await import('node:fs');
  const storeSrc = fsB7.readFileSync(new URL('../js/store.js', import.meta.url), 'utf8');
  const mainSrc = fsB7.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');

  ok('store.snapshot() inclut pseudo (écrit dans players/<uid>)', storeSrc.includes('pseudo: save.pseudo, // v1.3.83'));
  ok('store.mergeRemoteBody restaure le pseudo du cloud SI local vide (jamais d\'écrasement)', storeSrc.includes("if (!save.pseudo && typeof remote.pseudo === 'string'"));
  ok('fonctionnel : pseudo local vide -> mergeRemote({pseudo}) le récupère ; pseudo local présent -> conservé', (() => {
    store.setPseudo('');
    const r1 = store.mergeRemote({ pseudo: 'PseudoCloud', wallets: { auto: 42 } });
    const p1 = store.load().pseudo;
    store.setPseudo('LocalPseudo');
    store.mergeRemote({ pseudo: 'AutreCloud' });
    const p2 = store.load().pseudo;
    store.setPseudo('');
    return r1 === true && p1 === 'PseudoCloud' && p2 === 'LocalPseudo';
  })());
  ok('store.snapshot().pseudo reflète le pseudo courant', (() => { store.setPseudo('SnapTest'); const p = store.snapshot().pseudo; store.setPseudo(''); return p === 'SnapTest'; })());
  ok('main.js : à la connexion (completeGoogleSignIn), si le pseudo revient du cloud -> modale fermée + action en attente exécutée ; idem à la restauration de session au boot', mainSrc.includes('v1.3.83 : le pseudo revient du cloud') && mainSrc.includes('pendingAfterPseudo;') && mainSrc.includes("updatePseudoSaveState(); // v1.3.83"));
}


console.log('BH. v1.3.84 : pseudo uniquement APRÈS connexion Google + tutoriel lancé une seule fois');
{
  const fsB8 = await import('node:fs');
  const mainSrc = fsB8.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');

  ok('ensurePseudoThen exige uid ET pseudo', mainSrc.includes('if (save.uid && save.pseudo) {'));
  ok('updatePseudoSaveState : Enregistrer désactivé tant que pas connecté+pseudo (forcé) + nouveaux textes 🔑', mainSrc.includes('pseudoForced && !(save.uid &&') && mainSrc.includes("Connecte d'abord ton compte Google"));
  ok('btn-pseudo-save refuse sans uid (toast 🔑) même hors mode forcé', mainSrc.includes('if (!save.uid) {') && mainSrc.includes("Connecte ton compte Google d'abord"));
  ok("openPseudoModal pré-remplit depuis l'email Google si connecté sans pseudo", mainSrc.includes("save.googleEmail || '').split('@')[0]"));
  ok('btn-play : login+pseudo puis tutoriel UNE SEULE FOIS (setTutorialDone au lancement)', mainSrc.includes('store.setTutorialDone(); // v1.3.84') && mainSrc.includes('startTutorial();'));
  ok('abandon tuto : commentaire MAJ (ne se relance plus)', mainSrc.includes('tutorialDone est posé au LANCEMENT'));
}


console.log('BI. v1.3.85 : jeu libre sans compte/pseudo — connexion+pseudo demandées seulement pour le classement, scores locaux rattachés au compte');
{
  const fsB9 = await import('node:fs');
  const mainSrc = fsB9.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const lbSrc = fsB9.readFileSync(new URL('../js/leaderboard.js', import.meta.url), 'utf8');

  const playBlock = (mainSrc.match(/on\('btn-play'[\s\S]*?\}\);/) || [''])[0];
  const lbBlock = (mainSrc.match(/on\('btn-leaderboard'[\s\S]*?show\('screen-leaderboard'\);\s*\}\);/) || [''])[0];
  const helpBlock = (mainSrc.match(/on\('btn-help'[\s\S]*?\}\);/) || [''])[0];
  ok('btn-play joue SANS ensurePseudoThen (tutoriel une fois puis niveaux directement)', !playBlock.includes('ensurePseudoThen') && playBlock.includes('setTutorialDone()') && playBlock.includes("show('screen-levels')"));
  ok('btn-help (tutoriel) sans pseudo non plus', !helpBlock.includes('ensurePseudoThen') && helpBlock.includes('startTutorial();'));
  ok("btn-leaderboard : ensurePseudoThen (connexion Google + pseudo) AVANT d'ouvrir le classement", lbBlock.includes('ensurePseudoThen(() => {') && lbBlock.includes('flushQueue'));
  ok('toast anonyme : le résultat local sera envoyé à la connexion et lié au compte', mainSrc.includes('ce résultat y sera envoyé et lié à ton compte'));
  ok('flushQueue(idToken, uid, pseudo) : rattache uid ET pseudo (y compris payload .entry) aux entrées anonymes', lbSrc.includes("export async function flushQueue(idToken, uid, pseudo = '')") && lbSrc.includes('if (pseudo && tgt && !tgt.pseudo) tgt.pseudo = pseudo;'));
  ok('main.js : les 4 appels flushQueue passent save.pseudo', (mainSrc.match(/flushQueue\(getAuthToken\(\), save\.uid, save\.pseudo\)/g) || []).length === 4);
  {
    const posts = [];
    globalThis.fetch = async (url, opts) => { if (opts && opts.method === 'POST') posts.push({ url: String(url), body: JSON.parse(opts.body) }); return { ok: true, json: async () => null }; };
    lb._setWriteGap(0);
    localStorage.setItem('roadtap_lb_queue_v1', JSON.stringify([
      { kind: 'score', payload: { pseudo: '', uid: '', score: 500, level: 'L', levelId: 1, mode: 'auto', date: 1, lines: 10 }, at: 1 },
      { kind: 'speedrun', payload: { levelId: 1, entry: { pseudo: '', uid: '', timeMs: 20000, level: 'L', date: 2, lines: 10 } }, at: 2 },
    ]));
    const sent = await lb.flushQueue('TOK', 'uid-42', 'MonPseudo');
    const scorePost = posts.find((p) => p.url.includes('/scores/'));
    const srPost = posts.find((p) => p.url.includes('/speedrun/'));
    ok('fonctionnel : 2 entrées anonymes -> 2 POST avec uid=uid-42 ET pseudo=MonPseudo rattachés, file vidée', sent === 2 && lb.queueSize() === 0 && scorePost.body.uid === 'uid-42' && scorePost.body.pseudo === 'MonPseudo' && srPost.body.uid === 'uid-42' && srPost.body.pseudo === 'MonPseudo');
    delete globalThis.fetch;
  }
}

console.log('BK. v1.3.86 : sweep de cohérence post-fusion — crash Tutoriel (TUT_LEVEL.id), unlockAudio noyé dans un //, clé training dupliquée');
{
  const fsBK = await import('node:fs');
  const mainSrc = fsBK.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  ok('startTutorial : le fantôme lit TUT_LEVEL.id (fin du ReferenceError "level is not defined" au clic 👶)', mainSrc.includes('ghost: (store.getReplay(save.difficulty, TUT_LEVEL.id) || {}).taps'));
  ok('exactement 2 sites getReplay(save.difficulty, level|TUT_LEVEL .id) : startTutorial + startLevel', (mainSrc.match(/getReplay\(save\.difficulty, (?:level|TUT_LEVEL)\.id\)/g) || []).length === 2);
  ok('plus aucun "unlockAudio();" noyé après un // sur la même ligne', !mainSrc.split('\n').some((l) => { const c = l.indexOf('//'); return c >= 0 && l.slice(c + 2).includes('unlockAudio();'); }));
  ok('unlockAudio(); restauré sur sa propre ligne dans startLevel (fix anti-freeze v1.3.65)', mainSrc.includes('\n  unlockAudio(); //'));
  ok('clé training : UNE SEULE occurrence dans les options Game de startLevel (doublon supprimé)', (mainSrc.match(/training: !!save\.training/g) || []).length === 1);
}

console.log('BJ. v1.3.86 : demandes d\'amis — pseudo vérifié (existe en ligne), envoi, recevoir, accepter/refuser, statut côté émetteur');
{
  const fsB10 = await import('node:fs');
  const mainSrc = fsB10.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const lbSrc = fsB10.readFileSync(new URL('../js/leaderboard.js', import.meta.url), 'utf8');
  const storeSrc = fsB10.readFileSync(new URL('../js/store.js', import.meta.url), 'utf8');
  const html = fsB10.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const rules = JSON.parse(fsB10.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules;

  ok('rules : nœud friendRequests — read destinataire+émetteur, write create pending (fromUid==auth) / PATCH statut accepted|refused (toUid) / delete (toUid)',
    !!rules.friendRequests && rules.friendRequests['$toUid']['.read'].includes('auth.uid == $toUid') && rules.friendRequests['$toUid']['$fromUid']['.read'].includes('$fromUid') && rules.friendRequests['$toUid']['$fromUid']['.write'].includes("'pending'") && rules.friendRequests['$toUid']['$fromUid']['.write'].includes("== 'accepted'") && rules.friendRequests['$toUid']['$fromUid']['.write'].includes("== 'refused'") && !JSON.stringify(rules).includes(' in [')); // v1.3.87 : l'opérateur "in" est INTERDIT par RTDB (erreur de publication line 54)
  ok('rules : AUCUN opérateur « in [ » dans tout database.rules.json (RTDB l’interdit à la publication)', !JSON.stringify(rules).includes(' in ['));
  ok('leaderboard : resolveUidByPseudo + sendFriendRequest + getIncomingFriendRequests + respondFriendRequest + getOutgoingRequestStatus + deleteFriendRequest', ['resolveUidByPseudo', 'sendFriendRequest', 'getIncomingFriendRequests', 'respondFriendRequest', 'getOutgoingRequestStatus', 'deleteFriendRequest'].every((f) => lbSrc.includes('export async function ' + f)));
  ok('store : friendRequestsOut (defaults + strObjMap + snapshot + mergeRemote union + add/get/remove)', storeSrc.includes('friendRequestsOut: {}') && storeSrc.includes('function strObjMap') && storeSrc.includes('friendRequestsOut: save.friendRequestsOut') && storeSrc.includes('export function addOutgoingFriendRequest') && storeSrc.includes('export function removeOutgoingFriendRequest'));
  ok('main.js : addFriendFromInput async — guards (vide/soi-même/pas connecté/déjà ami/déjà demandé) + resolveUidByPseudo + sendFriendRequest + addOutgoingFriendRequest', mainSrc.includes('async function addFriendFromInput()') && mainSrc.includes('leaderboard.resolveUidByPseudo(v)') && mainSrc.includes('leaderboard.sendFriendRequest(') && mainSrc.includes("n'existe pas — aucun score en ligne"));
  ok('main.js : renderFriendRequests — reçues ✅/❌ (respond+addFriend+delete) et envoyées (statut accepted->ami / refused->retiré)', mainSrc.includes('async function renderFriendRequests()') && mainSrc.includes("respondFriendRequest(save.uid, r.fromUid, 'accepted'") && mainSrc.includes("'refused'") && mainSrc.includes('getOutgoingRequestStatus(toUid, save.uid'));
  ok('index.html : #friend-requests-in + #friend-requests-out dans la barre amis', html.includes('id="friend-requests-in"') && html.includes('id="friend-requests-out"'));
  {
    // fonctionnel : resolveUidByPseudo via scores mockés + sendFriendRequest POST + respond PATCH
    const calls = [];
    globalThis.fetch = async (url, opts) => {
      calls.push({ url: String(url), method: opts && opts.method, body: opts && opts.body ? JSON.parse(opts.body) : null });
      if (String(url).includes('/scores/')) return { ok: true, json: async () => ({ a: { pseudo: 'Bob', uid: 'uidBob', score: 10 }, b: { pseudo: 'Alice', uid: 'uidAlice', score: 20 } }) };
      if (String(url).includes('/speedrun/')) return { ok: true, json: async () => null };
      return { ok: true, json: async () => null };
    };
    lb._setWriteGap(0);
    const found = await lb.resolveUidByPseudo('bob');
    ok('resolveUidByPseudo("bob") -> uidBob (insensible à la casse, via scores publics)', !!found && found.uid === 'uidBob');
    const none = await lb.resolveUidByPseudo('PersonneIci');
    ok('resolveUidByPseudo("PersonneIci") -> null (pseudo inexistant)', none === null);
    const okSend = await lb.sendFriendRequest('uidMe', 'Moi', 'uidBob', 'Bob', 'TOK');
    const post = calls.find((c) => c.method === 'POST' && c.url.includes('/friendRequests/uidBob/uidMe.json'));
    ok('sendFriendRequest -> POST /friendRequests/<to>/<from> avec status pending + fromUid==auth', okSend === true && !!post && post.body.status === 'pending' && post.body.fromUid === 'uidMe' && post.url.includes('auth=TOK'));
    const okResp = await lb.respondFriendRequest('uidBob', 'uidMe', 'accepted', 'TOK');
    const patch = calls.find((c) => c.method === 'PATCH' && c.url.includes('/friendRequests/uidBob/uidMe.json'));
    ok('respondFriendRequest -> PATCH {status:accepted} sur /friendRequests/<me>/<from>', okResp === true && !!patch && patch.body.status === 'accepted');
    delete globalThis.fetch;
  }
}

console.log('BL. v1.3.87 : règles RTDB — opérateur "in" interdit (erreur de publication line 54), PATCH friendRequests via == accepted || == refused + garde-fou audit §12');
{
  const fsBL = await import('node:fs');
  const rulesRaw = fsBL.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8');
  const auditSrc = fsBL.readFileSync(new URL('../tools/audit.mjs', import.meta.url), 'utf8');
  ok('database.rules.json : aucun " in [" dans tout le fichier (opérateur interdit par RTDB)', !rulesRaw.includes(' in ['));
  ok('friendRequests .write : PATCH statut via "== accepted || == refused" (remplace "in [accepted,refused]")', rulesRaw.includes("newData.child('status').val() == 'accepted' || newData.child('status').val() == 'refused'"));
  ok('audit §12 : garde-fou anti-régression " in [" présent dans tools/audit.mjs', auditSrc.includes("includes(' in [')"));
}
console.log('BM. v1.3.88 : diag classement — compteur SCORES non écrasé par la lecture speedrun + message explicite (onglet Amis / niveau) ; demandes d\'amis : lastFrError (HTTP xxx) exposé dans le toast');
{
  const fsBM = await import('node:fs');
  const mainSrc = fsBM.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const lbSrc = fsBM.readFileSync(new URL('../js/leaderboard.js', import.meta.url), 'utf8');
  ok('renderLeaderboard : snapshot stScores après chaque lecture principale (season/reaction/friends/normal)', (mainSrc.match(/stScores = leaderboard\.getLbStatus\(\);/g) || []).length === 4);
  ok('renderLeaderboard : le message lb-source utilise stScores (plus écrasé par getSpeedrunAll)', mainSrc.includes('const st = stScores ||'));
  ok('lb-source : raison explicite quand 0 affiché (onglet 👥 Amis sans ami / niveau « … »)', mainSrc.includes('(onglet 👥 Amis') && mainSrc.includes('niveau « ${LEVEL_NAME_BY_ID[Number(lbLevelFilter)]'));
  ok('leaderboard : getLastFrError exporté + lastFrError renseigné dans send/respond/deleteFriendRequest', lbSrc.includes('export function getLastFrError()') && (lbSrc.match(/lastFrError = /g) || []).length >= 6);
  ok('main.js : toast envoi refusé inclut la vraie cause (HTTP 401/403 -> publier les règles friendRequests)', mainSrc.includes('leaderboard.getLastFrError()') && mainSrc.includes('publie les règles friendRequests'));
  {
    globalThis.fetch = async (url, opts) => {
      if (String(url).includes('/friendRequests/')) return { ok: false, status: 401, json: async () => null };
      return { ok: true, json: async () => null };
    };
    lb._setWriteGap(0);
    const okSend = await lb.sendFriendRequest('uidMe', 'Moi', 'uidBob', 'Bob', 'TOK');
    ok('sendFriendRequest HTTP 401 -> false + getLastFrError() === "HTTP 401"', okSend === false && lb.getLastFrError() === 'HTTP 401');
    globalThis.fetch = async () => ({ ok: true, json: async () => null });
    const okSend2 = await lb.sendFriendRequest('uidMe', 'Moi', 'uidBob', 'Bob', 'TOK');
    ok('sendFriendRequest OK -> true + getLastFrError() vidé', okSend2 === true && lb.getLastFrError() === '');
    delete globalThis.fetch;
  }
}
console.log('BN. v1.3.89 : reconnexion — le pseudo revient du cloud (loadRaw + 2e essai ; pushCloud ne pousse plus après un pull en échec)');
{
  const fsBN = await import('node:fs');
  const mainSrc = fsBN.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const csSrc = fsBN.readFileSync(new URL('../js/cloudsave.js', import.meta.url), 'utf8');
  const cs = await import('../js/cloudsave.js');
  ok('cloudsave.loadRaw exposé ({ok,data,error}) et load conservé', csSrc.includes('export async function loadRaw') && csSrc.includes('export async function load('));
  ok('pushCloud : pull via loadRaw + "if (!r.ok) return;" — AUCUN PUT après un pull en échec (n\'écrase plus players/<uid>)', mainSrc.includes('cloudsave.loadRaw(') && mainSrc.includes('if (!r.ok) return;'));
  ok('2e essai de lecture après 1200 ms à la connexion ET au boot (2 sites) si le 1er load échoue (401 App Check)', (mainSrc.match(/await new Promise\(\(r\) => setTimeout\(r, 1200\)\)/g) || []).length >= 3);
  ok('noteRestoredPseudo(hadPseudo) appelé aux 3 sites de merge + toast « récupéré du cloud » + champ pseudo re-rempli', mainSrc.includes('function noteRestoredPseudo') && (mainSrc.match(/noteRestoredPseudo\(hadPseudo\)/g) || []).length >= 3 && mainSrc.includes('récupéré du cloud') && mainSrc.includes('if (pinp) pinp.value = save.pseudo;'));
  {
    globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => null });
    let r = await cs.loadRaw('Uid_MixedCase_ABC123', 'TOK');
    ok('loadRaw HTTP 401 -> { ok:false, error:"HTTP 401" } (pull en échec -> pushCloud ne poussera pas)', r.ok === false && r.error === 'HTTP 401');
    const seen = [];
    globalThis.fetch = async (u) => { seen.push(String(u)); return { ok: true, json: async () => null }; };
    r = await cs.loadRaw('Uid_MixedCase_ABC123', 'TOK');
    ok('loadRaw 200 + nœud vide -> { ok:true, data:null } + URL avec uid TEL QUEL + ?auth=', r.ok === true && r.data === null && seen[0].includes('/players/Uid_MixedCase_ABC123.json') && seen[0].includes('?auth=TOK'));
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ pseudo: 'Siebeile' }) });
    r = await cs.loadRaw('uid1', 'TOK');
    ok('loadRaw 200 + data -> { ok:true, data:{pseudo:"Siebeile"} }', r.ok === true && r.data && r.data.pseudo === 'Siebeile');
    delete globalThis.fetch;
  }
  {
    // fonctionnel : déconnexion (resetProgress) puis reconnexion (mergeRemote du cloud)
    store.resetProgress();
    ok('après resetProgress (déconnexion), le pseudo local est vide', !store.get().pseudo);
    const changed = store.mergeRemote({ pseudo: 'Siebeile', wallets: { auto: 42 } });
    ok('mergeRemote({pseudo:"Siebeile"}) -> true et save.pseudo restauré du cloud', changed === true && store.get().pseudo === 'Siebeile');
    ok('snapshot() conserve le pseudo restauré (le prochain push ne l\'efface pas)', store.snapshot().pseudo === 'Siebeile');
  }
}
console.log('BO. v1.3.90 : plus de délai auto « niveau suivant » (bouton manuel ▶) ; replay : fin propre + guards !isReplay ; menu 🎞 Replays (10 dernières, ▶ voir, 💾 télécharger .json)');
{
  const fsBO = await import('node:fs');
  const mainSrc = fsBO.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const storeSrc = fsBO.readFileSync(new URL('../js/store.js', import.meta.url), 'utf8');
  const html = fsBO.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = fsBO.readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
  ok('compte à rebours auto supprimé : plus de startNextCountdown/cancelNextCountdown dans main.js, plus de over-next/over-count/countdown-bar dans HTML/CSS', !mainSrc.includes('startNextCountdown') && !mainSrc.includes('cancelNextCountdown') && !html.includes('id="over-next"') && !html.includes('over-count') && !css.includes('#over-next') && !css.includes('.countdown-bar'));
  ok('bouton manuel « ▶ Niveau suivant » conservé (btn-over-next, affiché seulement si terminé + suivant existe)', html.includes('id="btn-over-next"') && mainSrc.includes("on('btn-over-next', 'click'") && mainSrc.includes("bn.classList.toggle('hidden', !(stats.completed && next))"));
  ok('écran de fin d’un replay : titre « ▶ Replay terminé » + bouton replay caché pendant un replay', mainSrc.includes('▶ Replay terminé') && mainSrc.includes('btnReplay.classList.toggle(\'hidden\', isReplay ||'));
  ok('onGameEnd : guards !isReplay sur records/totaux/cleared/étoiles/endless/trophée/pièces/défi/quêtes/succès (>= 8)', (mainSrc.match(/!isReplay/g) || []).length >= 8);
  ok('onGameEnd : pushReplay dans l’historique des 10 dernières parties (hors replay)', mainSrc.includes('store.pushReplay({') && mainSrc.includes('if (!isReplay && game && game.replay)'));
  ok('startLevel : mode du replay d’origine + pas de vitesse entraînement + pas d’overlay continuer en replay', mainSrc.includes('replayRep && replayRep.mode ? replayRep.mode : save.difficulty') && mainSrc.includes('save.training && !replayRep') && mainSrc.includes('onThreshold: replayRep ? () => {} : showContinue'));
  ok('store.js : roadtap_replays_v1 + listReplays/pushReplay (cap 10)/getReplayById/deleteReplay', storeSrc.includes("const REPLAYS_KEY = 'roadtap_replays_v1';") && storeSrc.includes('export function listReplays') && storeSrc.includes('while (a.length > 10) a.pop()') && storeSrc.includes('export function getReplayById') && storeSrc.includes('export function deleteReplay'));
  ok('index.html : écran #screen-replays + #replays-list + boutons #btn-replays/#btn-replays-back', html.includes('id="screen-replays"') && html.includes('id="replays-list"') && html.includes('id="btn-replays"') && html.includes('id="btn-replays-back"'));
  ok('main.js : renderReplays (▶/💾/✕) + downloadReplay (Blob + a.download roadtap-replay-*.json + createObjectURL) + levelById (LEVELS + ENDLESS/WEEKEND/WEEKLY)', mainSrc.includes('function renderReplays()') && mainSrc.includes('function downloadReplay(r)') && mainSrc.includes('new Blob([') && mainSrc.includes('a.download = `roadtap-replay-') && mainSrc.includes('URL.createObjectURL') && mainSrc.includes('WEEKEND_LEVEL.id === id'));
  {
    for (let i = 1; i <= 12; i++) store.pushReplay({ mode: 'auto', levelId: 1, levelName: 'L1', score: i, timeMs: i * 1000, completed: true, seed: 42, lines: 10, taps: [{ a: 'front', t: 100 }] });
    const l = store.listReplays();
    ok('pushReplay x12 -> listReplays() = 10, le plus récent en tête (score 12), le plus vieux (score 3) en queue', l.length === 10 && l[0].score === 12 && l[9].score === 3);
    ok('getReplayById retrouve la tête + deleteReplay la retire (reste 9)', !!store.getReplayById(l[0].id) && (store.deleteReplay(l[0].id), store.listReplays().length === 9));
  }
}
console.log('BP. v1.3.91 : fix crash calibration (calib null) ; bip 0 ms : timing corrigé (outputLatency), garanti même si frame sautée, plus doux, optionnel (hors classement) ; musique : démarrage propre au début de chaque niveau');
{
  const fsBP = await import('node:fs');
  const mainSrc = fsBP.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const gameSrc = fsBP.readFileSync(new URL('../js/game.js', import.meta.url), 'utf8');
  const audioSrc = fsBP.readFileSync(new URL('../js/audio.js', import.meta.url), 'utf8');
  const storeSrc = fsBP.readFileSync(new URL('../js/store.js', import.meta.url), 'utf8');
  const coreSrc = fsBP.readFileSync(new URL('../js/core.js', import.meta.url), 'utf8');
  const html = fsBP.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  ok('calibration : guard "if (!calib)" dans l’intervalle + calibTimer nettoyé à la fin (plus de TypeError calib.beats)', mainSrc.includes('if (!calib) { clearInterval(iv); calibTimer = null; return; }') && mainSrc.includes('calibTimer = iv;') && mainSrc.includes('if (calibTimer) { clearInterval(calibTimer); calibTimer = null; }'));
  ok('bip 0 ms : fenêtre élargie (tSec < 0.7 sans borne basse) + latence de sortie compensée (outputLatency) + plus de reprogrammation après le 0 + volume 0.22 -> 0.13', audioSrc.includes('if (!(tSec < 0.7)) return;') && audioSrc.includes('c.outputLatency') && audioSrc.includes('if (prev.at <= 0.02) return;') && audioSrc.includes('exponentialRampToValueAtTime(0.13, t0 + 0.004)'));
  ok('game.js : lineBeat appelé dès t < 0.7 (plus de t > -0.05 -> le bip part même à haute vitesse/bas fps) et géré par access.lineBeat', gameSrc.includes('this.access.lineBeat && typeof this.audio.lineBeat') && gameSrc.includes('t < 0.7) this.audio.lineBeat(t,') && !gameSrc.includes('t > -0.05 && t < 0.7'));
  ok('bip = feature intégrante toujours ON (v1.3.92) : plus de lineBeatSound/setLineBeatSound/s-opt-linebeat/opt-linebeat ; access.lineBeat: true aux 2 sites', !storeSrc.includes('lineBeatSound') && !storeSrc.includes('setLineBeatSound') && !html.includes('s-opt-linebeat') && !mainSrc.includes('opt-linebeat') && (mainSrc.match(/lineBeat: true,/g) || []).length === 2);
  ok('v1.3.92 : le bip à l’oreille n’est jamais exclu du classement (feature) ; hitMarker si', !coreSrc.includes('lineBeatSound') && coreSrc.includes('!s.hitMarker'));
  ok('musique : musicKick fait stopMusic + resume explicite + musicNext = currentTime + 0.06 -> démarrage propre au début de chaque niveau', audioSrc.includes('if (c.state === \'suspended\') c.resume();') && (audioSrc.match(/stopMusic\(\);/g) || []).length >= 2 && audioSrc.includes('musicNext = c.currentTime + 0.06;'));
  ok('tutoriel : unlockAudio + setMusicEnabled + musicKick au lancement (la musique démarre aussi dans le 👶)', mainSrc.includes('unlockAudio(); // v1.3.91') && mainSrc.includes('setMusicEnabled(save.music && save.sound); // v1.3.91'));
  {
    const audio = await import('../js/audio.js');
    audio.setEnabled(true);
    audio.setMusicEnabled(true);
    audio.musicKick(); // headless : ac() -> null, aucun crash
    audio.scheduleLineBeat(0.1, 'k1');
    audio.scheduleLineBeat(-0.2, 'k1');
    audio.clearLineBeats();
    audio.setMusicEnabled(false);
    ok('headless : musicKick/scheduleLineBeat/clearLineBeats sans crash (pas de WebAudio en Node)', true);
    ok('canSubmitToLeaderboard : éligible par défaut (bip toujours ON ne change rien) ; hitMarker=true -> exclu', core.canSubmitToLeaderboard({ pseudo: 'a', uid: 'b' }) === true && core.canSubmitToLeaderboard({ pseudo: 'a', uid: 'b', hitMarker: true }) === false);
  }
}
console.log('BQ. v1.3.92 : bip à l’oreille calé à −45 ms (BEAT_OFFSET_S), TOUJOURS ON (feature intégrante, aucune option) + musique PAR NIVEAU (LEVEL_THEMES)');
{
  const fsBQ = await import('node:fs');
  const audioSrc = fsBQ.readFileSync(new URL('../js/audio.js', import.meta.url), 'utf8');
  const storeSrc = fsBQ.readFileSync(new URL('../js/store.js', import.meta.url), 'utf8');
  const coreSrc = fsBQ.readFileSync(new URL('../js/core.js', import.meta.url), 'utf8');
  const mainSrc = fsBQ.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const html = fsBQ.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const audio = await import('../js/audio.js');
  ok('bip = feature intégrante : plus aucune option (plus de lineBeatSound dans store/core, plus de s-opt-linebeat/opt-linebeat), access.lineBeat: true aux 2 sites', !storeSrc.includes('lineBeatSound') && !coreSrc.includes('lineBeatSound') && !html.includes('s-opt-linebeat') && !mainSrc.includes('opt-linebeat') && (mainSrc.match(/lineBeat: true,/g) || []).length === 2);
  ok('beat calé à −45 ms : BEAT_OFFSET_S = -0.045 appliqué (tSec + BEAT_OFFSET_S - lat, latence de sortie compensée)', audioSrc.includes('const BEAT_OFFSET_S = -0.045;') && audioSrc.includes('tSec + BEAT_OFFSET_S - lat'));
  ok('musique par niveau : LEVEL_THEMES (8 profils root/mode/prog/base) + setMusicLevel + themeChords()[bar] dans scheduleStep + tempo = curTheme.base + combo', audioSrc.includes('const LEVEL_THEMES = [') && (audioSrc.match(/root:/g) || []).length >= 8 && audioSrc.includes('export function setMusicLevel') && audioSrc.includes('themeChords()[bar]') && audioSrc.includes('(curTheme.base || 96)'));
  ok('musicKick(levelId) applique le thème ; startLevel -> musicKick(level.id), tutoriel -> musicKick(TUT_LEVEL.id)', audioSrc.includes('export function musicKick(levelId)') && mainSrc.includes('musicKick(level.id);') && mainSrc.includes('musicKick(TUT_LEVEL.id);'));
  ok('textes UI : aide 0 ms dit « tic à −45 ms » (plus d’option dans les réglages)', html.includes('tic » audio joue à −45 ms') && !html.includes('s-opt-linebeat'));
  {
    audio.setMusicLevel(1);
    ok('setMusicLevel(1) -> La mineur, tempo base 96', audio.getMusicLevel().root === 220 && audio.getMusicLevel().mode === 'minor' && audio.musicTempo(0) === 96);
    audio.setMusicLevel(3);
    ok('setMusicLevel(3) -> Sol MAJEUR base 112, le combo fait monter le tempo (112 -> 176)', audio.getMusicLevel().mode === 'major' && audio.musicTempo(0) === 112 && audio.musicTempo(16) === 176);
    ok('canSubmitToLeaderboard inchangé : éligible par défaut, hitMarker=true -> exclu', core.canSubmitToLeaderboard({ pseudo: 'a', uid: 'b' }) === true && core.canSubmitToLeaderboard({ pseudo: 'a', uid: 'b', hitMarker: true }) === false);
  }
}
console.log(`\nOK - ${passed} assertions adversariales passent (rien ne plante)`);
