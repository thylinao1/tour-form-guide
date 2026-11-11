/* Languages: English (the source text), Hindi, Spanish, French, Chinese, Arabic and Hebrew.
   Arabic and Hebrew are shown right to left.
   The page is written in English. This plugin swaps the text that is on screen for the chosen language and
   keeps doing so as the page draws new parts. Text without a translation stays in English.
   Numbers are looked up as "#", so "Stage 4" and "Stage 12" share one entry ("Stage #"). A text with two or more
   numbers is translated with numbered slots ({1}, {2}), so each number lands in the right place.
   In Arabic the betting parts are switched off: the Bet builder tab and the betting panels are hidden.
   Dictionaries arrive as window.TDF_I18N = { hi: {...}, es: {...}, ... } (built from i18n/*.json).
   Exposes window.TDF_LANG = { get, set, translate, key }. */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const NUM = /\d+(?:[.,]\d+)*/g;
  const BET = /\b(bet|bets|betting|bettor)\b/i;
  const LANGS = [['en', 'English'], ['hi', 'हिन्दी'], ['es', 'Español'], ['fr', 'Français'], ['zh', '中文'], ['ar', 'العربية'], ['he', 'עברית']];
  const RTL = ['ar', 'he'];
  const NO_BET_NOTE = 'المراهنة غير متاحة في النسخة العربية. تعرض هذه النسخة تحليل السباق فقط.';

  /* =================== pure helpers (tested in tests/i18n.test.mjs) =================== */
  /** The lookup key of a piece of text: single spaces, no outer space, every number written as "#". */
  const key = (text) => text.replace(/\s+/g, ' ').trim().replace(NUM, '#');
  /** Translate one piece of text with a dictionary, or return null when there is no entry.
      The numbers of the original are put back: into numbered slots ({1} = first number of the English, {2} = second)
      when the translation has them, because another language may need the numbers in another order;
      otherwise into the "#" slots in order. Outer spaces are kept. */
  function translate(text, dict) {
    if (!dict || !text) return null;
    const core = text.replace(/\s+/g, ' ').trim();
    if (!core) return null;
    const hit = dict[core.replace(NUM, '#')];
    if (typeof hit !== 'string') return null;
    const nums = core.match(NUM) || [];
    let i = 0;
    const out = /\{\d+\}/.test(hit)
      ? hit.replace(/\{(\d+)\}/g, (m, k) => (nums[k - 1] != null ? nums[k - 1] : m))
      : hit.replace(/#/g, () => (i < nums.length ? nums[i++] : '#'));
    return text.match(/^\s*/)[0] + out + text.match(/\s*$/)[0];
  }

  /** In right to left text (Arabic, Hebrew) a time such as +4' 24" would be drawn back to front. Wrapping each number run
      (digits with their signs, quotes and units) in left to right isolate marks keeps it in order. */
  const NUMBER_RUN = /[+\-\u2212]?\d[\d\s'"\u2032\u2033:.,%hms]*[\d'"\u2032\u2033%hms]|\d/g;
  const isolateNumbers = (text) => text.replace(NUMBER_RUN, (m) => `\u2066${m}\u2069`);

  const API = { get: () => 'en', set: () => false, translate, key, isolateNumbers, langs: LANGS.map((l) => l[0]), rtl: RTL };
  W.TDF_LANG = API;
  if (!W.document) return;

  const DICT = W.TDF_I18N || {};
  const STORE = 'tdf-lang';
  const ATTRS = ['title', 'aria-label', 'placeholder'];
  const root = document.documentElement;
  const texts = new WeakMap(); // text node -> { orig, shown }
  const attrs = new WeakMap(); // element -> { attribute: { orig, shown } }
  let lang = 'en';

  const skipped = (el) => !!el.closest('script, style, svg, pre, code, [data-no-i18n]');

  /* =================== swapping text =================== */
  function doText(node) {
    const p = node.parentElement;
    if (!p || skipped(p)) return;
    const cur = node.nodeValue;
    let st = texts.get(node);
    if (!st || cur !== st.shown) st = { orig: cur, shown: cur }; // new text, or the page changed it
    const t = lang === 'en' ? null : translate(st.orig, DICT[lang]);
    st.shown = t == null ? st.orig : t;
    if (RTL.includes(lang)) st.shown = isolateNumbers(st.shown);
    texts.set(node, st);
    if (cur !== st.shown) node.nodeValue = st.shown;
    if (p.firstChild === node) p.dataset.i18nOrig = st.orig.replace(/\s+/g, ' ').trim(); // lets page code still find things by their English text
    markBet(p, st.orig);
  }
  function doAttrs(el) {
    if (skipped(el)) return;
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const m = attrs.get(el) || {};
      attrs.set(el, m);
      const cur = el.getAttribute(a);
      if (!m[a] || cur !== m[a].shown) m[a] = { orig: cur, shown: cur };
      const t = lang === 'en' ? null : translate(m[a].orig, DICT[lang]);
      m[a].shown = t == null ? m[a].orig : t;
      if (cur !== m[a].shown) el.setAttribute(a, m[a].shown);
    }
  }
  /** Mark the betting parts, so the Arabic version can hide them: a panel whose title is about betting,
      and any button, link or menu item whose own text is. */
  function markBet(parent, orig) {
    if (!BET.test(orig)) return;
    const heading = parent.closest('h2');
    const panel = heading && heading.closest('.panel');
    if (panel) { panel.dataset.bet = '1'; return; }
    const item = parent.closest('button, a');
    if (item && !item.closest('.tabs')) item.dataset.bet = '1';
  }
  function walk(node) {
    if (node.nodeType === 3) { doText(node); return; }
    if (node.nodeType !== 1) return;
    doAttrs(node);
    const tw = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  const watcher = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'childList') m.addedNodes.forEach(walk);
      else if (m.type === 'characterData') doText(m.target);
      else doAttrs(m.target);
    }
  });

  /* =================== choosing a language =================== */
  const read = () => { try { return localStorage.getItem(STORE); } catch (e) { return null; } };
  const write = (v) => { try { localStorage.setItem(STORE, v); } catch (e) { /* private mode: the choice lasts for this visit only */ } };
  const noBet = () => lang === 'ar';
  function leaveBetTab() { if (noBet() && location.hash === '#bet') location.hash = 'race'; }

  function set(next) {
    if (!LANGS.some((l) => l[0] === next) || (next !== 'en' && !DICT[next])) return false;
    lang = next;
    root.lang = next;
    root.dir = RTL.includes(next) ? 'rtl' : 'ltr';
    root.classList.toggle('no-bet', noBet());
    watcher.disconnect();
    walk(document.body);
    if (next !== 'en') watcher.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    leaveBetTab();
    if (picker) picker.value = next;
    return true;
  }
  API.get = () => lang;
  API.set = (next) => { const ok = set(next); if (ok) write(next); return ok; };

  let picker = null;
  function addPicker() {
    const mast = document.querySelector('.mast-inner');
    if (!mast) return;
    picker = document.createElement('select');
    picker.className = 'th-btn lang-sel';
    picker.setAttribute('aria-label', 'Language');
    picker.setAttribute('data-no-i18n', '');
    LANGS.forEach(([code, name]) => {
      if (code !== 'en' && !DICT[code]) return;
      const o = document.createElement('option');
      o.value = code; o.textContent = name; o.lang = code;
      picker.appendChild(o);
    });
    picker.addEventListener('change', () => API.set(picker.value));
    const before = mast.querySelector('.cb-btn') || mast.querySelector('.th-btn') || mast.querySelector('.gd-help-btn');
    if (before) before.parentNode.insertBefore(picker, before); else mast.appendChild(picker);
    const note = document.createElement('p');
    note.className = 'no-bet-note'; note.lang = 'ar'; note.dir = 'rtl'; note.setAttribute('data-no-i18n', ''); note.textContent = NO_BET_NOTE;
    const main = document.querySelector('main') || document.body;
    main.insertBefore(note, main.firstChild);
  }

  addPicker();
  W.addEventListener('hashchange', leaveBetTab);
  const q = new URLSearchParams(location.search).get('lang');
  const start = q || read();
  if (start && start !== 'en') set(start);
})();
