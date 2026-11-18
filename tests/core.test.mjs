import assert from 'node:assert/strict';
import { judge, pointsFor, buildPattern, coinsForResult, accuracy, avgReaction, mulberry32 } from '../js/core.js';
import { LEVELS, WINDOWS } from '../js/data.js';

assert.equal(judge(0), 'perfect');
assert.equal(judge(-WINDOWS.perfect), 'perfect');
assert.equal(judge(WINDOWS.perfect + 1), 'good');
assert.equal(judge(WINDOWS.good), 'good');
assert.equal(judge(WINDOWS.good + 1), 'passable');
assert.equal(judge(-WINDOWS.passable), 'passable');
assert.equal(judge(WINDOWS.passable + 1), null);
assert.equal(judge(-9999), null);

assert.equal(pointsFor('perfect', 0), 100);
assert.equal(pointsFor('good', 0), 60);
assert.equal(pointsFor('passable', 0), 25);
assert.ok(pointsFor('perfect', 10) > pointsFor('perfect', 0), 'combo augmente les points');
assert.equal(pointsFor('perfect', 100), Math.round(100 * (1 + 40 * 0.05)), 'combo plafonné à x40');

for (const level of LEVELS) {
  const pattern = buildPattern(level, 12345);
  assert.ok(pattern.length >= level.lines, `niveau ${level.id}: assez de lignes`);
  for (let i = 1; i < pattern.length; i++) {
    const gap = pattern[i].dist - pattern[i - 1].dist;
    const minGapMs = (gap / level.speed) * 1000;
    assert.ok(minGapMs > WINDOWS.passable, `niveau ${level.id}: écart jouable (${Math.round(minGapMs)} ms > ${WINDOWS.passable} ms)`);
    assert.ok(['dash', 'band', 'chevron'].includes(pattern[i].type));
  }
  assert.ok(pattern[0].dist >= 600, 'délai de départ suffisant');
  const again = buildPattern(level, 12345);
  assert.deepEqual(pattern, again, 'pattern déterministe pour une seed donnée');
}

const a = buildPattern(LEVELS[0], 1);
const b = buildPattern(LEVELS[0], 2);
assert.notDeepEqual(a, b, 'seeds différentes -> patterns différents');

const stats = { score: 800, perfects: 10, goods: 5, passables: 2, misses: 0, reactions: [30, 50, 80] };
assert.ok(coinsForResult(stats, LEVELS[0], false) > 0);
assert.ok(coinsForResult(stats, LEVELS[11], true) > coinsForResult(stats, LEVELS[0], false), 'niveau terminé rapporte plus');
assert.equal(accuracy(stats), 100);
assert.equal(accuracy({ ...stats, misses: 3 }), Math.round((17 / 20) * 100));
assert.equal(avgReaction(stats), 53);
assert.equal(avgReaction({ ...stats, reactions: [] }), null);

const r = mulberry32(42);
assert.ok(r() >= 0 && r() < 1);

console.log('OK - tous les tests passent (' + LEVELS.length + ' niveaux vérifiés)');
