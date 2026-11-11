// Checks the terms and conditions plugin: the content, the acceptance record and when the window opens by itself.
//   node tests/terms.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = { window: {}, console, URLSearchParams };
vm.runInNewContext(fs.readFileSync(path.join(here, '..', 'src', 'plugins', '75-terms.js'), 'utf8'), ctx);
const T = ctx.window.TDF_TERMS;

let pass = 0;
function check(name, fn) { fn(); pass += 1; console.log(`pass ${name}`); }

check('eight points, each with a short title and a full sentence', () => {
  assert.equal(T.points.length, 8);
  T.points.forEach(([name, text]) => { assert.ok(name.length >= 5 && name.length <= 24, name); assert.ok(text.length > 60 && text.endsWith('.'), name); });
});

check('the points say the things a betting themed site must say', () => {
  const all = T.points.map((p) => p[1]).join(' ');
  ['cannot place a bet', 'no money', 'advice', '18 or older', 'afford to lose', 'your own browser', 'not connected to the Tour de France'].forEach((w) => assert.ok(all.includes(w), w));
});

check('an acceptance counts only for the same version and only when it says accepted', () => {
  assert.equal(T.isAccepted(JSON.stringify({ version: T.version, accepted: true }), T.version), true);
  assert.equal(T.isAccepted(JSON.stringify({ version: '2020-01-01', accepted: true }), T.version), false);
  assert.equal(T.isAccepted(JSON.stringify({ version: T.version, accepted: false }), T.version), false);
  assert.equal(T.isAccepted('not json', T.version), false);
  assert.equal(T.isAccepted(null, T.version), false);
  assert.equal(T.isAccepted('null', T.version), false);
});

check('the window opens by itself on a first visit, and stays shut after acceptance or with a recording switch', () => {
  assert.equal(T.shouldOpen('', false), true);
  assert.equal(T.shouldOpen('?lang=es', false), true);
  assert.equal(T.shouldOpen('', true), false);
  assert.equal(T.shouldOpen('?terms=0', false), false);
  assert.equal(T.shouldOpen('?welcome=0', false), false);
  assert.equal(T.shouldOpen('?tour=1', false), false);
  assert.equal(T.shouldOpen('?smoke=1&click=.x', false), false);
});

check('without a page, open does nothing and reports false', () => { assert.equal(T.open(), false); });

const DASH = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
check('no em dash or en dash in any text', () => { T.texts().forEach((t) => assert.ok(!DASH.test(t), t)); });

console.log(`\n${pass} checks passed`);
