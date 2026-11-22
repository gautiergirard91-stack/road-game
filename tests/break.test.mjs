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
    access: {},
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
    store.setBest(3, 100);
    store.setTrophy(3);
    store.markCleared(3);
    store.addCoins('auto', 50);
    store.addCoins('auto', NaN); // ne doit pas rendre le wallet NaN
    store.spend('pilote', 10); // fonds insuffisants -> false
    store.setBestTime(3, 12345);
    store.setSpeedrun(true);
    store.setHorizontalZones(true);
    store.setPseudo(98765);
  });
  ok('setters sûrs après save corrompue', store.getWallet('auto') === 50 && Number.isFinite(store.getWallet('auto')));
  ok('markCleared/isCleared', store.isCleared(3) === true && store.isCleared(4) === false);
  ok('setBest/setTrophy persistés', store.get().best[3] === 100 && store.get().trophies[3] === true);
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

  // écriture refusée -> fallback local + erreur explicite
  globalThis.fetch = async () => ({ ok: false, status: 403 });
  const r4 = await lb.submitScore({ pseudo: 'Moi', score: 10, level: 'L', levelId: 1, mode: 'auto', date: Date.now() });
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

  // --- keyToAction : UNE SEULE action par touche (fix double-binding ArrowLeft) ---
  ok('horizontal ON: ArrowLeft -> front (PAS swipe)', core.keyToAction('ArrowLeft', true) === 'front');
  ok('horizontal ON: ArrowRight -> rear', core.keyToAction('ArrowRight', true) === 'rear');
  ok('horizontal ON: ArrowDown -> swipe', core.keyToAction('ArrowDown', true) === 'swipe');
  ok('horizontal ON: KeyS -> swipe', core.keyToAction('KeyS', true) === 'swipe');
  ok('horizontal OFF: ArrowLeft -> swipe (hérité)', core.keyToAction('ArrowLeft', false) === 'swipe');
  ok('horizontal OFF: ArrowUp -> front', core.keyToAction('ArrowUp', false) === 'front');
  ok('horizontal OFF: Space -> rear', core.keyToAction('Space', false) === 'rear');
  ok('touche inconnue -> null', core.keyToAction('KeyZ', true) === null);

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
  globalThis.fetch = async () => ({ ok: false, status: 403 });
  await lb.submitScore({ pseudo: 'Moi', score: 5, level: 'L', levelId: 1, mode: 'auto', date: 1 });
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
  await lb.submitScore({ pseudo: 'Test', score: 123, level: 'Premiers tours', levelId: 1, mode: 'auto', date: 42 });
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
  await lb.submitSpeedrun(3, { pseudo: 'Test', timeMs: 45320, level: 'Double file', date: 9 });
  const post = calls.find((c) => c.method === 'POST');
  ok('POST vers /speedrun/3.json', post && post.url.includes('/speedrun/3.json'));
  ok('corps = contrat règles speedrun (pseudo/timeMs/level/date + bornes)', post && ['pseudo', 'timeMs', 'level', 'date'].every((k) => k in post.body) && post.body.timeMs >= 1000 && post.body.timeMs <= 3600000 && post.body.mode === 'pilote');

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
  await lb.submitSpeedrun(1, { pseudo: 'Moi', timeMs: 50000, level: 'L', date: 1 });
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
  // anonyme : pas de ?auth=
  calls.length = 0;
  await lb.submitScore({ pseudo: 'Anon', score: 5, level: 'L', levelId: 1, mode: 'auto', date: 2 });
  const anon = calls.find((c) => c.method === 'POST');
  ok('sans idToken -> pas de ?auth= (règle auth == null)', anon && !anon.url.includes('?auth='));
  ok('uid vide ajouté proprement', anon && anon.body.uid === '');
  // speedrun aussi
  calls.length = 0;
  await lb.submitSpeedrun(2, { pseudo: 'Moi', uid: 'uid123', timeMs: 40000, level: 'L', date: 3 }, 'TOK');
  const sr = calls.find((c) => c.method === 'POST');
  ok('submitSpeedrun avec idToken -> ?auth= + uid dans le corps', sr && sr.url.includes('?auth=TOK') && sr.body.uid === 'uid123');
  delete globalThis.fetch;
}

console.log(`\nOK - ${passed} assertions adversariales passent (rien ne plante)`);
