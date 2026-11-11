/* Guide plugin: first-visit welcome, a guided spotlight tour, the Help menu, "How to make an educated bet",
   a glossary and the video tutorial. The copy, the tour steps and the card placement maths are plain data and
   pure functions in CORE, so tests/guide.test.mjs can check them in Node without a browser.
   URL switches (handy for recordings): ?welcome=0 hides the first-visit welcome, ?tour=1 starts the tour. */
(function (root) {
  'use strict';

  /* =================== pure part (no DOM) =================== */
  const STORE_KEY = 'tdf-guide-welcome-seen';
  const CARD_GAP = 14; // px between the highlighted element and the tour card
  const EDGE = 12; // px kept free at the edge of the screen
  const DOCK_BELOW = 640; // screens narrower than this get the tour card docked at the bottom
  const RING_PAD = 6; // px of breathing room around the highlighted element

  /** Tour steps. view: tab to open (null = stay). target: selectors tried in order. */
  const TOUR = [
    { view: 'race', target: ['#view-race .hero', '#view-race .panel'], title: 'Start here',
      text: 'This page sums up the whole 2025 Tour on one screen. The tabs along the top open each part of the guide.' },
    { view: 'outright', target: ['#view-outright [data-fn~="E1"]', '#view-outright .panel'], title: 'Who was strong overall',
      text: 'The overall standings (GC) rank riders by total time. Click a row to see that rider\'s biggest day against the top ten, or a name to open their profile.' },
    { view: 'stages', target: ['#view-stages [data-fn~="E2"]', '#view-stages .panel'], title: 'One stage at a time',
      text: 'Pick any of the 21 stages to see who finished near the front. Switch to the team view to see which teams filled the top ten.' },
    { view: 'terrain', target: ['#view-terrain [data-fn~="E5"]', '#view-terrain [data-fn~="E6"]', '#view-terrain .panel'], title: 'Who suits which terrain',
      text: 'Flat, hilly, mountain and time trial stages reward different riders. Check that your rider is good on the kind of stage you have in mind.' },
    { view: 'jerseys', target: ['#view-jerseys [data-fn~="E4"]', '#view-jerseys .panel'], title: 'Compare the four jerseys',
      text: 'The overall, points, mountains and young rider classifications sit side by side. Each jersey rewards a different kind of rider.' },
    { view: 'teams', target: ['#view-teams [data-fn~="E3"]', '#view-teams [data-fn~="E14"]', '#view-teams .panel'], title: 'The team around a rider',
      text: 'A strong team protects its leader and sets up sprints. Open a team to see which riders carried its time and its results.' },
    { view: 'nations', target: ['#view-nations [data-fn~="E8"]', '#view-nations .panel'], title: 'Riders and teams by country',
      text: 'See how many riders and teams each country sent, and how they did. Click a country to list its riders.' },
    { view: 'bet', target: ['#view-bet .panel', '#view-bet'], title: 'The bet builder',
      text: 'Pick two riders and compare them on every stage they both rode. Fair odds come from a smoothed share of how often each one finished ahead in 2025.' },
    { view: 'functions', target: ['#view-functions .panel', '#view-functions'], title: 'All 15 views, E1 to E15',
      text: 'This map lists all 15 views of the race. Click any one to jump straight to its panel.' },
    { view: null, target: ['.gd-help-btn'], title: 'Help is always here',
      text: 'Open Help to replay this tour, watch the video, read the five betting checks or look up a word. That is the whole tour.' },
  ];

  /** The five checks before a bet. go: [view, function code] tried in order; the first view that exists wins. */
  const BET_STEPS = [
    { title: 'Check who is strong overall', tone: 'maillot', fn: ['E1', 'E10'], go: [['outright', 'E1']], label: 'Open Overall winner',
      text: 'Start with the overall standings. A rider who finished high overall was strong for three weeks, not just one lucky day.' },
    { title: 'Check the terrain of the stage', tone: 'mountain', fn: ['E5', 'E6'], go: [['terrain', 'E5']], label: 'Open Terrain',
      text: 'Flat days suit sprinters, mountain days suit climbers, time trials suit riders who are strong alone. Match the rider to the stage.' },
    { title: 'Check form and reliability', tone: 'hilly', fn: ['E12'], go: [['form', 'E12']], label: 'Open Form and risk',
      text: 'Did they finish the race, and how often were they in the top ten? A rider who rarely finishes near the front is a risk.' },
    { title: 'Check the team around them', tone: 'flat', fn: ['E3', 'E14'], go: [['teams', 'E14']], label: 'Open Teams',
      text: 'Strong teammates protect a leader and set up sprints. See which teams put riders in the top ten most often.' },
    { title: 'Compare your two picks head to head', tone: 'itt', fn: [], go: [['bet', null], ['h2h', null]], label: 'Open Bet builder',
      text: 'Put your two candidates side by side and count who finished ahead more often. The bet builder turns that count into fair odds.' },
  ];
  const LIMITS = 'Honest limits: this is one race only, the 2025 Tour. Past results are not a forecast, because form changes and riders crash. Nothing here is a tip, and there is no betting on this site.';

  /** One line per term. */
  const GLOSSARY = [
    ['GC (general classification)', 'The overall standings. Each rider\'s stage times are added up, and the lowest total wins the Tour.'],
    ['Yellow jersey', 'Worn by the GC leader. Whoever wears it after the last stage wins the Tour.'],
    ['Points classification (green jersey)', 'Points for finishing high on stages and at sprint points on the route. Usually won by a sprinter.'],
    ['Mountains classification (polka dot jersey)', 'Points for reaching the top of climbs first. Won by the best climber.'],
    ['Young rider (white jersey)', 'The GC for riders born on or after 1 January 2000, so aged 25 or under in 2025.'],
    ['Time trial (ITT)', 'Riders start one at a time and race alone against the clock. The fastest time wins.'],
    ['Flat stage', 'Little climbing. Usually ends in a bunch sprint.'],
    ['Hilly stage', 'Short, steep climbs. Suits punchy riders and breakaways.'],
    ['Mountain stage', 'Long climbs. This is where the overall contenders gain or lose the most time.'],
    ['Time bonus', 'Seconds taken off a rider\'s total for finishing 1st, 2nd or 3rd on a stage (10, 6 and 4 seconds).'],
    ['Penalty', 'Seconds added to a rider\'s time by the judges for breaking a race rule.'],
    ['Adjusted time', 'Stage time minus bonuses plus penalties. Every ranking on this site uses it.'],
    ['Gap', 'Time behind the leader. +4\' 24" means 4 minutes and 24 seconds behind.'],
    ['Peloton', 'The main group of riders on the road.'],
    ['Abandon (DNF)', 'A rider who left the race before Paris: "did not finish".'],
    ['Head to head', 'Two riders compared directly: on each stage, who finished ahead of the other.'],
    ['Fair odds', '1 divided by a smoothed share, (wins + 1) / (stages + 2). Won 3 of 4: 4 / 6 = 67%, so fair odds 1.50. A summary, not a forecast.'],
    ['Outright', 'Who wins the whole race, not a single stage. On this site: the Overall winner tab.'],
    ['Puncheur', 'A rider who is strongest on short, steep climbs, the kind found on hilly stages.'],
    ['s.t. (same time)', 'Riders who cross the line in one group are all given the same time as the first rider of that group.'],
    ['Drill down', 'Click a total to open the detail behind it, for example from a team to its riders, or from a rider to each stage.'],
    ['Roll up', 'The opposite of drill down: add the details back up into a total, for example riders into their team.'],
    ['E badges (E1 to E15)', 'Mark the 15 main views. The Function map lists them all.'],
  ];

  /** Keep only the tour steps whose tab exists (a null view means "stay where you are"). */
  function stepsFor(views) {
    return TOUR.filter((s) => s.view == null || views.includes(s.view));
  }

  /** First [view, code] pair whose view exists, or null. */
  function pickJump(go, views) {
    return go.find(([v]) => views.includes(v)) || null;
  }

  /** Simple facts for the welcome screen, read from the engine. */
  function welcomeFacts(E) {
    return {
      riders: E.riders.length, teams: E.teams.length, stages: E.stages.length,
      finishers: E.riders.filter((r) => r.finished).length,
      winnerTime: E.gcFinal[0].cum, secondGap: E.gcFinal[1].gap,
    };
  }

  /**
   * Where the tour card goes. t: highlighted box {top, left, width, height} in screen pixels, or null.
   * card: {width, height}. vp: {width, height}. Returns {top, left, side}; side is below, above, inside or dock.
   */
  function placeCard(t, card, vp) {
    const clampX = (x) => Math.max(EDGE, Math.min(x, vp.width - card.width - EDGE));
    const dock = { top: Math.max(EDGE, vp.height - card.height - EDGE), left: clampX((vp.width - card.width) / 2), side: 'dock' };
    if (!t || vp.width < DOCK_BELOW) return dock;
    const left = clampX(t.left + t.width / 2 - card.width / 2);
    const below = t.top + t.height + CARD_GAP;
    if (below + card.height <= vp.height - EDGE) return { top: below, left, side: 'below' };
    const above = t.top - CARD_GAP - card.height;
    if (above >= EDGE) return { top: above, left, side: 'above' };
    return { top: dock.top, left: clampX(t.left + t.width - card.width - EDGE), side: 'inside' };
  }

  /** Highlight box: the target padded a little and cut to the visible area under the masthead. Null if off screen. */
  function ringBox(r, topLimit, vp) {
    const top = Math.max(r.top - RING_PAD, topLimit), bottom = Math.min(r.top + r.height + RING_PAD, vp.height);
    const left = Math.max(r.left - RING_PAD, 2), right = Math.min(r.left + r.width + RING_PAD, vp.width - 2);
    if (bottom - top < 8 || right - left < 8) return null;
    return { top, left, width: right - left, height: bottom - top };
  }

  const CORE = { TOUR, BET_STEPS, GLOSSARY, LIMITS, STORE_KEY, stepsFor, pickJump, welcomeFacts, placeCard, ringBox };
  root.TDF_GUIDE_CORE = CORE;

  /* =================== browser part =================== */
  const API = root.TDF_APP;
  if (!API || typeof document === 'undefined') return;
  const { h, add, clear, svg, E, T } = API;
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const params = new URLSearchParams(location.search);
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,video[controls],[tabindex]:not([tabindex="-1"])';

  function storeGet() { try { return root.localStorage.getItem(STORE_KEY); } catch (e) { return null; } }
  function storeSet() { try { root.localStorage.setItem(STORE_KEY, '1'); } catch (e) { /* private mode: the welcome simply shows again */ } }

  /** Poll until fn() returns something, or give up after ms. */
  async function waitFor(fn, ms) {
    const end = Date.now() + ms;
    for (;;) {
      const v = fn();
      if (v || Date.now() > end) return v || null;
      await sleep(50);
    }
  }
  const visible = (el) => !!el && el.getClientRects().length > 0 && !el.closest('[hidden]');
  const findIn = (sels) => sels.map((s) => document.querySelector(s)).find(visible) || null;
  const mastBottom = () => { const m = document.querySelector('.masthead'); return m ? Math.max(0, m.getBoundingClientRect().bottom) : 0; };

  /** Open a tab and wait until it is drawn (the tab's own scroll-to-top has run by then). */
  async function openView(view) {
    if (!view || !API.VIEWS.includes(view)) return;
    API.go(view);
    await waitFor(() => location.hash === `#${view}` && visible(document.getElementById(`view-${view}`)), 1500);
    await sleep(90);
  }
  function scrollToEl(el) {
    if (el.closest('.masthead')) return;
    const y = root.scrollY + el.getBoundingClientRect().top - mastBottom() - 16;
    root.scrollTo({ top: Math.max(0, y), behavior: reduced() ? 'auto' : 'smooth' });
  }
  /** Open a tab, scroll to the panel tagged with code, and flash it. Works across tabs. */
  async function jumpTo(view, code) {
    await openView(view);
    const sec = document.getElementById(`view-${view}`);
    const el = code && sec ? [...sec.querySelectorAll('[data-fn]')].find((p) => p.dataset.fn.split(' ').includes(code)) : null;
    if (!el) return;
    scrollToEl(el);
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 2300);
  }
  function jumpBet(step) {
    const pick = pickJump(step.go, API.VIEWS);
    if (pick) jumpTo(pick[0], pick[1]);
  }
  // Button text follows the real tab name, so it stays right if a tab is renamed.
  const tabText = (view) => { const a = document.querySelector(`.tabs a[href="#${view}"]`); return a ? a.textContent.trim() : ''; };
  const betLabel = (step) => {
    const pick = pickJump(step.go, API.VIEWS);
    const name = pick ? tabText(pick[0]) : '';
    return name ? `Open ${name}` : step.label;
  };
  const badge = (code) => h('span', { class: 'fn', text: code });

  /* ---------- small icons ---------- */
  const ICONS = {
    tour: 'M5 21V4 M5 4h11l-2 4 2 4H5',
    video: 'M8 5v14l11-7z',
    bet: 'M9 6h11 M9 12h11 M9 18h11 M4 6l1 1 2-2 M4 12l1 1 2-2 M4 18l1 1 2-2',
    glossary: 'M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z M5 16a4 4 0 0 1 4-4h10',
    welcome: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 11v6 M12 7.5v.5',
    help: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6 M12 17v.5',
  };
  function icon(name) {
    return svg('svg', { class: 'gd-ico', width: '18', height: '18', viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none',
      stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg('path', { d: ICONS[name] }));
  }

  /* =================== dialogs =================== */
  let openDlg = null;
  /** Modal dialog: focus trapped inside, Escape or a click on the dimmed backdrop closes it, focus goes back after. */
  function openDialog(o) {
    closeDialog();
    const back = document.activeElement;
    const titleId = `gd-dlg-${o.name}-title`;
    const closeBtn = h('button', { type: 'button', class: 'gd-close', 'aria-label': 'Close' }, '×');
    const card = h('div', { class: `gd-card ${o.cls || ''}`.trim() }, closeBtn);
    const dlg = h('dialog', { class: 'gd-dialog', 'aria-labelledby': titleId, 'data-guide': o.name }, card);
    const close = () => closeDialog();
    o.build(card, { titleId, close });
    closeBtn.addEventListener('click', close);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
    dlg.addEventListener('keydown', (e) => trapTab(e, card));
    document.body.appendChild(dlg);
    openDlg = { dlg, back, onClose: o.onClose };
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    const first = card.querySelector('[data-autofocus]') || card.querySelector(FOCUSABLE);
    if (first) first.focus({ preventScroll: true });
    return dlg;
  }
  function closeDialog() {
    if (!openDlg) return;
    const { dlg, back, onClose } = openDlg;
    openDlg = null;
    const v = dlg.querySelector('video');
    if (v) v.pause();
    if (dlg.open && typeof dlg.close === 'function') dlg.close();
    dlg.remove();
    if (onClose) onClose();
    if (back && back.isConnected && back.focus) back.focus({ preventScroll: true });
  }
  function trapTab(e, box) {
    if (e.key !== 'Tab') return;
    const f = [...box.querySelectorAll(FOCUSABLE)].filter(visible);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  const dlgHead = (titleId, eyebrow, title, sub) => h('div', { class: 'gd-head' },
    eyebrow ? h('p', { class: 'eyebrow', text: eyebrow }) : null,
    h('h2', { id: titleId, text: title }), sub ? h('p', { class: 'gd-sub', text: sub }) : null);

  /* ---------- welcome ---------- */
  function stageStrip() {
    const HEIGHT = { flat: 10, hilly: 20, mountain: 38, itt: 16 };
    const strip = h('div', { class: 'gd-strip', role: 'img', 'aria-label': `The ${E.stages.length} stages of 2025 by terrain: flat, hilly, mountain and time trial` });
    E.stages.forEach((s, i) => strip.appendChild(h('span', {
      class: 'gd-bar', title: `Stage ${s.id}: ${T.TERRAIN_LABEL[s.code]}, ${s.distance.toFixed(0)} km`,
      style: `--i:${i};height:${HEIGHT[s.code] || 12}px;background:var(--${s.code})`,
    })));
    return strip;
  }
  function welcome() {
    const f = welcomeFacts(E);
    const cards = [
      ['1', 'What this is', `The 2025 Tour de France in numbers: ${f.stages} stages, ${f.riders} riders, ${f.teams} teams. Built to help you judge riders and teams before you bet. It sums up settled results; it does not predict.`],
      ['2', 'How to move around', 'Use the tabs across the top. Click any rider name for a profile. Click any chart bar or table row to go one level deeper.'],
      ['3', 'How to read the numbers', null],
    ];
    const read = h('p', null, `Times are hours, minutes and seconds, like ${T.fmtTime(f.winnerTime)}. Gaps are time behind the leader, like ${T.fmtGap(f.secondGap)}. `,
      badge('E1'), ' badges mark the 15 main views.');
    openDialog({
      name: 'welcome', cls: 'gd-welcome', onClose: storeSet,
      build: (card, { titleId, close }) => {
        add(card,
          h('div', { class: 'gd-hero' },
            h('span', { class: 'brand-block', text: 'TOUR ’25' }),
            h('h2', { id: titleId, text: 'Welcome to the Race Analyst' }),
            h('p', { class: 'gd-sub', text: `Every result of the 2025 Tour, laid out so a first-time visitor can read it. ${f.finishers} of ${f.riders} riders reached Paris.` }),
            stageStrip()),
          h('div', { class: 'gd-cards' }, cards.map(([n, t, x], i) => h('div', { class: 'gd-wcard', style: `--i:${i}` },
            h('span', { class: 'gd-num', text: n }), h('h3', { text: t }), x ? h('p', { text: x }) : read))),
          h('div', { class: 'gd-actions' },
            h('button', { type: 'button', class: 'btn primary gd-big', 'data-autofocus': '', on: { click: () => { close(); startTour(); } } }, icon('tour'), 'Take the 1 minute tour'),
            h('button', { type: 'button', class: 'btn gd-big', on: { click: () => { storeSet(); openVideo(); } } }, icon('video'), 'Watch the video'),
            h('button', { type: 'button', class: 'btn gd-big gd-quiet', on: { click: close } }, 'Explore on my own')),
          h('p', { class: 'note gd-foot', text: 'You can open this again from Help, top right.' }));
      },
    });
  }

  /* ---------- how to make an educated bet ---------- */
  function betSteps(onJump) {
    return h('ol', { class: 'gd-bet-steps' }, BET_STEPS.map((s, i) => h('li', { class: 'gd-bet-step', style: `--i:${i};--tc:var(--${s.tone})` },
      h('div', { class: 'gd-bet-top' }, h('span', { class: 'gd-num', text: String(i + 1) }), s.fn.map(badge)),
      h('h3', { text: s.title }),
      h('p', { text: s.text }),
      h('button', { type: 'button', class: 'btn', 'aria-label': `${betLabel(s)}: ${s.title}`, on: { click: () => onJump(s) } }, betLabel(s), ' →'))));
  }
  const limitsEl = () => h('p', { class: 'gd-limits', text: LIMITS });
  // a closing joke under the five checks window, at the owner's request
  const QUIP = 'It’s not a bet if you bet your money on Pogacar, it’s a guarantee.';
  function openBetGuide() {
    openDialog({
      name: 'bet', cls: 'gd-wide',
      build: (card, { titleId, close }) => add(card,
        dlgHead(titleId, 'Five checks', 'How to make an educated bet', 'Work through these in order. Each button opens the tab with the evidence.'),
        betSteps((s) => { close(); jumpBet(s); }), limitsEl(), h('p', { class: 'gd-quip', text: QUIP })),
    });
  }
  function betPanel(rootEl) {
    if (rootEl.querySelector('#gd-bet-panel')) return;
    const p = API.panel({ title: 'How to make an educated bet', id: 'gd-bet-panel',
      sub: 'Five checks before you pick a rider. Each button opens the tab with the evidence.',
      tools: h('button', { type: 'button', class: 'btn', on: { click: () => startTour() } }, icon('tour'), ' Take the 1 minute tour') });
    add(p.body, betSteps(jumpBet), limitsEl());
    p.el.classList.add('gd-bet-panel');
    // Order on the start tab: headline, podium (40-showcase, if loaded), then these five steps.
    const anchor = rootEl.querySelector('#sc-podium-panel') || rootEl.querySelector('.hero');
    if (anchor) anchor.after(p.el); else rootEl.appendChild(p.el);
  }

  /* ---------- glossary ---------- */
  function openGlossary() {
    openDialog({
      name: 'glossary', cls: 'gd-gloss',
      build: (card, { titleId }) => {
        const list = h('dl', { class: 'gd-terms' });
        const empty = h('p', { class: 'note', hidden: '', text: 'No term matches. Try a shorter word.' });
        const rows = GLOSSARY.map(([t, d]) => { const r = h('div', { class: 'gd-term' }, h('dt', { text: t }), h('dd', { text: d })); list.appendChild(r); return { r, k: `${t} ${d}`.toLowerCase() }; });
        const q = h('input', { type: 'search', class: 'finder gd-q', placeholder: 'Filter terms', 'aria-label': 'Filter the glossary', 'data-autofocus': '' });
        q.addEventListener('input', () => {
          const s = q.value.trim().toLowerCase();
          let n = 0;
          rows.forEach(({ r, k }) => { r.hidden = !!s && !k.includes(s); if (!r.hidden) n += 1; });
          empty.hidden = n > 0;
        });
        add(card, dlgHead(titleId, 'Glossary', 'Words used on this site', 'Cycling and betting terms, one line each.'), q, list, empty);
      },
    });
  }

  /* ---------- video ---------- */
  function openVideo() {
    openDialog({
      name: 'video', cls: 'gd-wide',
      build: (card, { titleId, close }) => {
        const note = h('div', { class: 'gd-novideo', hidden: '' },
          h('p', { text: 'The video is not available in this copy of the page. The 1 minute tour shows the same things, step by step.' }),
          h('button', { type: 'button', class: 'btn primary', on: { click: () => { close(); startTour(); } } }, icon('tour'), ' Start the tour instead'));
        // preload 'metadata' makes a missing file fail at once, so the note shows instead of an empty player.
        const video = h('video', { class: 'gd-video', controls: '', preload: 'metadata', playsinline: '', src: 'assets/tutorial.mp4', 'aria-label': 'Video tutorial: how to use the Race Analyst' });
        video.addEventListener('error', () => { video.hidden = true; note.hidden = false; });
        // The poster is only set once the image has loaded, so a missing poster never shows a broken frame.
        const poster = new Image();
        poster.addEventListener('load', () => { video.poster = poster.src; });
        poster.src = 'assets/tutorial-poster.jpg';
        add(card, dlgHead(titleId, 'Video, under 3 minutes', 'How to use the Race Analyst', 'A narrated walk through the tabs and the five checks behind an educated bet.'), video, note);
      },
    });
  }

  /* =================== guided tour =================== */
  let tour = null;
  function startTour() {
    closeDialog(); closeMenu(); endTour();
    const fm = root.TDF_FUNCTIONS; // the function map has its own step-through; only one walkthrough at a time
    if (fm && typeof fm.stop === 'function') fm.stop();
    const steps = stepsFor(API.VIEWS);
    const ring = h('div', { class: 'gd-ring', 'aria-hidden': 'true' });
    const card = h('div', { class: 'gd-tour', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gd-tour-title', 'aria-describedby': 'gd-tour-text' });
    document.body.append(ring, card);
    tour = { steps, i: -1, ring, card, el: null, seq: 0, back: document.activeElement, raf: 0 };
    root.addEventListener('resize', schedule);
    root.addEventListener('scroll', schedule, true);
    document.addEventListener('keydown', tourKeys, true);
    storeSet();
    goStep(0, 1);
  }
  function endTour() {
    if (!tour) return;
    const { ring, card, back } = tour;
    tour = null;
    ring.remove(); card.remove();
    root.removeEventListener('resize', schedule);
    root.removeEventListener('scroll', schedule, true);
    document.removeEventListener('keydown', tourKeys, true);
    if (back && back.isConnected && back.focus) back.focus({ preventScroll: true });
  }
  async function goStep(i, dir) {
    if (!tour) return;
    if (i < 0) return;
    if (i >= tour.steps.length) { endTour(); return; }
    const seq = ++tour.seq;
    const st = tour.steps[i];
    tour.ring.classList.remove('on');
    await openView(st.view);
    const el = await waitFor(() => findIn(st.target), 1500);
    if (!tour || tour.seq !== seq) return;
    if (!el) { goStep(i + dir, dir); return; }
    tour.i = i; tour.el = el;
    scrollToEl(el);
    drawCard();
    place();
    tour.ring.classList.add('on');
  }
  function drawCard() {
    const { steps, i, card } = tour;
    const st = steps[i], last = i === steps.length - 1;
    const next = h('button', { type: 'button', class: 'btn primary', on: { click: () => goStep(i + 1, 1) } }, last ? 'Finish' : 'Next →');
    clear(card);
    add(card, h('div', { class: 'gd-tour-inner', 'aria-live': 'polite' },
      h('div', { class: 'gd-tour-top' },
        h('span', { class: 'gd-step', text: `Step ${i + 1} of ${steps.length}` }),
        h('button', { type: 'button', class: 'gd-skip', on: { click: endTour } }, last ? 'Close' : 'Skip tour')),
      h('div', { class: 'gd-progress', 'aria-hidden': 'true' }, h('i', { style: `transform:scaleX(${(i + 1) / steps.length})` })),
      h('h3', { id: 'gd-tour-title', text: st.title }),
      h('p', { id: 'gd-tour-text', text: st.text }),
      h('div', { class: 'gd-tour-nav' },
        h('button', { type: 'button', class: 'btn', disabled: i === 0, on: { click: () => goStep(i - 1, -1) } }, '← Back'), next),
      h('p', { class: 'gd-keys', text: 'Keys: arrows to move, Enter for next, Escape to stop.' })));
    next.focus({ preventScroll: true });
  }
  function schedule() {
    if (!tour || tour.raf) return;
    tour.raf = requestAnimationFrame(() => { if (tour) { tour.raf = 0; place(); } });
  }
  function place() {
    if (!tour || !tour.el) return;
    const vp = { width: document.documentElement.clientWidth, height: root.innerHeight };
    const inMast = !!tour.el.closest('.masthead');
    const box = tour.el.isConnected ? ringBox(tour.el.getBoundingClientRect(), inMast ? 0 : mastBottom(), vp) : null;
    const { ring, card } = tour;
    ring.hidden = !box;
    if (box) { ring.style.width = `${box.width}px`; ring.style.height = `${box.height}px`; ring.style.transform = `translate(${box.left}px, ${box.top}px)`; }
    const pos = placeCard(box, { width: card.offsetWidth, height: card.offsetHeight }, vp);
    card.style.transform = `translate(${Math.round(pos.left)}px, ${Math.round(pos.top)}px)`;
    card.dataset.side = pos.side;
  }
  function tourKeys(e) {
    if (!tour || openDlg) return;
    const typing = e.target.closest && e.target.closest('input,select,textarea');
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); endTour(); return; }
    if (e.key === 'Tab' && tour.card.contains(document.activeElement)) { trapTab(e, tour.card); return; }
    if (typing) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); goStep(tour.i + 1, 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); goStep(tour.i - 1, -1); } else if (e.key === 'Enter' && !e.target.closest('button,a,[tabindex]')) { e.preventDefault(); goStep(tour.i + 1, 1); }
  }

  /* =================== Help menu in the masthead =================== */
  let menuBtn = null, menu = null;
  const MENU = [
    ['tour', 'Take the 1 minute tour', 'A guided walk through the main tabs', () => startTour()],
    ['video', 'Watch the video', 'Under 3 minutes, narrated', () => openVideo()],
    ['bet', 'How to make an educated bet', 'Five checks, with links to the evidence', () => openBetGuide()],
    ['glossary', 'Glossary', 'GC, time bonus, fair odds and more', () => openGlossary()],
    ['welcome', 'Show the welcome again', 'What this is and how to read it', () => welcome()],
  ];
  function buildHelp() {
    const mast = document.querySelector('.mast-inner');
    if (!mast || mast.querySelector('.gd-help')) return;
    menuBtn = h('button', { type: 'button', class: 'gd-help-btn', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': 'gd-help-menu', 'aria-label': 'Help: tour, video, betting checks and glossary' },
      icon('help'), h('span', { class: 'gd-help-label', text: 'Help' }));
    if (!storeGet()) menuBtn.classList.add('gd-ping');
    menu = h('div', { class: 'gd-menu', id: 'gd-help-menu', role: 'menu', 'aria-label': 'Help', hidden: '' },
      MENU.map(([ic, t, sub, fn]) => h('button', { type: 'button', role: 'menuitem', tabindex: '-1', dataset: { guide: ic }, on: { click: () => { closeMenu(); fn(); } } },
        icon(ic), h('span', null, h('span', { class: 'gd-mi-title', text: t }), h('span', { class: 'gd-mi-sub', text: sub })))));
    menuBtn.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu(true)));
    menuBtn.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); openMenu(); } });
    menu.addEventListener('keydown', menuKeys);
    mast.appendChild(h('div', { class: 'gd-help' }, menuBtn, menu));
    document.addEventListener('click', (e) => { if (menu && !menu.hidden && !e.target.closest('.gd-help')) closeMenu(); });
  }
  const items = () => [...menu.querySelectorAll('[role="menuitem"]')];
  function openMenu() {
    menu.hidden = false; menuBtn.setAttribute('aria-expanded', 'true'); menuBtn.classList.remove('gd-ping');
    items()[0].focus();
  }
  function closeMenu(refocus) {
    if (!menu || menu.hidden) return;
    menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false');
    if (refocus) menuBtn.focus();
  }
  function menuKeys(e) {
    const list = items(), k = list.indexOf(document.activeElement);
    const to = (n) => { e.preventDefault(); list[(n + list.length) % list.length].focus(); };
    if (e.key === 'ArrowDown') to(k + 1);
    else if (e.key === 'ArrowUp') to(k - 1);
    else if (e.key === 'Home') to(0);
    else if (e.key === 'End') to(list.length - 1);
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(true); } else if (e.key === 'Tab') closeMenu();
  }

  /* =================== start =================== */
  function init() {
    buildHelp();
    API.extendView('race', (rootEl) => betPanel(rootEl));
    root.TDF_GUIDE = { startTour, endTour, welcome, openVideo, openGlossary, openBetGuide, jumpTo };
    if (params.get('tour') === '1') { setTimeout(startTour, 500); return; }
    if (params.get('welcome') !== '0' && !storeGet()) setTimeout(() => { if (!openDlg && !tour) welcome(); }, 450);
  }
  // Wait for every plugin script to run, so tabs added by other plugins (bet builder, function map) are known.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
