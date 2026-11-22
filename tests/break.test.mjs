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
    store.setBest('auto', 3, 100); // v1.3.44 : signature (mode, levelId, score)
    store.setTrophy(3);
    store.markCleared(3);
    store.addCoins('auto', 50);
    store.addCoins('auto', NaN); // ne doit pas rendre le wallet NaN
    store.spend('pilote', 10); // fonds insuffisants -> false
    store.setBestTime('auto', 3, 12345); // v1.3.44 : (mode, levelId, ms)
    store.setSpeedrun(true);
    store.setHorizontalZones(true);
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
  ok('main.js : panneaux câblés (préfixes \'\' modale et \'s-\' paramètres)', mainSrc.includes("wireAccessCheckboxes('');") && mainSrc.includes("wireAccessCheckboxes('s-');"));
  // comportement : les setters persistent et partent dans le snapshot cloud
  mem['roadtap_save_v1'] = '{}';
  store.load();
  store.setWideWindows(true);
  store.setColorblind(true);
  store.setHorizontalZones(true);
  ok('setters accessibilité persistés (wideWindows/colorblind/horizontalZones)', store.get().wideWindows === true && store.get().colorblind === true && store.get().horizontalZones === true);
  ok('horizontalZones part dans le snapshot cloud (synchro multi-appareils)', store.snapshot().horizontalZones === true);
  ok('wideWindows/colorblind restent des préférences d\'appareil locales (par design, pas dans le snapshot)', !('wideWindows' in store.snapshot()) && !('colorblind' in store.snapshot()));
  store.setWideWindows(false);
  store.setColorblind(false);
  store.setHorizontalZones(false);
  ok('désactivation persistée', store.get().wideWindows === false && store.get().colorblind === false && store.get().horizontalZones === false);
}

