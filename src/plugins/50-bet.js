/* Bet builder: a guided three step evidence card for two riders or two teams.
   Uses settled 2025 results only. No money, no stake, no prediction.
   The pure calculations at the top also run under node (tests/bet.test.mjs). */
(function (root) {
  'use strict';

  /* =================== pure core =================== */
  const CONDITIONS = ['wet', 'hot', 'windy'];
  const WEEK_RANGE = { 1: 'stages 1 to 9', 2: 'stages 10 to 15', 3: 'stages 16 to 21' };
  const THIN_BELOW = 4;   // under 4 shared stages: very thin
  const FAIR_FROM = 8;    // 8 or more shared stages: fair

  /** weather rows [stage, temp, rain, wind, wet, hot, windy] -> Map stage -> object */
  function weatherMap(rows) {
    return new Map((rows || []).map((w) => [w[0], { temp: w[1], rain: w[2], wind: w[3], wet: w[4] === 1, hot: w[5] === 1, windy: w[6] === 1 }]));
  }

  /** Slice and dice the stages. f = {terrain: 'any'|code, week: 'any'|1|2|3, conds: ['wet', ...]}. Every condition must hold. */
  function filterStages(stages, wx, f) {
    const terrain = f.terrain || 'any', week = f.week || 'any', conds = f.conds || [];
    return stages.filter((s) => (terrain === 'any' || s.code === terrain)
      && (week === 'any' || s.week === Number(week))
      && conds.every((c) => { const w = wx.get(s.id); return !!(w && w[c]); }));
  }

  function median(a) {
    if (!a.length) return null;
    const s = a.slice().sort((x, y) => x - y), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

  /** Turn per-stage pairs {stage, code, a, b} (result rows or null) into a record on finishing place. */
  function summarise(pairs) {
    const rows = pairs.filter((p) => p.a && p.b).map((p) => ({
      stage: p.stage, code: p.code, rankA: p.a.rank, rankB: p.b.rank, bibA: p.a.bib, bibB: p.b.bib,
      gap: p.a.time - p.b.time, ahead: p.a.rank < p.b.rank ? 'A' : p.a.rank > p.b.rank ? 'B' : '=',
    }));
    const aAhead = rows.filter((r) => r.ahead === 'A').length, bAhead = rows.filter((r) => r.ahead === 'B').length;
    return {
      rows, common: rows.length, aAhead, bAhead, level: rows.length - aAhead - bAhead,
      medianGap: median(rows.map((r) => r.gap)),
      avgRankA: mean(rows.map((r) => r.rankA)), avgRankB: mean(rows.map((r) => r.rankB)),
    };
  }

  /** Rider record on the given stages: finishing place, never time (a bunch shares one time). */
  function riderRecord(E, bibA, bibB, stages) {
    const A = new Map((E.byRider.get(bibA) || []).map((x) => [x.stage, x]));
    const B = new Map((E.byRider.get(bibB) || []).map((x) => [x.stage, x]));
    return summarise(stages.map((s) => ({ stage: s.id, code: s.code, a: A.get(s.id) || null, b: B.get(s.id) || null })));
  }

  /** The team's best placed rider on a stage (lowest rank), or null. */
  function teamBest(E, team, stageId) {
    return E.byStage.get(stageId).find((x) => E.riderByBib.get(x.bib).team === team) || null;
  }

  /** Team record: each team is represented by its best placed rider on the stage. */
  function teamRecord(E, teamA, teamB, stages) {
    return summarise(stages.map((s) => ({ stage: s.id, code: s.code, a: teamBest(E, teamA, s.id), b: teamBest(E, teamB, s.id) })));
  }

  /** "History says" share: (wins + 1) / (stages + 2). Pulls small samples toward 50%. */
  const historyShare = (wins, n) => (wins + 1) / (n + 2);
  /** Fair decimal odds: the price with no bookmaker margin. */
  const fairOdds = (p) => (p > 0 ? 1 / p : null);
  /** How much the record can carry, from the number of stages. */
  function confidence(n) {
    if (n < THIN_BELOW) return { label: 'very thin', level: 1 };
    if (n < FAIR_FROM) return { label: 'thin', level: 2 };
    return { label: 'fair', level: 3 };
  }

  /** "wet mountain stages in week 3" style phrase for the current slice. */
  function scopePhrase(f, terrainLabel) {
    const conds = (f.conds || []).join(' ');
    const terr = f.terrain && f.terrain !== 'any' ? (f.terrain === 'itt' ? 'time trial' : terrainLabel(f.terrain).toLowerCase()) : '';
    const words = [conds, terr, 'stages'].filter(Boolean).join(' ');
    return f.week && f.week !== 'any' ? `${words} in week ${f.week}` : words;
  }

  /** One plain sentence about the record. names = [A, B]. */
  function verdictText(rec, names, f, terrainLabel) {
    const narrowed = (f.terrain && f.terrain !== 'any') || (f.week && f.week !== 'any') || (f.conds && f.conds.length);
    const scope = narrowed ? `2025 ${scopePhrase(f, terrainLabel)}` : 'all 2025 stages';
    if (!rec.common) return `${names[0]} and ${names[1]} never both finished one of the ${scope} you picked.`;
    const conf = confidence(rec.common);
    const n = rec.common, plural = n === 1 ? 'stage' : 'stages';
    let lead;
    if (rec.aAhead === rec.bAhead) lead = `On ${scope} ${names[0]} and ${names[1]} were level: ${rec.aAhead} each out of ${n}.`;
    else {
      const [w, l, wins] = rec.aAhead > rec.bAhead ? [names[0], names[1], rec.aAhead] : [names[1], names[0], rec.bAhead];
      lead = `On ${scope} ${w} finished ahead of ${l} on ${wins} of ${n}.`;
    }
    return `${lead} That is ${conf.label} evidence: ${n} ${plural}.`;
  }

  /**
   * Checklist dot for one signal. side and fav are 'A', 'B' or null (fav is null when the record is level).
   * green: agrees with the record, amber: points the other way, level: the record is level so there is
   * nothing to agree with, grey: the signal shows no clear edge.
   */
  function signalDot(side, fav) {
    if (side == null) return 'grey';
    if (!fav) return 'level';
    return side === fav ? 'green' : 'amber';
  }

  const core = { CONDITIONS, WEEK_RANGE, weatherMap, filterStages, median, riderRecord, teamRecord, teamBest, historyShare, fairOdds, confidence, scopePhrase, verdictText, signalDot };
  if (typeof module === 'object' && module.exports) { module.exports = core; return; }

  /* =================== interface =================== */
  const API = root.TDF_APP;
  if (!API) return;
  const { h, add, clear, svg, panel, seg, selectEl, riderFinder, riderEl, glyph, teamShort, ordinal, R, E, TL, go, gotoStage, fmtGap } = API;
  const WX = weatherMap((root.TDF_DATA || {}).weather);
  const termLabel = (c) => TL[c];
  const COND_INFO = {
    wet: { label: 'Wet', tip: 'At least 1 mm of rain at the finish town on race day' },
    hot: { label: 'Hot', tip: '28 °C or more at the finish town' },
    windy: { label: 'Windy', tip: 'Wind of 20 km/h or more at the finish town' },
  };
  const PREFERRED_TEAMS = ['UAE TEAM EMIRATES XRG', 'TEAM VISMA | LEASE A BIKE'];
  const DEFAULT_TEAMS = PREFERRED_TEAMS.every((t) => E.teamByName.has(t)) ? PREFERRED_TEAMS : [E.TEAMCLASS.list[0].team, E.TEAMCLASS.list[1].team];
  const st = { mode: 'riders', terrain: 'any', week: 'any', conds: [], a: 1, b: 11, ta: DEFAULT_TEAMS[0], tb: DEFAULT_TEAMS[1], lastShare: 0.5 };
  const one = (n) => (n == null ? 'none' : n.toFixed(1));
  const pctTxt = (p) => `${Math.round(p * 100)}%`;
  const oddsTxt = (o) => (o == null ? 'none' : o.toFixed(2));
  /** 12 -> "12 s", 95 -> "1' 35\"" */
  const shortGap = (s) => (s < 60 ? `${Math.round(s)} s` : fmtGap(s).replace(/^\+/, ''));

  /* small weather icons, drawn with the current text colour */
  function wxIcon(kind) {
    const s = svg('svg', { width: '12', height: '12', viewBox: '0 0 12 12', 'aria-hidden': 'true', class: `bet-wx ${kind}` });
    const line = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round' };
    if (kind === 'wet') s.appendChild(svg('path', { d: 'M6 1.2 C6 1.2 2.4 5.6 2.4 7.6 A3.6 3.6 0 0 0 9.6 7.6 C9.6 5.6 6 1.2 6 1.2 Z', fill: 'currentColor' }));
    if (kind === 'hot') { s.appendChild(svg('circle', { cx: '6', cy: '6', r: '2.4', fill: 'currentColor' })); s.appendChild(svg('path', { d: 'M6 0.6 V2 M6 10 V11.4 M0.6 6 H2 M10 6 H11.4 M2.2 2.2 L3.1 3.1 M8.9 8.9 L9.8 9.8 M2.2 9.8 L3.1 8.9 M8.9 3.1 L9.8 2.2', ...line })); }
    if (kind === 'windy') s.appendChild(svg('path', { d: 'M1 4 H7.5 A1.6 1.6 0 1 0 6 2.2 M1 7 H9.5 A1.6 1.6 0 1 1 8 8.8 M1 10 H5', ...line }));
    return s;
  }

  /* names and labels for the two sides */
  function sides() {
    if (st.mode === 'riders') return [R(st.a).short, R(st.b).short];
    return [teamShort(st.ta), teamShort(st.tb)];
  }
  function currentStages() { return filterStages(E.stages, WX, st); }
  function currentRecord(stages) {
    return st.mode === 'riders' ? riderRecord(E, st.a, st.b, stages) : teamRecord(E, st.ta, st.tb, stages);
  }

  function renderBet(root) {
    const step1 = h('div'), step2 = h('div'), evidence = h('div', { class: 'bet-evidence' });
    const live = h('p', { class: 'bet-sr', 'aria-live': 'polite' });
    add(root, h('div', { class: 'view-head' }, h('div', null,
      h('p', { class: 'eyebrow', text: 'Bet builder' }),
      h('h1', { text: 'Build an educated bet in three steps' }),
      h('p', { class: 'lede', text: 'Pick a type of stage, pick two riders or two teams, and see what the 2025 results say about them. Nothing here is a forecast and there is no money involved: it is an evidence card from one finished race.' }))));
    const p1 = stepPanel(1, 'What are you betting on?', 'Choose riders or teams, then the kind of day.', 7);
    const p2 = stepPanel(2, 'Pick your two', 'Search for any rider, or pick two teams.', 5);
    const p3 = stepPanel(3, 'What 2025 says', 'Recomputed every time you change step 1 or step 2.', 12);
    add(p1.body, step1); add(p2.body, step2); add(p3.body, live, evidence);
    add(root, p1.el, p2.el, p3.el);
    // Steps 1 and 2 are rebuilt on every change, so keyboard focus goes back to the same control.
    const FOCUSABLE = 'button, select, input, a[href]';
    const focusSpot = () => {
      const a = document.activeElement;
      const box = [step1, step2].find((b) => b.contains(a));
      return box ? { box, i: [...box.querySelectorAll(FOCUSABLE)].indexOf(a) } : null;
    };
    const refresh = () => {
      const spot = focusSpot();
      drawStep1(step1, refresh); drawStep2(step2, refresh); live.textContent = drawEvidence(evidence);
      const el = spot && spot.i >= 0 ? spot.box.querySelectorAll(FOCUSABLE)[spot.i] : null;
      if (el) el.focus({ preventScroll: true });
    };
    refresh();
  }

  function stepPanel(n, title, sub, span) {
    const p = panel({ title: [h('span', { class: 'bet-num', 'aria-hidden': 'true', text: String(n) }), h('span', { class: 'bet-sr', text: `Step ${n}: ` }), title], sub, span });
    p.el.classList.add('bet-step');
    return p;
  }

  /* ---------- step 1 ---------- */
  function drawStep1(box, refresh) {
    clear(box);
    const terrOpts = [{ value: 'any', label: 'Any stage' }, ...E.TERRAINS.map((c) => ({ value: c, label: TL[c], icon: glyph(c) }))];
    const condBtns = CONDITIONS.map((c) => h('button', {
      type: 'button', 'aria-pressed': String(st.conds.includes(c)), title: COND_INFO[c].tip,
      on: { click: () => { st.conds = st.conds.includes(c) ? st.conds.filter((x) => x !== c) : [...st.conds, c]; refresh(); } },
    }, wxIcon(c), COND_INFO[c].label));
    const kept = currentStages(), keptIds = new Set(kept.map((s) => s.id));
    add(box,
      row('Compare', seg([{ value: 'riders', label: 'Two riders' }, { value: 'teams', label: 'Two teams' }], st.mode, (v) => { st.mode = v; refresh(); }, 'Compare riders or teams')),
      row('Kind of day', seg(terrOpts, st.terrain, (v) => { st.terrain = v; refresh(); }, 'Kind of stage')),
      row('Weather (optional)', h('div', { class: 'seg', role: 'group', 'aria-label': 'Race day weather, pick any' }, condBtns)),
      row('Race week', seg([{ value: 'any', label: 'Any week' }, ...[1, 2, 3].map((w) => ({ value: w, label: `Week ${w}` }))], st.week, (v) => { st.week = v; refresh(); }, 'Race week')),
      h('div', { class: 'bet-slice', role: 'img', 'aria-label': `${kept.length} of 21 stages match your choices` },
        E.stages.map((s) => h('span', { class: `bet-dot${keptIds.has(s.id) ? ' on' : ''}`, style: `--c: var(--${s.code})`, title: `Stage ${s.id}, ${s.terrain}` }))),
      h('p', { class: 'note' }, h('b', { text: `${kept.length} of 21 stages match.` }),
        ' Slice and dice: each choice cuts the 21 stages of 2025 down to a smaller set, and step 3 only uses that set. Weeks: 1 is stages 1 to 9, 2 is 10 to 15, 3 is 16 to 21. Hover a weather button to see what it means.'));
  }
  const row = (label, control) => h('div', { class: 'bet-row' }, h('span', { class: 'bet-row-label', text: label }), control);

  /* ---------- step 2 ---------- */
  function drawStep2(box, refresh) {
    clear(box);
    const swap = h('button', { class: 'btn bet-swap', type: 'button', 'aria-label': 'Swap the two sides', on: { click: () => {
      if (st.mode === 'riders') [st.a, st.b] = [st.b, st.a]; else [st.ta, st.tb] = [st.tb, st.ta];
      refresh();
    } } }, 'Swap');
    if (st.mode === 'riders') add(box, h('div', { class: 'bet-pick' }, riderSide('a', refresh), swap, riderSide('b', refresh)));
    else add(box, h('div', { class: 'bet-pick' }, teamSide('a', refresh), swap, teamSide('b', refresh)));
    const same = st.mode === 'riders' ? st.a === st.b : st.ta === st.tb;
    if (same) add(box, h('p', { class: 'note bet-warn', text: 'Both sides are the same. Pick two different ones.' }));
  }
  function riderSide(k, refresh) {
    const bib = k === 'a' ? st.a : st.b, r = R(bib);
    const finder = riderFinder((b) => { st[k] = b; refresh(); }, { label: `Change rider ${k.toUpperCase()}` });
    const lab = finder.querySelector('span'); if (lab) lab.textContent = 'Change';
    return h('div', { class: `bet-side ${k}` },
      h('span', { class: `bet-key ${k}`, text: `Rider ${k.toUpperCase()}` }),
      riderEl(bib),
      h('span', { class: 'note', text: r.gcRank ? `${ordinal(r.gcRank)} overall in 2025` : r.status }),
      finder);
  }
  function teamSide(k, refresh) {
    const key = k === 'a' ? 'ta' : 'tb';
    const opts = E.TEAMCLASS.list.map((t) => ({ value: t.team, label: `${teamShort(t.team)} (${ordinal(t.rank)} team)` }));
    return h('div', { class: `bet-side ${k}` },
      h('span', { class: `bet-key ${k}`, text: `Team ${k.toUpperCase()}` }),
      selectEl(`bet-team-${k}`, [{ options: opts }], st[key], (v) => { st[key] = v; refresh(); }, `Team ${k.toUpperCase()}`),
      h('span', { class: 'note', text: 'Each team is judged by its best placed rider on each stage.' }));
  }

  /* ---------- step 3 ---------- */
  function drawEvidence(box) {
    clear(box);
    const names = sides();
    const same = st.mode === 'riders' ? st.a === st.b : st.ta === st.tb;
    if (same) { const msg = 'Pick two different sides in step 2 to see the evidence.'; add(box, h('p', { class: 'bet-empty', text: msg })); return msg; }
    const stages = currentStages();
    const rec = currentRecord(stages);
    if (!rec.common) {
      add(box, h('div', { class: 'bet-empty' },
        h('p', { class: 'verdict', text: verdictText(rec, names, st, termLabel) }),
        h('p', { class: 'note', text: 'Try a wider choice in step 1, for example Any week or no weather filter.' })),
        honestLine());
      return verdictText(rec, names, st, termLabel);
    }
    const decided = rec.aAhead + rec.bAhead;
    const pA = historyShare(rec.aAhead, decided), pB = 1 - pA;
    const fav = rec.aAhead > rec.bAhead ? 'A' : rec.bAhead > rec.aAhead ? 'B' : null;
    const card = h('div', { class: 'bet-card' },
      h('p', { class: 'verdict bet-verdict', text: verdictText(rec, names, st, termLabel) }),
      honestLine(),
      recordBlock(rec, names, pA, pB),
      factsBlock(rec, names),
      stripBlock(rec, names),
      checklistBlock(names, fav),
      glossary());
    add(box, card);
    animateIn(card, pA);
    return verdictText(rec, names, st, termLabel);
  }
  const honestLine = () => h('p', { class: 'bet-honest' }, h('b', { text: 'Settled 2025 results.' }), ' A frequency from one race, not a forecast.');

  function recordBlock(rec, names, pA, pB) {
    const conf = confidence(rec.common);
    const tie = rec.level ? ` (${rec.level} level)` : '';
    const sideBox = (k, name, p, ahead) => h('div', { class: `bet-odds ${k}` },
      h('span', { class: `bet-key ${k}`, text: name }),
      h('span', { class: 'bet-big', text: pctTxt(p) }),
      h('span', { class: 'note', text: `History says. Fair odds ${oddsTxt(fairOdds(p))}` }),
      h('span', { class: 'note', text: `Ahead on ${ahead} of ${rec.common}` }));
    const bar = h('div', { class: 'bet-bar', role: 'img', 'aria-label': `${names[0]} ${pctTxt(pA)}, ${names[1]} ${pctTxt(pB)}` }, h('span', { class: 'bet-bar-a' }));
    const meter = h('div', { class: 'bet-meter', role: 'meter', 'aria-valuemin': '1', 'aria-valuemax': '3', 'aria-valuenow': String(conf.level), 'aria-label': `Evidence strength: ${conf.label}` },
      [1, 2, 3].map((i) => h('span', { class: i <= conf.level ? 'on' : null })));
    return h('div', { class: 'bet-record' },
      h('p', { class: 'bet-line' }, `${names[0]} finished ahead of ${names[1]} on `, h('b', { text: `${rec.aAhead} of ${rec.common}` }), ` stages they both finished${tie}.`),
      h('div', { class: 'bet-odds-row' }, sideBox('a', names[0], pA, rec.aAhead), sideBox('b', names[1], pB, rec.bAhead)),
      bar,
      h('div', { class: 'bet-conf' }, h('span', { class: 'note', text: 'Evidence strength' }), meter, h('b', { text: `${conf.label} (${rec.common} ${rec.common === 1 ? 'stage' : 'stages'})` })));
  }

  function factsBlock(rec, names) {
    const g = rec.medianGap;
    const gapTxt = g == null || Math.abs(g) < 0.5 ? 'Same time' : `${g < 0 ? names[0] : names[1]} by ${shortGap(Math.abs(g))}`;
    return h('div', { class: 'tiles bet-facts' },
      API.tile('Typical time gap (median)', gapTxt, 'Riders in one bunch share a time, so this is often zero.', true),
      API.tile(`Average place, ${names[0]}`, one(rec.avgRankA), 'On these stages. Lower is better.', true),
      API.tile(`Average place, ${names[1]}`, one(rec.avgRankB), 'On these stages. Lower is better.', true));
  }

  function stripBlock(rec, names) {
    const cells = rec.rows.map((r, i) => {
      const w = WX.get(r.stage) || {};
      const who = r.ahead === 'A' ? names[0] : r.ahead === 'B' ? names[1] : 'nobody';
      const cls = r.ahead === 'A' ? 'a' : r.ahead === 'B' ? 'b' : 'lvl';
      return h('button', {
        type: 'button', class: `bet-cell ${cls}`, style: `--i: ${i}`,
        'aria-label': `Stage ${r.stage}, ${TL[r.code]}: ${who} ahead (${ordinal(r.rankA)} against ${ordinal(r.rankB)}). Open the stage.`,
        title: `Stage ${r.stage}: ${ordinal(r.rankA)} against ${ordinal(r.rankB)}`,
        on: { click: () => gotoStage(r.stage) },
      },
      h('span', { class: 'bet-cell-n', text: String(r.stage) }),
      glyph(r.code),
      h('span', { class: 'bet-cell-wx' }, CONDITIONS.filter((c) => w[c]).map(wxIcon)),
      h('span', { class: 'bet-cell-who', text: r.ahead === '=' ? 'level' : r.ahead }));
    });
    return h('div', { class: 'bet-strip-wrap' },
      h('div', { class: 'bet-strip-head' },
        h('h3', { text: 'Stage by stage' }),
        h('span', { class: 'legend' },
          h('span', null, h('i', { style: 'background:var(--a)' }), `A: ${names[0]} ahead`),
          h('span', null, h('i', { style: 'background:var(--b)' }), `B: ${names[1]} ahead`))),
      h('div', { class: 'bet-strip' }, cells),
      h('p', { class: 'note', text: 'Click a stage to open its full result.' }));
  }

  /* ---------- checklist ---------- */
  function signalsRiders() {
    const A = R(st.a), B = R(st.b), code = st.terrain === 'any' ? 'all' : st.terrain;
    const terrName = code === 'all' ? 'all stages' : `${TL[code].toLowerCase()} stages`;
    const ta = E.terrainStats(A.bib, code), tb = E.terrainStats(B.bib, code);
    const lower = (x, y) => (x == null || y == null || x === y ? null : x < y ? 'A' : 'B');
    const higher = (x, y) => (x == null || y == null || x === y ? null : x > y ? 'A' : 'B');
    const rely = (r) => (r.starts ? `${r.finished ? 'finished the race' : `left at stage ${r.exitStage}`}, top ten on ${pctTxt(r.top10s / r.starts)} of stages` : 'did not start');
    const relySide = A.finished !== B.finished ? (A.finished ? 'A' : 'B') : higher(A.starts ? A.top10s / A.starts : null, B.starts ? B.top10s / B.starts : null);
    const tA = E.teamByName.get(A.team), tB = E.teamByName.get(B.team);
    const week = st.week === 'any' ? 3 : Number(st.week);
    const wf = E.weekForm([A.bib, B.bib]).filter((x) => x.week === week);
    const wA = wf.find((x) => x.bib === A.bib), wB = wf.find((x) => x.bib === B.bib);
    const wTxt = (r, w) => (w && w.n ? one(w.avgRank) : 'no stages');
    return [
      { title: 'Terrain fit', tab: 'terrain', side: lower(ta && ta.avgRank, tb && tb.avgRank),
        text: `Average place on ${terrName}: ${A.short} ${one(ta && ta.avgRank)}, ${B.short} ${one(tb && tb.avgRank)}.` },
      { title: 'Reliability', tab: 'form', side: relySide, text: `${A.short} ${rely(A)}. ${B.short} ${rely(B)}.` },
      { title: 'Team strength', tab: 'teams', side: A.team === B.team ? null : lower(tA.classRank, tB.classRank),
        text: A.team === B.team ? 'Same team, so no edge here.' : `Team classification: ${teamShort(A.team)} ${ordinal(tA.classRank)}, ${teamShort(B.team)} ${ordinal(tB.classRank)}.` },
      { title: 'Overall standing', tab: 'outright', side: A.gcRank && B.gcRank ? lower(A.gcRank, B.gcRank) : A.gcRank ? 'A' : B.gcRank ? 'B' : null,
        text: `Final overall place: ${A.short} ${A.gcRank ? ordinal(A.gcRank) : 'did not finish'}, ${B.short} ${B.gcRank ? ordinal(B.gcRank) : 'did not finish'}.` },
      { title: `Form in week ${week}`, tab: 'form', side: lower(wA && wA.n ? wA.avgRank : null, wB && wB.n ? wB.avgRank : null),
        text: `Average place in week ${week} (${WEEK_RANGE[week]}): ${A.short} ${wTxt(A, wA)}, ${B.short} ${wTxt(B, wB)}.` },
    ];
  }
  function signalsTeams() {
    const A = E.teamByName.get(st.ta), B = E.teamByName.get(st.tb), nA = teamShort(A.name), nB = teamShort(B.name);
    const code = st.terrain === 'any' ? null : st.terrain;
    const terrTop = (t) => (code ? t.byTerrain[code].top10s : t.top10s);
    const lower = (x, y) => (x == null || y == null || x === y ? null : x < y ? 'A' : 'B');
    const higher = (x, y) => (x == null || y == null || x === y ? null : x > y ? 'A' : 'B');
    const gcTxt = (t) => (t.bestGcRank ? `${ordinal(t.bestGcRank)} (${R(t.bestGcBib).short})` : 'nobody finished');
    return [
      { title: 'Terrain fit', tab: 'terrain', side: higher(terrTop(A), terrTop(B)),
        text: `Top ten finishes on ${code ? `${TL[code].toLowerCase()} stages` : 'all stages'}: ${nA} ${terrTop(A)}, ${nB} ${terrTop(B)}.` },
      { title: 'Reliability', tab: 'teams', side: higher(A.finished, B.finished),
        text: `Riders who reached Paris: ${nA} ${A.finished} of ${A.riders}, ${nB} ${B.finished} of ${B.riders}.` },
      { title: 'Team strength', tab: 'teams', side: lower(A.classRank, B.classRank),
        text: `Team classification: ${nA} ${ordinal(A.classRank)}, ${nB} ${ordinal(B.classRank)}.` },
      { title: 'Overall standing', tab: 'outright', side: lower(A.bestGcRank, B.bestGcRank),
        text: `Best overall place: ${nA} ${gcTxt(A)}, ${nB} ${gcTxt(B)}.` },
      { title: 'Stage wins', tab: 'stages', side: higher(A.wins, B.wins), text: `Stage wins: ${nA} ${A.wins}, ${nB} ${B.wins}.` },
    ];
  }
  const TAB_NAME = { terrain: 'Terrain', form: 'Form and risk', teams: 'Teams', outright: 'Overall winner', stages: 'Stages' };
  function checklistBlock(names, fav) {
    const sigs = st.mode === 'riders' ? signalsRiders() : signalsTeams();
    const dotWord = { green: 'agrees with the record', amber: 'points the other way', grey: 'no clear edge', level: 'the record is level, this signal favours one side' };
    const items = sigs.map((s) => {
      const d = signalDot(s.side, fav);
      const who = s.side ? (s.side === 'A' ? names[0] : names[1]) : null;
      return h('li', { class: `bet-sig ${d}` },
        h('span', { class: `bet-dot-sig ${d}`, role: 'img', 'aria-label': dotWord[d] }),
        h('div', null,
          h('b', { text: s.title }), who ? h('span', { class: 'pill', text: `edge: ${who}` }) : null,
          h('p', { text: s.text })),
        h('button', { class: 'btn bet-check', type: 'button', 'aria-label': `Check ${s.title.toLowerCase()} in the ${TAB_NAME[s.tab]} tab`, on: { click: () => go(s.tab) } }, `Check in ${TAB_NAME[s.tab]}`));
    });
    return h('div', { class: 'bet-checklist' },
      h('h3', { text: 'Checklist: other 2025 signals' }),
      h('p', { class: 'note', text: fav
        ? 'Green agrees with the head to head record, amber points the other way, grey shows no clear edge. These use the whole race, not only the stages you picked.'
        : 'The head to head record is level, so no signal can agree or disagree with it: the pill shows who each signal favours, and grey means no clear edge. These use the whole race, not only the stages you picked.' }),
      h('ul', null, items));
  }

  function glossary() {
    const item = (t, d) => [h('dt', { text: t }), h('dd', { text: d })];
    return h('details', { class: 'bet-gloss' },
      h('summary', { text: 'What do these words mean?' }),
      h('dl', null,
        item('Head to head', 'Who crossed the line first on each stage both finished. We compare finishing place, not time, because riders in one group are all given the same time.'),
        item('History says', '(times ahead + 1) divided by (stages + 2). Adding 1 and 2 pulls small samples toward 50%, so 2 out of 2 reads as 75%, not 100%.'),
        item('Fair odds', '1 divided by the History says share, so a 50% share gives 2.00 and a 67% share gives 1.50. It is a way to read the share, not a price: it ignores any bookmaker margin.'),
        item('Evidence strength', 'Under 4 stages is very thin, 4 to 7 is thin, 8 or more is fair. One race is always a small sample.')));
  }

  /* ---------- motion: transform and opacity only ---------- */
  function animateIn(card, pA) {
    const bar = card.querySelector('.bet-bar-a');
    const from = st.lastShare;
    st.lastShare = pA;
    if (bar) bar.style.transform = `scaleX(${from})`;
    card.classList.add('bet-enter');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (bar) bar.style.transform = `scaleX(${pA})`;
      card.classList.add('bet-in');
    }));
  }

  // registered last: when the page opens on #bet the view renders at once, so every helper above must exist first
  API.registerView('bet', 'Bet builder', renderBet, { before: 'method' });
})(typeof self !== 'undefined' ? self : this);
