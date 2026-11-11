// Checks the Function map plugin: the 15 views and their fixed tabs, the four ways to explore,
// step navigation, the headline numbers against the real 2025 data, and the no-dash wording rule.
//   node tests/functions.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadData } from '../build.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const plugin = (ext) => fs.readFileSync(path.join(here, '..', 'src', 'plugins', `10-functions.${ext}`), 'utf8');

// run the plugin without a page: it must still expose its pure parts
const ctx = { window: {}, console };
vm.runInNewContext(plugin('js'), ctx);
const F = ctx.window.TDF_FUNCTIONS;

let pass = 0;
function check(name, fn) { fn(); pass += 1; console.log(`pass ${name}`); }

const FIXED_VIEW = { E1: 'outright', E2: 'stages', E3: 'teams', E4: 'jerseys', E5: 'terrain', E6: 'terrain', E7: 'outright', E8: 'nations',
  E9: 'nations', E10: 'outright', E11: 'stages', E12: 'form', E13: 'teams', E14: 'teams', E15: 'stages' };

check('15 views, E1 to E15 in order, each on its fixed tab', () => {
  assert.equal(F.list.length, 15);
  F.list.forEach((f, i) => {
    assert.equal(f.code, `E${i + 1}`);
    assert.equal(f.view, FIXED_VIEW[f.code], `${f.code} view`);
    ['title', 'brief', 'see', 'say'].forEach((k) => assert.ok(f[k] && f[k].length > 5, `${f.code} ${k}`));
    assert.ok(f.ops.length >= 1 && f.ops.every((o) => F.ops[o]), `${f.code} ops`);
  });
});

check('four ways to explore, each with a link', () => {
  assert.equal(F.explore.map((r) => r.key).join(','), 'drill,jerseys,times,countries');
  F.explore.forEach((r) => assert.ok(r.links.length >= 1 && r.links.every((l) => l.action || l.view), `explore ${r.key}`));
});

check('no assignment wording in the text shown on the page', () => {
  const shown = F.list.flatMap((f) => [f.title, f.see, f.say]).concat(F.explore.flatMap((r) => [r.title, r.how, ...r.links.map((l) => l.label)]));
  shown.forEach((t) => assert.ok(!/lecturer|brief|prompt|task 3|requirement|assignment/i.test(t), t));
  const code = plugin('js').replace(/brief: '[^']*',/g, '');
  ['lecturer', 'Task 3', 'requirements met', 'prompts covered', 'the brief'].forEach((w) => assert.ok(!code.includes(w), w));
});

check('the five OLAP moves are all defined and all used', () => {
  assert.equal(Object.keys(F.ops).sort().join(','), 'dice,drill,pivot,rollup,slice');
  const used = new Set(F.list.flatMap((f) => f.ops));
  Object.keys(F.ops).forEach((k) => assert.ok(used.has(k), `${k} used`));
});

check('step navigation stays inside 0 to 14', () => {
  assert.equal(F.stepIndex(0, -1, 15), 0);
  assert.equal(F.stepIndex(0, 1, 15), 1);
  assert.equal(F.stepIndex(14, 1, 15), 14);
  assert.equal(F.stepIndex(7, 0, 15), 7);
});

check('without the app, start and stop do nothing and report false', () => {
  assert.equal(F.start(0), false);
  assert.equal(F.stop(), false);
});

check('headline numbers match the 2025 data', () => {
  const T = require('../src/engine.js');
  const E = T.createEngine(loadData());
  const fx = { name: (b) => E.riderByBib.get(b).name, team: (t) => t, gap: (s) => T.fmtGap(s).slice(1), ordinal: (n) => `${n}th` };
  const facts = F.facts(E, fx);
  assert.equal(Object.keys(facts).length, 15, 'one fact per view');
  assert.match(facts.E1, /Poga.ar won by 4' 24"/);
  assert.equal(facts.E2, '21 stages to explore');
  assert.equal(facts.E5, '6 mountain stages');
  assert.equal(facts.E8, 'France: 38 riders, 5 teams');
  assert.equal(facts.E11, 'Stages 5 and 13');
  assert.match(facts.E12, /Poga.ar: 13 top ten finishes/);
  assert.equal(facts.E13, '23 teams, 184 riders');
  assert.equal(facts.E15, 'Stage 2, 209.1 km, Lauwin-Planque to Boulogne-Sur-Mer');
  assert.match(facts.E4, /Lipowitz, 3th overall/);
  const kmh = Number(facts.E6.match(/([\d.]+) km\/h/)[1]);
  assert.ok(kmh > 35 && kmh < 60, `plausible top speed ${kmh}`);
});

// en dash and em dash, built from char codes so this file contains neither character
const DASH = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
check('no em dash or en dash in the plugin files', () => {
  ['js', 'css'].forEach((ext) => assert.ok(!DASH.test(plugin(ext)), `10-functions.${ext}`));
  const text = F.list.flatMap((f) => [f.title, f.brief, f.see, f.say]).concat(F.explore.flatMap((r) => [r.title, r.how]));
  text.forEach((t) => assert.ok(!DASH.test(t), t));
});

console.log(`\n${pass} checks passed`);
