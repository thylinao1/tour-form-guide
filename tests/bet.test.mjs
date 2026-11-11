// Checks the Bet builder calculations (src/plugins/50-bet.js) against real 2025 numbers.
//   node tests/bet.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadData } from '../build.mjs';

const require = createRequire(import.meta.url);
const T = require('../src/engine.js');
const B = require('../src/plugins/50-bet.js');
const data = loadData();
const E = T.createEngine(data);
const WX = B.weatherMap(data.weather);
const ids = (f) => B.filterStages(E.stages, WX, f).map((s) => s.id);
const TL = (c) => T.TERRAIN_LABEL[c];

let pass = 0;
function check(name, fn) { fn(); pass++; console.log(`pass ${name}`); }

check('slice: all stages, terrain, week and weather', () => {
  assert.equal(ids({}).length, 21);
  assert.deepEqual(ids({ terrain: 'itt' }), [5, 13]);
  assert.deepEqual(ids({ week: 3 }), [16, 17, 18, 19, 20, 21]);
  assert.deepEqual(ids({ conds: ['wet'] }), [10, 14, 17, 18, 19, 20, 21]);
  assert.deepEqual(ids({ conds: ['hot'] }), [7, 8, 9, 11, 15]);
  assert.deepEqual(ids({ conds: ['windy'] }), [1, 2, 3, 9, 10]);
  assert.deepEqual(ids({ conds: ['wet'], week: '3' }), [17, 18, 19, 20, 21]);
  assert.deepEqual(ids({ conds: ['hot', 'windy'] }), [9]);
  assert.deepEqual(ids({ terrain: 'itt', conds: ['hot'] }), []);
  const mountain = E.stages.filter((s) => s.code === 'mountain').map((s) => s.id);
  assert.deepEqual(ids({ terrain: 'mountain' }), mountain);
});

check('rider record: Pogacar ahead of Vingegaard on 18 of 21', () => {
  const rec = B.riderRecord(E, 1, 11, B.filterStages(E.stages, WX, {}));
  assert.equal(rec.common, 21);
  assert.equal(rec.aAhead, 18);
  assert.equal(rec.bAhead, 3);
  assert.equal(rec.level, 0);
  const swapped = B.riderRecord(E, 11, 1, B.filterStages(E.stages, WX, {}));
  assert.equal(swapped.aAhead, 3);
  assert.equal(swapped.bAhead, 18);
});

check('rider record: median gap and average place match a manual count', () => {
  const rec = B.riderRecord(E, 1, 11, E.stages);
  const a = new Map(E.byRider.get(1).map((x) => [x.stage, x])), b = new Map(E.byRider.get(11).map((x) => [x.stage, x]));
  const gaps = E.stages.map((s) => a.get(s.id).time - b.get(s.id).time).sort((x, y) => x - y);
  assert.equal(rec.medianGap, gaps[10]);
  const avgA = E.stages.reduce((t, s) => t + a.get(s.id).rank, 0) / 21;
  assert.ok(Math.abs(rec.avgRankA - avgA) < 1e-9);
  assert.ok(rec.medianGap <= 0, 'Pogacar is not slower than Vingegaard on the median stage');
});

check('rider record: a rider who left early only counts shared stages', () => {
  const out = E.riders.find((r) => r.exitStage != null && r.starts > 0);
  const rec = B.riderRecord(E, out.bib, 1, E.stages);
  assert.equal(rec.common, out.starts);
  const none = E.riders.find((r) => r.starts === 0);
  if (none) assert.equal(B.riderRecord(E, none.bib, 1, E.stages).common, 0);
});

check('team record: best placed rider per team', () => {
  const [ta, tb] = [E.TEAMCLASS.list[0].team, E.TEAMCLASS.list[1].team];
  const rec = B.teamRecord(E, ta, tb, E.stages);
  assert.equal(rec.common, 21);
  assert.equal(rec.aAhead + rec.bAhead + rec.level, 21);
  const best = (team, sid) => Math.min(...E.byStage.get(sid).filter((x) => E.riderByBib.get(x.bib).team === team).map((x) => x.rank));
  rec.rows.forEach((r) => { assert.equal(r.rankA, best(ta, r.stage)); assert.equal(r.rankB, best(tb, r.stage)); });
  assert.equal(B.teamBest(E, E.riderByBib.get(1).team, 4).rank, best(E.riderByBib.get(1).team, 4));
});

check('share, fair odds and confidence', () => {
  assert.equal(B.historyShare(18, 21), 19 / 23);
  assert.ok(Math.abs(B.fairOdds(19 / 23) - 23 / 19) < 1e-12);
  assert.equal(B.historyShare(0, 0), 0.5);
  assert.equal(B.historyShare(2, 2), 0.75);
  assert.equal(B.fairOdds(0), null);
  assert.equal(B.confidence(0).label, 'very thin');
  assert.equal(B.confidence(3).label, 'very thin');
  assert.equal(B.confidence(4).label, 'thin');
  assert.equal(B.confidence(7).label, 'thin');
  assert.equal(B.confidence(8).label, 'fair');
  assert.equal(B.confidence(21).level, 3);
});

check('verdict sentences are plain and dash free', () => {
  const mtn = B.filterStages(E.stages, WX, { terrain: 'mountain' });
  const rec = B.riderRecord(E, 1, 11, mtn);
  const v = B.verdictText(rec, ['Pogacar', 'Vingegaard'], { terrain: 'mountain' }, TL);
  assert.match(v, new RegExp(`^On 2025 mountain stages Pogacar finished ahead of Vingegaard on ${rec.aAhead} of ${rec.common}\\. That is `));
  const empty = B.verdictText(B.riderRecord(E, 1, 11, []), ['Pogacar', 'Vingegaard'], { terrain: 'itt', conds: ['hot'] }, TL);
  assert.match(empty, /never both finished/);
  assert.equal(B.scopePhrase({ terrain: 'itt', conds: ['wet'], week: 3 }, TL), 'wet time trial stages in week 3');
  [v, empty].forEach((s) => assert.ok(!/[\u2013\u2014]/.test(s), 'no en or em dash'));
});

check('checklist dots: a level record never shows a signal as pointing the other way', () => {
  // Pogacar against Vingegaard on flat stages in week 1 is level at 2 to 2.
  const flatW1 = B.filterStages(E.stages, WX, { terrain: 'flat', week: 1 });
  const rec = B.riderRecord(E, 1, 11, flatW1);
  assert.equal(rec.aAhead, rec.bAhead, 'flat week 1 is a level record');
  const fav = rec.aAhead > rec.bAhead ? 'A' : rec.bAhead > rec.aAhead ? 'B' : null;
  assert.equal(fav, null);
  assert.equal(B.signalDot('A', fav), 'level');
  assert.equal(B.signalDot('B', fav), 'level');
  assert.equal(B.signalDot(null, fav), 'grey');
  assert.equal(B.signalDot('A', 'A'), 'green');
  assert.equal(B.signalDot('B', 'A'), 'amber');
});

console.log(`\n${pass} checks passed`);