console.log('R. v1.3.40 : jouer SANS compte (local), Google requis seulement pour cloud+classement, reset à 0 à la déconnexion, fusion à la reconnexion');
{
  const fs4 = await import('node:fs');
  const mainSrc = fs4.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');

  // on joue avec seulement un pseudo (plus besoin d'uid)
  ok('ensurePseudoThen : jouer ne requiert QUE le pseudo', /function ensurePseudoThen\(fn\) \{\s*if \(save\.pseudo\) \{/.test(mainSrc));
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
  ok('speedrun en auto -> mode auto', makeGame(LEVELS[0], 'auto', { speedrun: true }).mode === 'auto');
  ok('speedrun en permisA -> mode permisA', makeGame(LEVELS[0], 'permisA', { speedrun: true }).mode === 'permisA');
  ok('speedrun en pilote -> mode pilote', makeGame(LEVELS[0], 'pilote', { speedrun: true }).mode === 'pilote');

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

  ok('database.rules.json : les 3 règles .write rejettent wideWindows==true', (rules.match(/wideWindows'\)\.val\(\) != true/g) || []).length === 3);

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
  ok('DEFAULT_KEYS = front ↑ / rear Espace / swipe ←', core.DEFAULT_KEYS.front === 'ArrowUp' && core.DEFAULT_KEYS.rear === 'Space' && core.DEFAULT_KEYS.swipe === 'ArrowLeft');
  ok('sanitizeKeys : corrompu -> défauts, partiel -> complété', core.sanitizeKeys(null).front === 'ArrowUp' && core.sanitizeKeys({ front: 'KeyA', rear: 42 }).front === 'KeyA' && core.sanitizeKeys({ front: 'KeyA' }).rear === 'Space');
  ok('keyLabel lisible', core.keyLabel('ArrowUp') === '↑ Haut' && core.keyLabel('Space') === 'Espace' && core.keyLabel('KeyZ') === 'Z' && core.keyLabel('Digit5') === '5');
  ok('bindKey : rebind OK', core.bindKey(core.DEFAULT_KEYS, 'front', 'KeyA').front === 'KeyA');
  ok('bindKey : doublon refusé (null)', core.bindKey(core.DEFAULT_KEYS, 'front', 'Space') === null && core.bindKey(core.DEFAULT_KEYS, 'front', 'ArrowLeft') === null);
  ok('keyToAction : touches perso priment', core.keyToAction('KeyA', false, { front: 'KeyA', rear: 'Space', swipe: 'ArrowLeft' }) === 'front');
  ok('keyToAction : repli mapping intégré si touche non perso', core.keyToAction('ArrowUp', false, { front: 'KeyA', rear: 'Space', swipe: 'ArrowLeft' }) === 'front' && core.keyToAction('ArrowRight', true, undefined) === 'rear');

  mem['roadtap_save_v1'] = '{}';
  store.load();
  ok('save.keys défauts après load vide', store.get().keys.front === 'ArrowUp' && store.get().keys.rear === 'Space');
  ok('setKey persiste (save + localStorage)', store.setKey('front', 'KeyZ') === true && store.get().keys.front === 'KeyZ' && JSON.parse(mem['roadtap_save_v1']).keys.front === 'KeyZ');
  ok('setKey doublon -> false, inchangé', store.setKey('rear', 'KeyZ') === false && store.get().keys.rear === 'Space');
  ok('snapshot inclut keys (cloud)', store.snapshot().keys.front === 'KeyZ');
  mem['roadtap_save_v1'] = JSON.stringify({ keys: { front: 'KeyP', rear: 'bogus' } });
  store.load();
  ok('sanitize keys : invalide -> défaut', store.get().keys.front === 'KeyP' && store.get().keys.rear === 'Space' && store.get().keys.swipe === 'ArrowLeft');
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
  ok('main.js : capture de touche dans keydown + keyToAction(save.keys)', mainSrc.includes('keyCapture') && mainSrc.includes('keyToAction(e.code, save.horizontalZones, save.keys)'));
  ok('main.js : 3 boutons de rebinding câblés', mainSrc.includes("'btn-key-front'") && mainSrc.includes("'btn-key-rear'") && mainSrc.includes("'btn-key-swipe'"));
  ok('main.js : version + état serveur (ping) dans les paramètres', mainSrc.includes("$('#set-version')") && mainSrc.includes("$('#set-server')") && mainSrc.includes('leaderboard.ping()'));
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
  ok('main.js : onglet « reaction » dans le filtre + branche isReact (tri croissant avgMs)', mainSrc.includes("{ id: 'reaction', name: '⚡ Réaction' }") && mainSrc.includes('isReact') && mainSrc.includes('a.avgMs - b.avgMs'));
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
  ok('bindKey : retry sur MouseRight OK, doublon refusé', core.bindKey(core.DEFAULT_KEYS, 'retry', 'MouseRight').retry === 'MouseRight' && core.bindKey(core.DEFAULT_KEYS, 'retry', 'Space') === null);

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
  ok('access-modal toujours présent (handlers JS valides)', html.includes('id="access-modal"'));
  ok('CSS : options accessibilité lisibles dans Paramètres (16px + fond + case agrandie)', css.includes('.settings-panel label.lb-optin') && css.includes('font-size: 16px') && css.includes('scale(1.3)'));

  ok('main.js : plus d\'option « Tous » ni « Tous niveaux » dans les filtres LB', !mainSrc.includes("name: 'Tous niveaux'") && !mainSrc.includes("{ id: 'all', name: 'Tous' }"));
  ok('main.js : ouverture du classement = difficulté courante + aucun filtre niveau', mainSrc.includes('lbFilter = save.difficulty;') && mainSrc.includes("lbLevelFilter = 'all';"));
  ok('main.js : filtre par niveau => fetch de TOUS les modes (bug testeur niveau 2)', mainSrc.includes("lbLevelFilter !== 'all' ? 'all' : lbFilter"));
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

console.log(`\nOK - ${passed} assertions adversariales passent (rien ne plante)`);
