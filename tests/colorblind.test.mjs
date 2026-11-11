// Checks the colour blind palette: under simulated red-blind (protan) and green-blind (deutan) vision the
// colours that must be told apart stay clearly different. Simulation: Vienot, Brettel and Mollon (1999).
//   node tests/colorblind.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(here, '..', 'src', 'plugins', '65-colorblind.css'), 'utf8');
const base = fs.readFileSync(path.join(here, '..', 'src', 'styles.css'), 'utf8');
const tokensOf = (text) => Object.fromEntries([...text.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
const CB = tokensOf(css.slice(css.indexOf(':root.cb.cb'), css.indexOf('}', css.indexOf(':root.cb.cb'))));
const STD = tokensOf(base.slice(base.indexOf(':root {'), base.indexOf('}', base.indexOf(':root {'))));

const SIM = {
  protan: [[0.11238, 0.88762, 0], [0.11238, 0.88762, 0], [0.00401, -0.00401, 1]],
  deutan: [[0.29275, 0.70725, 0], [0.29275, 0.70725, 0], [-0.02234, 0.02234, 1]],
};
const lin = (hex) => [1, 3, 5].map((i) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
function lab(rgb) {
  const [r, g, b] = rgb.map((v) => Math.max(0, Math.min(1, v)));
  const xyz = [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883];
  const f = xyz.map((t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116));
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
}
const seen = (hex, kind) => lab(kind ? SIM[kind].map((row) => row.reduce((s, k, i) => s + k * lin(hex)[i], 0)) : lin(hex));
const dist = (a, b, kind) => Math.hypot(...seen(a, kind).map((v, i) => v - seen(b, kind)[i]));
const worstPair = (set, names, kind) => {
  let worst = { d: Infinity };
  names.forEach((a, i) => names.slice(i + 1).forEach((b) => { const d = dist(set[a], set[b], kind); if (d < worst.d) worst = { d, a, b }; }));
  return worst;
};

let pass = 0;
function check(name, fn) { fn(); pass += 1; console.log(`pass ${name}`); }
const MIN = 18; // CIE76 distance; well above the just noticeable difference (about 2.3)
const GROUPS = { terrain: ['flat', 'hilly', 'mountain', 'itt'], 'good and bad': ['good', 'bad'], 'two sides': ['a', 'b'], jerseys: ['green', 'polka'], series: ['s1', 's2', 's3', 's4', 's5', 's6'] };

check('the colour blind set defines every data colour token', () => {
  Object.values(GROUPS).flat().concat(['div-neg', 'div-pos']).forEach((t) => assert.ok(CB[t], `--${t}`));
});

for (const kind of ['protan', 'deutan']) {
  for (const [group, names] of Object.entries(GROUPS)) {
    check(`${group} colours stay apart with ${kind} vision`, () => {
      const w = worstPair(CB, names, kind);
      assert.ok(w.d >= MIN, `${w.a} and ${w.b} are only ${w.d.toFixed(1)} apart`);
    });
  }
}

check('the standard good and bad colours are the pair this mode fixes', () => {
  const before = Math.min(dist(STD.good, STD.bad, 'protan'), dist(STD.good, STD.bad, 'deutan'));
  const after = Math.min(dist(CB.good, CB.bad, 'protan'), dist(CB.good, CB.bad, 'deutan'));
  assert.ok(after > before, `before ${before.toFixed(1)}, after ${after.toFixed(1)}`);
});

console.log(`\n${pass} checks passed`);
