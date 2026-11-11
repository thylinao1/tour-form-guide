/* plugin 20-coverage: two analysis views added to existing tabs.
 *   E13 Depth of squads  (Teams tab)  : distinct riders per team, who reached Paris, how many nationalities.
 *   E15 The long day     (Stages tab) : stages sorted by distance, with the leading finishers of the chosen one.
 * The pure calculations at the top also run under Node (module.exports) for tests/coverage.test.mjs.
 */
(function () {
  'use strict';

  /* =================== pure calculations =================== */
  const RACE_STAGES = 21;
  const REASON_TEXT = { DNS: 'did not start', withdrawal: 'abandoned during the stage' };

  function ordinalOf(n) {
    const v = n % 100;
    const suf = v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
    return `${n}${suf}`;
  }

  /** One row per team: registered riders, riders with a result, riders who reached Paris, nationalities. */
  function squadDepth(E) {
    return E.teams.map((t) => {
      const rs = E.riders.filter((r) => r.team === t.name);
      const byCountry = new Map();
      rs.forEach((r) => byCountry.set(r.country, (byCountry.get(r.country) || 0) + 1));
      const countries = [...byCountry.entries()]
        .map(([code, n]) => ({ code, name: E.countryName.get(code) || code, n }))
        .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
      const finishers = rs.filter((r) => r.finished && r.gcRank != null).sort((a, b) => a.gcRank - b.gcRank);
      const finished = rs.filter((r) => r.finished).length;
      return {
        team: t.name, country: t.country, registered: rs.length,
        raced: rs.filter((r) => r.starts > 0).length, finished, left: rs.length - finished,
        nations: byCountry.size, countries,
        bestGcBib: finishers.length ? finishers[0].bib : null, bestGcRank: finishers.length ? finishers[0].gcRank : null,
      };
    });
  }

  /** Measures for the ranked chart. Ties fall back to the other measure, then the best overall place, then the name. */
  const MEASURES = {
    paris: { label: 'Reached Paris', rankWord: 'riders in Paris', key: (x) => x.finished, then: (x) => x.nations },
    nations: { label: 'Nationalities', rankWord: 'nationalities', key: (x) => x.nations, then: (x) => x.finished },
    raced: { label: 'Raced a stage', rankWord: 'riders who raced', key: (x) => x.raced, then: (x) => x.finished },
  };
  function sortSquads(rows, measure) {
    const m = MEASURES[measure] || MEASURES.paris;
    return rows.slice().sort((a, b) => m.key(b) - m.key(a) || m.then(b) - m.then(a)
      || (a.bestGcRank ?? 999) - (b.bestGcRank ?? 999) || a.team.localeCompare(b.team));
  }

  /** Plain words for how a rider's race ended. */
  function outcomeText(r) {
    if (r.finished) return r.gcRank != null ? `${ordinalOf(r.gcRank)} overall` : 'Finished';
    if (r.exitStage == null) return 'Left the race';
    return `Left at stage ${r.exitStage}, ${REASON_TEXT[r.exitReason] || r.exitReason}`;
  }

  /** Full rider list of one team: finishers by overall place, then the riders who left (latest exit first). */
  function teamRoster(E, team) {
    return E.riders.filter((r) => r.team === team)
      .map((r) => ({
        bib: r.bib, name: r.name, country: r.country, countryName: r.countryName, age: r.age,
        finished: r.finished, gcRank: r.gcRank ?? null, exitStage: r.exitStage, exitReason: r.exitReason,
        stagesRaced: r.starts, outcome: outcomeText(r),
      }))
      .sort((a, b) => (b.finished - a.finished) || (a.gcRank ?? 999) - (b.gcRank ?? 999)
        || (b.exitStage ?? 0) - (a.exitStage ?? 0) || a.bib - b.bib);
  }

  /** The 21 stages, longest first (ties by stage number), with a 1-based length rank. */
  function stagesByDistance(E) {
    return E.stages
      .map((s) => ({ id: s.id, date: s.date, distance: s.distance, code: s.code, start: s.start, finish: s.finish, route: s.route }))
      .sort((a, b) => b.distance - a.distance || a.id - b.id)
      .map((s, i) => Object.assign(s, { lengthRank: i + 1 }));
  }

  /** Top n finishers of a stage by finishing place, with adjusted time (time - bonus + penalty) and the gap to the day's best adjusted time. */
  function stageLeaders(E, stageId, n) {
    const rows = E.byStage.get(stageId) || [];
    if (!rows.length) return [];
    const best = Math.min(...rows.map((r) => r.time - r.bonus + r.penalty));
    return rows.slice(0, n || 10).map((r) => {
      const adj = r.time - r.bonus + r.penalty;
      return { rank: r.rank, bib: r.bib, time: r.time, bonus: r.bonus, penalty: r.penalty, adj, adjGap: adj - best };
    });
  }

  const calc = { squadDepth, sortSquads, MEASURES, outcomeText, teamRoster, stagesByDistance, stageLeaders, ordinalOf, RACE_STAGES };
  if (typeof module === 'object' && module.exports) { module.exports = calc; return; }

  /* =================== interface =================== */
  const API = typeof window !== 'undefined' ? window.TDF_APP : null;
  if (!API) return;
  const { h, add, clear, panel, tile, seg, selectEl, tbl, chart, redraw, base, axisCat, axisVal, axisY, tipHead, tipRow, riderEl, terrEl, legend, teamShort, dateShort, fmtClock, fmtGap, ordinal, TL, E, R } = API;

  // replay the small entrance animation on a container (CSS turns it off for reduced motion)
  function enter(el) { el.classList.remove('cov-enter'); void el.offsetWidth; el.classList.add('cov-enter'); }
  const gapText = (s) => (s === 0 ? 'same time' : s > 0 && s < 60 ? `+${s} s` : fmtGap(s));
  const leftColor = (t) => API.blend(t.muted, t.sheet, 0.45);
  const countryLabel = (c) => (API.SHORT_COUNTRY && API.SHORT_COUNTRY[c.code]) || c.name;

  /* ---------- E13 Depth of squads ---------- */
  function mountDepth(root) {
    const rows = squadDepth(E);
    let measure = 'paris';
    let order = sortSquads(rows, measure);
    let selected = order[0].team;

    const p = panel({
      title: 'Depth of squads', fn: [['E13', 'Depth of squads']], id: 'cov-depth',
      sub: 'Every team started with 8 riders, so what separates them is how many reached Paris and how international the squad is. Click a team to see its full rider list.',
    });
    const teamSel = selectEl('cov-team-sel', [{ options: rows.slice().sort((a, b) => teamShort(a.team).localeCompare(teamShort(b.team))).map((x) => ({ value: x.team, label: teamShort(x.team) })) }], selected, (v) => pick(v), 'Team to list');
    const measureSeg = seg(Object.entries(MEASURES).map(([value, m]) => ({ value, label: m.label })), measure, (v) => {
      measure = v; order = sortSquads(rows, measure); redraw(depthChart);
    }, 'Rank teams by');
    add(p.head.appendChild(h('div', { class: 'panel-tools' })), measureSeg, teamSel);

    const box = h('div', { class: 'chart cov-depth-chart', role: 'img', 'aria-label': 'Ranked bars: riders per team who reached Paris and who left the race. Use the team list above to open a team.' });
    const roster = h('div', { class: 'cov-side', 'aria-live': 'polite' });
    add(p.body,
      h('div', { class: 'tiles' },
        tile('Riders who started', String(rows.reduce((a, x) => a + x.registered, 0)), `${rows.length} teams of 8`, true),
        tile('Reached Paris', String(rows.reduce((a, x) => a + x.finished, 0)), `${rows.filter((x) => x.finished === 8).length} teams kept all 8`, true),
        tile('Never finished a stage', String(rows.reduce((a, x) => a + x.registered - x.raced, 0)), 'both left during stage 1', true),
        tile('Most nationalities', String(Math.max(...rows.map((x) => x.nations))), rows.filter((x) => x.nations === Math.max(...rows.map((y) => y.nations))).map((x) => teamShort(x.team)).join(', '), true)),
      h('div', { class: 'cov-split' },
        h('div', { class: 'cov-main' }, box, legend([{ color: 'var(--a)', label: 'Reached Paris' }, { color: 'color-mix(in srgb, var(--muted) 55%, var(--sheet))', label: 'Left the race' }, { color: 'var(--s4)', label: 'Nationalities' }]),
          h('p', { class: 'note', text: 'Ties are broken by the other measure, then by the team\u2019s best overall place.' })),
        roster));
    root.appendChild(p.el);

    const depthChart = chart(box, (t) => buildDepthOption(t, order.slice().reverse(), measure, selected), {
      onClick: (e) => { const list = order.slice().reverse(); if (list[e.dataIndex]) pick(list[e.dataIndex].team); },
    });

    function pick(team) {
      selected = team; teamSel.value = team; redraw(depthChart); drawRoster();
    }
    function drawRoster() {
      clear(roster);
      const row = rows.find((x) => x.team === selected);
      const list = teamRoster(E, selected);
      if (!row || !list.length) { roster.appendChild(h('p', { class: 'note', text: 'No riders found for this team.' })); return; }
      const rank = order.findIndex((x) => x.team === selected) + 1;
      add(roster,
        h('div', { class: 'cov-side-head' },
          h('h3', { text: teamShort(selected) }),
          h('span', { class: 'pill', text: `${ordinal(rank)} of ${order.length} for ${MEASURES[measure].rankWord}` })),
        h('div', { class: 'tiles cov-mini' },
          tile('Registered', String(row.registered), 'riders at the start', true),
          tile('Raced a stage', String(row.raced), 'riders with at least one result', true),
          tile('Reached Paris', String(row.finished), row.left ? `${row.left} left the race` : 'nobody left', true),
          tile('Nationalities', String(row.nations), row.bestGcRank ? `best rider ${ordinal(row.bestGcRank)} overall` : 'no finisher', true)),
        h('div', { class: 'cov-flags', 'aria-label': 'Countries in this squad' }, row.countries.map((c) => h('span', { class: 'pill', text: `${countryLabel(c)} ${c.n}` }))),
        tbl([
          { label: 'Rider', render: (r) => riderEl(r.bib, { team: false }) },
          { label: 'Country', render: (r) => r.countryName },
          { label: 'Age', n: true, render: (r) => String(r.age) },
          { label: 'How the race ended', render: (r) => h('span', { class: `pill ${r.finished ? 'good' : 'warn'}`, text: r.outcome }) },
        ], list, { caption: 'Age on 5 July 2025, the first day of the race. Click a name to open the rider profile.' }));
      enter(roster);
    }
    drawRoster();
  }

  function buildDepthOption(t, list, measure, selected) {
    const nat = measure === 'nations';
    const lab = (x) => (nat ? `${x.nations} nationalities` : measure === 'raced' ? `${x.raced} of ${x.registered} raced` : `${x.finished} of ${x.registered} in Paris`);
    const bold = (x) => (x.team === selected ? { fontWeight: 700, color: t.ink } : {});
    const series = nat
      ? [{ name: 'Nationalities', type: 'bar', barMaxWidth: 14, data: list.map((x) => ({ value: x.nations, itemStyle: { color: t.s[3], borderRadius: [0, 4, 4, 0], opacity: x.team === selected ? 1 : 0.82 } })),
        label: { show: true, position: 'right', color: t.ink2, fontSize: 11, formatter: (p) => lab(list[p.dataIndex]) } }]
      : [
        { name: measure === 'raced' ? 'Raced a stage' : 'Reached Paris', type: 'bar', stack: 'r', barMaxWidth: 14,
          data: list.map((x) => ({ value: measure === 'raced' ? x.raced : x.finished, itemStyle: { color: t.a, opacity: x.team === selected ? 1 : 0.82 } })) },
        { name: measure === 'raced' ? 'Never finished a stage' : 'Left the race', type: 'bar', stack: 'r', barMaxWidth: 14,
          data: list.map((x) => ({ value: measure === 'raced' ? x.registered - x.raced : x.left, itemStyle: { color: leftColor(t), borderRadius: [0, 4, 4, 0] } })),
          label: { show: true, position: 'right', color: t.ink2, fontSize: 11, formatter: (p) => lab(list[p.dataIndex]) } },
      ];
    return Object.assign(base(t), {
      grid: { left: 8, right: 118, top: 6, bottom: 24, containLabel: true },
      xAxis: axisVal(t, { minInterval: 1, max: 8, name: nat ? 'nationalities in the squad' : 'riders', nameLocation: 'middle', nameGap: 24 }),
      yAxis: axisCat(t, list.map((x) => teamShort(x.team)), { axisLabel: { color: t.ink2, fontSize: 11 },
        data: list.map((x) => ({ value: teamShort(x.team), textStyle: bold(x) })) }),
      tooltip: Object.assign(base(t).tooltip, { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps) => {
        const x = list[ps[0].dataIndex];
        return tipHead(teamShort(x.team)) + tipRow(null, 'Registered', String(x.registered)) + tipRow(null, 'Raced a stage', String(x.raced))
          + tipRow(t.a, 'Reached Paris', String(x.finished)) + tipRow(leftColor(t), 'Left the race', String(x.left)) + tipRow(t.s[3], 'Nationalities', String(x.nations));
      } }),
      series,
    });
  }

  /* ---------- E15 The long day ---------- */
  function mountLongDay(root) {
    const byLen = stagesByDistance(E);
    let selected = byLen[0].id;
    let order = 'distance';

    const p = panel({
      title: 'The long day', fn: [['E15', 'The long day']], id: 'cov-long',
      sub: `All 21 stages sorted by distance. The longest, stage ${byLen[0].id}, ran ${byLen[0].distance.toFixed(1)} km. Click any bar to see that stage and who finished first.`,
    });
    const stageSel = selectEl('cov-stage-sel', [{ options: byLen.map((s) => ({ value: s.id, label: `${ordinal(s.lengthRank)} longest · stage ${s.id} · ${s.distance.toFixed(1)} km` })) }], selected, (v) => pick(Number(v)), 'Stage to show');
    const orderSeg = seg([{ value: 'distance', label: 'Longest first' }, { value: 'race', label: 'Race order' }], order, (v) => { order = v; redraw(longChart); }, 'Order of the bars');
    add(p.head.appendChild(h('div', { class: 'panel-tools' })), orderSeg, stageSel);

    const box = h('div', { class: 'chart cov-long-chart', role: 'img', 'aria-label': 'Bar chart of stage distances coloured by terrain. Use the stage list above to pick a stage.' });
    const card = h('div', { class: 'cov-side', 'aria-live': 'polite' });
    add(p.body, h('div', { class: 'cov-split' },
      h('div', { class: 'cov-main' }, box, legend(['flat', 'hilly', 'mountain', 'itt'].map((c) => ({ color: `var(--${c})`, label: TL[c] }))),
        h('p', { class: 'note', text: 'Distance is the official stage length. Time trials are short on purpose: riders start one by one and race the clock alone.' })),
      card));
    root.appendChild(p.el);

    const bars = () => (order === 'race' ? byLen.slice().sort((a, b) => a.id - b.id) : byLen);
    const longChart = chart(box, (t) => buildLongOption(t, bars(), selected, byLen[0].id), {
      onClick: (e) => { const s = bars()[e.dataIndex]; if (s) pick(s.id); },
    });

    function pick(id) { selected = id; stageSel.value = String(id); redraw(longChart); drawCard(); }
    function drawCard() {
      clear(card);
      const s = byLen.find((x) => x.id === selected);
      const top = stageLeaders(E, selected, 10);
      if (!s) { card.appendChild(h('p', { class: 'note', text: 'Pick a stage to see its details.' })); return; }
      add(card,
        h('div', { class: 'cov-side-head' },
          h('h3', { text: `Stage ${s.id} · ${dateShort(s.date, true)}` }),
          h('span', { class: `pill${s.lengthRank === 1 ? ' cov-longest' : ''}`, text: s.lengthRank === 1 ? 'Longest stage of the race' : `${ordinal(s.lengthRank)} longest of 21` })),
        h('div', { class: 'tiles cov-mini' },
          tile('Distance', `${s.distance.toFixed(1)} km`, h('span', null, terrEl(s.code)), true),
          tile('Start', s.start, 'where the stage began', true),
          tile('Finish', s.finish, s.start === s.finish ? 'same town: a loop' : 'where it ended', true)),
        h('h3', { class: 'cov-sub', text: 'Leading finishers' }),
        top.length ? tbl([
          { label: 'Pos', render: (r) => String(r.rank), cls: 'pos' },
          { label: 'Rider', render: (r) => riderEl(r.bib) },
          { label: 'Adjusted time', n: true, render: (r) => fmtClock(r.adj) },
          { label: 'Gap', n: true, render: (r) => gapText(r.adjGap) },
        ], top, { caption: 'Adjusted time is the finish time minus bonus seconds plus any penalty. Gap is behind the best adjusted time of the day.' })
          : h('p', { class: 'note', text: 'No results for this stage.' }),
        h('div', { class: 'panel-tools' },
          h('button', { class: 'btn primary', type: 'button', text: 'Open this stage', 'aria-label': `Open stage ${s.id} in the stage view`, on: { click: () => API.gotoStage(s.id) } })));
      enter(card);
    }
    drawCard();
  }

  function buildLongOption(t, list, selected, longestId) {
    return Object.assign(base(t), {
      grid: { left: 8, right: 16, top: 30, bottom: 26, containLabel: true },
      xAxis: axisCat(t, list.map((s) => String(s.id)), { name: 'stage', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: t.muted, fontSize: 11 } }),
      yAxis: axisY(t, { name: 'km' }),
      tooltip: Object.assign(base(t).tooltip, { trigger: 'item', formatter: (p) => {
        const s = list[p.dataIndex];
        return tipHead(`Stage ${s.id} · ${s.route}`) + tipRow(t.terr[s.code], TL[s.code], `${s.distance.toFixed(1)} km`) + tipRow(null, 'Length rank', `${ordinal(s.lengthRank)} of 21`);
      } }),
      series: [{
        type: 'bar', barMaxWidth: 26,
        data: list.map((s) => ({
          value: s.distance,
          itemStyle: { color: t.terr[s.code], borderRadius: [4, 4, 0, 0], opacity: s.id === selected ? 1 : 0.62,
            borderColor: s.id === selected ? t.ink : 'transparent', borderWidth: s.id === selected ? 2 : 0 },
          label: s.id === longestId ? { show: true, position: 'top', align: 'left', offset: [-8, 0], color: t.ink, fontWeight: 700, fontSize: 12, formatter: `Longest: ${s.distance.toFixed(1)} km` } : { show: false },
        })),
      }],
    });
  }

  API.extendView('teams', (root) => mountDepth(root));
  API.extendView('stages', (root) => mountLongDay(root));
})();
