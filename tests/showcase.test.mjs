// Checks the pure calculations behind the showcase plugin (podium, headline numbers, race replay, 3D grid).
// Run: node tests/showcase.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadData } from '../build.mjs';

const require = createRequire(import.meta.url);
const T = require('../src/engine.js');
const C = require('../src/plugins/40-showcase.js');
const E = T.createEngine(loadData());
const bibOf = (name) => E.riders.find((r) => r.name.includes(name)).bib;

// podium: Pogacar, Vingegaard +264 s, Lipowitz +660 s
const pod = C.podium(E);
assert.deepEqual(pod.map((p) => p.bib), [1, 11, bibOf('Lipowitz')]);
assert.equal(pod[0].cum, 277349);
assert.deepEqual(pod.map((p) => p.gap), [0, 264, 660]);

// headline numbers
const n = C.headline(E);
assert.deepEqual([n.riders, n.stages, n.finishers], [184, 21, 160]);
assert.equal(n.km, Math.round(E.stages.reduce((a, s) => a + s.distance, 0)));

// replay: final frame equals the final standings; riders who left are not ranked
const cast = C.replayCast(E);
assert.ok(cast.includes(1) && cast.includes(11));
assert.equal(new Set(cast).size, cast.length, 'cast has no duplicates');
const last = C.replayFrame(E, 21, cast);
const top10 = last.filter((f) => f.position != null && f.position <= 10).sort((a, b) => a.position - b.position);
assert.deepEqual(top10.map((f) => f.bib), E.gcTop10);
assert.equal(last.find((f) => f.bib === 11).gap, 264);
const gone = E.riders.find((r) => cast.includes(r.bib) && !r.finished);
assert.ok(gone, 'at least one top-10 rider left the race');
assert.equal(C.replayFrame(E, gone.exitStage, cast).find((f) => f.bib === gone.bib).position, null);
assert.ok(C.replayFrame(E, gone.exitStage - 1, cast).find((f) => f.bib === gone.bib).position != null, 'still ranked the stage before leaving');
// every frame ranks exactly the riders still in the race
E.stages.forEach((s) => {
  const f = C.replayFrame(E, s.id, cast);
  f.forEach((x) => assert.equal(x.position != null, E.gcAfter(s.id).some((e) => e.bib === x.bib)));
});

// 3D grid: final top 10 on all 21 stages; Pogacar's largest gap is 29 s
const g = C.raceGrid(E);
assert.equal(g.cells.length, 210);
assert.deepEqual(g.bibs, E.gcTop10);
const pog = g.cells.filter((c) => c[1] === 0);
assert.equal(Math.max(...pog.map((c) => c[3])), 29);
assert.deepEqual(g.cells.filter((c) => c[0] === 20).map((c) => c[3]), E.gcFinal.slice(0, 10).map((e) => e.gap));

console.log(`showcase tests OK (cast of ${cast.length} riders, ${g.cells.length} 3D cells)`);
