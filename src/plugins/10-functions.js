/* Function map tab. Shows where each of the lecturer's 15 demonstration prompts (E1 to E15) and the five
   Task 3 requirements live, jumps straight to each one, and runs a step by step walk-through for the live demo.
   Exposes window.TDF_FUNCTIONS = { list, requirements, ops, facts, stepIndex, show, start, stop }. */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;

  /* =================== content =================== */
  const OPS = {
    rollup: { label: 'Roll up', tip: 'add details up into a bigger total, for example riders into a team' },
    drill: { label: 'Drill down', tip: 'open a total to see the details inside it, for example a team to its riders' },
    slice: { label: 'Slice', tip: 'keep just one value of one thing, for example only mountain stages' },
    dice: { label: 'Dice', tip: 'filter on several things at once, for example chosen riders on chosen stages' },
    pivot: { label: 'Pivot', tip: 'turn the same numbers to see them from another side, for example a stage seen by team' },
  };

  // The view for each code is fixed by the project plan; other tabs and the docs rely on it.
  const LIST = [
    { code: 'E1', view: 'outright', brief: 'GC leaderboard with contextual descent', title: 'Final overall standings', ops: ['rollup', 'drill'],
      see: 'The final overall standings (GC, the general classification: lowest total time wins). Click any rider to see the day they gained or lost the most time on the top ten.',
      say: 'This is the final overall table. Click a contender and the chart shows their biggest day against the top ten.' },
    { code: 'E2', view: 'stages', brief: 'A stage in focus', title: 'Stage in focus', ops: ['slice', 'pivot'],
      see: 'Pick any stage to see its route, distance, terrain and leading finishers with their times, then switch to a team view of the top ten.',
      say: 'Pick a stage: route, distance, terrain and the top finishers. The team view shows which squads filled the top ten.' },
    { code: 'E3', view: 'teams', brief: 'Team burden and contribution', title: 'Team burden and contribution', ops: ['rollup', 'drill'],
      see: 'Team totals add the three best times on every stage (the official rule; a switch shows the all rider adjusted total). Open a team to see which riders supplied those times.',
      say: 'Team time is a roll up. Opening a team drills down to the riders who did the work on each stage.' },
    { code: 'E4', view: 'jerseys', brief: 'Parallel classifications', title: 'Parallel classifications', ops: ['pivot', 'slice'],
      see: 'Each young rider’s overall place next to their young rider place (with an age filter), plus a mountains only standing built from the six mountain stages.',
      say: 'Three standings side by side. The mountains only column shows who climbs better than their overall place suggests.' },
    { code: 'E5', view: 'terrain', brief: 'Mountain contours', title: 'Mountain contours', ops: ['slice', 'rollup', 'drill'],
      see: 'How often each rider made the podium (top three) on mountain stages, and their average time behind the stage winner. Click a rider for each mountain day.',
      say: 'Mountain specialists: podium count and average gap to the winner. Click a rider to get back to the daily results.' },
    { code: 'E6', view: 'terrain', brief: 'Speed as a simple ratio', title: 'Speed by terrain', ops: ['rollup', 'pivot'],
      see: 'Average speed (distance divided by time) on flat, hilly, mountain and time trial stages, for riders or teams, compared with a typical finisher.',
      say: 'Speed is distance divided by time. A bar that grows on mountain stages means that rider gains when the road climbs.' },
    { code: 'E7', view: 'outright', brief: 'Bonuses, penalties and counterfactuals', title: 'Bonuses and penalties per rider', ops: ['rollup', 'slice'],
      see: 'Time bonuses (seconds taken off for a top three finish) and penalties for each rider. The panel above it replays the standings with them switched off.',
      say: 'Switch bonuses off, then penalties, and watch who moves into or out of the top ten.' },
    { code: 'E8', view: 'nations', brief: 'Participation by nation', title: 'Where the riders and teams come from', ops: ['rollup', 'drill'],
      see: 'A map and ranking of how many riders and teams each country sent. Pick a country to list its riders and their teams.',
      say: 'Counts of riders and teams per country. Pick a country to drill down to the riders behind the number.' },
    { code: 'E9', view: 'nations', brief: 'National outcomes', title: 'National outcomes', ops: ['rollup', 'drill'],
      see: 'For every country: its best overall place, stage wins and podiums, with a path back to the riders and stages behind them.',
      say: 'Each row is a country with its best overall place, wins and podiums. Click a row to reach the riders.' },
    { code: 'E10', view: 'outright', brief: 'Temporal GC storyline', title: 'The fight for yellow, stage by stage', ops: ['rollup', 'dice'],
      see: 'Lines show how far each chosen rider was behind the race leader (who wears the yellow jersey) after every stage, with mountain stages and time trials shaded.',
      say: 'Each line is a rider’s gap to the leader after every stage. The shaded bands are where the gaps open up.' },
    { code: 'E11', view: 'stages', brief: 'Against the clock', title: 'Against the clock', ops: ['slice'],
      see: 'A short catalogue of the time trial stages, where riders start alone and race the clock: date, distance, winner and the fastest riders.',
      say: 'In a time trial each rider races alone against the clock. Here they are with date, distance and winner.' },
    { code: 'E12', view: 'form', brief: 'Consistency near the front', title: 'Consistency near the front', ops: ['rollup', 'slice', 'drill'],
      see: 'Riders with the most top ten stage finishes, with a terrain filter. Click a rider to list the stages, places and stage types behind the count.',
      say: 'Consistency is a strong form signal. Click a rider to see every stage behind the count.' },
    { code: 'E13', view: 'teams', brief: 'Depth of squads', title: 'Depth of squads', ops: ['rollup', 'drill'],
      see: 'Every team started with 8 riders, so this counts how many of them reached Paris and how many nationalities each squad has. Pick a team for its full rider list.',
      say: 'Every team started with eight riders. Compare who reached Paris, then open a team to see its full roster and countries.' },
    { code: 'E14', view: 'teams', brief: 'Top-ten intensity by team', title: 'Top-ten intensity by team', ops: ['pivot', 'rollup', 'drill'],
      see: 'A team by terrain grid that counts top ten finishes. Click a cell to list the stages and riders behind it.',
      say: 'Top ten finishes per team and terrain. Click a cell to see exactly which riders and stages make the number.' },
    { code: 'E15', view: 'stages', brief: 'The long day', title: 'The long day', ops: ['slice', 'drill'],
      see: 'Stages sorted by distance, with the longest one’s date, terrain, start and finish towns, and its leading finishers and times.',
      say: 'Sorted by distance, the longest day comes first: its route, its terrain and who finished at the front.' },
  ];

  const REQUIREMENTS = [
    { key: 'a', title: 'Drill down by stage, rider and team', how: 'Open any total to see what is inside it: a terrain to its stages to the top finishers, any rider name to their whole race, and a team to its riders to each stage.',
      links: [{ label: 'Stages explorer', view: 'stages', code: 'OLAP', title: 'Roll up and drill down' }, { label: 'Rider profile', action: 'rider' }, { label: 'Team to rider to stage', view: 'teams', code: 'E3' }] },
    { key: 'b', title: 'Compare the General, Points, Mountains and Young Rider classifications', how: 'The Jerseys tab shows the overall (yellow jersey), points (green), mountains (polka dot) and young rider (white) standings side by side.',
      links: [{ label: 'Jerseys tab', view: 'jerseys', code: '3b', title: 'Official final classifications' }, { label: 'Side by side ranks', view: 'jerseys', code: 'E4' }] },
    { key: 'c', title: 'Cumulative race times by rider, team and classification', how: 'Total time for every rider after every stage, the team classification totals, and the young rider and mountains only standings.',
      links: [{ label: 'Overall standings', view: 'outright', code: 'E1' }, { label: 'Time after each stage', view: 'outright', code: 'E10' }, { label: 'Team classification', view: 'teams', title: 'Team classification' }] },
    { key: 'd', title: 'Teams per country and riders per country', how: 'A map and ranked bars count riders per nationality and teams per country. Pick a country to list them.',
      links: [{ label: 'Nations tab', view: 'nations', code: 'E8' }] },
    { key: 'e', title: 'Clear, intuitive, good looking design', how: 'One colour per terrain and per jersey, this map of every prompt, a walk-through of all 15, light and dark themes, and a layout that works on a phone.',
      links: [{ label: 'Start the walk-through', action: 'tour' }, { label: 'Back to the top', action: 'top' }] },
  ];

  /* =================== pure helpers (tested in tests/functions.test.mjs) =================== */
  /** Next step index, kept inside 0..n-1. */
  const stepIndex = (i, delta, n) => Math.max(0, Math.min(n - 1, i + delta));

  /** One short headline number per prompt, computed from the engine. fx = { name(bib), team(name), gap(seconds), ordinal(n) }. */
  function buildFacts(E, fx) {
    const out = {};
    const put = (code, fn) => {
      try { const v = fn(); if (v) out[code] = v; } catch (err) { if (W.console) W.console.warn(`function map: no fact for ${code}`, err); }
    };
    const rowsOf = (id) => E.byStage.get(id) || [];
    const ord = fx.ordinal || ((n) => String(n));
    const topBy = (arr, key) => arr.slice().sort((a, b) => key(b) - key(a))[0];
    put('E1', () => `${fx.name(E.gcFinal[0].bib)} won by ${fx.gap(E.gcFinal[1].gap)}`);
    put('E2', () => `${E.stages.length} stages to explore`);
    put('E3', () => `Best team: ${fx.team(E.TEAMCLASS.list[0].team)}`);
    put('E4', () => { const y = E.riders.filter((r) => r.young && r.gcRank).sort((a, b) => a.gcRank - b.gcRank)[0]; return `Best young rider: ${fx.name(y.bib)}, ${ord(y.gcRank)} overall`; });
    put('E5', () => `${E.stages.filter((s) => s.code === 'mountain').length} mountain stages`);
    put('E6', () => {
      const sp = E.stages.map((s) => ({ s, w: rowsOf(s.id).find((r) => r.rank === 1) })).filter((x) => x.w && x.w.time > 0)
        .map((x) => ({ id: x.s.id, kmh: x.s.distance / (x.w.time / 3600) }));
      const f = topBy(sp, (x) => x.kmh);
      return `Fastest: stage ${f.id}, winner at ${f.kmh.toFixed(1)} km/h`;
    });
    put('E7', () => `${new Set(E.stages.flatMap((s) => rowsOf(s.id)).filter((r) => r.bonus > 0).map((r) => r.bib)).size} riders earned time bonuses`);
    put('E8', () => { const n = topBy(E.nations, (x) => x.riders); return `${n.name}: ${n.riders} riders, ${n.teams} teams`; });
    put('E9', () => { const n = E.nations[0]; return `Most stage wins: ${n.name} (${n.wins})`; });
    put('E10', () => `${E.leaders.filter((l) => l.changed).length} changes of race leader`);
    put('E11', () => `Stages ${E.stages.filter((s) => s.code === 'itt').map((s) => s.id).join(' and ')}`);
    put('E12', () => { const r = topBy(E.riders, (x) => x.top10s || 0); return `${fx.name(r.bib)}: ${r.top10s} top ten finishes`; });
    put('E13', () => `${E.teams.length} teams, ${E.riders.length} riders`);
    put('E14', () => { const t = topBy(E.teams, (x) => x.top10s); return `${fx.team(t.name)}: ${t.top10s} top ten finishes`; });
    put('E15', () => { const s = topBy(E.stages, (x) => x.distance); return `Stage ${s.id}, ${s.distance.toFixed(1)} km, ${s.start} to ${s.finish}`; });
    return out;
  }

  const FN = { list: LIST, requirements: REQUIREMENTS, ops: OPS, facts: buildFacts, stepIndex, show: () => false, start: () => false, stop: () => false };
  W.TDF_FUNCTIONS = FN;

  const API = W.TDF_APP;
  if (!API || !W.document) return;
  const { h, add } = API;

  /* =================== navigation =================== */
  const TAB_FALLBACK = { outright: 'Overall winner', stages: 'Stages', terrain: 'Terrain', jerseys: 'Jerseys', form: 'Form and risk', teams: 'Teams', nations: 'Nations' };
  const ACCENT = { outright: 'maillot', stages: 'flat', terrain: 'mountain', jerseys: 'green', form: 'itt', teams: 's5', nations: 'b' };
  function tabLabel(view) {
    const a = document.querySelector(`.tabs a[href="#${view}"]`);
    return (a && a.textContent.trim()) || TAB_FALLBACK[view] || view;
  }

  /** Make sure a tab is open and drawn, then run fn. Waits for the hash change the app handles. */
  function onView(view, fn) {
    if ((location.hash || '').slice(1) === view) { fn(); return; }
    const once = () => { W.removeEventListener('hashchange', once); setTimeout(fn, 0); };
    W.addEventListener('hashchange', once);
    location.hash = view;
  }

  function flashPanel(el) {
    el.scrollIntoView({ block: 'start', behavior: prefersReduced() ? 'auto' : 'smooth' });
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 2200);
  }
  function panelByTitle(view, title) {
    const root = document.getElementById(`view-${view}`);
    if (!root) return null;
    return [...root.querySelectorAll('.panel')].find((p) => {
      const h2 = p.querySelector('h2');
      return h2 && h2.textContent.trim().startsWith(title);
    }) || null;
  }
  const prefersReduced = () => !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /** Jump to a target ({view, code, title} or {action}). done(found) reports whether a panel was found. */
  function show(target, done) {
    const cb = done || (() => {});
    if (target.action === 'rider') { API.openRider(API.E.gcFinal[0].bib); cb(true); return; }
    if (target.action === 'tour') { start(0); cb(true); return; }
    if (target.action === 'top') { onView('functions', () => { W.scrollTo({ top: 0, behavior: prefersReduced() ? 'auto' : 'smooth' }); cb(true); }); return; }
    onView(target.view, () => {
      let el = null;
      if (target.code) {
        const r = API.goToFunction(target.view, target.code);
        if (r && typeof r.then === 'function') { r.then((x) => finish(x)); return; }
        el = r;
      }
      finish(el);
    });
    function finish(el) {
      if (el) { cb(true); return; }
      const byTitle = target.title ? panelByTitle(target.view, target.title) : null;
      if (byTitle) flashPanel(byTitle);
      cb(!!byTitle);
    }
  }
  FN.show = show;

  let toastTimer = 0;
  /** A short message at the bottom of the screen, for when the user has already left the map. */
  function toast(text) {
    let el = document.querySelector('.fm-toast');
    if (!el) { el = h('p', { class: 'fm-toast', role: 'status' }); document.body.appendChild(el); }
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 4500);
  }

  /** Mark a prompt's card as seen once its panel was reached, so the presenter can see what is left. */
  function markSeen(code) {
    const c = document.querySelector(`.fm-card[data-code="${code}"]`);
    if (c) c.classList.add('seen');
  }

  /* =================== walk-through bar =================== */
  let tourIdx = -1;
  let bar = null;
  let lastFocus = null;
  const isTyping = (el) => !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
  // Registered in the capture phase, so it runs before the app's own Escape handler closes the drawer.
  function onKey(e) {
    if (tourIdx < 0 || e.altKey || e.ctrlKey || e.metaKey) return;
    const drawer = document.getElementById('drawer');
    const drawerOpen = !!drawer && !drawer.hidden;
    if (e.key === 'Escape') {
      if (drawerOpen) return; // the app closes the rider profile first
      if (document.querySelector('dialog[open]')) return; // an open dialog (Help, welcome) closes first
      stop();
      return;
    }
    if (drawerOpen || isTyping(e.target) || document.querySelector('dialog[open]')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  }
  function buildBar() {
    const title = h('strong', { class: 'fm-tour-title' });
    const say = h('p', { class: 'fm-tour-say' });
    const miss = h('p', { class: 'fm-tour-miss', hidden: '' });
    const fill = h('span', { class: 'fm-tour-fill' });
    const code = h('span', { class: 'fm-code' });
    const prev = h('button', { class: 'btn', type: 'button', text: 'Previous', 'aria-label': 'Previous prompt', on: { click: () => step(-1) } });
    const next = h('button', { class: 'btn primary', type: 'button', text: 'Next', 'aria-label': 'Next prompt', on: { click: () => (tourIdx >= LIST.length - 1 ? stop() : step(1)) } });
    const again = h('button', { class: 'btn ghost', type: 'button', text: 'Show again', 'aria-label': 'Scroll back to this panel', on: { click: () => step(0) } });
    const close = h('button', { class: 'btn fm-tour-close', type: 'button', text: 'Close', 'aria-label': 'Close the walk-through', on: { click: stop } });
    const el = h('div', { class: 'fm-tour', role: 'region', 'aria-label': 'Walk-through of the 15 demonstration prompts' },
      h('div', { class: 'fm-tour-track', 'aria-hidden': 'true' }, fill),
      h('div', { class: 'fm-tour-inner' },
        code,
        h('div', { class: 'fm-tour-text', 'aria-live': 'polite' }, title, say, miss),
        h('div', { class: 'fm-tour-nav' }, again, prev, next, close)),
      h('p', { class: 'fm-tour-keys', text: 'Arrow keys move between steps. Esc closes.' }));
    return { el, title, say, miss, fill, code, prev, next };
  }
  function paintBar() {
    const f = LIST[tourIdx];
    bar.code.textContent = f.code;
    bar.code.style.setProperty('--acc', `var(--${ACCENT[f.view] || 'maillot'})`);
    bar.title.textContent = `${f.code} of ${LIST.length} · ${f.title}`;
    bar.say.textContent = f.say;
    bar.miss.hidden = true;
    bar.fill.style.transform = `scaleX(${(tourIdx + 1) / LIST.length})`;
    bar.prev.disabled = tourIdx === 0;
    bar.next.textContent = tourIdx === LIST.length - 1 ? 'Finish' : 'Next';
  }
  function step(delta) {
    if (tourIdx < 0 || !bar) return;
    tourIdx = stepIndex(tourIdx, delta, LIST.length);
    paintBar();
    const f = LIST[tourIdx], at = tourIdx;
    show(f, (found) => {
      if (found) markSeen(f.code);
      if (found || at !== tourIdx || !bar) return;
      bar.miss.textContent = `Could not find the ${f.code} panel. Look for the ${f.code} tag on the ${tabLabel(f.view)} tab.`;
      bar.miss.hidden = false;
    });
  }
  function start(i) {
    const guide = W.TDF_GUIDE; // only one walk-through at a time: end the guided tour if it is running
    if (guide && typeof guide.endTour === 'function') guide.endTour();
    if (!bar) {
      lastFocus = document.activeElement;
      bar = buildBar();
      document.body.appendChild(bar.el);
      document.body.classList.add('fm-touring');
      document.addEventListener('keydown', onKey, true);
    }
    tourIdx = stepIndex(Number(i) || 0, 0, LIST.length);
    step(0);
    bar.next.focus({ preventScroll: true });
    return true;
  }
  function stop() {
    if (!bar) return false;
    document.removeEventListener('keydown', onKey, true);
    bar.el.remove();
    bar = null;
    tourIdx = -1;
    document.body.classList.remove('fm-touring');
    if (lastFocus && lastFocus.isConnected && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    return true;
  }
  FN.start = start;
  FN.stop = stop;

  /* =================== the tab =================== */
  const accentVar = (view) => `--acc: var(--${ACCENT[view] || 'maillot'})`;
  const opChip = (k) => h('span', { class: 'fm-op', dataset: { op: k }, title: OPS[k].tip, text: OPS[k].label });

  function hero() {
    const ticks = LIST.map((f, i) => h('button', { class: 'fm-tick', type: 'button', style: `${accentVar(f.view)}; --i: ${i}`,
      'aria-label': `${f.code}: ${f.title}, on the ${tabLabel(f.view)} tab`, title: `${f.code} · ${f.title}`, text: f.code,
      on: { click: () => show(f) } }));
    const count = (n, of, label) => h('div', { class: 'fm-count' },
      h('span', { class: 'fm-count-num' }, h('b', { text: String(n) }), h('span', { text: ` of ${of}` })),
      h('span', { class: 'fm-count-label', text: label }));
    return h('div', { class: 'fm-hero' },
      h('div', { class: 'fm-hero-text' },
        h('p', { class: 'fm-eyebrow', text: 'Function map · the brief at a glance' }),
        h('h1', { text: 'Every prompt in the brief, one click away' }),
        h('p', { class: 'fm-lede', text: 'Each card below is one of the lecturer’s 15 demonstration prompts. Press “Show me” to jump to the panel that answers it, or start the walk-through to visit all 15 in order.' }),
        h('div', { class: 'fm-hero-actions' },
          h('button', { class: 'btn fm-start', id: 'fm-tour-start', type: 'button', on: { click: () => start(0) } }, 'Start the walk-through', h('span', { class: 'fm-start-n', text: '15 steps' })))),
      h('div', { class: 'fm-hero-board' },
        h('div', { class: 'fm-counts' },
          count(LIST.length, 15, 'demonstration prompts covered'),
          count(REQUIREMENTS.length, 5, 'Task 3 requirements met')),
        h('div', { class: 'fm-ticks', role: 'group', 'aria-label': 'Jump straight to a prompt' }, ticks)));
  }

  function opsLegend(grid) {
    let active = null;
    const btns = Object.keys(OPS).map((k) => h('button', { class: 'fm-op fm-op-btn', type: 'button', 'aria-pressed': 'false', dataset: { op: k },
      on: { click: () => { active = active === k ? null : k; paint(); } } }, h('b', { text: OPS[k].label }), h('span', { text: `: ${OPS[k].tip}` })));
    function paint() {
      btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.op === active)));
      grid.querySelectorAll('.fm-card').forEach((c) => c.classList.toggle('dim', !!active && !c.dataset.ops.split(' ').includes(active)));
    }
    return h('div', { class: 'fm-legend' },
      h('p', { class: 'note' }, h('b', { text: 'The five OLAP moves. ' }), 'OLAP means exploring totals by cutting them different ways. Each card is tagged with the moves it shows; press one to highlight those cards.'),
      h('div', { class: 'fm-ops-row', role: 'group', 'aria-label': 'Highlight cards by OLAP move' }, btns));
  }

  function sqlBlock(code) {
    const q = W.TDF_SQL && W.TDF_SQL[code];
    if (!q || !q.sql) return null;
    const id = `fm-sql-${code}`;
    const codeEl = h('code', { text: q.sql });
    const status = h('span', { class: 'note', 'aria-live': 'polite' });
    const copy = h('button', { class: 'btn', type: 'button', text: 'Copy SQL', on: { click: () => copyText(q.sql, codeEl, status) } });
    const box = h('div', { class: 'fm-sql', id, hidden: '' },
      q.title ? h('p', { class: 'fm-sql-title', text: q.title }) : null,
      h('pre', null, codeEl),
      h('div', { class: 'fm-sql-tools' }, copy, status),
      q.note ? h('p', { class: 'note', text: q.note }) : null);
    const toggle = h('button', { class: 'btn', type: 'button', text: 'SQL', 'aria-expanded': 'false', 'aria-controls': id, title: `Show the SQL query behind ${code}`,
      on: { click: () => { const open = box.hidden; box.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); } } });
    return { toggle, box };
  }
  function copyText(text, codeEl, status) {
    const ok = () => { status.textContent = 'Copied'; setTimeout(() => { status.textContent = ''; }, 1800); };
    const fallback = () => {
      const range = document.createRange();
      range.selectNodeContents(codeEl);
      const sel = W.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      status.textContent = 'Selected: press Ctrl+C or Cmd+C to copy';
    };
    if (W.navigator && W.navigator.clipboard && W.isSecureContext) W.navigator.clipboard.writeText(text).then(ok, fallback);
    else fallback();
  }

  function card(f, i, fact) {
    const miss = h('p', { class: 'fm-miss', role: 'status', hidden: '' });
    const sql = sqlBlock(f.code);
    const onFound = (found) => {
      if (found) { markSeen(f.code); return; }
      miss.textContent = `Could not find this panel yet. Open the ${tabLabel(f.view)} tab and look for the ${f.code} tag.`;
      miss.hidden = false;
      toast(miss.textContent);
    };
    const go = h('button', { class: 'btn primary fm-go', type: 'button', dataset: { fmShow: f.code }, 'aria-label': `Show me ${f.code}: ${f.title}`,
      on: { click: () => { miss.hidden = true; show(f, onFound); } } }, 'Show me');
    return h('article', { class: 'fm-card', style: `${accentVar(f.view)}; --i: ${i}`, dataset: { ops: f.ops.join(' '), code: f.code } },
      h('div', { class: 'fm-card-top' },
        h('span', { class: 'fm-code', text: f.code }),
        h('span', { class: 'fm-seen', text: 'Seen' }),
        h('span', { class: 'fm-tab' }, h('i', { 'aria-hidden': 'true' }), `${tabLabel(f.view)} tab`)),
      h('h3', { class: 'fm-title', text: f.title }),
      f.brief !== f.title ? h('p', { class: 'fm-brief', text: `Brief: ${f.brief}` }) : h('p', { class: 'fm-brief', text: 'Brief: same title as the lecturer\'s prompt' }),
      h('p', { class: 'fm-see', text: f.see }),
      fact ? h('p', { class: 'fm-fact' }, h('span', { text: 'In the data' }), fact) : null,
      h('div', { class: 'fm-ops', 'aria-label': 'OLAP moves shown' }, f.ops.map(opChip)),
      h('div', { class: 'fm-actions' }, go, sql ? sql.toggle : null),
      miss,
      sql ? sql.box : null);
  }

  function tabLegend() {
    const views = [...new Set(LIST.map((f) => f.view))];
    return h('div', { class: 'legend' }, views.map((v) => h('span', null, h('i', { style: `background:var(--${ACCENT[v]})` }), tabLabel(v))));
  }

  function checkIcon() {
    const s = API.svg('svg', { width: '18', height: '18', viewBox: '0 0 20 20', 'aria-hidden': 'true', class: 'fm-check' });
    s.appendChild(API.svg('circle', { cx: '10', cy: '10', r: '9' }));
    s.appendChild(API.svg('path', { d: 'M6 10.5 L8.8 13.2 L14 7.5' }));
    return s;
  }
  function requirementsPanel() {
    const p = API.panel({ title: 'Task 3 requirements', sub: 'The five things the assignment asks the dashboard to do, and where each one is.' });
    const rows = REQUIREMENTS.map((r, i) => {
      const miss = h('p', { class: 'fm-miss', role: 'status', hidden: '' });
      const links = r.links.map((l) => h('button', { class: 'btn fm-link', type: 'button', 'aria-label': `Show me: ${l.label}`,
        on: { click: () => { miss.hidden = true; show(l, (found) => { if (!found) { miss.textContent = `Could not find that panel. Open the ${tabLabel(l.view)} tab.`; miss.hidden = false; toast(miss.textContent); } }); } } }, l.label, h('span', { 'aria-hidden': 'true', text: ' ›' })));
      return h('li', { class: 'fm-req', style: `--i: ${i}` },
        h('span', { class: 'fm-req-key', text: r.key }),
        h('div', { class: 'fm-req-body' },
          h('h3', null, r.title, h('span', { class: 'fm-met' }, checkIcon(), 'Met')),
          h('p', { class: 'fm-req-how', text: r.how }),
          h('div', { class: 'fm-req-links' }, links),
          miss));
    });
    add(p.body, h('ol', { class: 'fm-reqs' }, rows));
    return p.el;
  }

  function render(root) {
    let facts = {};
    try {
      facts = buildFacts(API.E, { name: (b) => (API.R(b) ? API.R(b).short || API.R(b).name : String(b)), team: API.teamShort, gap: (s) => API.fmtGap(s).slice(1), ordinal: API.ordinal });
    } catch (err) { if (W.console) W.console.warn('function map: facts unavailable', err); }
    const grid = h('div', { class: 'fm-grid' }, LIST.map((f, i) => card(f, i, facts[f.code])));
    const cards = API.panel({ title: 'The 15 demonstration prompts', sub: 'In the lecturer’s order, E1 to E15. The colour shows which tab each one lives on; every panel there carries the same code tag.' });
    add(cards.body, tabLegend(), opsLegend(grid), grid);
    add(root, hero(), cards.el, requirementsPanel());
  }

  API.registerView('functions', 'Function map', render, { before: 'method' });
})();
