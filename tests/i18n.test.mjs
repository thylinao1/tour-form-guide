// Checks the language plugin: the lookup key, number slots, and the translation files themselves.
//   node tests/i18n.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = { window: {}, console };
vm.runInNewContext(fs.readFileSync(path.join(here, '..', 'src', 'plugins', '70-i18n.js'), 'utf8'), ctx);
const L = ctx.window.TDF_LANG;
const load = (lang) => JSON.parse(fs.readFileSync(path.join(here, '..', 'i18n', `${lang}.json`), 'utf8'));

let pass = 0;
function check(name, fn) { fn(); pass += 1; console.log(`pass ${name}`); }

check('numbers become # in the lookup key, spaces are tidied', () => {
  assert.equal(L.key('  Stage 12 ·  209.1 km '), 'Stage # · # km');
  assert.equal(L.key('Pogacar won by 4\' 24"'), 'Pogacar won by #\' #"');
  assert.equal(L.key('1,234 riders'), '# riders');
});

check('numbers go back into the slots in order, outer spaces are kept', () => {
  const dict = { 'Stage # · # km': 'Etapa # · # km', '# of # stages': '# de # etapas' };
  assert.equal(L.translate(' Stage 12 · 209.1 km ', dict), ' Etapa 12 · 209.1 km ');
  assert.equal(L.translate('13 of 21 stages', dict), '13 de 21 etapas');
});

check('numbered slots let a translation change the order of the numbers', () => {
  const dict = { 'Top # of each classification after stage #': '第 {2} 赛段后各榜的前 {1} 名' };
  assert.equal(L.translate('Top 10 of each classification after stage 21', dict), '第 21 赛段后各榜的前 10 名');
});

check('text without an entry stays as it is (null means keep the English)', () => {
  assert.equal(L.translate('Nothing here', { other: 'x' }), null);
  assert.equal(L.translate('   ', { '': 'x' }), null);
  assert.equal(L.translate('Stage 3', null), null);
});

check('without a page the plugin reports English and refuses to switch', () => {
  assert.equal(L.get(), 'en');
  assert.equal(L.set('es'), false);
});

check('number runs are wrapped in left to right marks for Arabic, the letters around them are not', () => {
  const out = L.isolateNumbers('خلف +4\' 24" في المجموع');
  assert.equal(out, 'خلف \u2066+4\' 24"\u2069 في المجموع');
  assert.equal(L.isolateNumbers('المرحلة 12'), 'المرحلة \u206612\u2069');
  assert.equal(L.isolateNumbers('بدون أرقام'), 'بدون أرقام');
});

const source = JSON.parse(fs.readFileSync(path.join(here, '..', 'i18n', 'strings.json'), 'utf8'));
const DASH = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
const SCRIPT = { hi: /[\u0900-\u097F]/, zh: /[\u4E00-\u9FFF]/, ar: /[\u0600-\u06FF]/, he: /[\u0590-\u05FF]/, es: /[a-záéíóúñü]/i, fr: /[a-zàâçéèêëîïôûùüœ]/i };
for (const lang of ['hi', 'es', 'fr', 'zh', 'ar', 'he']) {
  const dict = load(lang);
  check(`${lang}: at least 95% of the text has a translation, and no entry is unknown`, () => {
    const have = source.filter((s) => typeof dict[s] === 'string' && dict[s].trim()).length;
    assert.ok(have >= source.length * 0.95, `${have} of ${source.length}`);
    Object.keys(dict).forEach((k) => assert.ok(source.includes(k), `unknown key: ${k}`));
  });
  check(`${lang}: every translation keeps its number slots and has no long dash`, () => {
    for (const [k, v] of Object.entries(dict)) {
      const slots = k.split('#').length - 1;
      const numbered = (v.match(/\{\d+\}/g) || []).map((x) => Number(x.slice(1, -1))).sort((a, b) => a - b);
      if (numbered.length) assert.deepEqual(numbered, Array.from({ length: slots }, (_, i) => i + 1), `numbered slots: ${k}`);
      else assert.equal(v.split('#').length - 1, slots, `number slots: ${k}`);
      if (slots >= 2) assert.ok(numbered.length, `two or more numbers need numbered slots: ${k}`);
      assert.ok(!DASH.test(v), `dash: ${k}`);
    }
  });
  check(`${lang}: the translations are written in the right script`, () => {
    const long = Object.entries(dict).filter(([k]) => k.split(' ').length >= 4);
    const right = long.filter(([, v]) => SCRIPT[lang].test(v)).length;
    assert.ok(right >= long.length * 0.97, `${right} of ${long.length}`);
  });
}

check('Arabic and Hebrew are the right to left languages', () => {
  assert.deepEqual([...L.rtl], ['ar', 'he']);
  assert.ok(L.langs.includes('fr') && L.langs.includes('he'));
});

check('betting is hidden only in Arabic and only while Halal friendly is on (the default)', () => {
  assert.equal(L.hidesBetting('ar', true), true);
  assert.equal(L.hidesBetting('ar', undefined), true);
  assert.equal(L.hidesBetting('ar', false), false);
  assert.equal(L.hidesBetting('he', true), false);
  assert.equal(L.hidesBetting('en', true), false);
});

check('Arabic has no betting words', () => {
  const words = ['مراهن', 'رهان', 'قمار', 'احتمالات الرهان', 'وكيل المراهنات'];
  const hits = Object.entries(load('ar')).filter(([, v]) => words.some((w) => v.includes(w)));
  assert.equal(hits.length, 0, hits.slice(0, 5).map(([k, v]) => `${k} => ${v}`).join(' | '));
});

console.log(`\n${pass} checks passed`);
