// Checks the pure parts of the enlarged route map plugin: the map projection and the label placement.
//   node tests/routemap.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { loadData } from '../build.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = { window: {}, console };
vm.runInNewContext(fs.readFileSync(path.join(here, '..', 'src', 'plugins', '45-routemap.js'), 'utf8'), ctx);
const M = ctx.window.TDF_ROUTEMAP;
const REL = { bbox: [-5.4, 41.9, 8.6, 51.6], w: 1600, h: 1618 };

let pass = 0;
function check(name, fn) { fn(); pass += 1; console.log(`pass ${name}`); }
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

check('corners of the image map to the corners of the box', () => {
  assert.deepEqual([...M.project([-5.4, 51.6], REL)], [0, 0]);
  const [x, y] = M.project([8.6, 41.9], REL);
  assert.ok(Math.abs(x - 1600) < 1e-9 && Math.abs(y - 1618) < 1e-9);
});

check('north is up and east is right', () => {
  const lille = M.project([3.06, 50.64], REL), toulouse = M.project([1.44, 43.6], REL);
  assert.ok(lille[1] < toulouse[1], 'Lille is above Toulouse');
  assert.ok(lille[0] > toulouse[0], 'Lille is to the right of Toulouse');
});

check('every stage town of the real data falls inside the image', () => {
  const { geo, stages } = loadData();
  stages.forEach((s) => [s[4], s[5]].forEach((town) => {
    const [x, y] = M.project(geo.places[town], REL);
    assert.ok(x > 20 && x < REL.w - 20 && y > 20 && y < REL.h - 20, `${town} at ${x.toFixed(0)}, ${y.toFixed(0)}`);
  }));
});

check('two labels at nearly the same point do not overlap', () => {
  const pts = [{ x: 400, y: 400, text: 'Loudenvielle', fs: 27 }, { x: 404, y: 402, text: 'Peyragudes', fs: 27 }];
  const out = M.placeLabels(pts, [], REL);
  const box = (l) => { const w = l.text.length * l.fs * 0.56; const x = l.anchor === 'start' ? l.tx : l.anchor === 'end' ? l.tx - w : l.tx - w / 2; return { x, y: l.ty - l.fs, w, h: l.fs }; };
  assert.ok(!hit(box(out[0]), box(out[1])), 'boxes are apart');
});

check('a label next to the right edge is placed to the left of its point', () => {
  const [l] = M.placeLabels([{ x: 1590, y: 800, text: 'Pontarlier', fs: 27 }], [], REL);
  assert.equal(l.anchor, 'end');
});

check('a label avoids a blocked box', () => {
  const [l] = M.placeLabels([{ x: 500, y: 500, text: 'Toulouse', fs: 27 }], [{ x: 505, y: 470, w: 300, h: 60 }], REL);
  assert.notEqual(l.anchor, 'start');
});

console.log(`\n${pass} checks passed`);
