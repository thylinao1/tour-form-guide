// Checks the pure part of src/plugins/30-guide.js (copy, tour steps, card placement) without a browser.
//   node tests/guide.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadData } from '../build.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const jsFile = path.join(here, '..', 'src', 'plugins', '30-guide.js');
const cssFile = path.join(here, '..', 'src', 'plugins', '30-guide.css');
const ctx = {};
vm.runInNewContext(fs.readFileSync(jsFile, 'utf8'), ctx);
const G = ctx.TDF_GUIDE_CORE;
const T = require('../src/engine.js');
const E = T.createEngine(loadData());

let pass = 0;
function check(name, fn) { fn(); pass += 1; console.log(`pass ${name}`); }

const CORE_VIEWS = ['race', 'outright', 'stages', 'terrain', 'jerseys', 'form', 'teams', 'h2h', 'nations', 'method'];
const ALL_VIEWS = [...CORE_VIEWS.slice(0, 9), 'bet', 'functions', 'method'];

check('welcome facts come from the real data', () => {
  const f = G.welcomeFacts(E);
  assert.equal(f.riders, 184);
  assert.equal(f.teams, 23);
  assert.equal(f.stages, 21);
  assert.equal(f.finishers, 160);
  assert.equal(f.winnerTime, 277349);
  assert.equal(f.secondGap, 264);
  assert.equal(T.fmtTime(f.winnerTime), '77h 02\' 29"');
  assert.equal(T.fmtGap(f.secondGap), '+4\' 24"');
});

check('tour skips tabs that do not exist', () => {
  assert.equal(G.stepsFor(ALL_VIEWS).length, 10);
  const core = G.stepsFor(CORE_VIEWS);
  assert.equal(core.length, 8);
  assert.ok(!core.some((s) => s.view === 'bet' || s.view === 'functions'));
  assert.equal(core[0].view, 'race');
  assert.equal(core[core.length - 1].target[0], '.gd-help-btn');
});

check('every tour step has a known tab, selectors and two short sentences', () => {
  G.TOUR.forEach((s) => {
    assert.ok(s.view === null || ALL_VIEWS.includes(s.view), s.view);
    assert.ok(s.target.length > 0);
    assert.equal((s.text.match(/[.!?](\s|$)/g) || []).length, 2, s.title);
    assert.ok(s.text.length <= 170, `${s.title} is too long`);
  });
});

check('the five betting checks jump to real tabs, falling back to head-to-head', () => {
  assert.equal(G.BET_STEPS.length, 5);
  G.BET_STEPS.forEach((s) => assert.ok(G.pickJump(s.go, ALL_VIEWS), s.title));
  const last = G.BET_STEPS[4];
  assert.deepEqual([...G.pickJump(last.go, ALL_VIEWS)], ['bet', null]);
  assert.deepEqual([...G.pickJump(last.go, CORE_VIEWS)], ['h2h', null]);
  assert.match(G.LIMITS, /not a forecast/);
});

check('glossary covers the main terms in one line each', () => {
  assert.ok(G.GLOSSARY.length >= 14);
  const terms = G.GLOSSARY.map(([t]) => t.toLowerCase()).join(' | ');
  ['general classification', 'yellow', 'green', 'polka dot', 'white', 'time trial', 'flat', 'hilly', 'mountain', 'time bonus',
    'penalty', 'adjusted time', 'peloton', 'head to head', 'fair odds', 'drill down', 'roll up'].forEach((w) => assert.ok(terms.includes(w), w));
  G.GLOSSARY.forEach(([t, d]) => { assert.ok(!/\n/.test(d)); assert.ok(d.length <= 140, t); });
});

check('no en or em dashes anywhere in the guide', () => {
  [fs.readFileSync(jsFile, 'utf8'), fs.readFileSync(cssFile, 'utf8')].forEach((txt) => assert.ok(!/[\u2013\u2014]/.test(txt)));
});

check('tour card placement stays on screen', () => {
  const vp = { width: 1440, height: 900 }, card = { width: 370, height: 220 };
  const onScreen = (p) => p.left >= 12 && p.left + card.width <= vp.width - 12 && p.top >= 12 && p.top + card.height <= vp.height - 12;
  const below = G.placeCard({ top: 100, left: 40, width: 600, height: 300 }, card, vp);
  assert.equal(below.side, 'below'); assert.equal(below.top, 414); assert.ok(onScreen(below));
  const above = G.placeCard({ top: 600, left: 1200, width: 200, height: 250 }, card, vp);
  assert.equal(above.side, 'above'); assert.equal(above.top, 366); assert.ok(onScreen(above));
  const inside = G.placeCard({ top: 80, left: 0, width: 1440, height: 800 }, card, vp);
  assert.equal(inside.side, 'inside'); assert.ok(onScreen(inside));
  const phone = G.placeCard({ top: 100, left: 0, width: 360, height: 100 }, { width: 336, height: 200 }, { width: 360, height: 740 });
  assert.equal(phone.side, 'dock'); assert.equal(phone.left, 12); assert.equal(phone.top, 528);
  assert.equal(G.placeCard(null, card, vp).side, 'dock');
});

check('spotlight ring is cut to the visible area under the masthead', () => {
  const vp = { width: 1440, height: 900 };
  const r = G.ringBox({ top: 20, left: 30, width: 400, height: 300 }, 60, vp);
  assert.equal(r.top, 60); assert.equal(r.left, 24); assert.equal(r.height, 266);
  assert.equal(G.ringBox({ top: 1200, left: 0, width: 100, height: 100 }, 60, vp), null);
});

console.log(`\n${pass} checks passed`);
