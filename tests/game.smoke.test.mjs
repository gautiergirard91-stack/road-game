import assert from 'node:assert/strict';

Object.defineProperty(globalThis, 'window', {
  value: { innerWidth: 390, innerHeight: 844, devicePixelRatio: 2 },
  configurable: true,
});

const { Game, MODELS } = await import('../js/game.js');
const { LEVELS, SKINS } = await import('../js/data.js');

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

function makeCanvas() {
  return { getContext: () => makeCtx(), style: {}, width: 0, height: 0 };
}

function makeGame(level, mode, extra = {}) {
  const events = { judge: [], miss: 0, threshold: 0, end: null };
  const game = new Game(makeCanvas(), {
    level,
    mode,
    skinId: 'default',
    effects: [],
    audio: {},
    onJudge: (e) => events.judge.push(e),
    onMiss: () => {
      events.miss++;
    },
    onThreshold: () => {
      events.threshold++;
    },
    onEnd: (stats) => {
      events.end = stats;
    },
    ...extra,
  });
  return { game, events };
}

function autoTap(game, skipCrosswalk = false) {
  for (const line of game.lines) {
    if (line.state !== 'pending' || line.hits.rear) continue;
    if (skipCrosswalk && line.type === 'crosswalk') continue;
    const d = game.distance - line.dist;
    if (Math.abs(d) < 4) {
      game.tap('rear');
      return;
    }
  }
}

function step(game, seconds, tapper) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds && game.running; t += dt) {
    if (tapper) tapper(game);
    game.update(dt);
    game.render();
  }
}

{
  const { game, events } = makeGame(LEVELS[0], 'auto');
  game.start();
  const total = game.lines.length;
  step(game, 40, autoTap);
  assert.ok(events.judge.length >= 8, `au moins 8 lignes tapées (reçu ${events.judge.length})`);
  assert.equal(events.miss, 0, 'aucun raté avec tap précis');
  assert.ok(game.score > 0, 'score > 0');
  assert.ok(game.remaining < total, 'badge lignes restantes a diminué');
  assert.ok(events.end && events.end.completed, 'niveau terminé proprement');
}

{
  const { game, events } = makeGame(LEVELS[0], 'auto');
  game.start();
  step(game, 40, null);
  assert.ok(events.threshold >= 1, 'seuil de ratés atteint sans tap');
  assert.ok(game.paused, 'pause en attente de décision');
  game.resumeWithContinue();
  assert.equal(game.paused, false, 'continue : reprise');
  assert.equal(game.stats.misses, 0, 'continue : ratés remis à zéro');
}

{
  const { game } = makeGame(LEVELS[3], 'auto');
  game.start();
  game.lines = game.lines.filter((l) => l.type !== 'crosswalk'); // déterministe : un seul passage piéton
  game.spawnLine('crosswalk', 800);
  let sawSlow = false;
  const dt = 1 / 60;
  for (let t = 0; t < 30 && game.running; t += dt) {
    autoTap(game, true);
    game.update(dt);
    game.render();
    if (game.autoStop && game.slow < 0.99) sawSlow = true;
  }
  assert.ok(sawSlow, "régression: en mode auto, la voiture doit ralentir pour le piéton (autoStop)");
}

{
  const { game, events } = makeGame(LEVELS[0], 'pilote');
  game.start();
  game.forceBlocker();
  let swiped = false;
  const dt = 1 / 60;
  for (let t = 0; t < 20 && game.running; t += dt) {
    autoTap(game);
    game.update(dt);
    if (!swiped && game.blocker) {
      game.swipeLeft();
      swiped = true;
      game.tSame = 9999;
    }
  }
  assert.ok(swiped, 'swipe devant le bloqueur');
  assert.equal(game.stats.overtakes, 1, '1 dépassement comptabilisé');
  assert.ok(events.judge.some((e) => e.overtake), 'événement overtake émis');
  for (let t = 0; t < 10 && game.running; t += dt) game.update(dt);
  assert.ok(game.laneTarget === 0.72 && game.carXFrac > 0.68, 'voiture revenue dans la voie de droite après dépassement');
}

{
  const { game } = makeGame(LEVELS[0], 'permisA');
  game.start();
  const before = game.frontAxleY;
  globalThis.window.innerHeight = 700;
  game.resize();
  assert.notEqual(game.frontAxleY, before, 'frontAxleY recalculé après resize');
  assert.ok(game.frontAxleY < game.wheelY, 'guide AV au-dessus du guide AR');
  globalThis.window.innerHeight = 844;
  game.resize();
}

{
  // v1.3.4 : le combo ne monte QUE sur PARFAIT
  const { game, events } = makeGame(LEVELS[0], 'auto');
  game.start();
  const l1 = game.lines[0];
  game.distance = l1.dist; // roues pile sur la ligne
  game.tap('rear');
  assert.equal(events.judge.at(-1).result, 'perfect');
  assert.equal(game.combo, 1, 'PARFAIT -> combo 1');
  const l2 = game.lines.find((l) => l.state === 'pending');
  game.distance = l2.dist + game.effSpeed * 0.08; // ~80 ms -> BIEN
  game.tap('rear');
  assert.equal(events.judge.at(-1).result, 'good');
  assert.equal(game.combo, 1, 'BIEN ne fait PAS monter le combo');
  const l3 = game.lines.find((l) => l.state === 'pending');
  game.distance = l3.dist;
  game.tap('rear');
  assert.equal(events.judge.at(-1).result, 'perfect');
  assert.equal(game.combo, 2, 'PARFAIT -> combo 2');
}

{
  // v1.3.4 : dépassement autorisé DÈS que la voiture est visible à l'écran (pas besoin d'attendre)
  const { game, events } = makeGame(LEVELS[0], 'pilote');
  game.start();
  game.tSame = 9999;
  game.sameDir.push({ p: game.distance + game.wheelY - 100, v: game.level.speed * 0.5, color: '#fff', w: 60, overtaken: false, grace: 0 });
  assert.equal(game.blocker, null, 'pas encore de bloqueur proche (hors BLOCK_RANGE)');
  game.swipeLeft();
  assert.equal(game.stats.overtakes, 1, "dépassement dès l'arrivée à l'écran");
  assert.equal(game.laneTarget, 0.28, 'voie de gauche visée');
  assert.ok(events.judge.some((e) => e.overtake), 'événement overtake émis');
}

{
  // v1.3.4 : piéton -> la voiture s'arrête AVANT le passage piéton, pas au milieu
  const { game } = makeGame(LEVELS[3], 'auto');
  game.start();
  game.lines = game.lines.filter((l) => l.type !== 'crosswalk'); // déterministe : un seul passage piéton
  game.spawnLine('crosswalk', 500);
  const dt = 1 / 60;
  let stoppedBefore = false;
  for (let t = 0; t < 30 && game.running; t += dt) {
    game.update(dt);
    game.render();
    if (game.autoStop && game.slow <= 0.05 && game.ped) {
      const cw = game.ped.line; // le passage piéton concerné par le piéton en cours
      if (game.lineY(cw) <= game.wheelY - 40) stoppedBefore = true; // arrêtée au moins 40 px avant la ligne
    }
  }
  assert.ok(stoppedBefore, "à l'arrêt pour le piéton, la voiture est AVANT le passage piéton");
}

// v1.3.4 : chaque skin a un modèle de voiture existant
for (const s of SKINS) {
  assert.ok(MODELS[s.model], `modèle ${s.model} existe pour le skin ${s.id}`);
}

console.log('OK - smoke test moteur : 8 scénarios sans crash, mécaniques vérifiées');
