// Checks the pure calculations of src/plugins/20-coverage.js (E13 depth of squads, E15 the long day)
// against independent recounts from the raw tables.   node tests/coverage.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadData } from '../build.mjs';

const require = createRequire(import.meta.url);
const T = require('../src/engine.js');
const C = require('../src/plugins/20-coverage.js');
const raw = loadData();
const E = T.createEngine(raw);

let pass = 0;
function check(name, fn) { fn(); pass++; console.log(`pass ${name}`); }

check('E13 squad depth: 23 teams of 8, 184 riders, 160 reached Paris', () => {
  const rows = C.squadDepth(E);
  assert.equal(rows.length, 23);
  assert.ok(rows.every((x) => x.registered === 8));
  const total = (k) => rows.reduce((a, x) => a + x[k], 0);
  assert.equal(total('registered'), 184);
  assert.equal(total('finished'), 160);
  assert.equal(total('left'), 24);
  // two riders (Ganna, Bissegger) left during stage 1 and have no result at all
  assert.equal(total('raced'), 182);
  assert.equal(rows.find((x) => x.team === 'INEOS GRENADIERS').raced, 7);
  assert.equal(rows.find((x) => x.team === 'DECATHLON AG2R LA MONDIALE TEAM').raced, 7);
});

check('E13 squad depth matches an independent recount from the raw rider, result and exit tables', () => {
  const rows = C.squadDepth(E);
  const exited = new Set(raw.exits.map((e) => e[0]));
  const withResult = new Set(raw.results.map((r) => r[0]));
  raw.teams.forEach(([team]) => {
    const rs = raw.riders.filter((r) => r[3] === team);
    const x = rows.find((y) => y.team === team);
    assert.equal(x.registered, rs.length, `${team} registered`);
    assert.equal(x.finished, rs.filter((r) => !exited.has(r[0])).length, `${team} finished`);
    assert.equal(x.raced, rs.filter((r) => withResult.has(r[0])).length, `${team} raced`);
    assert.equal(x.nations, new Set(rs.map((r) => r[4])).size, `${team} nations`);
    assert.equal(x.countries.reduce((a, c) => a + c.n, 0), 8, `${team} country counts add to 8`);
  });
});

check('E13 ranking: by finishers, then nationalities; UAE has the most nationalities (8)', () => {
  const byParis = C.sortSquads(C.squadDepth(E), 'paris');
  // five squads kept all 8 riders; among them ties go to more nationalities, so Arkea (3) is fifth
  assert.deepEqual(byParis.slice(0, 5).map((x) => x.team).sort(),
    ['ARKEA-B&B HOTELS', 'ISRAEL - PREMIER TECH', 'TEAM PICNIC POSTNL', 'TEAM VISMA | LEASE A BIKE', 'TUDOR PRO CYCLING TEAM']);
  assert.equal(byParis[4].team, 'ARKEA-B&B HOTELS');
  assert.equal(byParis[3].team, 'TEAM VISMA | LEASE A BIKE');
  assert.ok(byParis.slice(0, 5).every((x) => x.finished === 8));
  assert.ok(byParis.slice(5).every((x) => x.finished <= 7));
  for (let i = 1; i < byParis.length; i++) assert.ok(byParis[i - 1].finished >= byParis[i].finished, 'sorted by finishers');
  const byNat = C.sortSquads(C.squadDepth(E), 'nations');
  assert.equal(byNat[0].team, 'UAE TEAM EMIRATES XRG');
  assert.equal(byNat[0].nations, 8);
  assert.equal(byNat[0].bestGcBib, 1, 'Pogacar is UAE best rider');
});

check('E13 roster: UAE lists 8 riders, Pogacar first at 1st overall, age at race start', () => {
  const list = C.teamRoster(E, 'UAE TEAM EMIRATES XRG');
  assert.equal(list.length, 8);
  assert.equal(list[0].bib, 1);
  assert.equal(list[0].outcome, '1st overall');
  assert.equal(list[0].age, 26); // born 21 September 1998, raced from 5 July 2025
  const out = list.filter((r) => !r.finished);
  assert.equal(out.length, 1);
  assert.match(out[0].outcome, /^Left at stage \d+, (did not start|abandoned during the stage)$/);
  // Ganna: withdrawal on stage 1
  const ineos = C.teamRoster(E, 'INEOS GRENADIERS');
  const ganna = ineos.find((r) => r.bib === 64);
  assert.equal(ganna.outcome, 'Left at stage 1, abandoned during the stage');
  assert.equal(ganna.stagesRaced, 0);
  assert.equal(C.outcomeText({ finished: false, exitStage: 10, exitReason: 'DNS' }), 'Left at stage 10, did not start');
});

check('E15 stages by distance: stage 2 longest at 209.1 km (hilly), stage 13 time trial shortest', () => {
  const s = C.stagesByDistance(E);
  assert.equal(s.length, 21);
  assert.deepEqual([s[0].id, s[0].distance, s[0].code, s[0].lengthRank], [2, 209.1, 'hilly', 1]);
  assert.equal(s[0].start, 'Lauwin-Planque');
  assert.equal(s[0].finish, 'Boulogne-Sur-Mer');
  assert.deepEqual(s.slice(-2).map((x) => [x.id, x.code]), [[5, 'itt'], [13, 'itt']]);
  assert.equal(s[20].distance, 10.9);
  for (let i = 1; i < s.length; i++) assert.ok(s[i - 1].distance >= s[i].distance, 'sorted longest first');
  // ties keep race order: stages 16 and 18 are both 171.5 km
  const tie = s.filter((x) => x.distance === 171.5).map((x) => x.id);
  assert.deepEqual(tie, [16, 18]);
});

check('E15 leading finishers of stage 2: adjusted time = time - bonus + penalty, recomputed from raw results', () => {
  const top = C.stageLeaders(E, 2, 10);
  assert.equal(top.length, 10);
  const rawRows = raw.results.filter((r) => r[1] === 2).sort((a, b) => a[3] - b[3] || a[0] - b[0]);
  const best = Math.min(...rawRows.map((r) => r[2] - r[4] + r[5]));
  top.forEach((x, i) => {
    const r = rawRows[i];
    assert.equal(x.bib, r[0]); assert.equal(x.rank, r[3]);
    assert.equal(x.adj, r[2] - r[4] + r[5]);
    assert.equal(x.adjGap, x.adj - best);
  });
  // winner bib 106 took 10 bonus seconds; Pogacar (bib 1) 2nd with 6, 4 s behind on adjusted time
  assert.deepEqual([top[0].bib, top[0].adj, top[0].adjGap], [106, 17131, 0]);
  assert.deepEqual([top[1].bib, top[1].adjGap], [1, 4]);
  assert.deepEqual(C.stageLeaders(E, 99, 10), []);
});

console.log(`\n${pass} checks passed`);
