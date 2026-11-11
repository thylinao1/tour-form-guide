/* Enlarged route map. A dialog that shows all 21 stages on a satellite terrain image of France, with the
   start and finish towns named. Opened from the small route map on the Stages tab.
   Exposes window.TDF_ROUTEMAP = { open(stageId, onPick), project, placeLabels }.
   The terrain image arrives as window.TDF_RELIEF = { src, bbox: [lonMin, latMin, lonMax, latMax], w, h }. */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const FALLBACK = { src: '', bbox: [-5.4, 41.9, 8.6, 51.6], w: 1600, h: 1618 };
  const FONT = 27, FONT_ON = 34, CHAR_W = 0.56, BADGE_R = 22, BADGE_R_ON = 30, PAD = 6;

  /* =================== pure helpers (tested in tests/routemap.test.mjs) =================== */
  /** Longitude and latitude to image pixels. The image is linear in both, so this is a straight scale. */
  function project(lonLat, rel) {
    const [x0, y0, x1, y1] = rel.bbox;
    return [((lonLat[0] - x0) / (x1 - x0)) * rel.w, ((y1 - lonLat[1]) / (y1 - y0)) * rel.h];
  }
  const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

  /** Candidate boxes for a label around a point: right, left, above, below, then the four corners. */
  function candidates(p, w, fs) {
    const g = 12, hgt = fs * 1.15;
    return [
      { x: p.x + g, y: p.y - hgt / 2, anchor: 'start' }, { x: p.x - g - w, y: p.y - hgt / 2, anchor: 'end' },
      { x: p.x - w / 2, y: p.y - g - hgt, anchor: 'middle' }, { x: p.x - w / 2, y: p.y + g, anchor: 'middle' },
      { x: p.x + g, y: p.y - g - hgt, anchor: 'start' }, { x: p.x + g, y: p.y + g, anchor: 'start' },
      { x: p.x - g - w, y: p.y - g - hgt, anchor: 'end' }, { x: p.x - g - w, y: p.y + g, anchor: 'end' },
    ].map((c) => Object.assign(c, { w, h: hgt }));
  }

  /** Greedy label placement. points: [{x, y, text, fs}] in priority order; blocked: boxes to keep clear.
      Each label takes the first position that touches nothing, or else the one that overlaps least. */
  function placeLabels(points, blocked, size) {
    const taken = blocked.slice();
    return points.map((p) => {
      const w = p.text.length * p.fs * CHAR_W;
      let best = null, bestCost = Infinity;
      for (const c of candidates(p, w, p.fs)) {
        const out = c.x < PAD || c.y < PAD || c.x + c.w > size.w - PAD || c.y + c.h > size.h - PAD ? 1e6 : 0;
        const cost = out + taken.reduce((sum, b) => sum + overlap(c, b), 0);
        if (cost < bestCost) { best = c; bestCost = cost; }
        if (cost === 0) break;
      }
      taken.push(best);
      const tx = best.anchor === 'start' ? best.x : best.anchor === 'end' ? best.x + best.w : best.x + best.w / 2;
      return Object.assign({}, p, { tx, ty: best.y + best.h * 0.76, anchor: best.anchor });
    });
  }

  const RM = { open: () => false, project, placeLabels };
  W.TDF_ROUTEMAP = RM;

  const API = W.TDF_APP;
  if (!API || !W.document) return;
  const { h, add, clear, svg, E, TL, TERR } = API;
  const GEO = (W.TDF_DATA && W.TDF_DATA.geo) || { places: {}, badges: {} };
  const REL = W.TDF_RELIEF || FALLBACK;
  const pt = (lonLat) => { const [x, y] = project(lonLat, REL); return { x, y }; };

  /* =================== drawing =================== */
  function stageShape(s, on) {
    const a = pt(GEO.places[s.start]), b = pt(GEO.places[s.finish]);
    const loop = s.start === s.finish;
    const mk = (cls, width) => (loop
      ? svg('circle', { cx: a.x, cy: a.y - 26, r: 26, class: cls, 'stroke-width': width, fill: 'none' })
      : svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: cls, 'stroke-width': width }));
    const g = svg('g', { class: `rm-stage${on ? ' on' : ''}`, style: `--c: var(--${s.code})` });
    add(g, mk('rm-casing', on ? 15 : 9), mk('rm-line', on ? 9 : 5));
    return g;
  }

  function badge(s, on, pick) {
    const B = GEO.badges[s.id], at = pt(B.at), anchor = pt(B.anchor), r = on ? BADGE_R_ON : BADGE_R;
    const g = svg('g', { class: `rm-badge${on ? ' on' : ''}`, style: `--c: var(--${s.code})`, tabindex: '0', role: 'button',
      'aria-label': `Stage ${s.id}, ${TL[s.code]}, ${s.route}` });
    if (Math.hypot(at.x - anchor.x, at.y - anchor.y) > 4) g.appendChild(svg('line', { x1: anchor.x, y1: anchor.y, x2: at.x, y2: at.y, class: 'rm-leader' }));
    const num = svg('text', { x: at.x, y: at.y + (on ? 11 : 8), 'text-anchor': 'middle', class: 'rm-num' });
    num.textContent = String(s.id);
    add(g, svg('circle', { cx: at.x, cy: at.y, r }), num);
    g.addEventListener('click', () => pick(s.id));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(s.id); } });
    return g;
  }

  /** Town labels: the chosen stage's towns first (larger, with Start and Finish), then every other town. */
  function townLabels(sel) {
    const st = E.stageById.get(sel);
    const first = st.start === st.finish ? [[st.start, st.start]] : [[st.start, `Start: ${st.start}`], [st.finish, `Finish: ${st.finish}`]];
    const chosen = new Set(first.map((f) => f[0]));
    const rest = Object.keys(GEO.places).filter((n) => !chosen.has(n)).sort((a, b) => GEO.places[b][1] - GEO.places[a][1]);
    const points = first.map(([n, text]) => Object.assign(pt(GEO.places[n]), { name: n, text, fs: FONT_ON, on: true }))
      .concat(rest.map((n) => Object.assign(pt(GEO.places[n]), { name: n, text: n, fs: FONT, on: false })));
    const blocked = E.stages.map((s) => { const c = pt(GEO.badges[s.id].at), r = (s.id === sel ? BADGE_R_ON : BADGE_R) + 3; return { x: c.x - r, y: c.y - r, w: 2 * r, h: 2 * r }; })
      .concat(points.map((p) => ({ x: p.x - 9, y: p.y - 9, w: 18, h: 18 })));
    return placeLabels(points, blocked, REL);
  }

  function drawMap(root, sel, pick) {
    clear(root);
    const s = svg('svg', { viewBox: `0 0 ${REL.w} ${REL.h}`, class: 'rm-svg', role: 'group', 'aria-label': 'Map of France with the 21 stages' });
    if (REL.src) s.appendChild(svg('image', { href: REL.src, x: 0, y: 0, width: REL.w, height: REL.h, preserveAspectRatio: 'none' }));
    else s.appendChild(svg('rect', { x: 0, y: 0, width: REL.w, height: REL.h, class: 'rm-blank' }));
    const order = E.stages.slice().sort((a, b) => (a.id === sel) - (b.id === sel)); // the chosen stage is drawn last, on top
    order.forEach((st) => s.appendChild(stageShape(st, st.id === sel)));
    const labels = townLabels(sel);
    labels.forEach((l) => s.appendChild(svg('circle', { cx: l.x, cy: l.y, r: l.on ? 9 : 6, class: `rm-town${l.on ? ' on' : ''}` })));
    labels.slice().reverse().forEach((l) => {
      const t = svg('text', { x: l.tx, y: l.ty, 'text-anchor': l.anchor, 'font-size': l.fs, class: `rm-label${l.on ? ' on' : ''}` });
      t.textContent = l.text;
      s.appendChild(t);
    });
    order.forEach((st) => s.appendChild(badge(st, st.id === sel, pick)));
    root.appendChild(s);
  }

  function drawList(root, sel, pick) {
    clear(root);
    E.stages.forEach((s) => {
      const on = s.id === sel;
      root.appendChild(h('li', null, h('button', { class: `rm-row${on ? ' on' : ''}`, type: 'button', 'aria-pressed': String(on), style: `--c: var(--${s.code})`, on: { click: () => pick(s.id) } },
        h('span', { class: 'rm-row-n', text: String(s.id) }),
        h('span', { class: 'rm-row-t' }, h('b', { text: s.route }), h('span', { text: `${TL[s.code]} · ${s.distance.toFixed(1)} km · ${API.dateShort(s.date)}` })))));
    });
    const cur = root.querySelector('.rm-row.on');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }

  /* =================== the dialog =================== */
  let dlg = null;
  function build() {
    const mapBox = h('div', { class: 'rm-map' });
    const list = h('ol', { class: 'rm-list' });
    const cap = h('p', { class: 'rm-cap', 'aria-live': 'polite' });
    const close = h('button', { class: 'btn rm-close', type: 'button', text: 'Close', on: { click: () => dlg.el.close() } });
    const el = h('dialog', { class: 'rm-dialog', 'aria-labelledby': 'rm-title' },
      h('div', { class: 'rm-head' },
        h('div', null, h('p', { class: 'rm-eyebrow', text: 'Route map' }), h('h2', { id: 'rm-title', text: 'Where each stage was raced' }), cap),
        close),
      h('div', { class: 'rm-body' }, mapBox,
        h('div', { class: 'rm-side' },
          h('div', { class: 'legend rm-legend' }, TERR.map((c) => h('span', null, h('i', { style: `background:var(--${c})` }), TL[c]))),
          list)),
      h('p', { class: 'rm-note', text: 'Lines join the start and finish towns, not the roads raced. A ring marks a stage that starts and finishes in one town. Terrain image: NASA Blue Marble (public domain). Town positions: © OpenStreetMap contributors.' }));
    el.addEventListener('click', (e) => { if (e.target === el) el.close(); }); // a click on the backdrop closes it
    document.body.appendChild(el);
    return { el, mapBox, list, cap, close };
  }

  function open(stageId, onPick) {
    if (!dlg) dlg = build();
    let sel = E.stageById.get(stageId) ? stageId : 1;
    const paint = () => {
      const s = E.stageById.get(sel);
      dlg.cap.textContent = `Stage ${s.id} · ${TL[s.code]} · ${s.route} · ${s.distance.toFixed(1)} km`;
      drawMap(dlg.mapBox, sel, pick);
      drawList(dlg.list, sel, pick);
    };
    function pick(id) { sel = id; paint(); if (onPick) onPick(id); }
    paint();
    if (!dlg.el.open) dlg.el.showModal();
    dlg.close.focus();
    return true;
  }
  RM.open = open;
})();
