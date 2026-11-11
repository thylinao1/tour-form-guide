/* Terms and conditions. The site has a betting theme, so a first-time visitor sees a short terms window and
   has to tick "18 or older" and accept before using the page. The footer link opens the same window again.
   The acceptance is remembered on this device (with the terms version, so a new version asks again).
   URL switches for recordings and tests: ?terms=0, ?welcome=0, ?tour=1 or ?smoke do not open the window by themselves.
   Exposes window.TDF_TERMS = { version, points, texts, isAccepted, shouldOpen, open }. */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const VERSION = '2026-11-11';
  const KEY = 'tdf-terms';

  /* =================== content =================== */
  const POINTS = [
    ['What this site is', 'Race Analyst is a university project by NUS BT5110 Group 31. It summarises the results of the finished 2025 Tour de France.'],
    ['No real betting', 'You cannot place a bet here. There is no money, no stake, no account and no payout. The Bet builder only compares what happened in 2025.'],
    ['Not advice', 'Nothing on this site is betting, financial or professional advice. Past results do not guarantee future results. Any decision you make is your own.'],
    ['Adults only', 'Betting themes are for adults. Use this site only if you are 18 or older, or the legal age for betting where you live if that is higher.'],
    ['Bet responsibly', 'If you bet elsewhere, set a limit and never bet money you cannot afford to lose. If betting stops being fun, stop and ask a local support service for help.'],
    ['Your data', 'This page does not ask for your name or email and has no tracking code. Your choices (language, colours, theme and this acceptance) are saved only in your own browser.'],
    ['Accuracy', 'The numbers come from the course data and the published standings listed on the Method tab. We check them, but mistakes are possible and the site is provided as it is.'],
    ['Names and marks', 'Rider, team and race names belong to their owners. This site is not connected to the Tour de France or its organisers.'],
  ];
  const UI = {
    eyebrow: 'Before you start',
    title: 'Terms and conditions',
    intro: 'Eight short points. Please read them before you use the site.',
    tick: 'I am 18 or older and I accept these terms.',
    accept: 'Accept and continue',
    close: 'Close',
    link: 'Terms and conditions',
    accepted: 'You have accepted these terms on this device.',
  };

  /* =================== pure helpers (tested in tests/terms.test.mjs) =================== */
  /** True when the stored value says this version of the terms was accepted. */
  function isAccepted(raw, version) {
    if (!raw) return false;
    try { const v = JSON.parse(raw); return !!v && v.version === version && v.accepted === true; } catch (e) { return false; }
  }
  /** Should the window open by itself? Not after acceptance, and not with a recording or test switch in the address. */
  function shouldOpen(search, accepted) {
    if (accepted) return false;
    const q = new URLSearchParams(search || '');
    return q.get('terms') !== '0' && q.get('welcome') !== '0' && q.get('tour') !== '1' && !q.has('smoke');
  }
  const texts = () => POINTS.flat().concat(Object.values(UI));

  const TERMS = { version: VERSION, points: POINTS, texts, isAccepted, shouldOpen, open: () => false };
  W.TDF_TERMS = TERMS;

  const API = W.TDF_APP;
  if (!API || !W.document) return;
  const { h } = API;

  /* =================== storage =================== */
  let acceptedNow = false; // also covers browsers where storage is blocked: the acceptance then lasts for this visit
  const read = () => { try { return W.localStorage.getItem(KEY); } catch (e) { return null; } };
  const accepted = () => acceptedNow || isAccepted(read(), VERSION);
  function remember() {
    acceptedNow = true;
    try { W.localStorage.setItem(KEY, JSON.stringify({ version: VERSION, accepted: true })); } catch (e) { /* private mode: lasts for this visit only */ }
  }

  /* =================== the window =================== */
  let dlg = null;
  let moving = false;
  /** A copy of the header language menu, because the header cannot be reached while this window is open. */
  function languageMenu() {
    const src = document.querySelector('.lang-sel');
    if (!src || !W.TDF_LANG || src.options.length < 2) return null;
    const sel = h('select', { class: 'tc-lang', 'aria-label': 'Language', 'data-no-i18n': '' });
    [...src.options].forEach((o) => sel.appendChild(h('option', { value: o.value, text: o.textContent })));
    sel.addEventListener('change', () => W.TDF_LANG.set(sel.value));
    return sel;
  }
  function build() {
    const tick = h('input', { type: 'checkbox', id: 'tc-tick' });
    const acceptBtn = h('button', { class: 'btn tc-accept', type: 'button', text: UI.accept, disabled: '' });
    const closeBtn = h('button', { class: 'btn', type: 'button', text: UI.close });
    const done = h('p', { class: 'tc-done', text: UI.accepted });
    const gate = h('div', { class: 'tc-gate' }, h('label', { class: 'tc-tick', for: 'tc-tick' }, tick, h('span', { text: UI.tick })), acceptBtn);
    const lang = languageMenu();
    const el = h('dialog', { class: 'tc-dialog', 'aria-labelledby': 'tc-title' },
      h('div', { class: 'tc-head' }, lang, h('p', { class: 'tc-eyebrow', text: UI.eyebrow }), h('h2', { id: 'tc-title', text: UI.title }), h('p', { class: 'tc-intro', text: UI.intro })),
      h('ol', { class: 'tc-list', tabindex: '0' }, POINTS.map(([name, text]) => h('li', null, h('b', { text: name }), h('span', { text }))),),
      h('div', { class: 'tc-foot' }, gate, h('div', { class: 'tc-view' }, done, closeBtn)));
    tick.addEventListener('change', () => { acceptBtn.disabled = !tick.checked; });
    acceptBtn.addEventListener('click', () => { if (!tick.checked) return; remember(); el.close(); });
    closeBtn.addEventListener('click', () => el.close());
    // Until the terms are accepted the window cannot be dismissed with Esc or a click outside it.
    // Chrome does not always let a page cancel Esc (when the visitor has not clicked yet), so a window that
    // closed without acceptance opens again. The "moving" flag covers the deliberate close and reopen below.
    el.addEventListener('cancel', (e) => { if (!accepted()) e.preventDefault(); });
    el.addEventListener('close', () => { if (!accepted() && !moving) open(); });
    el.addEventListener('click', (e) => { if (e.target === el && accepted()) el.close(); });
    document.body.appendChild(el);
    return { el, tick, acceptBtn, closeBtn, lang };
  }
  function open() {
    if (!dlg) dlg = build();
    const gated = !accepted();
    dlg.el.classList.toggle('gated', gated);
    dlg.tick.checked = false;
    dlg.acceptBtn.disabled = true;
    if (dlg.lang) dlg.lang.value = W.TDF_LANG.get();
    if (!dlg.el.open) dlg.el.showModal();
    (gated ? dlg.tick : dlg.closeBtn).focus({ preventScroll: true });
    return true;
  }
  TERMS.open = open;

  /* =================== footer link and first visit =================== */
  const foot = document.querySelector('.site-foot');
  if (foot) {
    const link = h('button', { class: 'tc-link', type: 'button', text: UI.link });
    link.addEventListener('click', open);
    foot.appendChild(document.createTextNode(' '));
    foot.appendChild(link);
  }
  if (shouldOpen(W.location.search, accepted())) {
    open();
    // The first-visit welcome (guide plugin) opens a moment later and would cover this window: put the terms back on top.
    setTimeout(() => {
      if (!dlg || !dlg.el.open || accepted()) return;
      if (!document.querySelector('dialog[open]:not(.tc-dialog)')) return;
      const ticked = dlg.tick.checked;
      moving = true; dlg.el.close(); dlg.el.showModal();
      setTimeout(() => { moving = false; }, 0); // the close event of the line above has fired by then
      dlg.tick.checked = ticked; dlg.acceptBtn.disabled = !ticked;
      dlg.tick.focus({ preventScroll: true });
    }, 700);
  }
})();
