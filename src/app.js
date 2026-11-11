/* Tour 2025 Form Guide - interface. Reads window.TDF_DATA through the engine (window.TDF). */
(function () {
  'use strict';
  const T = window.TDF;
  const E = T.createEngine(window.TDF_DATA);
  const { fmtTime, fmtGap, fmtClock } = T;
  const TERR = ['flat', 'hilly', 'mountain', 'itt'];
  const TL = T.TERRAIN_LABEL;

  /* =================== DOM helpers =================== */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
        else if (k === 'style') el.setAttribute('style', v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    add(el, kids);
    return el;
  }
  function add(el, ...kids) {
    kids.flat(Infinity).forEach((k) => {
      if (k == null || k === false) return;
      el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    });
    return el;
  }
  const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  const svgNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, ...kids) {
    const el = document.createElementNS(svgNS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
    kids.forEach((k) => el.appendChild(k));
    return el;
  }

  /* =================== formatting =================== */
  const nf = new Intl.NumberFormat('en-GB');
  const fmtInt = (n) => (n == null ? '-' : nf.format(n));
  const pct = (x, d) => (x == null ? '-' : `${(x * 100).toFixed(d || 0)}%`);
  function ordinal(n) {
    if (n == null) return '-';
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function dateShort(iso, withDay) {
    const [y, m, d] = iso.split('-').map(Number);
    const wd = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return `${withDay === false ? '' : wd + ' '}${d} ${MONTHS[m - 1]}`;
  }
  const secs = (s) => `${(Math.round(s * 10) / 10).toFixed(Math.abs(s % 1) > 1e-9 ? 1 : 0)} s`;
  const mins = (s) => Math.round((s / 60) * 100) / 100;
  /** winning margins: 16 -> "16 s", 195 -> "3' 15\"" */
  const fmtBy = (s) => (s == null ? '-' : Math.abs(s) < 60 ? `${Math.round(Math.abs(s))} s` : fmtGap(Math.abs(s)).slice(1));

  /* names: surname, or initial + surname when the surname is shared */
  const surnameOf = (name) => {
    const parts = name.split(' ');
    const joiners = ['Van', 'Den', 'Der', 'De', 'Paret', 'Lund', 'Garcia', 'Le', 'Du'];
    let i = parts.length - 1;
    while (i > 1 && joiners.includes(parts[i - 1])) i -= 1;
    return parts.slice(i).join(' ');
  };
  const surnameCount = new Map();
  E.riders.forEach((r) => surnameCount.set(surnameOf(r.name), (surnameCount.get(surnameOf(r.name)) || 0) + 1));
  E.riders.forEach((r) => {
    const s = surnameOf(r.name);
    r.short = surnameCount.get(s) > 1 ? `${r.name[0]}. ${s}` : s;
  });
  const R = (bib) => E.riderByBib.get(bib);
  const SHORT_COUNTRY = { GBR: 'Great Britain', USA: 'United States', NLD: 'Netherlands', ARE: 'UAE' };
  E.riders.forEach((r) => { if (SHORT_COUNTRY[r.country]) r.countryName = SHORT_COUNTRY[r.country]; });
  E.teams.forEach((t) => { if (SHORT_COUNTRY[t.country]) t.countryName = SHORT_COUNTRY[t.country]; });
  E.nations.forEach((n) => { if (SHORT_COUNTRY[n.code]) n.name = SHORT_COUNTRY[n.code]; });

  const TEAM_SHORT = {
    'ALPECIN-DECEUNINCK': 'Alpecin-Deceuninck', 'ARKEA-B&B HOTELS': 'Arkéa-B&B Hotels', 'BAHRAIN VICTORIOUS': 'Bahrain Victorious',
    'COFIDIS': 'Cofidis', 'DECATHLON AG2R LA MONDIALE TEAM': 'Decathlon AG2R', 'EF EDUCATION - EASYPOST': 'EF Education-EasyPost',
    'GROUPAMA-FDJ': 'Groupama-FDJ', 'INEOS GRENADIERS': 'Ineos Grenadiers', 'INTERMARCHÉ - WANTY': 'Intermarché-Wanty',
    'ISRAEL - PREMIER TECH': 'Israel-Premier Tech', 'LIDL-TREK': 'Lidl-Trek', 'LOTTO': 'Lotto', 'MOVISTAR TEAM': 'Movistar',
    'RED BULL - BORA - HANSGROHE': 'Red Bull-Bora', 'SOUDAL QUICK-STEP': 'Soudal Quick-Step', 'TEAM JAYCO ALULA': 'Jayco AlUla',
    'TEAM PICNIC POSTNL': 'Picnic PostNL', 'TEAM VISMA | LEASE A BIKE': 'Visma | Lease a Bike', 'TOTALENERGIES': 'TotalEnergies',
    'TUDOR PRO CYCLING TEAM': 'Tudor', 'UAE TEAM EMIRATES XRG': 'UAE Team Emirates', 'UNO-X MOBILITY': 'Uno-X Mobility', 'XDS ASTANA TEAM': 'XDS Astana',
  };
  const teamShort = (t) => TEAM_SHORT[t] || t;

  /* =================== theme tokens for charts =================== */
  function tokens() {
    const cs = getComputedStyle(document.documentElement);
    const g = (n) => cs.getPropertyValue(n).trim();
    return {
      paper: g('--paper'), sheet: g('--sheet'), sheet2: g('--sheet-2'), ink: g('--ink'), ink2: g('--ink-2'), muted: g('--muted'),
      rule: g('--rule'), ruleStrong: g('--rule-strong'), grid: g('--grid'), axis: g('--axis'), maillot: g('--maillot'),
      green: g('--green'), polka: g('--polka'), a: g('--a'), b: g('--b'), good: g('--good'), bad: g('--bad'),
      terr: { flat: g('--flat'), hilly: g('--hilly'), mountain: g('--mountain'), itt: g('--itt') },
      s: [g('--s1'), g('--s2'), g('--s3'), g('--s4'), g('--s5'), g('--s6')],
      seq: [g('--seq-1'), g('--seq-2'), g('--seq-3'), g('--seq-4'), g('--seq-5')],
      divNeg: g('--div-neg'), divPos: g('--div-pos'), font: g('--font-body'), display: g('--font-display'),
    };
  }
  function blend(hex, toward, amt) {
    const p = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
    const a = p(hex), b = p(toward);
    return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * amt).toString(16).padStart(2, '0')).join('');
  }

  /* =================== charts =================== */
  const charts = [];
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver((entries) => {
    entries.forEach((en) => {
      const c = charts.find((x) => x.el === en.target);
      if (!c) return;
      if (!c.inst && en.contentRect.width > 0) draw(c);
      else if (c.inst) c.inst.resize();
    });
  }) : null;
  function chart(el, build, opts) {
    const c = { el, build, opts: opts || {}, inst: null };
    charts.push(c);
    if (ro) ro.observe(el);
    draw(c);
    return c;
  }
  function draw(c) {
    if (!window.echarts) {
      if (!c.el.firstChild) c.el.appendChild(h('div', { class: 'chart-fallback', text: 'Charts need the ECharts library, which did not load. The tables on this page still work.' }));
      return;
    }
    if (!c.el.isConnected || c.el.clientWidth === 0) return;
    if (!c.inst) {
      c.inst = window.echarts.init(c.el, null, { renderer: 'svg' });
      if (c.opts.onClick) c.inst.on('click', c.opts.onClick);
    } else c.inst.resize();
    c.inst.setOption(c.build(tokens()), true);
  }
  function redraw(c) { draw(c); }
  function dropCharts(root) {
    for (let i = charts.length - 1; i >= 0; i--) {
      if (root.contains(charts[i].el)) { if (charts[i].inst) charts[i].inst.dispose(); if (ro) ro.unobserve(charts[i].el); charts.splice(i, 1); }
    }
  }
  const redrawAll = () => charts.forEach(draw);

  /* =================== maps (route and nations) =================== */
  const GEO = window.TDF_DATA.geo;
  let mapsReady = false;
  function ensureMaps() {
    if (!mapsReady && window.echarts && GEO) { window.echarts.registerMap('tdf-fr', GEO.fr); window.echarts.registerMap('tdf-eu', GEO.eu); mapsReady = true; }
  }
  // sequential colour for a 0..1 share, and a readable label colour on top of it
  function seqColor(t, x) {
    const k = Math.max(0, Math.min(1, x)) * (t.seq.length - 1), i = Math.min(t.seq.length - 2, Math.floor(k));
    return blend(t.seq[i], t.seq[i + 1], k - i);
  }
  function onColor(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? '#14181d' : '#ffffff';
  }
  // a small loop for stages that start and finish in the same town
  const loopRing = ([lon, lat]) => Array.from({ length: 17 }, (_, i) => { const a = (i / 16) * 2 * Math.PI; return [lon + (0.16 * Math.cos(a)) / 0.69, lat + 0.15 + 0.16 * Math.sin(a)]; });
  function routeOption(t, sel) {
    ensureMaps();
    const P = GEO.places, B = GEO.badges;
    const lines = E.stages.map((s) => {
      const on = s.id === sel;
      return { coords: B[s.id].loop ? loopRing(P[s.start]) : [P[s.start], P[s.finish]], stage: s.id,
        lineStyle: { color: t.terr[s.code], width: on ? 5 : 2.5, opacity: on ? 1 : 0.45 } };
    });
    const leaders = E.stages.filter((s) => Math.hypot(B[s.id].at[0] - B[s.id].anchor[0], B[s.id].at[1] - B[s.id].anchor[1]) > 0.05)
      .map((s) => ({ coords: [B[s.id].anchor, B[s.id].at], lineStyle: { color: t.ruleStrong, width: 1, opacity: 0.8 } }));
    const badges = E.stages.map((s) => {
      const on = s.id === sel;
      return { value: B[s.id].at, stage: s.id, symbolSize: on ? 26 : 18, z: on ? 10 : 5,
        itemStyle: { color: t.terr[s.code], borderColor: on ? t.ink : t.sheet, borderWidth: on ? 2.5 : 1.5, opacity: on ? 1 : 0.9 },
        label: { show: true, formatter: String(s.id), color: '#fff', fontSize: on ? 12 : 10, fontWeight: 700 } };
    });
    const st = E.stageById.get(sel);
    const towns = (st.start === st.finish ? [[st.start, 'right']] : [[st.start, 'left'], [st.finish, 'right']]).map(([n, pos], i) => ({
      value: P[n], name: n, label: { show: true, position: P[n][0] > 6 ? 'left' : pos, formatter: (st.start === st.finish ? '' : i ? 'Finish: ' : 'Start: ') + n,
        color: t.ink, fontSize: 11, fontWeight: 600, textBorderColor: t.sheet, textBorderWidth: 3 } }));
    return Object.assign(base(t), {
      geo: { map: 'tdf-fr', roam: false, silent: true, aspectScale: 0.69, layoutCenter: ['50%', '50%'], layoutSize: '100%',
        itemStyle: { areaColor: t.sheet2, borderColor: t.ruleStrong, borderWidth: 0.6 },
        regions: [{ name: 'France', itemStyle: { areaColor: blend(t.maillot, t.sheet, 0.8), borderColor: t.ruleStrong } }] },
      tooltip: Object.assign(base(t).tooltip, { trigger: 'item', formatter: (p) => {
        const s = p.data && p.data.stage && E.stageById.get(p.data.stage);
        if (!s) return p.data && p.data.name ? esc(p.data.name) : '';
        return tipHead(`Stage ${s.id} · ${TL[s.code]}`) + `<div>${esc(s.route)} · ${s.distance.toFixed(0)} km</div>` + tipRow(t.terr[s.code], 'Winner', R(s.winnerBib).name);
      } }),
      series: [
        { type: 'lines', coordinateSystem: 'geo', polyline: true, silent: true, data: leaders, z: 2 },
        { type: 'lines', coordinateSystem: 'geo', polyline: true, data: lines, z: 3, emphasis: { lineStyle: { width: 5, opacity: 1 } } },
        { type: 'scatter', coordinateSystem: 'geo', data: badges, z: 5, emphasis: { scale: 1.15 } },
        { type: 'scatter', coordinateSystem: 'geo', data: towns, symbolSize: 7, itemStyle: { color: t.ink }, silent: true, z: 6 },
      ],
    });
  }
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redrawAll);
  new MutationObserver(redrawAll).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

  function base(t) {
    return {
      animationDuration: 350,
      textStyle: { fontFamily: t.font, color: t.ink2, fontSize: 12 },
      tooltip: {
        confine: true, backgroundColor: t.sheet, borderColor: t.ruleStrong, borderWidth: 1, padding: [8, 10],
        textStyle: { color: t.ink, fontFamily: t.font, fontSize: 13 }, extraCssText: 'border-radius:8px;box-shadow:0 10px 28px -14px rgba(0,0,0,.45);',
      },
      grid: { left: 8, right: 24, top: 18, bottom: 6, containLabel: true },
    };
  }
  const axisCat = (t, data, extra) => Object.assign({
    type: 'category', data, axisLine: { lineStyle: { color: t.axis } }, axisTick: { show: false },
    axisLabel: { color: t.ink2, fontSize: 12 }, splitLine: { show: false },
  }, extra || {});
  const axisVal = (t, extra) => Object.assign({
    type: 'value', axisLine: { show: false }, axisTick: { show: false },
    axisLabel: { color: t.muted, fontSize: 11 }, splitLine: { lineStyle: { color: t.grid, width: 1 } },
    nameTextStyle: { color: t.muted, fontSize: 11 },
  }, extra || {});
  // y axes: the title starts at the axis line and runs right, so it is never clipped at the left edge
  const axisY = (t, extra) => axisVal(t, Object.assign({ nameGap: 10, nameTextStyle: { color: t.muted, fontSize: 11, align: 'left' } }, extra || {}));
  const tipRow = (sw, label, value) => `<div style="display:flex;align-items:center;gap:8px;justify-content:space-between"><span style="display:inline-flex;align-items:center;gap:6px">${sw ? `<i style="width:10px;height:10px;border-radius:3px;background:${sw};display:inline-block"></i>` : ''}${esc(label)}</span><b style="font-variant-numeric:tabular-nums">${esc(value)}</b></div>`;
  const tipHead = (s) => `<div style="font-weight:600;margin-bottom:4px">${esc(s)}</div>`;
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  /* =================== atoms =================== */
  function glyph(code, color) {
    const s = svg('svg', { width: '22', height: '13', viewBox: '0 0 24 14', 'aria-hidden': 'true' });
    const st = { fill: 'none', stroke: color || `var(--${code})`, 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    if (code === 'flat') s.appendChild(svg('path', { d: 'M2 9.5 H22', ...st }));
    if (code === 'hilly') s.appendChild(svg('path', { d: 'M2 11 C5 11 6 6 9 6 C12 6 12 9.5 15 9.5 C18 9.5 18.5 4.5 22 4.5', ...st }));
    if (code === 'mountain') s.appendChild(svg('path', { d: 'M2 12 L7.5 7 L10.5 9 L15.5 2 L19 7.5 L22 5.5', ...st }));
    if (code === 'itt') { s.appendChild(svg('circle', { cx: '12', cy: '7', r: '5.5', ...st })); s.appendChild(svg('path', { d: 'M12 7 V3.8 M12 7 L14.6 8.6', ...st })); }
    return s;
  }
  const terrEl = (code, label) => h('span', { class: 'terr' }, glyph(code), label === false ? null : TL[code]);
  function riderEl(bib, opts) {
    const r = R(bib);
    const o = opts || {};
    return h('span', { class: 'rider' },
      o.bib === false ? null : h('span', { class: 'bib', 'aria-hidden': 'true', text: String(bib) }),
      h('span', null,
        h('button', { class: 'rlink', type: 'button', dataset: { rider: String(bib) }, title: `Open ${r.name}'s profile`, text: o.short ? r.short : r.name }),
        o.team === false ? null : [' ', h('span', { class: 'team-s', text: teamShort(r.team) })]));
  }
  // also = this panel supports a function whose main panel is elsewhere on the tab (badge drawn dashed).
  const fnTag = (code, name, also) => h('span', { class: also ? 'fn also' : 'fn', title: `${also ? 'Also part of view' : 'View'} ${code}: ${name}` }, code);
  function panel(o) {
    const head = h('div', { class: 'panel-head' },
      h('div', null,
        h('h2', null, o.title, o.fn ? o.fn.map((f) => fnTag(f[0], f[1])) : null, o.fnAlso ? o.fnAlso.map((f) => fnTag(f[0], f[1], true)) : null),
        o.sub ? h('p', { class: 'sub', text: o.sub }) : null),
      o.tools ? h('div', { class: 'panel-tools' }, o.tools) : null);
    const body = h('div', { style: 'display:flex;flex-direction:column;gap:12px;min-width:0' });
    const el = h('section', { class: `panel ${o.span ? 'span-' + o.span : ''}` }, head, body);
    // data-fn marks the one main panel per function (goToFunction jumps there); data-fn-also marks supporting panels.
    if (o.fn) el.dataset.fn = o.fn.map((f) => f[0]).join(' ');
    if (o.fnAlso) el.dataset.fnAlso = o.fnAlso.map((f) => f[0]).join(' ');
    if (o.id) el.id = o.id;
    return { el, body, head };
  }
  const tile = (label, value, foot, small) => h('div', { class: 'tile' }, h('span', { class: 'label', text: label }), h('span', { class: `value${small ? ' small' : ''}`, text: value }), foot ? h('span', { class: 'foot' }, foot) : null);
  function seg(options, value, onChange, label) {
    const wrap = h('div', { class: 'seg', role: 'group', 'aria-label': label || 'Choose' });
    const btns = options.map((o) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(o.value === value), on: { click: () => { btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b))); onChange(o.value); } } }, o.icon || null, o.label);
      return b;
    });
    add(wrap, btns);
    return wrap;
  }
  function selectEl(id, groups, value, onChange, label) {
    const s = h('select', { class: 'sel', id, 'aria-label': label });
    groups.forEach((g) => {
      const parent = g.label ? h('optgroup', { label: g.label }) : s;
      g.options.forEach((o) => { const op = h('option', { value: String(o.value), text: o.label }); if (String(o.value) === String(value)) op.selected = true; parent.appendChild(op); });
      if (g.label) s.appendChild(parent);
    });
    s.addEventListener('change', () => onChange(s.value));
    return s;
  }
  // "Find any rider" box: type part of a name and pick from the list, or press Enter for the first match.
  // Options: filter (which riders to offer), label (accessible name).
  let finderSeq = 0;
  function riderFinder(onPick, o) {
    const opt = o || {};
    const id = `rider-find-${++finderSeq}`;
    const byLabel = new Map();
    const list = h('datalist', { id: `${id}-list` });
    E.riders.filter(opt.filter || (() => true)).sort((a, b) => (a.gcRank ?? 999) - (b.gcRank ?? 999) || a.name.localeCompare(b.name)).forEach((r) => {
      const l = `${r.name} · ${teamShort(r.team)} · ${r.finished ? `#${r.gcRank} overall` : r.status.toLowerCase()}`;
      byLabel.set(l, r.bib); list.appendChild(h('option', { value: l }));
    });
    const input = h('input', { type: 'search', class: 'finder', id, list: `${id}-list`, placeholder: 'Find any rider…', autocomplete: 'off', 'aria-label': opt.label || 'Find any rider to add to the chart' });
    const pick = () => { const b = byLabel.get(input.value); if (b != null) { onPick(b); input.value = ''; } };
    input.addEventListener('input', pick);
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const q = input.value.trim().toLowerCase(); if (!q) return;
      const hit = [...byLabel.keys()].find((l) => l.toLowerCase().includes(q));
      if (hit) { input.value = hit; pick(); }
    });
    return h('label', { class: 'field finder-wrap', for: id }, h('span', { text: 'Add' }), input, list);
  }
  const chipLabel = (b) => (R(b).finished ? R(b).short : `${R(b).short} (out)`);
  function tbl(cols, rows, o) {
    const opt = o || {};
    const thead = h('thead', null, h('tr', null, cols.map((c) => h('th', { class: c.n ? 'n' : null, scope: 'col', text: c.label }))));
    const tbody = h('tbody');
    rows.forEach((r, i) => {
      const tr = h('tr', { class: [opt.onRow ? 'click' : '', opt.rowClass ? opt.rowClass(r) : ''].join(' ').trim() || null });
      if (opt.onRow) { tr.addEventListener('click', (e) => { if (e.target.closest('button,a,select,input')) return; opt.onRow(r, i); }); tr.tabIndex = 0; tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') opt.onRow(r, i); }); }
      cols.forEach((c) => {
        const v = c.render ? c.render(r, i) : r[c.key];
        tr.appendChild(h('td', { class: [c.n ? 'n' : '', c.cls || ''].join(' ').trim() || null }, v == null ? '-' : v));
      });
      tbody.appendChild(tr);
    });
    return h('div', { class: `tbl-wrap${opt.scroll ? ' scroll' : ''}` }, h('table', { class: 'tbl' }, opt.caption ? h('caption', { class: 'note', style: 'text-align:left;caption-side:bottom;padding-top:6px', text: opt.caption }) : null, thead, tbody));
  }
  const legend = (items) => h('div', { class: 'legend' }, items.map((it) => h('span', null, h('i', { class: it.line ? 'line' : null, style: `background:${it.color}` }), it.label)));
  function chartBox(cls) { return h('div', { class: `chart ${cls || ''}`.trim(), role: 'img' }); }

  /* =================== routing =================== */
  const VIEWS = ['race', 'outright', 'stages', 'terrain', 'jerseys', 'form', 'teams', 'h2h', 'nations', 'method'];
  const built = new Set();
  const renderers = {};
  function route() {
    const name = (location.hash || '#race').slice(1);
    show(VIEWS.includes(name) ? name : 'race');
  }
  function show(name) {
    VIEWS.forEach((v) => { document.getElementById(`view-${v}`).hidden = v !== name; });
    document.querySelectorAll('.tabs a').forEach((a) => { if (a.getAttribute('href') === `#${name}`) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const root = document.getElementById(`view-${name}`);
    if (!built.has(name)) { built.add(name); clear(root); renderers[name](root); }
    charts.forEach((c) => { if (root.contains(c.el)) draw(c); });
    const active = document.querySelector('.tabs a[aria-current="page"]');
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function go(name) { if (location.hash !== `#${name}`) location.hash = name; else show(name); window.scrollTo({ top: 0 }); }
  // The masthead has one or two rows depending on the width. Jumps to a panel use --mast-h
  // (see scroll-margin-top in styles.css) so the panel title never hides under it.
  function trackMasthead() {
    const m = document.querySelector('.masthead');
    if (!m) return;
    const set = () => document.documentElement.style.setProperty('--mast-h', `${Math.ceil(m.getBoundingClientRect().height)}px`);
    set();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(set).observe(m);
    else window.addEventListener('resize', set);
  }
  trackMasthead();
  window.addEventListener('hashchange', () => { route(); window.scrollTo({ top: 0 }); });

  /* global delegation: rider links open the profile; stage links jump to the stage */
  document.addEventListener('click', (e) => {
    const rb = e.target.closest('[data-rider]');
    if (rb) { e.preventDefault(); openRider(Number(rb.dataset.rider)); return; }
    const sb = e.target.closest('[data-goto-stage]');
    if (sb) { e.preventDefault(); gotoStage(Number(sb.dataset.gotoStage)); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeRider(); });

  /* shared state across views */
  const S = {
    outrightBib: 1, story: [], stage: 1, terrain: 'flat', h2hMode: 'riders', a: 1, b: 11,
    ta: 'UAE TEAM EMIRATES XRG', tb: 'TEAM VISMA | LEASE A BIKE', team: E.TEAMCLASS.list[0].team,
  };
  const hooks = {};
  function gotoStage(id) { S.stage = id; if (hooks.stage) hooks.stage(); go('stages'); }

  /* =================== race card =================== */
  renderers.race = (root) => {
    const w = R(E.gcFinal[0].bib), sec = R(E.gcFinal[1].bib);
    const km = E.stages.reduce((a, s) => a + s.distance, 0);
    const first = E.stages[0], last = E.stages[E.stages.length - 1];
    const changes = E.leaders.filter((l) => l.changed).length;
    const yellowRiders = new Set(E.leaders.map((l) => l.bib)).size;
    const nations = new Set(E.riders.filter((r) => r.country !== 'XXX').map((r) => r.country)).size;
    const finished = E.riders.filter((r) => r.finished).length;
    const winners = new Set(E.stages.map((s) => s.winnerBib)).size;

    add(root, h('div', { class: 'hero' },
      h('div', null,
        h('p', { class: 'eyebrow', text: `Tour de France 2025 · ${dateShort(first.date, false)} to ${dateShort(last.date, false)} · ${E.stages.length} stages · ${fmtInt(Math.round(km))} km` }),
        h('h1', null, h('span', { class: 'hl', text: w.name }), ` won by ${fmtGap(E.gcFinal[1].gap).slice(1)}. Here is how the 2025 race played out.`),
        h('p', { class: 'lede', text: 'This page answers: what happened in the 2025 Tour, on one screen? Every number is a summary of settled 2025 results, not a prediction. Each tab above answers one question. Click any rider name to see their full race.' })),
      h('div', { class: 'tiles' },
        tile('Riders', fmtInt(E.riders.length), `${E.teams.length} teams of 8`),
        tile('Nations', String(nations), '+1 rider with no listed nationality'),
        tile('Finished', `${finished}`, `${pct(finished / E.riders.length)} of starters reached Paris`),
        tile('Stage winners', String(winners), `across ${E.stages.length} stages`),
        tile('Lead changes', String(changes), `${yellowRiders} riders wore yellow`),
        tile('Left the race', String(E.exits.length), `${E.exits.filter((x) => x.reason === 'DNS').length} did not start a stage, ${E.exits.filter((x) => x.reason !== 'DNS').length} abandoned`))));

    // jersey winners (official)
    const off = (c) => E.official.filter((o) => o.c === c).sort((a, b) => a.rank - b.rank);
    const jersey = (c, cls, label, val) => {
      const o = off(c)[0];
      return h('div', { class: 'jcard' },
        h('div', { class: 'jhead' }, h('span', { class: `jersey ${cls}` }), label),
        h('div', { class: 'jwho' }, o.bib ? h('button', { class: 'rlink', type: 'button', dataset: { rider: String(o.bib) }, text: R(o.bib).name }) : teamShort(o.name)),
        h('div', { class: 'jval', text: val(o) }));
    };
    const dataGap = E.gcFinal[0].cum - off('gc')[0].num;
    const jp = panel({ title: 'Jersey winners', sub: 'Official final classifications. Our data rebuilds the overall, young-rider and team standings exactly; points and mountains need official figures because sprint and climb points are not in the data.' });
    add(jp.body, h('div', { class: 'jerseys' },
      jersey('gc', 'yellow', 'Yellow · overall', (o) => fmtTime(o.num)),
      jersey('points', 'green', 'Green · points', (o) => `${o.num} points`),
      jersey('kom', 'polka', 'Polka-dot · mountains', (o) => `${o.num} points`),
      jersey('young', 'white', 'White · young rider', (o) => fmtTime(o.num)),
      jersey('team', 'team', 'Best team', (o) => fmtTime(o.num))),
    h('p', { class: 'note' }, `Stage 21 was timed for the overall 50.3 km from the finish (rain was forecast), so official totals are ${fmtGap(dataGap).slice(1)} shorter than the race-data totals used elsewhere. Gaps between riders are identical.`));
    root.appendChild(jp.el);

    // road book
    // Stage 21 was timed for the overall 50.3 km from the finish, so its times say nothing about a bunch finish.
    const NEUTRALISED = new Set([21]);
    const rp = panel({ title: 'Road book', sub: 'Every stage by race week, with its terrain and winner. The rest days fell on 15 and 21 July. Click a stage to open it.' });
    const book = h('div', { class: 'roadbook' });
    [1, 2, 3].forEach((wk) => {
      const st = E.stages.filter((s) => s.week === wk);
      const row = h('div', { class: 'rb-row' }, h('div', { class: 'rb-week' }, h('b', { text: `Week ${wk}` }), h('span', { text: `Stages ${st[0].id} to ${st[st.length - 1].id}` })));
      const strip = h('div', { class: 'rb-strip' });
      st.forEach((s) => {
        const wr = R(s.winnerBib);
        strip.appendChild(h('button', { class: 'rb', type: 'button', style: `--tc:var(--${s.code})`, dataset: { gotoStage: String(s.id) }, 'aria-label': `Stage ${s.id}, ${TL[s.code]}, won by ${wr.name}` },
          h('span', { class: 'rb-n', text: String(s.id) }),
          h('span', { class: 'rb-d', text: dateShort(s.date) }),
          terrEl(s.code),
          h('span', { class: 'rb-w', text: wr.short }),
          h('span', { class: 'rb-k', text: `${s.distance.toFixed(1)} km${NEUTRALISED.has(s.id) ? ' · times frozen' : s.bunch ? ' · bunch' : ''}` })));
      });
      row.appendChild(strip);
      book.appendChild(row);
    });
    add(rp.body, book, h('div', { class: 'legend' }, TERR.map((c) => h('span', null, terrEl(c), `${E.stages.filter((s) => s.code === c).length} stages`))));
    root.appendChild(rp.el);

    // bet notes
    const lastChange = E.leaders.reduce((acc, l, i) => (l.changed ? i : acc), 0);
    const lc = E.leaders[lastChange];
    const lcStage = E.stageById.get(lc.stage);
    const flat = E.stages.filter((s) => s.code === 'flat' && !NEUTRALISED.has(s.id));
    const flatBunch = flat.filter((s) => s.bunch);
    const flatWinners = new Set(flatBunch.map((s) => s.winnerBib)).size;
    const earlyLeaders = new Set(E.leaders.slice(0, lastChange).map((l) => l.bib)).size;
    const flatWins = {};
    flatBunch.forEach((s) => { const n = R(s.winnerBib).short; flatWins[n] = (flatWins[n] || 0) + 1; });
    const flatTop = Object.entries(flatWins).sort((a, b) => b[1] - a[1]).filter(([, n]) => n > 1).map(([n, k]) => `${n} ${k}`).join(', ');
    const odd = flat.filter((s) => !s.bunch);
    const mtn = E.stages.filter((s) => s.code === 'mountain');
    const mtnGc = mtn.filter((s) => s.winnerFinalGc != null && s.winnerFinalGc <= 10);
    const outsiders = mtn.filter((s) => !(s.winnerFinalGc != null && s.winnerFinalGc <= 10));
    const outsideWins = {};
    outsiders.forEach((s) => { const n = R(s.winnerBib).short; outsideWins[n] = (outsideWins[n] || 0) + 1; });
    const bestOutsider = Object.entries(outsideWins).sort((a, b) => b[1] - a[1])[0];
    const hp = E.h2h(E.gcFinal[0].bib, E.gcFinal[1].bib);
    const yo = E.youngClassification();
    const youngTop10 = E.gcFinal.slice(0, 10).filter((e) => R(e.bib).young).length;
    const teamWinner = E.TEAMCLASS.list[0], teamSecond = E.TEAMCLASS.list[1];
    const mostWinsTeam = E.teams.slice().sort((a, b) => b.wins - a.wins)[0];
    const topNation = E.nations[0];
    const mostRiders = E.nations.slice().sort((a, b) => b.riders - a.riders)[0];
    const slip = (mkt, title, body, bet, href, linkText) => h('article', { class: 'slip' },
      h('div', { class: 'slip-k' }, h('span', { text: 'Bet note' }), h('span', { class: 'mkt', text: mkt })),
      h('div', { class: 'slip-t', text: title }),
      h('p', { class: 'slip-b', text: body }),
      h('p', { class: 'slip-bet' }, h('b', { text: 'What the 2025 results show: ' }), bet),
      h('a', { href, text: `${linkText} →` }));
    const sp = panel({ title: 'Bet notes from 2025', sub: 'Each note describes settled 2025 results. None of them is a tip or a prediction, and each links to the tab that backs it up.' });
    add(sp.body, h('div', { class: 'slips' },
      slip('Overall winner', `Yellow was settled on stage ${lc.stage}`,
        `${R(lc.bib).short} took the lead for good at ${lcStage.finish} and led the last ${E.stages.length - lc.stage + 1} stages. That evening the lead was ${fmtGap(lc.margin).slice(1)}, already ${pct(lc.margin / E.gcFinal[1].gap)} of the final margin.`,
        `Before stage ${lc.stage}, ${earlyLeaders} different riders wore the yellow jersey. After it, the leader never changed.`, '#outright', 'Overall winner'),
      slip('Stage winner', `${flatBunch.length} of ${flat.length} flat stages ended in a bunch`,
        `A bunch finish means at least ${E.BUNCH_MIN} riders shared the winner’s time. ${flatTop ? `Riders with more than one: ${flatTop}.` : ''}${odd.length ? ` The exception: stage ${odd.map((s) => s.id).join(', ')} (${odd.map((s) => R(s.winnerBib).short).join(', ')}).` : ''} Stage 21 is left out: its times were taken 50 km from the finish.`,
        `${flatWinners} different riders won the ${flatBunch.length} bunch finishes.`, '#terrain', 'Terrain'),
      slip('Stage winner', `Only ${mtnGc.length} of ${mtn.length} mountain stages went to a top-10 rider`,
        `The rest went to climbers outside the final top 10${bestOutsider ? `; ${bestOutsider[0]} won ${bestOutsider[1]}` : ''}. The favourites still finished top 10 on almost every mountain day.`,
        `Mountain stage wins: ${mtnGc.length} to riders in the final top 10, ${mtn.length - mtnGc.length} to riders outside it.`, '#terrain', 'Terrain'),
      slip('Top 10', `${w.short} was top 10 on ${w.top10s} of ${w.starts} stages`,
        `That is ${pct(w.top10s / w.starts)} of his stages, more top 10 finishes than any other rider, with an average stage place of ${w.avgRank.toFixed(1)}.`,
        `Top 10 stage finishes: ${w.short} ${w.top10s}, ${sec.short} ${sec.top10s}.`, '#form', 'Form and risk'),
      slip('Head-to-head', `${w.short} beat ${sec.short} on ${hp.aAhead} of ${hp.common} stages`,
        `By terrain: ${TERR.map((c) => `${TL[c].toLowerCase()} ${hp.byTerrain[c].a}-${hp.byTerrain[c].b}`).join(', ')}.`,
        `Over the ${hp.common} stages both finished, the record was ${hp.aAhead} to ${hp.bAhead}.`, '#h2h', 'Head-to-head'),
      slip('Young rider', `${R(yo[0].bib).short} won white by ${fmtGap(yo[1].gap).slice(1)}`,
        `${youngTop10} of the overall top 10 were born in 2000 or later. The young-rider race went to the wire between ${R(yo[0].bib).short} and ${R(yo[1].bib).short}.`,
        `The best young rider, ${R(yo[0].bib).short}, finished ${ordinal(R(yo[0].bib).gcRank)} overall.`, '#jerseys', 'Jerseys'),
      slip('Teams', `${teamShort(teamWinner.team)} won the team prize by ${fmtGap(teamSecond.gap).slice(1)}`,
        `${teamShort(mostWinsTeam.name)} won the most stages (${mostWinsTeam.wins}). The team prize rewards depth: three riders count every day.`,
        teamWinner.team === mostWinsTeam.name ? 'The team prize winner also won the most stages.' : 'The team prize and the most stage wins went to different teams.', '#teams', 'Teams'),
      slip('Nationality', `${topNation.name} won ${topNation.wins} stages`,
        `${mostRiders.name} sent the most riders (${mostRiders.riders}) and won ${mostRiders.wins} stage${mostRiders.wins === 1 ? '' : 's'}.`,
        `${topNation.name} had ${topNation.riders} rider${topNation.riders === 1 ? '' : 's'} in the race.`, '#nations', 'Nations')));
    root.appendChild(sp.el);
  };

  /* =================== outright: E1, E10, E7 =================== */
  renderers.outright = (root) => {
    add(root, h('div', { class: 'view-head' }, h('div', null,
      h('p', { class: 'eyebrow', text: 'Overall winner (in betting: the outright) · the yellow jersey' }),
      h('h1', { text: 'How the 2025 Tour was won' }),
      h('p', { class: 'lede', text: 'This tab answers: who won the race overall, and on which days was it decided? The yellow jersey goes to the rider with the lowest total time. Pick a rider in the standings to see the day they gained or lost the most time on the top ten, then replay the race without time bonuses or penalties.' }))));

    // E1 leaderboard
    let showAll = false;
    const lb = panel({ title: 'Final overall standings', fn: [['E1', 'GC leaderboard with contextual descent']], span: 5, sub: 'Total adjusted time: finish time minus time bonuses plus time penalties. Click a row to see that rider’s biggest day against the top ten.' });
    const lbBody = h('div');
    const more = h('button', { class: 'btn', type: 'button', text: 'Show all 160 finishers', on: { click: () => { showAll = !showAll; more.textContent = showAll ? 'Show top 20' : 'Show all 160 finishers'; drawLb(); } } });
    function drawLb() {
      clear(lbBody);
      const rows = showAll ? E.gcFinal : E.gcFinal.slice(0, 20);
      lbBody.appendChild(tbl([
        { label: 'Pos', render: (e) => String(e.position), cls: 'pos' },
        { label: 'Rider', render: (e) => riderEl(e.bib) },
        { label: 'Time', n: true, render: (e) => (e.position === 1 ? fmtTime(e.cum) : fmtGap(e.gap)) },
        { label: 'Wins', n: true, render: (e) => String(R(e.bib).wins || '-') },
        { label: '', render: (e) => (R(e.bib).young ? h('span', { class: 'pill', title: 'Young rider (born 2000 or later)', text: 'Young' }) : '') },
      ], rows, { onRow: (e) => { S.outrightBib = e.bib; drawLb(); drawPivot(); addStory(e.bib); }, rowClass: (e) => (e.bib === S.outrightBib ? 'sel' : ''), scroll: showAll }));
    }
    add(lb.body, lbBody, more);
    drawLb();

    // E1 descent: pivotal day
    const pv = panel({ title: 'Biggest day against the top ten', fnAlso: [['E1', 'GC leaderboard with contextual descent']], span: 7 });
    const pvText = h('p', { class: 'verdict' });
    const pvBox = chartBox();
    const pvNote = h('p', { class: 'note', text: 'Each bar: the rider’s adjusted time minus the median of the final top 10 that day. Below zero = faster than the contenders. Click a bar to open that stage.' });
    add(pv.body, pvText, legend([{ color: 'var(--div-neg)', label: 'Faster than the top-10 contenders (median)' }, { color: 'var(--div-pos)', label: 'Slower than the top-10 contenders (median)' }]), pvBox, pvNote);
    let pvChart;
    function drawPivot() {
      const r = R(S.outrightBib);
      const p = E.pivotal(r.bib);
      const d = p.pivotal;
      const st = E.stageById.get(d.stage);
      const gained = d.delta < 0;
      clear(pvText);
      add(pvText, `${r.name}’s biggest day was stage ${d.stage}, ${st.route} (${TL[st.code].toLowerCase()}): `,
        h('span', { class: gained ? 'move-up' : 'move-down', text: `${secs(Math.abs(d.delta))} ${gained ? 'faster' : 'slower'}` }),
        ' than the median of the final top 10.');
      if (!pvChart) {
        pvChart = chart(pvBox, (t) => {
          const pp = E.pivotal(S.outrightBib);
          return Object.assign(base(t), {
            grid: { left: 8, right: 16, top: 24, bottom: 6, containLabel: true },
            xAxis: axisCat(t, pp.days.map((x) => String(x.stage)), { name: 'Stage', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: t.muted } }),
            yAxis: axisY(t, { name: 'seconds vs top-10 median', nameLocation: 'end', nameGap: 10 }),
            tooltip: Object.assign(base(t).tooltip, { trigger: 'item', formatter: (prm) => {
              const x = pp.days[prm.dataIndex]; const s2 = E.stageById.get(x.stage);
              const gc = E.gcPositionAfter(S.outrightBib, x.stage);
              return tipHead(`Stage ${x.stage} · ${TL[s2.code]}`) + `<div style="color:${t.muted};margin-bottom:4px">${esc(s2.route)}</div>` + tipRow(null, 'vs top-10 median', `${x.delta > 0 ? '+' : x.delta < 0 ? '-' : ''}${secs(Math.abs(x.delta))}`) + tipRow(null, 'Overall after stage', gc ? ordinal(gc.position) : '-');
            } }),
            series: [{
              type: 'bar', barMaxWidth: 22,
              data: pp.days.map((x) => ({
                value: x.delta,
                itemStyle: { color: x.delta < 0 ? t.divNeg : t.divPos, opacity: x.stage === pp.pivotal.stage ? 1 : 0.5, borderRadius: x.delta < 0 ? [0, 0, 4, 4] : [4, 4, 0, 0] },
                label: x.stage === pp.pivotal.stage ? { show: true, position: x.delta < 0 ? 'bottom' : 'top', color: t.ink, fontWeight: 600, formatter: () => `${x.delta > 0 ? '+' : '-'}${secs(Math.abs(x.delta))}` } : { show: false },
              })),
            }],
          });
        }, { onClick: (prm) => { const x = E.pivotal(S.outrightBib).days[prm.dataIndex]; if (x) gotoStage(x.stage); } });
      } else redraw(pvChart);
    }
    root.appendChild(lb.el); root.appendChild(pv.el);
    drawPivot();

    // E10 storyline
    const story = panel({ title: 'The fight for yellow, stage by stage', fn: [['E10', 'Temporal GC storyline']], sub: 'Minutes behind the race leader after each stage. Shaded bands are mountain stages (red) and time trials (violet). Dashed yellow lines mark the stages where the yellow jersey (race leader) changed hands. Pick up to six riders with the buttons, the search box, a team, or a row in the standings above.' });
    const chipsBox = h('div', { class: 'chips' });
    // team filter: show a team's six best placed riders (riders who left the race come last)
    const teamPick = selectEl('story-team', [{ options: [{ value: '', label: 'Show a team…' }, ...E.teams.slice().sort((a, b) => teamShort(a.name).localeCompare(teamShort(b.name))).map((tm) => ({ value: tm.name, label: teamShort(tm.name) }))] }], '', (v) => { if (v) showTeam(v); }, 'Show the riders of one team on the chart');
    // search any starter, including riders who left the race (their line stops at their last stage)
    const pickRow = h('div', { class: 'story-pick' }, chipsBox, riderFinder((b) => addStory(b)), teamPick);
    const storyBox = chartBox('tall');
    const ribbon = h('div', { class: 'yellow-ribbon', 'aria-label': 'Yellow jersey after each stage' });
    E.leaders.forEach((l) => ribbon.appendChild(h('div', { class: l.changed || l.stage === 1 ? 'chg' : null, title: `After stage ${l.stage}: ${R(l.bib).name} (lead ${fmtGap(l.margin)})`, text: R(l.bib).short })));
    const emptyNote = h('p', { class: 'note story-empty', role: 'status' });
    add(story.body, pickRow, emptyNote, storyBox, h('p', { class: 'note', text: 'Yellow jersey after each stage (bold = new leader):' }), ribbon);
    root.appendChild(story.el);
    const slots = new Map();
    S.story = E.gcFinal.slice(0, 5).map((e) => e.bib);
    S.story.forEach((b, i) => slots.set(b, i));
    function addStory(bib) {
      if (S.story.includes(bib)) return;
      if (S.story.length >= 6) { const out = S.story.shift(); slots.delete(out); }
      const used = new Set(slots.values());
      let k = 0; while (used.has(k)) k++;
      slots.set(bib, k); S.story.push(bib);
      drawChips(); redraw(storyChart);
    }
    function showTeam(name) {
      const bibs = E.riders.filter((r) => r.team === name).sort((a, b) => (a.gcRank ?? 999) - (b.gcRank ?? 999) || a.bib - b.bib).slice(0, 6).map((r) => r.bib);
      S.story = []; slots.clear();
      bibs.forEach((b, i) => { slots.set(b, i); S.story.push(b); });
      drawChips(); redraw(storyChart);
    }
    function drawChips() {
      clear(chipsBox);
      emptyNote.textContent = S.story.length ? '' : 'No riders picked. Add up to six with the buttons, the search box or the standings above.';
      emptyNote.hidden = S.story.length > 0;
      const cands = [...new Set([...E.gcFinal.slice(0, 12).map((e) => e.bib), ...S.story])];
      const t = tokens();
      cands.forEach((b) => {
        const on = S.story.includes(b);
        const r = R(b);
        chipsBox.appendChild(h('button', { type: 'button', class: 'chip', 'aria-pressed': String(on), title: r.finished ? `${r.name}: #${r.gcRank} overall` : `${r.name}: ${r.status.toLowerCase()}`, on: { click: () => {
          if (on) { S.story = S.story.filter((x) => x !== b); slots.delete(b); drawChips(); redraw(storyChart); } else addStory(b);
        } } }, h('span', { class: 'sw', style: `background:${on ? t.s[slots.get(b)] : 'transparent'};border:1px solid var(--rule-strong)` }), chipLabel(b)));
      });
    }
    drawChips();
    const storyChart = chart(storyBox, (t) => {
      const bands = (code, color) => E.stages.filter((s) => s.code === code).map((s) => [{ xAxis: s.id - 0.5, itemStyle: { color: blend(color, t.sheet, 0.86) } }, { xAxis: s.id + 0.5 }]);
      // riders who left the race get points only for the stages they completed, so their line simply stops
      const series = S.story.map((bib) => {
        const r = R(bib);
        return {
          type: 'line', name: r.short, showSymbol: !r.finished, symbolSize: 6, lineStyle: { width: 2, color: t.s[slots.get(bib)] }, itemStyle: { color: t.s[slots.get(bib)] },
          emphasis: { focus: 'series' }, endLabel: { show: true, formatter: r.finished ? r.short : `${r.short} · out`, color: t.ink2, fontSize: 12 },
          data: E.stages.map((s) => { const e = E.gcPositionAfter(bib, s.id); return e ? [s.id, mins(e.gap)] : null; }).filter(Boolean),
        };
      });
      // the stage bands sit on their own empty series so they stay visible when no rider is picked
      // dashed lines where the yellow jersey changed hands, labelled with the new leader
      const swaps = E.leaders.filter((l) => l.changed).map((l) => ({ xAxis: l.stage, label: { formatter: `${R(l.bib).short} in yellow` } }));
      series.unshift({ type: 'line', name: 'stage types', data: [], silent: true, tooltip: { show: false },
        markArea: { silent: true, data: [...bands('mountain', t.terr.mountain), ...bands('itt', t.terr.itt)] },
        markLine: { silent: true, symbol: ['none', 'none'], animation: false, lineStyle: { color: t.maillot, type: 'dashed', width: 2 },
          label: { position: 'insideEndTop', color: t.ink, fontSize: 11, fontWeight: 600 }, data: swaps } });
      const empty = S.story.length === 0;
      return Object.assign(base(t), {
        grid: { left: 8, right: 90, top: 20, bottom: 6, containLabel: true },
        xAxis: axisVal(t, { min: 0.5, max: 21.5, splitLine: { show: false }, axisLine: { show: true, lineStyle: { color: t.axis } },
          axisTick: { show: true, customValues: E.stages.map((s) => s.id), lineStyle: { color: t.axis } },
          axisLabel: { color: t.ink2, customValues: E.stages.map((s) => s.id) }, name: 'Stage', nameLocation: 'middle', nameGap: 26 }),
        yAxis: axisY(t, Object.assign({ inverse: true, name: 'minutes behind', nameLocation: 'start', nameGap: 10, min: 0 }, empty ? { max: 10 } : {})),
        tooltip: Object.assign(base(t).tooltip, { trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: t.ruleStrong } }, formatter: (ps) => {
          if (!ps.length) return '';
          const sid = Math.round(ps[0].axisValue); const s2 = E.stageById.get(sid);
          if (!s2) return '';
          const rows = ps.filter((p) => p.value && p.value[0] === sid && p.value[1] != null).sort((a, b) => a.value[1] - b.value[1]);
          const out = S.story.filter((bib) => !E.gcPositionAfter(bib, sid)).map((bib) => tipRow(t.s[slots.get(bib)], R(bib).short, R(bib).status.toLowerCase()));
          return tipHead(`After stage ${sid} · ${TL[s2.code]}`) + rows.map((p) => tipRow(p.color, p.seriesName, p.value[1] === 0 ? 'leader' : `+${p.value[1].toFixed(2)} min`)).join('') + out.join('');
        } }),
        series,
      });
    });

    // E7 counterfactual
    const cf = panel({ title: 'What if bonuses or penalties did not count?', fnAlso: [['E7', 'Bonuses, penalties and counterfactuals']], sub: 'A time bonus is seconds taken off a rider\'s total for finishing 1st, 2nd or 3rd on a stage (10, 6 and 4 s). A penalty is seconds added by the judges. Switch either off and the standings are replayed up to the stage you choose. Riders level on time are split by the lowest total of stage places.' });
    const state = { bonus: true, penalty: true, stage: 2 };
    const sw = (label, key) => {
      const inp = h('input', { type: 'checkbox', id: `cf-${key}`, checked: true });
      inp.addEventListener('change', () => { state[key] = inp.checked; drawCf(); });
      return h('label', { class: 'switch', for: `cf-${key}` }, inp, label);
    };
    const stageSel = selectEl('cf-stage', [{ options: E.stages.map((s) => ({ value: s.id, label: `after stage ${s.id}` })) }], 2, (v) => { state.stage = Number(v); drawCf(); }, 'Replay up to stage');
    add(cf.head.querySelector('.panel-tools') || cf.head.appendChild(h('div', { class: 'panel-tools' })), sw('Count bonuses', 'bonus'), sw('Count penalties', 'penalty'), stageSel);
    const cfHint = h('p', { class: 'verdict', text: 'Try this: the replay opens after stage 2. With bonuses switched off, six riders, Van der Poel included, are level on time, and Pogacar goes top only on the tie-break (the lowest total of stage places). By the final stage the gaps are so big that no switch moves anyone in the top 10.' });
    const cfOut = h('div', { class: 'split' });
    add(cf.body, cfHint, cfOut);
    root.appendChild(cf.el);
    function drawCf() {
      clear(cfOut);
      const baseGc = E.gcAfter(state.stage);
      const alt = E.gcAfter(state.stage, { bonus: state.bonus, penalty: state.penalty });
      const basePos = new Map(baseGc.map((e) => [e.bib, e.position]));
      const top = alt.slice(0, 10);
      const baseTop = new Set(baseGc.slice(0, 10).map((e) => e.bib));
      const altTop = new Set(top.map((e) => e.bib));
      const ins = top.filter((e) => !baseTop.has(e.bib)).map((e) => R(e.bib).short);
      const outs = baseGc.slice(0, 10).filter((e) => !altTop.has(e.bib)).map((e) => R(e.bib).short);
      const moved = top.filter((e) => basePos.get(e.bib) !== e.position).length;
      const upto = (bib) => E.byRider.get(bib).filter((x) => x.stage <= state.stage);
      const changed = !(state.bonus && state.penalty);
      add(cfOut,
        h('div', null, tbl([
          { label: 'Pos', render: (e) => String(e.position), cls: 'pos' },
          { label: 'Move', render: (e) => { const d = basePos.get(e.bib) - e.position; return d > 0 ? h('span', { class: 'move-up', text: `▲ ${d}` }) : d < 0 ? h('span', { class: 'move-down', text: `▼ ${-d}` }) : '-'; } },
          { label: 'Rider', render: (e) => riderEl(e.bib) },
          { label: 'Gap', n: true, render: (e) => (e.position === 1 ? fmtTime(e.cum) : fmtGap(e.gap)) },
          { label: 'Bonus', n: true, render: (e) => { const b = upto(e.bib).reduce((a, x) => a + x.bonus, 0); return b ? `${b} s` : '-'; } },
          { label: 'Penalty', n: true, render: (e) => { const p = upto(e.bib).reduce((a, x) => a + x.penalty, 0); return p ? `${p} s` : '-'; } },
        ], top)),
        h('div', { style: 'display:flex;flex-direction:column;gap:10px' },
          h('div', { class: 'tiles' },
            tile('Leader', R(top[0].bib).short, `${changed ? 'replayed' : 'actual'} after stage ${state.stage}`, true),
            tile('Margin to 2nd', fmtGap(top[1].gap).slice(1), changed ? `actual ${fmtGap(baseGc[1].gap).slice(1)}` : 'actual result', true),
            tile('Top-10 riders moved', String(moved), changed ? 'vs the actual standings' : 'switch a toggle to replay', true)),
          h('p', { class: 'note' }, changed
            ? (ins.length || outs.length ? [h('b', { text: 'Into the top 10: ' }), ins.join(', ') || 'nobody', '. ', h('b', { text: 'Out: ' }), outs.join(', ') || 'nobody', '.'] : 'The same ten riders make the top 10 in this replay.')
            : 'These are the actual standings. Switch off bonuses or penalties to see who they helped.'),
          h('p', { class: 'note', text: 'Bonuses are the only time awarded at the finish line. Penalties appear on 4 results in 2025.' })));
    }
    drawCf();

    // E7 part 1: cumulative bonuses and penalties for every rider who had any
    const led = panel({ title: 'Bonuses and penalties per rider', fn: [['E7', 'Bonuses, penalties and counterfactuals']], sub: 'Every rider who gained a time bonus or got a time penalty, over the whole race. Net effect = penalty minus bonus: below zero means the rules saved the rider time overall.' });
    const ledger = E.bonusLedger();
    add(led.body,
      h('div', { class: 'tiles' },
        tile('Riders with a bonus', String(ledger.filter((x) => x.bonus).length), `${fmtInt(ledger.reduce((a, x) => a + x.bonus, 0))} s handed out in total`, true),
        tile('Riders with a penalty', String(ledger.filter((x) => x.penalty).length), `${fmtInt(ledger.reduce((a, x) => a + x.penalty, 0))} s added in total`, true),
        tile('Most time saved', R(ledger[0].bib).short, `${-ledger[0].net} s over ${ledger[0].bonusDays} stages`, true)),
      ledger.length ? tbl([
        { label: '#', render: (x, i) => String(i + 1), cls: 'pos' },
        { label: 'Rider', render: (x) => riderEl(x.bib) },
        { label: 'Bonus', n: true, render: (x) => (x.bonus ? `-${x.bonus} s` : '-') },
        { label: 'Stages with a bonus', n: true, render: (x) => String(x.bonusDays || '-') },
        { label: 'Penalty', n: true, render: (x) => (x.penalty ? h('span', { class: 'move-down', text: `+${x.penalty} s` }) : '-') },
        { label: 'Net effect', n: true, render: (x) => h('b', { class: x.net < 0 ? 'move-up' : 'move-down', text: `${x.net > 0 ? '+' : x.net < 0 ? '-' : ''}${Math.abs(x.net)} s` }) },
        { label: 'Overall', n: true, render: (x) => (R(x.bib).finished ? ordinal(R(x.bib).gcRank) : 'out') },
      ], ledger, { scroll: true, caption: 'Sorted by net effect, most time saved first. Overall = final position in the overall standings.' }) : h('p', { class: 'note', text: 'No rider had a bonus or a penalty.' }));
    root.insertBefore(led.el, cf.el);
    hooks.outright = () => { drawLb(); drawPivot(); };
  };

  /* =================== stages: E2, E11, drill-down =================== */
  renderers.stages = (root) => {
    add(root, h('div', { class: 'view-head' }, h('div', null,
      h('p', { class: 'eyebrow', text: 'Stage winner bets' }),
      h('h1', { text: 'One stage at a time' }),
      h('p', { class: 'lede', text: 'This tab answers: who did best on a single day? Pick a stage on the map or in the list to see who won, by how much, their adjusted times and which teams filled the top 10. Further down: all stages grouped by terrain, the time trials and the longest day.' }))));

    const sp = panel({ title: 'Stage in focus', fn: [['E2', 'A stage in focus']] });
    const stageSel = selectEl('stage-sel', TERR.map((c) => ({ label: TL[c], options: E.stages.filter((s) => s.code === c).map((s) => ({ value: s.id, label: `Stage ${s.id} · ${s.route}` })) })), S.stage, (v) => { S.stage = Number(v); teamFilter = null; drawStage(); }, 'Stage');
    const prev = h('button', { class: 'btn', type: 'button', text: '← Prev', on: { click: () => { if (S.stage > 1) { S.stage -= 1; teamFilter = null; drawStage(); } } } });
    const next = h('button', { class: 'btn', type: 'button', text: 'Next →', on: { click: () => { if (S.stage < 21) { S.stage += 1; teamFilter = null; drawStage(); } } } });
    add(sp.head.appendChild(h('div', { class: 'panel-tools' })), prev, stageSel, next);
    const top = h('div', { style: 'min-width:0' });
    const routeBox = h('div', { class: 'chart route-map', role: 'img', 'aria-label': 'Map of the 21 stages; select a number to open that stage' });
    const routeWrap = h('div', { class: 'route-wrap' }, routeBox, legend(TERR.map((c) => ({ color: `var(--${c})`, label: TL[c] }))),
      h('p', { class: 'note', text: 'Select a stage number. Lines join start and finish towns (not the roads raced); loops mark stages that start and finish in one town. Outlines: Natural Earth; towns: © OpenStreetMap contributors.' }));
    const stageTop = h('div', { class: 'stage-top' }, top, routeWrap);
    const split = h('div', { class: 'split' });
    const left = h('div', { style: 'display:flex;flex-direction:column;gap:10px;min-width:0' });
    const right = h('div', { style: 'display:flex;flex-direction:column;gap:10px;min-width:0' });
    add(split, left, right);
    add(sp.body, stageTop, split);
    root.appendChild(sp.el);
    let depth = 10, teamFilter = null, teamChart, routeChart;
    const teamBox = chartBox('short');
    function drawStage() {
      stageSel.value = String(S.stage);
      const d = E.stageDetail(S.stage);
      const s = d.stage;
      const w = R(s.winnerBib);
      const yel = R(s.yellowAfter);
      clear(top);
      add(top,
        h('div', { class: 'stage-hero' },
          h('span', { class: 'big', text: `Stage ${s.id}` }),
          h('span', { class: 'meta' }, terrEl(s.code), h('span', { text: dateShort(s.date) }), h('span', { text: s.route }), h('span', { text: `${s.distance.toFixed(1)} km` }))),
        h('div', { class: 'tiles', style: 'margin-top:10px' },
          tile('Winner', w.short, teamShort(w.team), true),
          tile('Winning time', fmtClock(s.winnerTime), `${s.speed.toFixed(1)} km/h average`, true),
          tile('Finish', s.bunch ? `Bunch of ${s.inWinnerTime}` : s.inWinnerTime > 1 ? `Group of ${s.inWinnerTime}` : 'Solo', s.marginNextGroup == null ? 'whole field on the same time' : `next group ${fmtBy(s.marginNextGroup)} back`, true),
          tile('Yellow after the stage', yel.short, s.id === 1 ? 'first leader of the race' : s.top10Shuffle ? `${s.top10Shuffle} new rider${s.top10Shuffle > 1 ? 's' : ''} in the overall top 10` : 'no change in the overall top 10', true)));
      clear(left);
      const rows = teamFilter ? d.rows.filter((r) => R(r.bib).team === teamFilter) : d.rows.slice(0, depth);
      const gcMap = new Map(d.gcAfter.map((e) => [e.bib, e.position]));
      const hasPen = d.rows.some((r) => r.penalty);
      add(left,
        h('div', { class: 'panel-tools' },
          teamFilter ? [h('span', { class: 'pill', text: `${teamShort(teamFilter)} riders` }), h('button', { class: 'btn', type: 'button', text: 'Show everyone', on: { click: () => { teamFilter = null; drawStage(); } } })]
            : seg([{ value: 10, label: 'Top 10' }, { value: 25, label: 'Top 25' }, { value: 999, label: 'Full field' }], depth, (v) => { depth = v; drawStage(); }, 'How many finishers')),
        tbl([
          { label: 'Pos', render: (r) => String(r.rank), cls: 'pos' },
          { label: 'Rider', render: (r) => riderEl(r.bib) },
          { label: 'Nation', render: (r) => R(r.bib).countryName },
          { label: 'Time', n: true, render: (r) => (r.rank === 1 ? fmtClock(r.time) : r.gap === 0 ? 's.t.' : fmtGap(r.gap)) },
          { label: 'Bonus', n: true, render: (r) => (r.bonus ? `-${r.bonus} s` : '') },
          hasPen ? { label: 'Penalty', n: true, render: (r) => (r.penalty ? h('span', { class: 'move-down', text: `+${r.penalty} s` }) : '') } : null,
          { label: 'Adjusted time', n: true, render: (r) => h('b', { text: fmtClock(r.adj) }) },
          { label: 'Overall', n: true, render: (r) => ordinal(gcMap.get(r.bib)) },
        ].filter(Boolean), rows, { scroll: depth > 25 || !!teamFilter, caption: `s.t. = same time as the winner. Adjusted time = finish time minus bonus${hasPen ? ' plus penalty' : ''}, the time that counts for the overall standings. Overall = position in the overall standings after this stage.` }));
      clear(right);
      add(right, h('h3', { text: 'Which teams filled the top 10' }), h('p', { class: 'note', text: 'Click a team to list all its riders on this stage.' }), teamBox);
      if (!teamChart) {
        teamChart = chart(teamBox, (t) => {
          const dd = E.stageDetail(S.stage);
          const list = dd.teamsTop10.slice().reverse();
          return Object.assign(base(t), {
            grid: { left: 8, right: 30, top: 6, bottom: 6, containLabel: true },
            xAxis: axisVal(t, { minInterval: 1, max: (v) => Math.max(3, v.max) }),
            yAxis: axisCat(t, list.map((x) => teamShort(x.team))),
            tooltip: Object.assign(base(t).tooltip, { formatter: (p) => { const x = list[p.dataIndex]; return tipHead(teamShort(x.team)) + x.bibs.map((b) => `<div>${esc(R(b).name)} · ${ordinal(dd.rows.find((r) => r.bib === b).rank)}</div>`).join(''); } }),
            series: [{ type: 'bar', barMaxWidth: 18, data: list.map((x) => ({ value: x.n, itemStyle: { color: t.terr[dd.stage.code], borderRadius: [0, 4, 4, 0] } })), label: { show: true, position: 'right', color: t.ink2 } }],
          });
        }, { onClick: (p) => { const list = E.stageDetail(S.stage).teamsTop10.slice().reverse(); teamFilter = list[p.dataIndex].team; drawStage(); } });
      } else redraw(teamChart);
      if (!routeChart) routeChart = chart(routeBox, (t) => routeOption(t, S.stage), { onClick: (p) => { if (p.data && p.data.stage) { S.stage = p.data.stage; teamFilter = null; drawStage(); } } });
      else redraw(routeChart);
    }
    hooks.stage = () => { if (built.has('stages')) { teamFilter = null; drawStage(); } };
    drawStage();

    // drill-down explorer
    const dx = panel({ title: 'Roll up and drill down', fn: [['OLAP', 'Drill down: terrain, then stage, then rider']], sub: 'Totals by terrain. Open a terrain to see its stages, and a stage to see its top five.' });
    const dxBody = h('div');
    dx.body.appendChild(dxBody);
    root.appendChild(dx.el);
    const openT = new Set(['mountain']), openS = new Set();
    function drawDx() {
      clear(dxBody);
      const tbody = h('tbody');
      TERR.forEach((c) => {
        const st = E.stages.filter((s) => s.code === c);
        const tw = new Set(st.map((s) => s.winnerBib)).size;
        const open = openT.has(c);
        tbody.appendChild(h('tr', null,
          h('td', null, h('button', { class: 'exp', type: 'button', 'aria-expanded': String(open), 'aria-label': `${open ? 'Collapse' : 'Expand'} ${TL[c]}`, text: open ? '▾' : '▸', on: { click: () => { open ? openT.delete(c) : openT.add(c); drawDx(); } } }), h('b', null, terrEl(c))),
          h('td', { class: 'n', text: String(st.length) }),
          h('td', { class: 'n', text: fmtInt(Math.round(st.reduce((a, s) => a + s.distance, 0))) }),
          h('td', { class: 'n', text: (st.reduce((a, s) => a + s.speed, 0) / st.length).toFixed(1) }),
          h('td', { class: 'n', text: `${st.filter((s) => s.bunch).length}` }),
          h('td', { class: 'n', text: String(tw) }),
          h('td', { text: '' })));
        if (!open) return;
        st.forEach((s) => {
          const so = openS.has(s.id);
          tbody.appendChild(h('tr', { class: 'sub' },
            h('td', { style: 'padding-left:26px' }, h('button', { class: 'exp', type: 'button', 'aria-expanded': String(so), text: so ? '▾' : '▸', 'aria-label': `${so ? 'Collapse' : 'Expand'} stage ${s.id}`, on: { click: () => { so ? openS.delete(s.id) : openS.add(s.id); drawDx(); } } }), h('button', { class: 'rlink', type: 'button', dataset: { gotoStage: String(s.id) }, text: `Stage ${s.id}` }), ` · ${dateShort(s.date)}`),
            h('td', { class: 'n', text: '1' }),
            h('td', { class: 'n', text: s.distance.toFixed(1) }),
            h('td', { class: 'n', text: s.speed.toFixed(1) }),
            h('td', { class: 'n', text: s.bunch ? `yes (${s.inWinnerTime})` : 'no' }),
            h('td', { class: 'n' }, riderEl(s.winnerBib, { short: true, bib: false, team: false })),
            h('td', { text: s.route })));
          if (!so) return;
          // level 3 has different columns, so it gets its own small table with its own headers
          tbody.appendChild(h('tr', { class: 'sub2' }, h('td', { colspan: '7', style: 'padding:4px 8px 10px 52px' },
            tbl([
              { label: 'Place', render: (r) => ordinal(r.rank), cls: 'pos' },
              { label: 'Rider', render: (r) => riderEl(r.bib) },
              { label: 'Nation', render: (r) => R(r.bib).countryName },
              { label: 'Time', n: true, render: (r) => (r.rank === 1 ? fmtClock(r.time) : r.gap === 0 ? 's.t.' : fmtGap(r.gap)) },
              { label: 'Bonus', n: true, render: (r) => (r.bonus ? `-${r.bonus} s` : '') },
              { label: 'Adjusted time', n: true, render: (r) => fmtClock(r.adj) },
            ], E.byStage.get(s.id).slice(0, 5), { caption: `Top five on stage ${s.id}. s.t. = same time as the winner.` }))));
        });
      });
      dxBody.appendChild(h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, ['Terrain / stage', 'Stages', 'km', 'Avg speed', 'Bunch finish', 'Winners', 'Route'].map((x, i) => h('th', { class: i && i < 6 ? 'n' : null, text: x })))), tbody)));
    }
    drawDx();

    // E11 against the clock
    const tt = panel({ title: 'Against the clock', fn: [['E11', 'Against the clock']], sub: 'The time-trial catalogue: date, distance, winner and the riders who went fastest.' });
    const cards = h('div', { class: 'itt-cards' });
    E.stages.filter((s) => s.code === 'itt').forEach((s) => {
      const rows = E.byStage.get(s.id).slice(0, 5);
      cards.appendChild(h('article', { class: 'itt' },
        h('div', { class: 'terr' }, glyph('itt'), h('b', { text: `Stage ${s.id} · ${dateShort(s.date)}` })),
        h('div', { text: `${s.route} · ${s.distance.toFixed(1)} km` }),
        h('div', null, 'Winner: ', riderEl(s.winnerBib, { bib: false }), ` in ${fmtClock(s.winnerTime)} (${s.speed.toFixed(1)} km/h), by ${fmtBy(s.marginToSecond)}`),
        h('ol', null, rows.map((r) => h('li', null, riderEl(r.bib, { bib: false, team: false }), r.rank === 1 ? '' : ` ${fmtGap(r.gap)}`)))));
    });
    add(tt.body, cards, h('p', { class: 'note', text: 'The 33 km stage 5 was flat and fast; the 10.9 km stage 13 climbed to Peyragudes, which suits climbers over specialists.' }));
    root.appendChild(tt.el);
  };

  /* =================== terrain: E5, E6, specialists =================== */
  renderers.terrain = (root) => {
    add(root, h('div', { class: 'view-head' }, h('div', null,
      h('p', { class: 'eyebrow', text: 'Stage winner bets · terrain' }),
      h('h1', { text: 'Who wins where' }),
      h('p', { class: 'lede', text: 'This tab answers: which riders do well on which kind of road? Terrain is the stage type: flat, hilly, mountain, or individual time trial (ITT), where riders start alone and race the clock. Pick a terrain to see who placed there and who gets faster when the road climbs.' }))));
    const tools = h('div', { class: 'panel', style: 'flex-direction:row;flex-wrap:wrap;align-items:center;gap:10px 16px;padding:10px 14px' },
      h('span', { class: 'note', text: 'Terrain:' }),
      seg(TERR.map((c) => ({ value: c, label: TL[c], icon: glyph(c) })), S.terrain, (v) => { S.terrain = v; drawAll(); }, 'Terrain'));
    root.appendChild(tools);

    const pa = panel({ title: '', span: 7 });
    const paBox = chartBox('tall');
    const paLegend = h('div');
    add(pa.body, paLegend, paBox, h('p', { class: 'note', text: 'Bars: number of top-10 finishes on this terrain, split into wins, other podiums and other top-10s. Label: top-10s / starts. Click a bar for the rider’s profile.' }));
    const pb = panel({ title: '', span: 5 });
    root.appendChild(pa.el); root.appendChild(pb.el);
    let paChart;
    function drawA() {
      const code = S.terrain;
      pa.head.querySelector('h2').textContent = `Who places on ${TL[code].toLowerCase()} stages`;
      const t = tokens();
      clear(paLegend).appendChild(legend([
        { color: t.terr[code], label: 'Win' }, { color: blend(t.terr[code], t.sheet, 0.45), label: '2nd to 3rd' }, { color: blend(t.terr[code], t.sheet, 0.72), label: '4th to 10th' }]));
      if (!paChart) {
        paChart = chart(paBox, (tk) => {
          const c2 = S.terrain;
          const list = E.consistency(c2).slice(0, 12).reverse();
          const col = tk.terr[c2];
          const mk = (name, f, color, last) => ({ type: 'bar', stack: 'p', name, barMaxWidth: 20, data: list.map((e) => f(e)), itemStyle: { color, borderRadius: last ? [0, 4, 4, 0] : 0, borderColor: tk.sheet, borderWidth: 1 },
            label: last ? { show: true, position: 'right', color: tk.ink2, formatter: (p) => `${list[p.dataIndex].top10s}/${list[p.dataIndex].starts}` } : undefined });
          return Object.assign(base(tk), {
            grid: { left: 8, right: 44, top: 6, bottom: 6, containLabel: true },
            xAxis: axisVal(tk, { minInterval: 1 }),
            yAxis: axisCat(tk, list.map((e) => R(e.bib).short)),
            tooltip: Object.assign(base(tk).tooltip, { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: blend(tk.ink, tk.sheet, 0.94) } }, formatter: (ps) => {
              const e = list[ps[0].dataIndex];
              return tipHead(R(e.bib).name) + `<div style="color:${tk.muted};margin-bottom:4px">${esc(teamShort(R(e.bib).team))}</div>` + tipRow(null, 'Starts', e.starts) + tipRow(null, 'Wins', e.wins) + tipRow(null, 'Podiums', e.podiums) + tipRow(null, 'Top 10s', `${e.top10s} (${pct(e.rate)})`) + tipRow(null, 'Average placing', e.avgRank.toFixed(1));
            } }),
            series: [mk('Win', (e) => e.wins, col), mk('2nd to 3rd', (e) => e.podiums - e.wins, blend(col, tk.sheet, 0.45)), mk('4th to 10th', (e) => e.top10s - e.podiums, blend(col, tk.sheet, 0.72), true)],
          });
        }, { onClick: (p) => { const list = E.consistency(S.terrain).slice(0, 12).reverse(); openRider(list[p.dataIndex].bib); } });
      } else redraw(paChart);
    }
    function drawB() {
      const code = S.terrain;
      const st = E.stages.filter((s) => s.code === code);
      pb.head.querySelector('h2').textContent = `How ${TL[code].toLowerCase()} stages were won`;
      const margins = st.map((s) => s.marginNextGroup).filter((m) => m != null);
      const gcw = st.filter((s) => s.winnerFinalGc != null && s.winnerFinalGc <= 10).length;
      clear(pb.body);
      add(pb.body,
        h('div', { class: 'tiles', style: 'grid-template-columns:repeat(2,minmax(0,1fr))' },
          tile('Stages', String(st.length), `${fmtInt(Math.round(st.reduce((a, s) => a + s.distance, 0)))} km in total`, true),
          tile('Bunch finishes', `${st.filter((s) => s.bunch).length} of ${st.length}`, `${E.BUNCH_MIN}+ riders on the winner’s time`, true),
          tile('Won by a top-10 rider', `${gcw} of ${st.length}`, 'final overall top 10', true),
          tile('Average gap to next group', margins.length ? fmtBy(Math.round(margins.reduce((a, m) => a + m, 0) / margins.length)) : '-', `${new Set(st.map((s) => s.winnerBib)).size} different winners`, true)),
        tbl([
          { label: 'Stage', render: (s) => h('button', { class: 'rlink', type: 'button', dataset: { gotoStage: String(s.id) }, text: String(s.id) }) },
          { label: 'Winner', render: (s) => riderEl(s.winnerBib, { bib: false, short: true }) },
          { label: 'Finish', render: (s) => (s.bunch ? `bunch (${s.inWinnerTime})` : s.inWinnerTime > 1 ? `group of ${s.inWinnerTime}` : 'solo') },
          { label: 'By', n: true, render: (s) => (s.marginNextGroup == null ? '-' : fmtBy(s.marginNextGroup)) },
          { label: 'Winner overall', n: true, render: (s) => (s.winnerFinalGc ? ordinal(s.winnerFinalGc) : 'did not finish') },
        ], st));
    }

    // scatter: sprinters vs climbers
    const sc = panel({ title: 'Sprinter, climber or both?', span: 7, sub: 'Each dot is a rider with at least one top-10 on flat or mountain stages. Further right = more often top 10 on flat stages; higher = more often top 10 in the mountains. Dot size = stage wins.' });
    const scLegend = h('div'); const scBox = chartBox('tall');
    add(sc.body, scLegend, scBox, h('p', { class: 'note', text: 'Rider types are rule-based labels from 2025 results (see Method). Click a dot for the rider’s profile.' }));
    root.appendChild(sc.el);
    const GROUPS = ['GC contender', 'Sprinter', 'Climber'];
    const pts = E.riders.filter((r) => r.starts >= 5 && ((r.terrain.flat && r.terrain.flat.top10s) || (r.terrain.mountain && r.terrain.mountain.top10s)));
    chart(scBox, (t) => {
      const colors = [t.s[0], t.s[2], t.s[1]];
      clear(scLegend).appendChild(legend([...GROUPS.map((g, i) => ({ color: colors[i], label: g })), { color: t.ruleStrong, label: 'Other types' }]));
      const ser = ['Other', ...GROUPS].map((g) => ({
        type: 'scatter', name: g, labelLayout: { hideOverlap: true }, z: g === 'Other' ? 1 : 3,
        data: pts.filter((r) => (g === 'Other' ? !GROUPS.includes(r.archetype) : r.archetype === g)).map((r) => ({
          value: [r.terrain.flat ? r.terrain.flat.top10Rate : 0, r.terrain.mountain ? r.terrain.mountain.top10Rate : 0], bib: r.bib,
          symbolSize: 9 + r.wins * 4,
          label: { show: r.wins >= 2 || (r.gcRank && r.gcRank <= 3) || (r.terrain.flat && r.terrain.flat.top10Rate >= 0.5), formatter: r.short, position: 'right', color: t.ink2, fontSize: 11 },
        })),
        itemStyle: { color: g === 'Other' ? t.ruleStrong : colors[GROUPS.indexOf(g)], borderColor: t.sheet, borderWidth: 2, opacity: 0.92 },
      }));
      return Object.assign(base(t), {
        grid: { left: 8, right: 30, top: 26, bottom: 8, containLabel: true },
        xAxis: axisVal(t, { min: 0, max: 1, name: 'Top-10 rate on flat stages', nameLocation: 'middle', nameGap: 28, axisLabel: { color: t.muted, formatter: (v) => `${Math.round(v * 100)}%` } }),
        yAxis: axisY(t, { min: 0, max: 1, name: 'Top-10 rate on mountain stages', nameLocation: 'end', axisLabel: { color: t.muted, formatter: (v) => `${Math.round(v * 100)}%` } }),
        tooltip: Object.assign(base(t).tooltip, { formatter: (p) => { const r = R(p.data.bib); return tipHead(r.name) + `<div style="color:${t.muted};margin-bottom:4px">${esc(r.archetype)} · ${esc(teamShort(r.team))}</div>` + tipRow(null, 'Flat top-10s', `${r.terrain.flat ? r.terrain.flat.top10s : 0}/${r.terrain.flat ? r.terrain.flat.starts : 0}`) + tipRow(null, 'Mountain top-10s', `${r.terrain.mountain ? r.terrain.mountain.top10s : 0}/${r.terrain.mountain ? r.terrain.mountain.starts : 0}`) + tipRow(null, 'Stage wins', r.wins); } }),
        series: ser,
      });
    }, { onClick: (p) => { if (p.data && p.data.bib) openRider(p.data.bib); } });

    // E5 mountain contours
    const mc = panel({ title: 'Mountain contours', fn: [['E5', 'Mountain contours']], span: 5, sub: 'Riders with the most podiums on the six mountain stages, and how far on average they finished behind the stage winner. Click a rider to see their daily gaps.' });
    const mcBox = chartBox(); const mcTrace = chartBox('short');
    add(mc.body, mcBox, h('h3', { text: 'Daily gap to the stage winner, mountain stages' }), mcTrace);
    root.appendChild(mc.el);
    const mlist = E.mountainGC.filter((m) => m.podiums > 0).sort((a, b) => b.podiums - a.podiums || a.avgGap - b.avgGap).slice(0, 10);
    let traced = mlist.slice(0, 3).map((m) => m.bib);
    const mslot = new Map(traced.map((b, i) => [b, i]));
    const toggleTrace = (b) => {
      if (traced.includes(b)) { traced = traced.filter((x) => x !== b); mslot.delete(b); }
      else { if (traced.length >= 4) { mslot.delete(traced[0]); traced = traced.slice(1); } const used = new Set(mslot.values()); let k = 0; while (used.has(k)) k++; mslot.set(b, k); traced = [...traced, b]; }
    };
    chart(mcBox, (t) => {
      const list = mlist.slice().reverse();
      return Object.assign(base(t), {
        grid: { left: 8, right: 70, top: 6, bottom: 6, containLabel: true },
        xAxis: axisVal(t, { name: 'average gap to stage winner (min)', nameLocation: 'middle', nameGap: 26, min: 0 }),
        yAxis: axisCat(t, list.map((m) => R(m.bib).short)),
        tooltip: Object.assign(base(t).tooltip, { formatter: (p) => { const m = list[p.dataIndex]; return tipHead(R(m.bib).name) + tipRow(null, 'Mountain podiums', m.podiums) + tipRow(null, 'Mountain wins', m.wins) + tipRow(null, 'Average gap to winner', fmtGap(Math.round(m.avgGap))); } }),
        series: [{ type: 'bar', barMaxWidth: 16, data: list.map((m) => ({ value: mins(m.avgGap), itemStyle: { color: traced.includes(m.bib) ? t.s[mslot.get(m.bib)] : blend(t.terr.mountain, t.sheet, 0.55), borderRadius: [0, 4, 4, 0] } })),
          label: { show: true, position: 'right', color: t.ink2, formatter: (p) => `${list[p.dataIndex].podiums} podium${list[p.dataIndex].podiums === 1 ? '' : 's'}` } }],
      });
    }, { onClick: (p) => { toggleTrace(mlist.slice().reverse()[p.dataIndex].bib); charts.forEach((c) => { if (c.el === mcBox || c.el === mcTrace) redraw(c); }); } });
    chart(mcTrace, (t) => Object.assign(base(t), {
      grid: { left: 8, right: 16, top: 40, bottom: 6, containLabel: true },
      legend: { show: true, top: 0, left: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 3, textStyle: { color: t.ink2 } },
      xAxis: axisCat(t, E.mountainIds.map((id) => `S${id}`)),
      yAxis: axisY(t, { inverse: true, name: 'min behind winner', nameLocation: 'start', min: 0 }),
      tooltip: Object.assign(base(t).tooltip, { trigger: 'axis', formatter: (ps) => tipHead(`Stage ${E.mountainIds[ps[0].dataIndex]} · ${E.stageById.get(E.mountainIds[ps[0].dataIndex]).finish}`) + ps.map((p) => tipRow(p.color, p.seriesName, `${p.value.toFixed(2)} min`)).join('') }),
      series: traced.map((b) => ({ type: 'line', name: R(b).short, symbolSize: 8, lineStyle: { width: 2, color: t.s[mslot.get(b)] }, itemStyle: { color: t.s[mslot.get(b)], borderColor: t.sheet, borderWidth: 2 },
        data: E.mountainIds.map((id) => mins(E.byStage.get(id).find((x) => x.bib === b).gap)) })),
    }));

    // E6 speed by terrain
    const spd = panel({ title: 'Speed by terrain', fn: [['E6', 'Speed as a simple ratio']], sub: 'Speed = distance divided by time over each terrain, compared with the median finisher on the same terrain. A rider whose bar grows on mountain stages gains when the road climbs. Compare up to four riders: use the buttons or search any rider.' });
    let spdMode = 'riders';
    let pickR = [E.gcFinal[0].bib, E.gcFinal[1].bib, 81, 21];
    let pickT = [E.TEAMCLASS.list[0].team, E.TEAMCLASS.list[1].team, 'LIDL-TREK', 'SOUDAL QUICK-STEP'];
    const spdTools = h('div', { class: 'panel-tools' });
    spd.head.appendChild(spdTools);
    const spdChips = h('div', { class: 'chips' });
    const spdBox = chartBox();
    const spdTable = h('div');
    const spdFinder = riderFinder((b) => { if (!pickR.includes(b)) pickR = [...pickR, b].slice(-4); drawSpeed(); }, { filter: (r) => r.starts > 0 });
    add(spd.body, h('div', { class: 'story-pick' }, spdChips, spdFinder), h('div', { class: 'split' }, h('div', null, spdBox), spdTable));
    root.appendChild(spd.el);
    add(spdTools, seg([{ value: 'riders', label: 'Riders' }, { value: 'teams', label: 'Teams' }], spdMode, (v) => { spdMode = v; drawSpeed(); }, 'Riders or teams'));
    const teamMedian = {};
    ['all', ...TERR].forEach((c) => { teamMedian[c] = T.median(E.teams.map((t) => t.speed[c])); });
    const teamIdx = (tm, c) => tm.speed[c] / teamMedian[c];
    let spdChart;
    function drawSpeed() {
      clear(spdChips);
      spdFinder.hidden = spdMode !== 'riders';
      const t = tokens();
      if (spdMode === 'riders') {
        const cands = [...new Set([...E.gcFinal.slice(0, 6).map((e) => e.bib), 81, 24, 21, 17, 106, 62, ...pickR])];
        cands.forEach((b) => { const on = pickR.includes(b); spdChips.appendChild(h('button', { type: 'button', class: 'chip', 'aria-pressed': String(on), on: { click: () => { pickR = on ? pickR.filter((x) => x !== b) : [...pickR, b].slice(-4); drawSpeed(); } } }, h('span', { class: 'sw', style: `background:${on ? t.s[pickR.indexOf(b)] : 'transparent'};border:1px solid var(--rule-strong)` }), chipLabel(b))); });
      } else {
        E.TEAMCLASS.list.forEach((x) => { const on = pickT.includes(x.team); spdChips.appendChild(h('button', { type: 'button', class: 'chip', 'aria-pressed': String(on), on: { click: () => { pickT = on ? pickT.filter((y) => y !== x.team) : [...pickT, x.team].slice(-4); drawSpeed(); } } }, h('span', { class: 'sw', style: `background:${on ? t.s[pickT.indexOf(x.team)] : 'transparent'};border:1px solid var(--rule-strong)` }), teamShort(x.team))); });
      }
      clear(spdTable);
      if (spdMode === 'riders') {
        const gain = E.riders.filter((r) => r.finished).map((r) => ({ r, sp: E.speedProfile(r.bib) })).sort((a, b) => b.sp.mountainShift - a.sp.mountainShift).slice(0, 10);
        add(spdTable, h('h3', { text: 'Who gains most when the road climbs' }), tbl([
          { label: 'Rider', render: (x) => riderEl(x.r.bib, { bib: false }) },
          { label: 'Flat + hilly', n: true, render: (x) => `${((x.sp.flathilly.index - 1) * 100).toFixed(1)}%` },
          { label: 'Mountain', n: true, render: (x) => `${((x.sp.mountain.index - 1) * 100).toFixed(1)}%` },
          { label: 'Gain', n: true, render: (x) => `+${(x.sp.mountainShift * 100).toFixed(1)} pts` },
        ], gain, { caption: 'Finishers only. % = speed above the median finisher on that terrain.' }));
      } else {
        const gain = E.teams.map((tm) => ({ tm, fh: (teamIdx(tm, 'flat') + teamIdx(tm, 'hilly')) / 2, mo: teamIdx(tm, 'mountain') })).sort((a, b) => (b.mo - b.fh) - (a.mo - a.fh)).slice(0, 10);
        add(spdTable, h('h3', { text: 'Teams that gain most in the mountains' }), tbl([
          { label: 'Team', render: (x) => teamShort(x.tm.name) },
          { label: 'Flat + hilly', n: true, render: (x) => `${((x.fh - 1) * 100).toFixed(1)}%` },
          { label: 'Mountain', n: true, render: (x) => `${((x.mo - 1) * 100).toFixed(1)}%` },
        ], gain, { caption: 'Team speed = all rider kilometres divided by rider hours. % = compared with the median team.' }));
      }
      if (!spdChart) spdChart = chart(spdBox, (tk) => {
        const isR = spdMode === 'riders';
        const ents = isR ? pickR : pickT;
        return Object.assign(base(tk), {
          grid: { left: 8, right: 12, top: 24, bottom: 6, containLabel: true },
          legend: { show: true, top: 0, left: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 12, textStyle: { color: tk.ink2 } },
          xAxis: axisCat(tk, TERR.map((c) => TL[c])),
          yAxis: axisY(tk, { axisLabel: { color: tk.muted, formatter: (v) => `${v > 0 ? '+' : ''}${v}%` } }),
          tooltip: Object.assign(base(tk).tooltip, { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: blend(tk.ink, tk.sheet, 0.94) } }, formatter: (ps) => tipHead(ps[0].axisValue) + ps.map((p) => tipRow(p.color, p.seriesName, p.data.kmh == null ? 'did not ride' : `${p.data.kmh.toFixed(2)} km/h (${p.value > 0 ? '+' : ''}${p.value.toFixed(1)}%)`)).join('') }),
          series: ents.map((x, i) => ({
            type: 'bar', name: isR ? R(x).short : teamShort(x), barMaxWidth: 16,
            itemStyle: { color: tk.s[i], borderColor: tk.sheet, borderWidth: 1 },
            data: TERR.map((c) => {
              if (isR) { const sp = E.speedProfile(x)[c]; return { value: sp.index == null ? null : Math.round((sp.index - 1) * 1000) / 10, kmh: sp.speed }; }
              const tm = E.teamByName.get(x); return { value: Math.round((teamIdx(tm, c) - 1) * 1000) / 10, kmh: tm.speed[c] };
            }),
          })),
        });
      }); else redraw(spdChart);
    }
    function drawAll() { drawA(); drawB(); }
    drawAll();
    drawSpeed();
  };

  /* =================== jerseys: E4 + official =================== */
  renderers.jerseys = (root) => {
    add(root, h('div', { class: 'view-head' }, h('div', null,
      h('p', { class: 'eyebrow', text: 'Jersey bets' }),
      h('h1', { text: 'Yellow, green, polka-dot, white' }),
      h('p', { class: 'lede', text: 'This tab answers: how do the four jersey competitions compare? Yellow = lowest total time, green = most points, polka dot = best climber, white = best young rider (born 2000 or later). First the official top 10 of each, then two extra views from our data: young riders under different age rules, and a mountains-only standing.' }))));

    const off = (c) => E.official.filter((o) => o.c === c).sort((a, b) => a.rank - b.rank);
    const op = panel({ title: 'Official final classifications', fn: [['3b', 'Classification comparison']], sub: 'Top 10 of each classification after stage 21.' });
    const grid = h('div', { class: 'jerseys' });
    const block = (c, cls, label, fmt) => {
      const rows = off(c);
      return h('div', { class: 'jcard', style: 'gap:6px' },
        h('div', { class: 'jhead' }, h('span', { class: `jersey ${cls}` }), h('b', { style: 'color:var(--ink)', text: label })),
        h('table', { class: 'tbl', style: 'font-size:13px' }, h('tbody', null, rows.map((o) => h('tr', null,
          h('td', { class: 'pos', text: String(o.rank) }),
          h('td', null, o.bib ? h('button', { class: 'rlink', type: 'button', dataset: { rider: String(o.bib) }, text: R(o.bib).short }) : teamShort(o.name)),
          h('td', { class: 'n', text: fmt(o, rows[0]) }))))));
    };
    const tfmt = (o, lead) => (o.rank === 1 ? fmtTime(o.num) : fmtGap(o.num - lead.num));
    add(grid, block('gc', 'yellow', 'Overall', tfmt), block('points', 'green', 'Points', (o) => String(o.num)), block('kom', 'polka', 'Mountains', (o) => String(o.num)), block('young', 'white', 'Young rider', tfmt), block('team', 'team', 'Teams', tfmt));
    const sources = [...new Set(E.official.map((o) => o.url))];
    add(op.body, grid, h('p', { class: 'note' }, 'Sources: ', sources.map((u, i) => [i ? ' · ' : '', h('a', { href: u, target: '_blank', rel: 'noopener', text: new URL(u).hostname.replace('www.', '') })]), '. Cross-checked against RTÉ, cyclingstage and NBC Sports.'));
    root.appendChild(op.el);

    // E4 parallel classifications
    const pc = panel({ title: 'Parallel classifications', fn: [['E4', 'Parallel classifications']], sub: 'Overall position next to young-rider position and a mountains-only standing (adjusted time summed over the six mountain stages).' });
    const rule = { mode: 'calendar', maxAge: 25 };
    const ageOut = h('output', { for: 'age-max', text: '25' });
    const ageIn = h('input', { type: 'range', id: 'age-max', min: '21', max: '30', step: '1', value: '25', 'aria-label': 'Maximum age at race start', disabled: true });
    ageIn.addEventListener('input', () => { rule.maxAge = Number(ageIn.value); ageOut.textContent = ageIn.value; drawPc(); });
    const tools = h('div', { class: 'panel-tools' },
      seg([{ value: 'calendar', label: 'Official rule: born 2000 or later' }, { value: 'age', label: 'Age at race start' }], 'calendar', (v) => { rule.mode = v; ageIn.disabled = v !== 'age'; drawPc(); }, 'Young-rider rule'),
      h('label', { class: 'field', for: 'age-max' }, 'max age', ageIn, ageOut));
    pc.head.appendChild(tools);
    const pcSplit = h('div', { class: 'split' });
    const pcLeft = h('div', { style: 'display:flex;flex-direction:column;gap:8px;min-width:0' });
    const slopeBox = chartBox('tall');
    add(pcSplit, pcLeft, h('div', { style: 'display:flex;flex-direction:column;gap:8px;min-width:0' }, h('h3', { text: 'Overall vs mountains-only (top 15 overall)' }), slopeBox, h('p', { class: 'note', text: 'Lines that rise climb better than their overall place; lines that fall lost their time elsewhere or gained it in the time trials and flat stages.' })));
    pc.body.appendChild(pcSplit);
    root.appendChild(pc.el);
    function drawPc() {
      clear(pcLeft);
      const yl = E.youngClassification(rule.mode === 'age' ? { mode: 'age', maxAge: rule.maxAge } : { mode: 'calendar' });
      const official = new Set(E.youngClassification().map((y) => y.bib));
      const extra = yl.filter((y) => !official.has(y.bib));
      const missing = [...official].filter((b) => !yl.some((y) => y.bib === b));
      const lead = yl[0];
      add(pcLeft,
        h('p', { class: 'verdict' }, lead ? [`${yl.length} eligible finishers. White jersey: `, riderEl(lead.bib, { bib: false }), ` (${ordinal(lead.gcRank)} overall)${yl[1] ? `, ${fmtGap(yl[1].gap).slice(1)} ahead of ${R(yl[1].bib).short}.` : '.'}`] : 'No eligible riders under this rule.'),
        rule.mode === 'age' ? h('p', { class: 'note' }, extra.length ? `Compared with the official rule, this age limit adds ${extra.map((y) => `${R(y.bib).short} (born ${R(y.bib).dob}, ${ordinal(y.gcRank)} overall)`).join(', ')}.` : 'Compared with the official rule, this age limit adds nobody.', missing.length ? ` It drops ${missing.length} rider${missing.length > 1 ? 's' : ''} born in 2000 or later.` : '') : null,
        tbl([
          { label: 'Young', render: (y) => String(y.youngRank), cls: 'pos' },
          { label: 'Rider', render: (y) => riderEl(y.bib) },
          { label: 'Age', n: true, render: (y) => String(R(y.bib).age) },
          { label: 'Overall', n: true, render: (y) => ordinal(y.gcRank) },
          { label: 'Mountains only', n: true, render: (y) => (R(y.bib).mountainRank ? ordinal(R(y.bib).mountainRank) : '-') },
          { label: 'Gap', n: true, render: (y) => (y.youngRank === 1 ? fmtTime(y.total) : fmtGap(y.gap)) },
        ], yl.slice(0, 12), { caption: 'Young-rider standings are the overall standings filtered to eligible riders. Times are race-data totals (official totals are about an hour shorter after the stage-21 neutralisation); gaps are official.' }));
    }
    drawPc();
    chart(slopeBox, (t) => {
      const list = E.gcFinal.slice(0, 15).map((e) => ({ bib: e.bib, gc: e.position, m: R(e.bib).mountainRank }));
      const deltas = list.map((x) => x.gc - x.m);
      const up = list[deltas.indexOf(Math.max(...deltas))], down = list[deltas.indexOf(Math.min(...deltas))];
      return Object.assign(base(t), {
        grid: { left: 110, right: 110, top: 26, bottom: 8 },
        xAxis: axisCat(t, ['Overall', 'Mountains only'], { boundaryGap: false, position: 'top', axisLine: { show: false }, axisLabel: { color: t.ink, fontWeight: 600 } }),
        yAxis: { type: 'value', inverse: true, min: 1, max: Math.max(15, ...list.map((x) => x.m)), show: false },
        tooltip: Object.assign(base(t).tooltip, { formatter: (p) => { const x = list[p.seriesIndex]; return tipHead(R(x.bib).name) + tipRow(null, 'Overall', ordinal(x.gc)) + tipRow(null, 'Mountains only', ordinal(x.m)); } }),
        series: list.map((x) => {
          const hl = x === up ? t.a : x === down ? t.b : null;
          const lab = { show: true, color: hl ? t.ink : t.ink2, fontSize: 11, fontWeight: hl ? 600 : 400, distance: 8 };
          return {
            type: 'line', symbolSize: 8, lineStyle: { width: hl ? 3 : 1.5, color: hl || t.ruleStrong }, itemStyle: { color: hl || t.muted, borderColor: t.sheet, borderWidth: 2 },
            emphasis: { focus: 'series', lineStyle: { width: 3 } }, z: hl ? 3 : 2,
            data: [
              { value: x.gc, label: { ...lab, position: 'left', formatter: `${R(x.bib).short} ${x.gc}` } },
              { value: x.m, label: { ...lab, position: 'right', formatter: `${x.m} ${R(x.bib).short}` } },
            ],
          };
        }),
      });
    });

    // points: published total = stage-finish points (race data) + points won elsewhere (intermediate sprints)
    const pTop = E.published.points.slice(0, 15);
    const shareOf = (o) => R(o.bib).otherPoints / o.points;
    const bySprint = pTop.slice().sort((a, b) => shareOf(b) - shareOf(a) || b.rank - a.rank);
    const pp = panel({ title: 'Green jersey: where the points came from', span: 7, sub: 'Published final points, top 15. Grey = stage-finish points from our race data (official 2025 scale per stage); green = points won away from the finish, at intermediate sprints (published total minus finish points).' });
    const ppBox = chartBox('tall');
    const w0 = pTop[0], fin0 = bySprint[bySprint.length - 1];
    add(pp.body, legend([{ color: 'var(--rule-strong)', label: 'Stage finishes (race data)' }, { color: 'var(--green)', label: 'Intermediate sprints' }]), ppBox,
      h('p', { class: 'verdict' }, `${R(w0.bib).short} won green with ${w0.points} points, ${Math.round(shareOf(w0) * 100)}% of them at intermediate sprints. ${R(bySprint[0].bib).short} took ${Math.round(shareOf(bySprint[0]) * 100)}% of his there; ${R(fin0.bib).short} scored ${shareOf(fin0) === 0 ? 'all' : `${Math.round((1 - shareOf(fin0)) * 100)}%`} of his at stage finishes. Green is won at intermediate sprints as well as at stage finishes.`));
    root.appendChild(pp.el);
    chart(ppBox, (t) => {
      const rows = pTop.slice().reverse();
      return Object.assign(base(t), {
        grid: { left: 8, right: 40, top: 6, bottom: 6, containLabel: true },
        xAxis: axisVal(t, {}), yAxis: axisCat(t, rows.map((o) => R(o.bib).short)),
        tooltip: Object.assign(base(t).tooltip, { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: blend(t.ink, t.sheet, 0.94) } }, formatter: (ps) => { const o = rows[ps[0].dataIndex]; const r = R(o.bib); return tipHead(`${r.name} · ${ordinal(o.rank)} in points`) + tipRow(null, 'Published total', o.points) + tipRow(t.ruleStrong, 'Stage finishes (data)', r.points) + tipRow(t.green, 'Intermediate sprints', r.otherPoints); } }),
        series: [
          { type: 'bar', stack: 'p', name: 'Stage finishes', barMaxWidth: 14, data: rows.map((o) => R(o.bib).points), itemStyle: { color: t.ruleStrong } },
          { type: 'bar', stack: 'p', name: 'Intermediate sprints', barMaxWidth: 14, data: rows.map((o) => R(o.bib).otherPoints), itemStyle: { color: t.green, borderRadius: [0, 4, 4, 0] },
            label: { show: true, position: 'right', color: t.ink2, formatter: (p) => String(rows[p.dataIndex].points) } },
        ],
      });
    }, { onClick: (p) => openRider(pTop.slice().reverse()[p.dataIndex].bib) });
    const kp = panel({ title: 'Polka-dot jersey vs mountain-stage results', span: 5, sub: 'Published mountain points (top 15) beside each rider’s place in our mountains-only standing and their podiums on mountain stages.' });
    add(kp.body, tbl([
      { label: 'Pos', render: (o) => String(o.rank), cls: 'pos' },
      { label: 'Rider', render: (o) => riderEl(o.bib, { bib: false }) },
      { label: 'Points', n: true, render: (o) => String(o.points) },
      { label: 'Mtn only', n: true, render: (o) => (R(o.bib).mountainRank ? ordinal(R(o.bib).mountainRank) : '-') },
      { label: 'Mtn podiums', n: true, render: (o) => String(R(o.bib).terrain.mountain ? R(o.bib).terrain.mountain.podiums : 0) },
    ], E.published.kom.slice(0, 15)), h('p', { class: 'note', text: `Climb points are not in the race data, so the polka-dot jersey can only be read here through mountain-stage results. Riders who hunt climb points in breakaways (Martinez) rank low on time. Full standings: ${E.published.kom.length} riders scored mountain points, ${E.published.points.length} scored green-jersey points.` }));
    root.appendChild(kp.el);
  };

  /* =================== form & risk: E12 =================== */
  renderers.form = (root) => {
    add(root, h('div', { class: 'view-head' }, h('div', null,
      h('p', { class: 'eyebrow', text: 'Top 10 finishes · reliability' }),
      h('h1', { text: 'Who keeps finishing near the front' }),
      h('p', { class: 'lede', text: 'This tab answers: who keeps finishing near the front, and who might not finish at all? Steady riders matter for questions like "will this rider finish in the top 10?", not only "will they win?". You can also see who faded in week 3 and who left the race.' }))));

    const cp = panel({ title: 'Consistency near the front', fn: [['E12', 'Consistency near the front']], sub: 'Riders with the most top-10 stage finishes. Click a bar to list the stages behind the count.' });
    let code = 'all', selBib = null;
    cp.head.appendChild(h('div', { class: 'panel-tools' }, seg([{ value: 'all', label: 'All terrain' }, ...TERR.map((c) => ({ value: c, label: TL[c], icon: glyph(c) }))], 'all', (v) => { code = v; selBib = null; redraw(cpChart); drawDetail(); }, 'Terrain')));
    const cpBox = chartBox('tall');
    const cpDetail = h('div', { style: 'display:flex;flex-direction:column;gap:8px;min-width:0' });
    add(cp.body, h('div', { class: 'split' }, cpBox, cpDetail));
    root.appendChild(cp.el);
    const listNow = () => E.consistency(code).slice(0, 15);
    const cpChart = chart(cpBox, (t) => {
      const list = listNow().slice().reverse();
      return Object.assign(base(t), {
        grid: { left: 8, right: 50, top: 6, bottom: 6, containLabel: true },
        xAxis: axisVal(t, { minInterval: 1 }), yAxis: axisCat(t, list.map((e) => R(e.bib).short)),
        tooltip: Object.assign(base(t).tooltip, { formatter: (p) => { const e = list[p.dataIndex]; return tipHead(R(e.bib).name) + tipRow(null, 'Top-10 finishes', `${e.top10s} of ${e.starts}`) + tipRow(null, 'Strike rate', pct(e.rate)) + tipRow(null, 'Wins / podiums', `${e.wins} / ${e.podiums}`); } }),
        series: [{ type: 'bar', barMaxWidth: 16, data: list.map((e) => ({ value: e.top10s, itemStyle: { color: e.bib === selBib ? t.ink : code === 'all' ? t.s[0] : t.terr[code], borderRadius: [0, 4, 4, 0] } })),
          label: { show: true, position: 'right', color: t.ink2, formatter: (p) => `${list[p.dataIndex].top10s}/${list[p.dataIndex].starts}` } }],
      });
    }, { onClick: (p) => { selBib = listNow().slice().reverse()[p.dataIndex].bib; redraw(cpChart); drawDetail(); } });
    function drawDetail() {
      clear(cpDetail);
      const list = listNow();
      const e = list.find((x) => x.bib === selBib) || list[0];
      if (!e) { cpDetail.appendChild(h('p', { class: 'note', text: 'No top-10 finishes on this terrain.' })); return; }
      const r = R(e.bib);
      add(cpDetail,
        h('h3', null, riderEl(e.bib)),
        h('div', { class: 'tiles' }, tile('Top-10 finishes', `${e.top10s}/${e.starts}`, `${pct(e.rate)} of stages ridden`, true), tile('Podiums', String(e.podiums), `${e.wins} win${e.wins === 1 ? '' : 's'}`, true), tile('Average placing', e.avgRank.toFixed(1), r.archetype, true)),
        tbl([
          { label: 'Stage', render: (x) => h('button', { class: 'rlink', type: 'button', dataset: { gotoStage: String(x.stage) }, text: String(x.stage) }) },
          { label: 'Terrain', render: (x) => terrEl(x.code) },
          { label: 'Place', n: true, render: (x) => ordinal(x.rank) },
          { label: 'Route', render: (x) => E.stageById.get(x.stage).route },
        ], e.stages, { scroll: true }));
    }
    drawDetail();

    // week form: final top six by default; add any rider (up to six)
    const wf = panel({ title: 'Form by week', span: 6, sub: 'Average time lost to each stage winner, per week. Lower is better; week 3 is where the Tour is decided. Starts with the final top six; pick up to six riders.' });
    let wfPick = E.gcFinal.slice(0, 6).map((e) => e.bib);
    const wfChips = h('div', { class: 'chips' });
    const wfBox = chartBox();
    const wfFinder = riderFinder((b) => { if (!wfPick.includes(b)) wfPick = [...wfPick, b].slice(-6); drawWf(); }, { filter: (r) => r.starts > 0 });
    add(wf.body, h('div', { class: 'story-pick' }, wfChips, wfFinder), wfBox);
    root.appendChild(wf.el);
    let wfChart;
    function drawWf() {
      clear(wfChips);
      const t = tokens();
      [...new Set([...E.gcFinal.slice(0, 6).map((e) => e.bib), ...wfPick])].forEach((b) => {
        const on = wfPick.includes(b);
        wfChips.appendChild(h('button', { type: 'button', class: 'chip', 'aria-pressed': String(on), on: { click: () => { wfPick = on ? wfPick.filter((x) => x !== b) : [...wfPick, b].slice(-6); drawWf(); } } },
          h('span', { class: 'sw', style: `background:${on ? t.s[wfPick.indexOf(b)] : 'transparent'};border:1px solid var(--rule-strong)` }), chipLabel(b)));
      });
      if (!wfChart) wfChart = chart(wfBox, (tk) => {
        const w = E.weekForm(wfPick);
        // weeks a rider did not ride (left the race) have no value
        const val = (b, k) => { const o = w.find((x) => x.bib === b && x.week === k); return o && o.n ? mins(o.avgGap) : null; };
        return Object.assign(base(tk), {
          grid: { left: 8, right: 16, top: 52, bottom: 6, containLabel: true },
          legend: { show: true, top: 0, left: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 3, textStyle: { color: tk.ink2 } },
          xAxis: axisCat(tk, ['Week 1 (stages 1 to 9)', 'Week 2 (10 to 15)', 'Week 3 (16 to 21)']),
          yAxis: axisY(tk, { inverse: true, min: 0, name: 'avg minutes lost to stage winner', nameLocation: 'start' }),
          tooltip: Object.assign(base(tk).tooltip, { trigger: 'axis', formatter: (ps) => tipHead(ps[0].axisValue) + ps.filter((p) => p.value != null).sort((a, b) => a.value - b.value).map((p) => tipRow(p.color, p.seriesName, `${p.value.toFixed(2)} min`)).join('') }),
          series: wfPick.map((b, i) => ({ type: 'line', name: chipLabel(b), symbolSize: 8, lineStyle: { width: 2, color: tk.s[i] }, itemStyle: { color: tk.s[i], borderColor: tk.sheet, borderWidth: 2 },
            emphasis: { focus: 'series' }, data: [1, 2, 3].map((k) => val(b, k)) })),
        });
      });
      else redraw(wfChart);
    }
    drawWf();

    // exits
    const ex = panel({ title: 'Riders who never reached Paris', span: 6, sub: 'Exits per stage: did not start, or abandoned during the stage. Hover a column for the names.' });
    const exBox = chartBox();
    add(ex.body, legend([{ color: 'var(--s1)', label: 'Did not start' }, { color: 'var(--s2)', label: 'Abandoned during the stage' }]), exBox);
    root.appendChild(ex.el);
    chart(exBox, (t) => Object.assign(base(t), {
      grid: { left: 8, right: 12, top: 14, bottom: 6, containLabel: true },
      xAxis: axisCat(t, E.stages.map((s) => String(s.id)), { name: 'Stage', nameLocation: 'middle', nameGap: 24 }),
      yAxis: axisY(t, { minInterval: 1 }),
      tooltip: Object.assign(base(t).tooltip, { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: blend(t.ink, t.sheet, 0.94) } }, formatter: (ps) => {
        const x = E.exitsByStage[ps[0].dataIndex];
        return tipHead(`Stage ${x.stage}: ${x.total} exit${x.total === 1 ? '' : 's'}`) + x.riders.map((b) => `<div>${esc(R(b).name)} · ${R(b).exitReason === 'DNS' ? 'did not start' : 'abandoned'}</div>`).join('') || tipHead(`Stage ${x.stage}: no exits`);
      } }),
      series: [
        { type: 'bar', stack: 'x', name: 'Did not start', barMaxWidth: 18, data: E.exitsByStage.map((x) => x.dns || null), itemStyle: { color: t.s[0], borderColor: t.sheet, borderWidth: 1 } },
        { type: 'bar', stack: 'x', name: 'Abandoned', barMaxWidth: 18, data: E.exitsByStage.map((x) => x.withdrawals || null), itemStyle: { color: t.s[1], borderColor: t.sheet, borderWidth: 1, borderRadius: [4, 4, 0, 0] } },
      ],
    }));

    const nx = panel({ title: 'Contenders lost along the way', sub: 'Every rider who left the race, with their overall position after the last stage they finished.' });
    const exits = E.exits.map((x) => {
      const r = R(x.bib);
      const last = r.lastStage ? E.gcPositionAfter(x.bib, r.lastStage) : null;
      return { ...x, pos: last ? last.position : null };
    }).sort((a, b) => (a.pos == null ? 999 : a.pos) - (b.pos == null ? 999 : b.pos));
    add(nx.body, tbl([
      { label: 'Rider', render: (x) => riderEl(x.bib) },
      { label: 'Left on', render: (x) => h('button', { class: 'rlink', type: 'button', dataset: { gotoStage: String(x.stage) }, text: `stage ${x.stage}` }) },
      { label: 'How', render: (x) => (x.reason === 'DNS' ? 'did not start' : 'abandoned') },
      { label: 'Overall when leaving', n: true, render: (x) => (x.pos ? ordinal(x.pos) : 'no stage finished') },
      { label: 'Rider type', render: (x) => R(x.bib).archetype },
    ], exits, { scroll: true, caption: `${E.exits.length} riders left: ${E.exits.filter((x) => x.reason === 'DNS').length} did not start a stage and ${E.exits.filter((x) => x.reason !== 'DNS').length} abandoned during one.` }));
    root.appendChild(nx.el);
  };

  /* =================== teams: E3, E14 =================== */
  renderers.teams = (root) => {
    add(root, h('div', { class: 'view-head' }, h('div', null,
      h('p', { class: 'eyebrow', text: 'Team bets' }),
      h('h1', { text: 'Which squads deliver' }),
      h('p', { class: 'lede', text: 'This tab answers: which teams were strongest, and which riders carried them? The team classification adds each team\'s three best times on every stage. Start from the team totals, then open a team to see its riders.' }))));

    const tc = panel({ title: 'Team classification', span: 5, sub: 'Gap to the winning team. Official method: the three best finish times per team on each stage, without bonuses or penalties.' });
    let variant = 'raw';
    tc.head.appendChild(h('div', { class: 'panel-tools' }, seg([{ value: 'raw', label: 'Official' }, { value: 'adj', label: 'With bonuses' }], 'raw', (v) => { variant = v; redraw(tcChart); }, 'Method')));
    const tcBox = h('div', { class: 'chart', style: 'height:560px' });
    add(tc.body, tcBox, h('p', { class: 'note', text: 'Click a team to open its breakdown below.' }));
    root.appendChild(tc.el);
    const tcChart = chart(tcBox, (t) => {
      const list = (variant === 'raw' ? E.TEAMCLASS : E.TEAMCLASS_ADJ).list.slice().reverse();
      return Object.assign(base(t), {
        grid: { left: 8, right: 64, top: 6, bottom: 6, containLabel: true },
        xAxis: axisVal(t, { name: 'minutes behind', nameLocation: 'middle', nameGap: 26 }),
        yAxis: axisCat(t, list.map((x) => teamShort(x.team)), { axisLabel: { color: t.ink2, fontSize: 11 } }),
        tooltip: Object.assign(base(t).tooltip, { formatter: (p) => { const x = list[p.dataIndex]; return tipHead(`${ordinal(x.rank)} · ${teamShort(x.team)}`) + tipRow(null, 'Total', fmtTime(x.total)) + tipRow(null, 'Gap', x.rank === 1 ? 'winner' : fmtGap(x.gap)); } }),
        series: [{ type: 'bar', barMaxWidth: 14, data: list.map((x) => ({ value: mins(x.gap), itemStyle: { color: x.team === S.team ? t.ink : t.s[0], borderRadius: [0, 4, 4, 0] } })),
          label: { show: true, position: 'right', color: t.ink2, fontSize: 11, formatter: (p) => (list[p.dataIndex].rank === 1 ? 'winner' : fmtGap(list[p.dataIndex].gap)) } }],
      });
    }, { onClick: (p) => { const list = (variant === 'raw' ? E.TEAMCLASS : E.TEAMCLASS_ADJ).list.slice().reverse(); S.team = list[p.dataIndex].team; teamSel.value = S.team; redraw(tcChart); drawTeam(); tb.el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });

    // E3
    const tb = panel({ title: 'Team burden and contribution', fn: [['E3', 'Team burden and contribution']], sub: 'Roll the team down to its riders: who supplied the three counted times, stage by stage. This panel uses the official rule (three best times per stage), while the Official / With bonuses switch above and the workload figure below show the other totals.' });
    const teamSel = selectEl('team-sel', [{ options: E.TEAMCLASS.list.map((x) => ({ value: x.team, label: `${ordinal(x.rank)} · ${teamShort(x.team)}` })) }], S.team, (v) => { S.team = v; redraw(tcChart); drawTeam(); }, 'Team');
    tb.head.appendChild(h('div', { class: 'panel-tools' }, teamSel));
    const tbBody = h('div', { style: 'display:flex;flex-direction:column;gap:12px;min-width:0' });
    tb.body.appendChild(tbBody);
    function drawTeam() {
      clear(tbBody);
      const tm = E.teamByName.get(S.team);
      const c = E.teamContribution(S.team);
      const t = tokens();
      const bucket = (rank) => (rank == null ? null : rank <= 3 ? 4 : rank <= 10 ? 3 : rank <= 30 ? 2 : rank <= 80 ? 1 : 0);
      const fill = (b) => (b == null ? 'transparent' : t.seq[b]);
      // the ramp runs light->dark in light mode and dark->light in dark mode, so the two
      // strongest steps take the surface colour as text and the rest take ink
      const ink = (b) => (b == null ? 'var(--muted)' : b >= 3 ? 'var(--sheet)' : 'var(--ink)');
      add(tbBody,
        h('div', { class: 'tiles' },
          tile('Team classification', ordinal(tm.classRank), tm.classRank === 1 ? fmtTime(tm.classTotal) : `${fmtGap(tm.classGap)} behind`, true),
          tile('Stage wins', String(tm.wins), `${tm.podiums} podiums · ${tm.top10s} top-10s`, true),
          tile('Riders in Paris', `${tm.finished} of ${tm.riders}`, tm.exits ? `${tm.exits} left the race` : 'nobody left', true),
          tile('Best rider overall', tm.bestGcBib ? R(tm.bestGcBib).short : '-', tm.bestGcRank ? ordinal(tm.bestGcRank) : '', true)),
        h('h3', { text: 'Whose times counted' }),
        h('p', { class: 'note', text: `Cells show each rider’s place on every stage. Outlined cells are the stages where that rider was one of the team’s three counted times. Total workload of the team’s finishers: ${fmtTime(tm.workload)}.` }),
        h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl heat' },
          h('thead', null, h('tr', null, h('th', { text: 'Rider' }), h('th', { class: 'n', text: 'Counted' }), E.stages.map((s) => h('th', { class: 'n', title: `Stage ${s.id} · ${TL[s.code]}`, text: String(s.id) })))),
          h('tbody', null, c.grid.slice().sort((a, b) => (c.list.find((x) => x.bib === b.bib).stagesCounted - c.list.find((x) => x.bib === a.bib).stagesCounted) || a.bib - b.bib).map((row) => {
            const cnt = c.list.find((x) => x.bib === row.bib);
            return h('tr', null,
              h('td', { style: 'white-space:nowrap' }, riderEl(row.bib, { team: false, short: true })),
              h('td', { class: 'n', text: `${cnt.stagesCounted}/21` }),
              row.cells.map((cell) => {
                const bk = bucket(cell.rank);
                return h('td', { class: 'n', title: cell.rank ? `Stage ${cell.stage}: ${ordinal(cell.rank)}${cell.counted ? ' · counted for the team' : ''}` : `Stage ${cell.stage}: not in race`,
                  style: `background:${fill(bk)};color:${ink(bk)};padding:4px 3px;font-size:12px;${cell.counted ? `outline:2px solid ${t.ink};outline-offset:-2px;` : ''}`, text: cell.rank ? String(cell.rank) : '·' });
              }));
          })))),
        legend([{ color: t.seq[4], label: 'Podium' }, { color: t.seq[3], label: '4th to 10th' }, { color: t.seq[2], label: '11th to 30th' }, { color: t.seq[1], label: '31st to 80th' }, { color: t.seq[0], label: '81st+' }]));
    }
    drawTeam();

    // E14
    const ti = panel({ title: 'Top-ten intensity by team', fn: [['E14', 'Top-ten intensity by team']], span: 7, sub: 'Top-10 stage finishes per team and terrain. Click a cell to list the stages and riders behind it.' });
    const tiBody = h('div', { style: 'display:flex;flex-direction:column;gap:14px;min-width:0' });
    const tiDetail = h('div', { style: 'display:flex;flex-direction:column;gap:8px;min-width:0' });
    ti.body.appendChild(tiBody);
    root.appendChild(ti.el);
    root.appendChild(tb.el);
    let cellSel = { team: E.teams.slice().sort((a, b) => b.top10s - a.top10s)[0].name, code: 'all' };
    function drawTi() {
      clear(tiBody);
      const t = tokens();
      const list = E.teams.slice().sort((a, b) => b.top10s - a.top10s || a.name.localeCompare(b.name));
      const max = Math.max(...list.flatMap((tm) => TERR.map((c) => tm.byTerrain[c].top10s)));
      const cell = (tm, c, v) => {
        const k = v === 0 ? null : Math.min(4, Math.ceil((v / (c === 'all' ? Math.max(...list.map((x) => x.top10s)) : max)) * 5) - 1);
        const on = cellSel.team === tm.name && cellSel.code === c;
        return h('td', { class: `cell${on ? ' on' : ''}`, tabindex: '0', role: 'button', 'aria-label': `${teamShort(tm.name)}, ${c === 'all' ? 'all terrain' : TL[c]}: ${v} top-10s`,
          style: `background:${k == null ? 'transparent' : t.seq[k]};color:${k != null && k >= 3 ? 'var(--sheet)' : 'var(--ink)'}`, text: String(v),
          on: { click: () => { cellSel = { team: tm.name, code: c }; drawTi(); }, keydown: (e) => { if (e.key === 'Enter') { cellSel = { team: tm.name, code: c }; drawTi(); } } } });
      };
      tiBody.appendChild(h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl heat' },
        h('thead', null, h('tr', null, h('th', { text: 'Team' }), TERR.map((c) => h('th', { class: 'n' }, terrEl(c))), h('th', { class: 'n', text: 'All' }))),
        h('tbody', null, list.map((tm) => h('tr', null, h('td', { style: 'white-space:nowrap', text: teamShort(tm.name) }), TERR.map((c) => cell(tm, c, tm.byTerrain[c].top10s)), cell(tm, 'all', tm.top10s)))))));
      clear(tiDetail);
      const det = E.teamTop10Detail(cellSel.team, cellSel.code);
      add(tiDetail, h('h3', { text: `${teamShort(cellSel.team)} · ${cellSel.code === 'all' ? 'all terrain' : TL[cellSel.code]}: ${det.length} top-10 finishes` }),
        det.length ? tbl([
          { label: 'Stage', render: (x) => h('button', { class: 'rlink', type: 'button', dataset: { gotoStage: String(x.stage) }, text: String(x.stage) }) },
          { label: 'Terrain', render: (x) => terrEl(x.code) },
          { label: 'Rider', render: (x) => riderEl(x.bib, { team: false }) },
          { label: 'Place', n: true, render: (x) => ordinal(x.rank) },
        ], det, { scroll: true }) : h('p', { class: 'note', text: 'No top-10 finishes here.' }));
      tiBody.appendChild(tiDetail);
    }
    drawTi();
  };

  /* =================== head-to-head =================== */
  renderers.h2h = (root) => {
    add(root, h('div', { class: 'view-head' }, h('div', null,
      h('p', { class: 'eyebrow', text: 'Head-to-head bets' }),
      h('h1', { text: 'Pick two, settle the bet' }),
      h('p', { class: 'lede', text: 'This tab answers: in a straight match-up, who finished ahead more often? A head-to-head bet asks which of two riders (or teams) does better. Pick any two and compare every stage they both rode in 2025.' })),
      seg([{ value: 'riders', label: 'Riders' }, { value: 'teams', label: 'Teams' }], S.h2hMode, (v) => { S.h2hMode = v; mode(); }, 'Compare riders or teams')));
    const rWrap = h('div', { class: 'subview' });
    const tWrap = h('div', { class: 'subview' });
    add(root, rWrap, tWrap);
    function mode() {
      rWrap.hidden = S.h2hMode !== 'riders'; tWrap.hidden = S.h2hMode !== 'teams';
      if (S.h2hMode === 'riders') drawRiders(); else drawTeams();
    }
    hooks.h2h = mode;
    const riderGroups = () => E.teams.slice().sort((a, b) => a.name.localeCompare(b.name)).map((tm) => ({
      label: teamShort(tm.name), options: E.teamRiders.get(tm.name).slice().sort((a, b) => (a.gcRank || 999) - (b.gcRank || 999) || a.name.localeCompare(b.name))
        .map((r) => ({ value: r.bib, label: `${r.name} (${r.gcRank ? ordinal(r.gcRank) : r.starts ? `left stage ${r.exitStage}` : 'no finish'})` })) }));
    const vsRow = (label, va, vb, better) => {
      const edge = better === 'a' ? 'a' : better === 'b' ? 'b' : '';
      return [h('div', { class: `va${edge === 'a' ? ' edge a' : ''}`, text: va }), h('div', { class: 'lab', text: label }), h('div', { class: `vb${edge === 'b' ? ' edge b' : ''}`, text: vb })];
    };
    const cmp = (a, b, lowerBetter) => (a == null || b == null || a === b ? '' : (lowerBetter ? a < b : a > b) ? 'a' : 'b');

    function drawRiders() {
      dropCharts(rWrap); clear(rWrap);
      const A = R(S.a), B = R(S.b);
      const hh = E.h2h(S.a, S.b);
      const t = tokens();
      const pick = panel({ title: 'Riders' });
      pick.el.querySelector('.panel-head').remove();
      const selA = selectEl('h2h-a', riderGroups(), S.a, (v) => { S.a = Number(v); drawRiders(); }, 'Rider A');
      const selB = selectEl('h2h-b', riderGroups(), S.b, (v) => { S.b = Number(v); drawRiders(); }, 'Rider B');
      add(pick.body, h('div', { class: 'picker' },
        h('div', { class: 'side a' }, h('span', { class: 'key a', text: 'Rider A' }), selA),
        h('button', { class: 'btn', type: 'button', text: '⇄ Swap', 'aria-label': 'Swap riders', on: { click: () => { [S.a, S.b] = [S.b, S.a]; drawRiders(); } } }),
        h('div', { class: 'side b' }, h('span', { class: 'key b', text: 'Rider B' }), selB)));
      let verdict;
      if (S.a === S.b) verdict = 'Pick two different riders.';
      else if (!hh.common) verdict = `${A.short} and ${B.short} never finished the same stage.`;
      else {
        const lead = hh.aAhead > hh.bAhead ? A : hh.bAhead > hh.aAhead ? B : null;
        const rec = `${A.short} ${hh.aAhead}-${hh.bAhead} ${B.short}`;
        const gcTxt = hh.finalGap == null ? (A.finished ? `${B.short} did not finish the race.` : B.finished ? `${A.short} did not finish the race.` : 'Neither finished the race.')
          : `Overall, ${hh.finalGap > 0 ? A.short : B.short} finished ${fmtGap(Math.abs(hh.finalGap)).slice(1)} ahead.`;
        verdict = [`Stage record: `, h('span', { class: lead === B ? 'b' : 'a', text: rec }), ` over ${hh.common} shared stage${hh.common === 1 ? '' : 's'}${lead ? `; ${lead.short} finished ahead more often` : ''}. ${gcTxt}`];
      }
      add(pick.body, h('p', { class: 'verdict' }, verdict));
      rWrap.appendChild(pick.el);
      pick.el.style.gridColumn = 'span 12';
      if (S.a === S.b || !hh.common) return;

      const st = panel({ title: 'Side by side', span: 5 });
      const grid = h('div', { class: 'vs-grid' });
      const ar = (r) => (r.avgRank == null ? null : r.avgRank);
      add(grid,
        h('div', { class: 'va' }, riderEl(A.bib, { team: false })), h('div', { class: 'lab', text: 'vs' }), h('div', { class: 'vb' }, riderEl(B.bib, { team: false })),
        vsRow('Team', teamShort(A.team), teamShort(B.team)),
        vsRow('Rider type', A.archetype, B.archetype),
        vsRow('Overall', A.gcRank ? ordinal(A.gcRank) : A.status, B.gcRank ? ordinal(B.gcRank) : B.status, cmp(A.gcRank, B.gcRank, true)),
        vsRow('Stage wins', String(A.wins), String(B.wins), cmp(A.wins, B.wins)),
        vsRow('Podiums', String(A.podiums), String(B.podiums), cmp(A.podiums, B.podiums)),
        vsRow('Top-10s', `${A.top10s}/${A.starts}`, `${B.top10s}/${B.starts}`, cmp(A.top10s, B.top10s)),
        vsRow('Average placing', ar(A) == null ? '-' : ar(A).toFixed(1), ar(B) == null ? '-' : ar(B).toFixed(1), cmp(ar(A), ar(B), true)),
        vsRow('Finish points', String(A.points), String(B.points), cmp(A.points, B.points)),
        vsRow('Mountains only', A.mountainRank ? ordinal(A.mountainRank) : '-', B.mountainRank ? ordinal(B.mountainRank) : '-', cmp(A.mountainRank, B.mountainRank, true)),
        vsRow('Bonus seconds', `${A.bonuses} s`, `${B.bonuses} s`, cmp(A.bonuses, B.bonuses)),
        vsRow('Age at start', String(A.age), String(B.age)));
      add(st.body, grid, h('p', { class: 'note', text: '◀ ▶ marks the better figure.' }));
      rWrap.appendChild(st.el);

      const tr = panel({ title: 'Who finished ahead, by terrain', span: 7, sub: 'Shared stages only. Bars count the stages each rider finished in front.' });
      const trBox = chartBox('short');
      add(tr.body, legend([{ color: t.a, label: A.short }, { color: t.b, label: B.short }]), trBox);
      rWrap.appendChild(tr.el);
      chart(trBox, (tk) => {
        const cats = TERR.filter((c) => hh.byTerrain[c].common);
        const mx = Math.max(1, ...cats.map((c) => Math.max(hh.byTerrain[c].a, hh.byTerrain[c].b)));
        return Object.assign(base(tk), {
          grid: { left: 8, right: 30, top: 6, bottom: 6, containLabel: true },
          xAxis: axisVal(tk, { min: -(mx + 1), max: mx + 1, minInterval: 1, axisLabel: { color: tk.muted, showMinLabel: false, showMaxLabel: false, formatter: (v) => String(Math.abs(v)) } }),
          yAxis: axisCat(tk, cats.map((c) => `${TL[c]} (${hh.byTerrain[c].common})`), { inverse: true }),
          tooltip: Object.assign(base(tk).tooltip, { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: blend(tk.ink, tk.sheet, 0.94) } }, formatter: (ps) => { const c = cats[ps[0].dataIndex]; return tipHead(`${TL[c]}: ${hh.byTerrain[c].common} shared stages`) + tipRow(tk.a, A.short, hh.byTerrain[c].a) + tipRow(tk.b, B.short, hh.byTerrain[c].b); } }),
          series: [
            { type: 'bar', stack: 'h', name: A.short, barMaxWidth: 20, data: cats.map((c) => -hh.byTerrain[c].a), itemStyle: { color: tk.a, borderRadius: [4, 0, 0, 4] }, label: { show: true, position: 'left', color: tk.ink2, formatter: (p) => (p.value ? String(-p.value) : '') } },
            { type: 'bar', stack: 'h', name: B.short, barMaxWidth: 20, data: cats.map((c) => hh.byTerrain[c].b), itemStyle: { color: tk.b, borderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right', color: tk.ink2, formatter: (p) => (p.value ? String(p.value) : '') } },
          ],
        });
      });

      const rk = panel({ title: 'Stage-by-stage placing', span: 6, sub: 'Place on each shared stage (log scale, 1st at the top).' });
      const rkBox = chartBox();
      add(rk.body, legend([{ color: t.a, label: A.short, line: true }, { color: t.b, label: B.short, line: true }]), rkBox);
      rWrap.appendChild(rk.el);
      chart(rkBox, (tk) => Object.assign(base(tk), {
        grid: { left: 8, right: 16, top: 14, bottom: 6, containLabel: true },
        xAxis: axisCat(tk, hh.rows.map((r) => String(r.stage)), { name: 'Stage', nameLocation: 'middle', nameGap: 24 }),
        yAxis: axisY(tk, { type: 'log', inverse: true, min: 1, logBase: 10, axisLabel: { color: tk.muted, formatter: (v) => ordinal(v) } }),
        tooltip: Object.assign(base(tk).tooltip, { trigger: 'axis', formatter: (ps) => { const r = hh.rows[ps[0].dataIndex]; const s2 = E.stageById.get(r.stage); return tipHead(`Stage ${r.stage} · ${TL[s2.code]}`) + tipRow(tk.a, A.short, ordinal(r.rankA)) + tipRow(tk.b, B.short, ordinal(r.rankB)); } }),
        series: [
          { type: 'line', name: A.short, data: hh.rows.map((r) => r.rankA), symbolSize: 7, lineStyle: { width: 2, color: tk.a }, itemStyle: { color: tk.a, borderColor: tk.sheet, borderWidth: 2 } },
          { type: 'line', name: B.short, data: hh.rows.map((r) => r.rankB), symbolSize: 7, lineStyle: { width: 2, color: tk.b }, itemStyle: { color: tk.b, borderColor: tk.sheet, borderWidth: 2 } },
        ],
      }), { onClick: (p) => gotoStage(hh.rows[p.dataIndex].stage) });

      const cg = panel({ title: 'Running time gap', span: 6, sub: `Cumulative adjusted time over the stages both rode. Above zero = ${A.short} ahead.` });
      const cgBox = chartBox();
      add(cg.body, cgBox);
      rWrap.appendChild(cg.el);
      const cgRows = hh.rows.filter((r) => r.cumGap != null);
      chart(cgBox, (tk) => Object.assign(base(tk), {
        grid: { left: 8, right: 16, top: 30, bottom: 6, containLabel: true },
        xAxis: axisCat(tk, cgRows.map((r) => String(r.stage)), { boundaryGap: false, name: 'Stage', nameLocation: 'middle', nameGap: 24 }),
        yAxis: axisY(tk, { name: 'minutes', axisLabel: { color: tk.muted, formatter: (v) => `${v > 0 ? '+' : ''}${v}` } }),
        tooltip: Object.assign(base(tk).tooltip, { trigger: 'axis', formatter: (ps) => { const r = cgRows[ps[0].dataIndex]; return tipHead(`After stage ${r.stage}`) + `<div>${esc(r.cumGap < 0 ? A.short : r.cumGap > 0 ? B.short : 'Level')}${r.cumGap ? ` ahead by ${esc(fmtGap(Math.abs(r.cumGap)).slice(1))}` : ''}</div>`; } }),
        series: [{ type: 'line', data: cgRows.map((r) => mins(-r.cumGap)), showSymbol: false, lineStyle: { width: 2, color: tk.ink }, itemStyle: { color: tk.ink },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: blend(tk.a, tk.sheet, 0.75) }, { offset: 1, color: blend(tk.b, tk.sheet, 0.75) }] }, opacity: 0.6 },
          markLine: { silent: true, symbol: 'none', lineStyle: { color: tk.axis, type: 'solid' }, label: { show: false }, data: [{ yAxis: 0 }] } }],
      }));
    }

    function drawTeams() {
      dropCharts(tWrap); clear(tWrap);
      const A = E.teamByName.get(S.ta), B = E.teamByName.get(S.tb);
      const hh = E.teamH2H(S.ta, S.tb);
      const t = tokens();
      const opts = [{ options: E.TEAMCLASS.list.map((x) => ({ value: x.team, label: teamShort(x.team) })) }];
      const pick = panel({ title: 'Teams' });
      pick.el.querySelector('.panel-head').remove();
      pick.el.style.gridColumn = 'span 12';
      add(pick.body, h('div', { class: 'picker' },
        h('div', { class: 'side a' }, h('span', { class: 'key a', text: 'Team A' }), selectEl('h2h-ta', opts, S.ta, (v) => { S.ta = v; drawTeams(); }, 'Team A')),
        h('button', { class: 'btn', type: 'button', text: '⇄ Swap', 'aria-label': 'Swap teams', on: { click: () => { [S.ta, S.tb] = [S.tb, S.ta]; drawTeams(); } } }),
        h('div', { class: 'side b' }, h('span', { class: 'key b', text: 'Team B' }), selectEl('h2h-tb', opts, S.tb, (v) => { S.tb = v; drawTeams(); }, 'Team B'))));
      const days = hh.rows.filter((r) => r.dayDiff < 0).length, daysB = hh.rows.filter((r) => r.dayDiff > 0).length;
      add(pick.body, h('p', { class: 'verdict' }, S.ta === S.tb ? 'Pick two different teams.' : [
        'Team classification: ', h('span', { class: hh.finalDiff <= 0 ? 'a' : 'b', text: teamShort(hh.finalDiff <= 0 ? A.name : B.name) }),
        ` finished ${fmtGap(Math.abs(hh.finalDiff)).slice(1)} ahead. Daily best-three times: ${teamShort(A.name)} faster on ${days} stages, ${teamShort(B.name)} on ${daysB}. Stage wins ${A.wins}-${B.wins}.`]));
      tWrap.appendChild(pick.el);
      if (S.ta === S.tb) return;

      const st = panel({ title: 'Side by side', span: 5 });
      const best = (tm) => (tm.bestGcBib ? `${R(tm.bestGcBib).short} (${ordinal(tm.bestGcRank)})` : '-');
      add(st.body, h('div', { class: 'vs-grid' },
        h('div', { class: 'va', text: teamShort(A.name) }), h('div', { class: 'lab', text: 'vs' }), h('div', { class: 'vb', text: teamShort(B.name) }),
        vsRow('Team classification', ordinal(A.classRank), ordinal(B.classRank), cmp(A.classRank, B.classRank, true)),
        vsRow('Stage wins', String(A.wins), String(B.wins), cmp(A.wins, B.wins)),
        vsRow('Podiums', String(A.podiums), String(B.podiums), cmp(A.podiums, B.podiums)),
        vsRow('Top-10s', String(A.top10s), String(B.top10s), cmp(A.top10s, B.top10s)),
        vsRow('Riders in Paris', `${A.finished}/8`, `${B.finished}/8`, cmp(A.finished, B.finished)),
        vsRow('Best rider overall', best(A), best(B), cmp(A.bestGcRank, B.bestGcRank, true)),
        vsRow('Riders in mountain top 20', A.mountainSupport.toFixed(2), B.mountainSupport.toFixed(2), cmp(A.mountainSupport, B.mountainSupport)),
        vsRow('Sprint + GC ambitions', A.splitPriorities ? 'split' : 'focused', B.splitPriorities ? 'split' : 'focused')),
      h('p', { class: 'note', text: '“Riders in mountain top 20” = average number of the team’s riders in the top 20 on each mountain stage. “Split” = a team with both a sprinter (two or more flat podiums) and a top-10 overall rider.' }));
      tWrap.appendChild(st.el);

      const tt = panel({ title: 'Top-10 finishes by terrain', span: 7 });
      const ttBox = chartBox('short');
      add(tt.body, legend([{ color: t.a, label: teamShort(A.name) }, { color: t.b, label: teamShort(B.name) }]), ttBox);
      tWrap.appendChild(tt.el);
      chart(ttBox, (tk) => Object.assign(base(tk), {
        grid: { left: 8, right: 12, top: 14, bottom: 6, containLabel: true },
        xAxis: axisCat(tk, TERR.map((c) => TL[c])), yAxis: axisY(tk, { minInterval: 1 }),
        tooltip: Object.assign(base(tk).tooltip, { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: blend(tk.ink, tk.sheet, 0.94) } } }),
        series: [A, B].map((tm, i) => ({ type: 'bar', name: teamShort(tm.name), barMaxWidth: 22, data: TERR.map((c) => tm.byTerrain[c].top10s), itemStyle: { color: i ? tk.b : tk.a, borderRadius: [4, 4, 0, 0] }, label: { show: true, position: 'top', color: tk.ink2 } })),
      }));

      const cg = panel({ title: 'Team time, stage by stage', span: 12, sub: `Running difference in the team classification (three best times per stage). Above zero = ${teamShort(A.name)} ahead.` });
      const cgBox = chartBox('short');
      add(cg.body, cgBox);
      tWrap.appendChild(cg.el);
      chart(cgBox, (tk) => Object.assign(base(tk), {
        grid: { left: 8, right: 16, top: 30, bottom: 6, containLabel: true },
        xAxis: axisCat(tk, hh.rows.map((r) => String(r.stage)), { boundaryGap: false, name: 'Stage', nameLocation: 'middle', nameGap: 24 }),
        yAxis: axisY(tk, { name: 'minutes', axisLabel: { color: tk.muted, formatter: (v) => `${v > 0 ? '+' : ''}${v}` } }),
        tooltip: Object.assign(base(tk).tooltip, { trigger: 'axis', formatter: (ps) => { const r = hh.rows[ps[0].dataIndex]; return tipHead(`After stage ${r.stage}`) + `<div>${esc(r.cumDiff < 0 ? teamShort(A.name) : r.cumDiff > 0 ? teamShort(B.name) : 'Level')}${r.cumDiff ? ` ahead by ${esc(fmtGap(Math.abs(r.cumDiff)).slice(1))}` : ''}</div>`; } }),
        series: [{ type: 'line', data: hh.rows.map((r) => mins(-r.cumDiff)), showSymbol: false, lineStyle: { width: 2, color: tk.ink }, itemStyle: { color: tk.ink },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: blend(tk.a, tk.sheet, 0.75) }, { offset: 1, color: blend(tk.b, tk.sheet, 0.75) }] }, opacity: 0.6 },
          markLine: { silent: true, symbol: 'none', lineStyle: { color: tk.axis, type: 'solid' }, label: { show: false }, data: [{ yAxis: 0 }] } }],
      }));

      [A, B].forEach((tm, i) => {
        const rp = panel({ title: `${i ? 'Team B' : 'Team A'} · ${teamShort(tm.name)}`, span: 6 });
        add(rp.body, tbl([
          { label: 'Rider', render: (r) => riderEl(r.bib, { team: false }) },
          { label: 'Type', render: (r) => r.archetype },
          { label: 'Overall', n: true, render: (r) => (r.gcRank ? ordinal(r.gcRank) : r.status) },
          { label: 'Wins', n: true, render: (r) => String(r.wins || '-') },
          { label: 'Top-10s', n: true, render: (r) => String(r.top10s || '-') },
        ], E.teamRiders.get(tm.name).slice().sort((a, b) => (a.gcRank || 999) - (b.gcRank || 999))));
        tWrap.appendChild(rp.el);
      });
    }
    mode();
  };

  /* =================== nations: E8, E9 =================== */
  renderers.nations = (root) => {
    add(root, h('div', { class: 'view-head' }, h('div', null,
      h('p', { class: 'eyebrow', text: 'Nations' }),
      h('h1', { text: 'Which countries supply the winners' }),
      h('p', { class: 'lede', text: 'This tab answers: which countries sent the most riders and teams, and whose riders did best? Riders count by nationality, teams by the country they are registered in. Click a country to list its riders and teams.' }))));
    const ns = E.nations.filter((n) => n.riders > 0);
    const most = ns.slice().sort((a, b) => b.riders - a.riders)[0];
    const teamCountries = E.nations.filter((n) => n.teams > 0);
    add(root, h('div', { class: 'tiles' },
      tile('Rider nationalities', String(ns.filter((n) => n.code !== 'XXX').length), '+1 rider with no listed nationality'),
      tile('Team countries', String(teamCountries.length), `${E.teams.length} teams`),
      tile('Most riders', most.name, `${most.riders} riders`, true),
      tile('Most stage wins', E.nations[0].name, `${E.nations[0].wins} stages`, true)));

    // map + ranked bars share one measure; both drill down to a nation
    const startsBy = new Map();
    E.riders.forEach((r) => startsBy.set(r.country, (startsBy.get(r.country) || 0) + r.starts));
    const MIN_STARTS = 40;
    const rateOf = (n) => { const st = startsBy.get(n.code) || 0; return st >= MIN_STARTS ? (n.top10s / st) * 100 : null; };
    const MEAS = {
      riders: { label: 'Riders', title: 'Riders per nationality', val: (n) => n.riders, fmt: (v) => String(v) },
      teams: { label: 'Teams', title: 'Teams per registration country', val: (n) => n.teams, fmt: (v) => String(v) },
      wins: { label: 'Stage wins', title: 'Stage wins per nation', val: (n) => n.wins, fmt: (v) => String(v) },
      rate: { label: 'Top-10s per 100 starts', title: 'Top-10 finishes per 100 stage starts', val: rateOf, fmt: (v) => v.toFixed(1) },
    };
    let meas = 'riders';
    const pool = E.nations.filter((n) => n.riders > 0 || n.teams > 0);
    const valOf = (n) => MEAS[meas].val(n);
    const mp = panel({ title: 'Where the riders and teams come from', fn: [['E8', 'Participation by nation']], fnAlso: [['E9', 'National outcomes']], span: 7, sub: 'Shade the map by participation or by results. Select a country to drill down to its riders below.' });
    mp.head.appendChild(h('div', { class: 'panel-tools' }, seg(Object.entries(MEAS).map(([k, m]) => ({ value: k, label: m.label })), meas, (v) => { meas = v; drawMeas(); }, 'Measure')));
    const mapBox = h('div', { class: 'chart nation-map', role: 'img', 'aria-label': 'Map of Europe shaded by the selected measure' });
    const tilesBox = h('div', { class: 'map-tiles' });
    add(mp.body, mapBox, h('p', { class: 'note', text: 'Outside this map:' }), tilesBox, h('p', { class: 'note', text: `Top-10s per 100 starts counts one rider on one stage as a start; nations with fewer than ${MIN_STARTS} starts (about two riders) are left blank. Outlines: Natural Earth.` }));
    const bp = panel({ title: MEAS.riders.title, span: 5 });
    const bpBox = h('div', { class: 'chart' });
    add(bp.body, bpBox);
    root.appendChild(mp.el); root.appendChild(bp.el);
    let selNation = E.nations[0].code;
    const ranked = () => pool.filter((n) => (valOf(n) ?? 0) > 0).sort((a, b) => valOf(b) - valOf(a) || a.name.localeCompare(b.name));
    const maxVal = () => Math.max(1e-9, ...pool.map((n) => valOf(n) ?? 0));
    const c1 = chart(mapBox, (t) => {
      ensureMaps();
      const mx = maxVal();
      const data = pool.filter((n) => GEO.euNames[n.code]).map((n) => {
        const v = valOf(n), on = n.code === selNation, fill = v ? seqColor(t, 0.12 + 0.88 * (v / mx)) : t.sheet2;
        return { name: GEO.euNames[n.code], value: v, code: n.code,
          itemStyle: { areaColor: fill, borderColor: on ? t.ink : t.sheet, borderWidth: on ? 2 : 0.8 },
          label: { show: !!v, formatter: v ? MEAS[meas].fmt(v) : '', color: v ? onColor(fill) : t.ink, fontSize: 11, fontWeight: 600 } };
      });
      return Object.assign(base(t), {
        tooltip: Object.assign(base(t).tooltip, { trigger: 'item', formatter: (p) => {
          const n = p.data && E.nations.find((x) => x.code === p.data.code);
          if (!n) return esc(p.name);
          const r = rateOf(n);
          return tipHead(n.name) + tipRow(null, 'Riders', n.riders) + tipRow(null, 'Teams registered', n.teams) + tipRow(null, 'Stage wins', n.wins) + tipRow(null, 'Top-10s per 100 starts', r == null ? 'too few starts' : r.toFixed(1));
        } }),
        series: [{ type: 'map', map: 'tdf-eu', roam: false, aspectScale: 0.62, layoutCenter: ['50%', '50%'], layoutSize: '100%', selectedMode: false,
          itemStyle: { areaColor: t.sheet2, borderColor: t.sheet, borderWidth: 0.8 }, label: { show: false },
          emphasis: { label: { show: true }, itemStyle: { areaColor: blend(t.maillot, t.sheet, 0.35) } }, data }],
      });
    }, { onClick: (p) => { if (p.data && p.data.code) pickNation(p.data.code); } });
    const c2 = chart(bpBox, (t) => {
      const l = ranked().reverse();
      return Object.assign(base(t), {
        grid: { left: 8, right: 36, top: 6, bottom: 6, containLabel: true },
        xAxis: axisVal(t, meas === 'rate' ? {} : { minInterval: 1 }), yAxis: axisCat(t, l.map((n) => n.name), { axisLabel: { color: t.ink2, fontSize: 11 } }),
        tooltip: Object.assign(base(t).tooltip, { formatter: (p) => { const n = l[p.dataIndex]; return tipHead(n.name) + tipRow(null, MEAS[meas].label, MEAS[meas].fmt(valOf(n))) + tipRow(null, 'Riders', n.riders); } }),
        series: [{ type: 'bar', barMaxWidth: 14, data: l.map((n) => ({ value: valOf(n), itemStyle: { color: n.code === selNation ? t.ink : seqColor(t, 0.65), borderRadius: [0, 4, 4, 0] } })),
          label: { show: true, position: 'right', color: t.ink2, fontSize: 11, formatter: (p) => MEAS[meas].fmt(p.value) } }],
      });
    }, { onClick: (p) => pickNation(ranked().reverse()[p.dataIndex].code) });
    function drawTiles() {
      clear(tilesBox);
      const t = tokens(), mx = maxVal();
      pool.filter((n) => !GEO.euNames[n.code]).sort((a, b) => (valOf(b) ?? -1) - (valOf(a) ?? -1) || a.name.localeCompare(b.name)).forEach((n) => {
        const v = valOf(n), fill = v ? seqColor(t, 0.12 + 0.88 * (v / mx)) : t.sheet;
        tilesBox.appendChild(h('button', { type: 'button', class: 'map-tile', 'aria-pressed': String(n.code === selNation), style: `background:${fill};color:${v ? onColor(fill) : 'var(--ink-2)'}`, on: { click: () => pickNation(n.code) } },
          h('b', { text: v ? MEAS[meas].fmt(v) : '-' }), n.name));
      });
    }
    function drawMeas() {
      bp.head.querySelector('h2').textContent = MEAS[meas].title;
      bpBox.style.height = `${Math.max(300, ranked().length * 19 + 30)}px`;
      redraw(c1); redraw(c2); drawTiles();
    }
    drawMeas();

    const op = panel({ title: 'National outcomes', fn: [['E9', 'National outcomes']], span: 7, sub: 'By rider nationality. Click a row to drill down to the riders.' });
    const opBody = h('div');
    op.body.appendChild(opBody);
    const dp = panel({ title: '', span: 5 });
    root.appendChild(op.el); root.appendChild(dp.el);
    function pickNation(code) { selNation = code; drawOut(); drawDrill(); redraw(c1); redraw(c2); drawTiles(); }
    function drawOut() {
      clear(opBody);
      opBody.appendChild(tbl([
        { label: 'Nation', render: (n) => n.name },
        { label: 'Riders', n: true, render: (n) => String(n.riders) },
        { label: 'Finished', n: true, render: (n) => String(n.finished) },
        { label: 'Stage wins', n: true, render: (n) => String(n.wins || '-') },
        { label: 'Podiums', n: true, render: (n) => String(n.podiums || '-') },
        { label: 'Top-10s', n: true, render: (n) => String(n.top10s || '-') },
        { label: 'Best overall', render: (n) => (n.bestGcBib ? [ordinal(n.bestGcRank), ' ', h('span', { class: 'team-s', text: R(n.bestGcBib).short })] : '-') },
      ], E.nations.filter((n) => n.riders > 0), { onRow: (n) => pickNation(n.code), rowClass: (n) => (n.code === selNation ? 'sel' : ''), scroll: true }));
    }
    function drawDrill() {
      const n = E.nations.find((x) => x.code === selNation);
      dp.head.querySelector('h2').textContent = `${n.name}: ${n.riders} rider${n.riders === 1 ? '' : 's'}${n.teams ? ` · ${n.teams} team${n.teams === 1 ? '' : 's'} registered` : ''}`;
      clear(dp.body);
      const rs = E.riders.filter((r) => r.country === n.code).sort((a, b) => (a.gcRank || 999) - (b.gcRank || 999) || a.name.localeCompare(b.name));
      if (!rs.length) { dp.body.appendChild(h('p', { class: 'note', text: 'No riders of this nationality; the country appears because a team is registered there.' })); return; }
      add(dp.body,
        n.stagesWon.length ? h('p', { class: 'note' }, h('b', { text: 'Stages won: ' }), n.stagesWon.map((x, i) => [i ? ', ' : '', h('button', { class: 'rlink', type: 'button', dataset: { gotoStage: String(x.stage) }, text: `stage ${x.stage}` }), ` (${R(x.bib).short})`])) : null,
        tbl([
          { label: 'Rider', render: (r) => riderEl(r.bib) },
          { label: 'Overall', n: true, render: (r) => (r.gcRank ? ordinal(r.gcRank) : r.starts ? `left s${r.exitStage}` : '-') },
          { label: 'Wins', n: true, render: (r) => String(r.wins || '-') },
          { label: 'Best stage', n: true, render: (r) => (r.starts ? ordinal(Math.min(...E.byRider.get(r.bib).map((x) => x.rank))) : '-') },
        ], rs, { scroll: true }));
    }
    drawOut(); drawDrill();
  };

  /* =================== method =================== */
  renderers.method = (root) => {
    add(root, h('div', { class: 'view-head' }, h('div', null,
      h('p', { class: 'eyebrow', text: 'Method and sources' }),
      h('h1', { text: 'How this form guide is built' }),
      h('p', { class: 'lede', text: 'This tab answers: where do the numbers come from, and where is each view? Every number is computed in your browser from the 2025 race data, except the official points and mountains standings, which come from published results.' }))));
    const fc = panel({ title: 'Where each view lives', span: 7, sub: 'The 15 views, E1 to E15, and the tab each one is on. The Function map tab takes you straight to each one.' });
    add(fc.body, h('p', { class: 'verdict' }, 'Want to see a view working? Open the ', h('a', { href: '#functions', text: 'Function map' }), ' and press any code from E1 to E15: it opens the right tab and highlights the panel.'));
    const F = [
      ['E1', 'GC leaderboard with contextual descent', 'Overall winner', '#outright', 'Final standings. Click a rider to see the day they gained or lost the most time on the top ten, then click through to that stage.'],
      ['E2', 'A stage in focus', 'Stages', '#stages', 'Pick any stage: winner, finish and adjusted times, teams, nations, distance and terrain. Click a team to see only its riders.'],
      ['E3', 'Team burden and contribution', 'Teams', '#teams', 'Team totals, then the riders whose times counted, stage by stage.'],
      ['E4', 'Parallel classifications', 'Jerseys', '#jerseys', 'Overall place next to young rider place (with an age filter at race start) and a mountains-only standing.'],
      ['E5', 'Mountain contours', 'Terrain', '#terrain', 'Podiums on mountain stages and average gap to the stage winner, with the daily gaps behind them.'],
      ['E6', 'Speed as a simple ratio', 'Terrain', '#terrain', 'Distance divided by time on each terrain, for riders and teams, compared with the median.'],
      ['E7', 'Bonuses, penalties, counterfactuals', 'Overall winner', '#outright', 'Bonus and penalty seconds for every rider, then a replay of the standings with them switched off.'],
      ['E8', 'Participation by nation', 'Nations', '#nations', 'Riders and teams per country on a map and a ranked list. Pick a country to list its riders and teams.'],
      ['E9', 'National outcomes', 'Nations', '#nations', 'Best overall place, stage wins and podiums per country, with links to the riders.'],
      ['E10', 'Temporal GC storyline', 'Overall winner', '#outright', 'Minutes behind the leader after each stage, mountain stages shaded, yellow jersey changes marked, rider and team filters.'],
      ['E11', 'Against the clock', 'Stages', '#stages', 'The time trials: date, distance, winner, speed and top five.'],
      ['E12', 'Consistency near the front', 'Form and risk', '#form', 'Riders with the most top-10 stage finishes, and the stages behind each count.'],
      ['E13', 'Depth of squads', 'Teams', '#teams', 'Distinct riders per team, with a way in to each team\'s full rider list and countries.'],
      ['E14', 'Top-ten intensity by team', 'Teams', '#teams', 'Top-10 finishes per team and terrain, with links to the stages and riders.'],
      ['E15', 'The long day', 'Stages', '#stages', 'Stages sorted by distance, the longest route in detail and its leading finishers with adjusted times.'],
    ];
    // Each code and tab link jumps straight to the panel that implements it and flashes it.
    const jumpTo = (f) => (e) => { e.preventDefault(); API.goToFunction(f[3].slice(1), f[0]); };
    add(fc.body, tbl([
      { label: 'Code', render: (f) => h('button', { class: 'fn fn-jump', type: 'button', style: 'margin:0', title: `Show ${f[0]} on the ${f[2]} tab`, 'aria-label': `Show ${f[0]}, ${f[1]}, on the ${f[2]} tab`, text: f[0], on: { click: jumpTo(f) } }) },
      { label: 'View', render: (f) => h('b', { text: f[1] }) },
      { label: 'Where', render: (f) => h('a', { href: f[3], title: `Open the ${f[2]} tab at ${f[0]}`, text: `${f[2]} ›`, on: { click: jumpTo(f) } }) },
      { label: 'What it does', render: (f) => f[4] },
    ], F, { caption: 'Press a code or a tab name to jump to that panel. It flashes yellow when you arrive.' }));
    root.appendChild(fc.el);

    const req = panel({ title: 'Ways to explore', span: 5 });
    add(req.body, h('dl', { class: 'kv' },
      h('dt', { text: 'Drill down' }), h('dd', { text: 'Go from a total to the detail behind it. Stages tab: terrain, then stage, then rider. Overall winner tab: rider, then their key stage. Teams tab: team, then rider, then stage. Nations tab: country, then riders. Click any rider name for a profile.' }),
      h('dt', { text: 'Compare the jerseys' }), h('dd', { text: 'Jerseys tab: the top 10 of the overall (yellow), points (green), mountains (polka dot) and young rider (white) standings side by side, plus each rider\'s places in all of them.' }),
      h('dt', { text: 'Running race times' }), h('dd', { text: 'Overall winner tab: each rider\'s total time after every stage. Teams tab: team totals and running team time. Head-to-head tab: the running gap between two riders or two teams.' }),
      h('dt', { text: 'Countries' }), h('dd', { text: 'Nations tab: how many riders and how many teams come from each country, on a map and in a ranked list, with results per country.' }),
      h('dt', { text: 'Colours and layout' }), h('dd', { text: 'One colour and icon per terrain, jersey colours for the standings, a plain sentence at the top of every tab, light and dark themes and a phone layout.' })));
    root.appendChild(req.el);

    const df = panel({ title: 'Definitions', span: 7 });
    add(df.body, h('div', { class: 'prose' },
      h('ul', null,
        h('li', null, h('b', { text: 'Adjusted time' }), ' = finish time minus time bonus plus time penalty. Overall standings add adjusted time over the stages and rank only riders who finished every stage so far; ties are broken by the sum of stage placings, as in the UCI rules.'),
        h('li', null, h('b', { text: 'Placings vs gaps' }), ': placings use the order riders crossed the line; gaps use the credited time. Riders in one bunch get the same time, so “s.t.” means same time as the winner.'),
        h('li', null, h('b', { text: 'Bunch finish' }), `: at least ${E.BUNCH_MIN} riders on the winner’s time.`),
        h('li', null, h('b', { text: 'Pivotal day (E1)' }), ': the stage with the largest difference between a rider’s adjusted time and the median adjusted time of the final top 10 that day.'),
        h('li', null, h('b', { text: 'Young rider' }), ': born on or after 1 January 2000 (2025 regulations, art. 24d); the age slider applies an age-at-race-start rule instead.'),
        h('li', null, h('b', { text: 'Team classification' }), ': the three best finish times per team on each stage, summed, without bonuses or penalties (art. 24e). Our totals equal the official ones.'),
        h('li', null, h('b', { text: 'Finish points' }), ': the official 2025 stage-finish scale for each stage (50, 30 or 20 points for the winner). Intermediate sprints are not in the data.'),
        h('li', null, h('b', { text: 'Speed index (E6)' }), ': total distance divided by total time on a terrain (in km/h), divided by the median finisher (riders) or median team (teams).'),
        h('li', null, h('b', { text: 'Rider types' }), ': the first rule that matches. Fewer than 5 starts: too few. Final top 10: GC contender (GC = general classification, the overall standings). Flat top-10s plus flat wins of at least 2, and more flat top-10s than hilly and mountain together: sprinter. Strong time-trial results: time-trialist. Mountain top-10s: climber. Hilly top-10s: puncheur (a rider for short, steep climbs). Otherwise: support rider.'))));
    root.appendChild(df.el);

    const cv = panel({ title: 'Caveats', span: 5 });
    add(cv.body, h('div', { class: 'prose' }, h('ul', null,
      h('li', { text: 'One season only: 7 flat, 6 hilly, 6 mountain stages and 2 time trials. Treat rates as signals, not probabilities.' }),
      h('li', { text: 'Stage 21 was timed for the overall 50.3 km from the finish because rain was forecast, so the data’s total times are about an hour longer than the official ones. Every gap is unchanged.' }),
      h('li', { text: 'No intermediate-sprint or climb points in the data, so the green and polka-dot jerseys use published standings. The full lists come from CyclingDB (collected by our teammate Jay); their top 10s are identical to the official results.' }),
      h('li', { text: 'Aleksandr Vlasov has no nationality in the source data and is listed as “Not specified”.' }),
      h('li', { text: 'Filippo Ganna and Stefan Bissegger left on stage 1 and have no results.' }),
      h('li', null, h('b', { text: 'No money: ' }), 'this site has no money, stakes or bets. It is a university analytics project that summarises one finished race, and past results do not guarantee future ones.'))));
    root.appendChild(cv.el);

    const src = panel({ title: 'Data sources' });
    add(src.body, h('div', { class: 'prose' }, h('ul', null,
      h('li', { text: 'Race results: BT5110 course CSVs (riders, individual results, exits), cleaned by Group 31 into rider, team, stage, result, exit and country tables; 184 riders, 3,602 stage results, 24 exits.' }),
      h('li', null, 'Official final classifications: ', [...new Set(E.official.map((o) => o.url))].map((u, i) => [i ? ', ' : '', h('a', { href: u, target: '_blank', rel: 'noopener', text: u.replace(/^https?:\/\//, '').slice(0, 70) })]), '. Cross-checked against RTÉ, cyclingstage and NBC Sports. The 2025 race regulations give the points scales, the young-rider rule and the team method.'),
      h('li', null, 'Full points and mountains standings (132 and 55 riders): ', h('a', { href: 'https://cyclingdb.com/race/tour-de-france/2025/points', target: '_blank', rel: 'noopener', text: 'CyclingDB points' }), ', ', h('a', { href: 'https://cyclingdb.com/race/tour-de-france/2025/kom', target: '_blank', rel: 'noopener', text: 'CyclingDB mountains' }), ', as collected for our teammate Jay’s dashboard; top 10s identical to the official results.'),
      h('li', null, 'Maps: country outlines from ', h('a', { href: 'https://www.naturalearthdata.com/', target: '_blank', rel: 'noopener', text: 'Natural Earth' }), ' (via world-atlas); stage town positions © ', h('a', { href: 'https://www.openstreetmap.org/copyright', target: '_blank', rel: 'noopener', text: 'OpenStreetMap contributors' }), ' (Nominatim).'))));
    root.appendChild(src.el);
  };

  /* =================== rider drawer (drill-through) =================== */
  const drawer = document.getElementById('drawer');
  const scrim = document.getElementById('scrim');
  let lastFocus = null;
  scrim.addEventListener('click', closeRider);
  function closeRider() {
    if (drawer.hidden) return;
    dropCharts(drawer); clear(drawer); drawer.hidden = true; scrim.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function openRider(bib) {
    const r = R(bib);
    if (!r) return;
    lastFocus = document.activeElement;
    dropCharts(drawer); clear(drawer);
    drawer.hidden = false; scrim.hidden = false;
    const rows = E.byRider.get(bib);
    const close = h('button', { class: 'btn close', type: 'button', text: 'Close', on: { click: closeRider } });
    add(drawer, close,
      h('div', { class: 'who' }, h('span', { class: 'bib', text: String(bib) }), h('div', null,
        h('h2', { text: r.name }),
        h('div', { class: 'note' }, `${teamShort(r.team)} · ${r.countryName} · ${r.age} at the start · `, h('span', { class: 'pill', text: r.archetype }), r.young ? [' ', h('span', { class: 'jersey white', title: 'Young rider' })] : null))),
      h('div', { class: 'tiles' },
        tile('Overall', r.gcRank ? ordinal(r.gcRank) : '-', r.gcRank ? (r.gcRank === 1 ? fmtTime(r.gcTotal) : fmtGap(r.gcGap)) : r.status, true),
        tile('Stage wins', String(r.wins), `${r.podiums} podiums`, true),
        tile('Top-10s', `${r.top10s}/${r.starts}`, r.starts ? `avg placing ${r.avgRank.toFixed(1)}` : 'no stages finished', true),
        tile('Green points', r.pubPoints ? String(r.pubPoints.points) : '-', r.pubPoints ? `${ordinal(r.pubPoints.rank)} · ${r.otherPoints} from sprints` : (r.finished ? 'not classified' : 'left the race'), true),
        tile('Mountain points', r.pubKom ? String(r.pubKom.points) : '-', r.pubKom ? `${ordinal(r.pubKom.rank)} in the mountains` : 'none scored', true)));
    if (!rows.length) { drawer.appendChild(h('p', { class: 'note', text: `${r.name} left the race on stage 1 and has no results.` })); close.focus(); return; }
    const t0 = tokens();
    const b1 = chartBox('short');
    add(drawer, h('h3', { text: 'Place on each stage' }), legend(TERR.map((c) => ({ color: t0.terr[c], label: TL[c] }))), b1);
    chart(b1, (t) => Object.assign(base(t), {
      grid: { left: 8, right: 12, top: 10, bottom: 6, containLabel: true },
      xAxis: axisCat(t, rows.map((x) => String(x.stage))),
      yAxis: axisY(t, { type: 'log', inverse: true, min: 1, axisLabel: { color: t.muted, formatter: (v) => ordinal(v) } }),
      tooltip: Object.assign(base(t).tooltip, { formatter: (p) => { const x = rows[p.dataIndex]; const s = E.stageById.get(x.stage); return tipHead(`Stage ${x.stage} · ${TL[s.code]}`) + `<div style="color:${t.muted}">${esc(s.route)}</div>` + tipRow(null, 'Place', ordinal(x.rank)) + tipRow(null, 'Gap', x.gap === 0 ? 'same time' : fmtGap(x.gap)); } }),
      series: [{ type: 'scatter', symbolSize: 10, data: rows.map((x) => ({ value: x.rank, itemStyle: { color: t.terr[x.code], borderColor: t.sheet, borderWidth: 2 } })) }],
    }), { onClick: (p) => { closeRider(); gotoStage(rows[p.dataIndex].stage); } });
    const gcRows = rows.map((x) => E.gcPositionAfter(bib, x.stage)).filter(Boolean);
    if (gcRows.length) {
      const b2 = chartBox('short');
      add(drawer, h('h3', { text: 'Overall position after each stage' }), b2);
      chart(b2, (t) => Object.assign(base(t), {
        grid: { left: 8, right: 12, top: 10, bottom: 6, containLabel: true },
        xAxis: axisCat(t, rows.slice(0, gcRows.length).map((x) => String(x.stage)), { boundaryGap: false }),
        yAxis: axisY(t, { inverse: true, min: 1, minInterval: 1 }),
        tooltip: Object.assign(base(t).tooltip, { trigger: 'axis', formatter: (ps) => { const e = gcRows[ps[0].dataIndex]; return tipHead(`After stage ${rows[ps[0].dataIndex].stage}`) + tipRow(null, 'Overall', ordinal(e.position)) + tipRow(null, 'Behind leader', e.gap ? fmtGap(e.gap) : 'leader'); } }),
        series: [{ type: 'line', data: gcRows.map((e) => e.position), symbolSize: 6, lineStyle: { width: 2, color: t.ink }, itemStyle: { color: t.ink } }],
      }));
    }
    const sp = E.speedProfile(bib);
    add(drawer, h('h3', { text: 'By terrain' }), tbl([
      { label: 'Terrain', render: (c) => terrEl(c) },
      { label: 'Starts', n: true, render: (c) => (r.terrain[c] ? String(r.terrain[c].starts) : '-') },
      { label: 'Wins', n: true, render: (c) => (r.terrain[c] ? String(r.terrain[c].wins) : '-') },
      { label: 'Top-10s', n: true, render: (c) => (r.terrain[c] ? String(r.terrain[c].top10s) : '-') },
      { label: 'Avg place', n: true, render: (c) => (r.terrain[c] ? r.terrain[c].avgRank.toFixed(1) : '-') },
      { label: 'Speed vs median', n: true, render: (c) => (sp[c].index == null ? '-' : `${sp[c].index >= 1 ? '+' : ''}${((sp[c].index - 1) * 100).toFixed(1)}%`) },
    ], TERR),
    h('div', { class: 'panel-tools' },
      h('button', { class: 'btn primary', type: 'button', text: 'Compare head-to-head', on: { click: () => { S.a = bib; if (S.b === bib) S.b = bib === 1 ? 11 : 1; S.h2hMode = 'riders'; closeRider(); go('h2h'); if (hooks.h2h) hooks.h2h(); } } }),
      r.gcRank ? h('button', { class: 'btn', type: 'button', text: 'Biggest day against the top ten', on: { click: () => { S.outrightBib = bib; closeRider(); go('outright'); if (hooks.outright) hooks.outright(); } } }) : null));
    close.focus();
  }

  /* =================== plugin API =================== */
  // Files in src/plugins/ add views and panels through window.TDF_APP. They load after this file.
  const API = { T, E, TERR, TL, h, add, clear, svgNS, svg, nf, fmtInt, pct, ordinal, MONTHS, DAYS, dateShort, secs, mins, fmtBy, surnameOf, surnameCount, R, SHORT_COUNTRY, TEAM_SHORT, teamShort, tokens, blend, charts, ro, chart, draw, redraw, dropCharts, redrawAll, GEO, ensureMaps, seqColor, onColor, loopRing, routeOption, base, axisCat, axisVal, axisY, tipRow, tipHead, esc, glyph, terrEl, riderEl, fnTag, panel, tile, seg, selectEl, riderFinder, chipLabel, tbl, legend, chartBox, VIEWS, built, renderers, route, show, go, S, hooks, gotoStage, drawer, scrim, closeRider, openRider, fmtTime, fmtGap, fmtClock };
  /** Add a new tab. render(root, API) runs the first time the tab opens. opts.before = name of the tab to insert before. */
  API.registerView = (name, label, render, opts) => {
    if (VIEWS.includes(name)) throw new Error(`view exists: ${name}`);
    const before = (opts && opts.before) || 'method';
    VIEWS.splice(Math.max(0, VIEWS.indexOf(before)), 0, name);
    const sec = h('section', { class: 'view', id: `view-${name}`, 'aria-label': label, hidden: '' });
    const refSec = document.getElementById(`view-${before}`);
    refSec.parentNode.insertBefore(sec, refSec);
    const link = h('a', { href: `#${name}`, text: label });
    const refLink = document.querySelector(`.tabs a[href="#${before}"]`);
    refLink.parentNode.insertBefore(link, refLink);
    renderers[name] = (root) => render(root, API);
    if ((location.hash || '').slice(1) === name) route();
    return sec;
  };
  /** Add panels to an existing tab. fn(root, API) runs right after the tab is first drawn (or now, if it is already drawn). */
  API.extendView = (name, fn) => {
    const orig = renderers[name];
    if (!orig) throw new Error(`no such view: ${name}`);
    renderers[name] = (root) => { orig(root); fn(root, API); };
    if (built.has(name)) { const root = document.getElementById(`view-${name}`); fn(root, API); charts.forEach((c) => { if (root.contains(c.el)) draw(c); }); }
  };
  /** Open a tab and scroll to the panel that implements a function code such as "E7". Returns the panel or null. */
  // Works on a tab that was never opened: the tab is drawn at once, and the scroll waits until the
  // hashchange handler (which scrolls to the top) has run.
  API.goToFunction = (viewName, code) => {
    const pending = location.hash !== `#${viewName}`;
    go(viewName);
    if (pending) show(viewName);
    const root = document.getElementById(`view-${viewName}`);
    const el = [...root.querySelectorAll('[data-fn]')].find((p) => p.dataset.fn.split(' ').includes(code));
    if (!el) return null;
    const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const jump = () => { el.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 2200); };
    if (pending) window.addEventListener('hashchange', () => setTimeout(jump, 0), { once: true }); else jump();
    return el;
  };
  window.TDF_APP = API;

  route();
})();
