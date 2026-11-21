import assert from 'node:assert/strict';

// Test de bout en bout du tutoriel en headless : on conduit la classe Tutorial
// avec un faux joueur (taps parfaits, swipes, curseur poussé à fond) et on
// vérifie que le tuto va jusqu'au bout — notamment après le passage piéton.

// --- stubs navigateur minimaux ---
Object.defineProperty(globalThis, 'window', {
  value: { innerWidth: 390, innerHeight: 844, devicePixelRatio: 2, matchMedia: () => ({ matches: false }) },
  configurable: true,
});
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.document = {
  getElementById: () => null,
  createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, addEventListener() {} }),
};
// temps simulé : les durées du tuto (minTime, fallback 12 s) utilisent performance.now()
let simNow = 0;
Object.defineProperty(globalThis, 'performance', { value: { now: () => simNow }, configurable: true });
// setTimeout immédiat (le fallback 0,5 s du missStep)
globalThis.setTimeout = (fn) => {
  fn();
  return 0;
};
// random déterministe (spawn piéton, pattern…) pour un test reproductible
let rngSeed = 42;
Math.random = () => {
  rngSeed = (rngSeed * 1103515245 + 12345) & 0x7fffffff;
  return rngSeed / 0x7fffffff;
};

const { Game } = await import('../js/game.js');
const { Tutorial } = await import('../js/tutorial.js');
const { ENDLESS_LEVEL, WINDOWS } = await import('../js/data.js');
const store = await import('../js/store.js');
store.load(); // comme main.js au démarrage

const TUT_LEVEL = { ...ENDLESS_LEVEL, id: 0, name: 'Tutoriel', speed: 230, gapMin: 540, gapMax: 720, w: { dash: 1 }, pDouble: 0, endless: true };

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

const els = {
  text: { textContent: '' },
  dots: { textContent: '' },
  read: { classList: { add() {}, remove() {} } },
  slider: { value: 0, addEventListener() {}, dispatchEvent() {}, getBoundingClientRect: () => ({ left: 0, width: 100 }) },
  quit: { addEventListener() {} },
};

let tut = null;
let done = false;
let quit = false;
const game = new Game(makeCanvas(), {
  level: TUT_LEVEL,
  mode: 'auto',
  tutorial: true,
  skinId: 'default',
  effects: [],
  audio: {},
  windows: WINDOWS,
  access: {},
  onJudge: (e) => tut?.onJudge(e),
  onMiss: () => tut?.onMiss(),
  onThreshold: () => {},
  onEnd: () => {},
});
game.start();
tut = new Tutorial(game, els, () => { done = true; }, () => { quit = true; });

const dt = 1 / 60;
let simT = 0;
const stepLog = [];
let cwMissedOnce = false; // v1.3.26 : on rate volontairement le 1er passage piéton
while (!done && !quit && simT < 240) {
  simT += dt;
  simNow = simT * 1000;
  if (tut.reading) tut.endRead(); // le joueur pousse le curseur jusqu'au bout
  const s = tut.steps[tut.i];
  const isCwStep = s && s.respawn;
  // v1.3.26 : dès que le 1er passage piéton est résolu (raté), on considère le raté fait
  if (isCwStep && !cwMissedOnce && game.lines.some((l) => l.type === 'crosswalk' && l.state === 'resolved')) cwMissedOnce = true;
  for (const axle of game.axles) {
    for (const line of game.lines) {
      if (line.state !== 'pending' || line.hits[axle]) continue;
      // étape "raté volontaire" : on laisse passer la 1ère ligne exprès
      if (s && s.missStep && !tut.missed && line === game.lines.find((l) => l.state === 'pending')) continue;
      // v1.3.26 : on laisse passer le 1er passage piéton exprès (il doit être respawn)
      if (isCwStep && line.type === 'crosswalk' && !cwMissedOnce) continue;
      const d = game.distance - line.dist + game.axleDelta(axle);
      if (Math.abs(d) < 25) game.tap(axle);
    }
  }
  if (game.blocker && !game.blocker.overtaken && game.carXFrac > 0.6) game.swipeLeft();
  game.update(dt);
  game.render();
  tut.tick();
  if (!stepLog.length || stepLog[stepLog.length - 1] !== tut.i) stepLog.push(tut.i);
}

console.log('étapes parcourues :', stepLog.join(' → '), '| terminé =', done, '| simT =', simT.toFixed(1) + 's');
assert.ok(!quit, 'le tutoriel n\'a pas été quitté');
assert.ok(done, `le tutoriel va jusqu'au bout sans se coincer (bloqué étape ${tut.i}/${tut.steps.length})`);
assert.ok(stepLog.includes(7), 'étape passage piéton (index 7) atteinte');
assert.ok(stepLog.indexOf(7) < stepLog.length - 1, 'étape SUIVANTE atteinte après le passage piéton (pas coincé dessus)');
console.log(`(info) 1er passage piéton raté volontairement dans ce run : ${cwMissedOnce}`);

// v1.3.26 : test unitaire déterministe du respawn — s'il ne reste aucun passage piéton
// en attente pendant l'étape, tick() doit en respawn un (anti-blocage)
{
  const fakeGame = {
    lines: [],
    tutHold: false,
    spawnLine(type, d) {
      this.lines.push({ type, dist: d, state: 'pending', hits: { front: null, rear: null } });
    },
  };
  const t2 = new Tutorial(fakeGame, els, () => {}, () => {});
  t2.i = 7; // étape passage piéton
  t2.reading = false;
  t2.stepStart = performance.now();
  t2.tick();
  assert.ok(fakeGame.lines.some((l) => l.type === 'crosswalk' && l.state === 'pending'), 'respawn : un passage piéton est recréé si plus aucun en attente');
  // et si un passage piéton est déjà en attente, on ne double pas
  const n = fakeGame.lines.length;
  t2.tick();
  assert.equal(fakeGame.lines.length, n, 'pas de respawn en double si un passage piéton est déjà là');
}
console.log('OK - tutoriel headless : toutes les étapes enchaînées jusqu\'à la fin + respawn du passage piéton vérifié');
