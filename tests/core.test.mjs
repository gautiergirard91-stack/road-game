import assert from 'node:assert/strict';
import { judge, pointsFor, buildPattern, coinsForResult, accuracy, avgReaction, continueCost, maxMissesFor, firstClearBonus, axleDelta, mulberry32 } from '../js/core.js';
import { LEVELS, WINDOWS, MAX_MISSES, CONTINUE_BASE_COST, SKINS, EFFECTS, ACHIEVEMENTS } from '../js/data.js';

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
    assert.ok(['dash', 'band', 'chevron', 'crosswalk'].includes(pattern[i].type));
    if (pattern[i].type === 'crosswalk') assert.ok(level.crosswalk, 'crosswalk uniquement dans les niveaux ville');
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

assert.equal(MAX_MISSES, 3, '3 vies avant game over');
assert.equal(continueCost(0), CONTINUE_BASE_COST);
assert.equal(continueCost(1), CONTINUE_BASE_COST * 2, 'coût doublé à chaque continue');
assert.equal(continueCost(2), CONTINUE_BASE_COST * 4);

const models = new Set(SKINS.map((s) => s.model));
assert.ok(models.has('berline') && models.has('sport') && models.has('citadine'), 'les 3 modèles de voiture sont présents');
assert.ok(SKINS.every((s) => s.model && s.color && typeof s.cost === 'number'), 'chaque skin a un modèle valide');

const pa = buildPattern(LEVELS[3], 7, 'permisA');
assert.ok(pa.every((l) => l.axle === 'front' || l.axle === 'rear'), 'permisA : chaque ligne a un essieu AV/AR');
assert.ok(pa.some((l) => l.axle === 'front') && pa.some((l) => l.axle === 'rear'), 'permisA : les deux essieux sont représentés');
const au = buildPattern(LEVELS[3], 7, 'auto');
assert.ok(au.every((l) => l.axle === 'rear'), 'auto école : tout est sur l\'essieu arrière');

assert.equal(maxMissesFor('auto'), 3, 'auto école : 3 vies');
assert.equal(maxMissesFor('permisA'), 5, 'permis A : 5 vies');
assert.equal(maxMissesFor('pilote'), 5, 'pilote : 5 vies');

let hasCrosswalk = false;
for (let s = 1; s <= 200 && !hasCrosswalk; s++) {
  if (buildPattern(LEVELS[3], s, 'auto').some((l) => l.type === 'crosswalk')) hasCrosswalk = true;
}
assert.ok(hasCrosswalk, 'niveaux ville : des passages piétons apparaissent');
assert.ok(buildPattern(LEVELS[0], 7, 'auto').every((l) => l.type !== 'crosswalk'), 'pas de passage piéton hors ville');

const wide = { perfect: 70, good: 150, passable: 240 };
assert.equal(judge(60, wide), 'perfect', 'fenêtres élargies : 60 ms = PARFAIT');
assert.equal(judge(60), 'good', 'fenêtres standard : 60 ms = BIEN');
assert.equal(judge(200, wide), 'passable');
assert.equal(judge(200), null);

assert.equal(firstClearBonus(LEVELS[0]), 300, 'bonus premier clear niveau 1');
assert.ok(firstClearBonus(LEVELS[11]) > firstClearBonus(LEVELS[0]), 'bonus croissant avec le niveau');
assert.ok(LEVELS.slice(0, 3).every((l) => l.theme === 'autoroute' && l.lines <= 20), 'niveaux autoroute raccourcis (parties rapides)');
assert.ok(LEVELS[0].lines <= 10 && LEVELS[0].speed >= 260, 'niveau 1 très court et un peu plus rapide');

assert.equal(LEVELS.length, 15, '15 niveaux (12 + 13/14/15)');
assert.ok(SKINS.length >= 10, 'au moins 10 voitures');
assert.ok(EFFECTS.some((e) => e.id === 'fire'), 'effet feu présent');
assert.ok(ACHIEVEMENTS.length >= 13, 'au moins 13 succès');
assert.ok(new Set(LEVELS.map((l) => l.theme)).size >= 7, 'au moins 7 thèmes utilisés par les niveaux');

assert.equal(axleDelta(800, 700, 'rear'), 0, 'essieu arrière : delta nul');
assert.equal(axleDelta(800, 700, 'front'), 100, 'essieu avant : delta = écart AV/AR (ici 100 px)');
assert.ok(axleDelta(800, 702, 'front') >= 70, 'écart AV/AR suffisant pour séparer les deux taps (> 70 px)');

console.log('OK - tous les tests passent (' + LEVELS.length + ' niveaux vérifiés)');
