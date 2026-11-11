/* Showcase plugin: the animated, interactive and 3D pieces.
   Start tab: a 3D podium of the final top three and headline numbers that count up.
   Outright tab: "Race replay" (the overall top 10 after every stage, as a bar chart race)
   and "The race in 3D" (ECharts GL bars, with a flat heatmap when WebGL is missing).
   The pure calculations sit in CALC so tests/showcase.test.mjs can check them in node. */
(function (root) {
  'use strict';

  /* ---------- pure calculations (no DOM) ---------- */
  const CALC = {
    /** Final top three: [{bib, position, cum, gap}] in finishing order. */
    podium(E) {
      return E.gcFinal.slice(0, 3).map((e) => ({ bib: e.bib, position: e.position, cum: e.cum, gap: e.gap }));
    },
    /** Headline counts for the start tab. */
    headline(E) {
      return {
        riders: E.riders.length,
        stages: E.stages.length,
        km: Math.round(E.stages.reduce((a, s) => a + s.distance, 0)),
        finishers: E.riders.filter((r) => r.finished).length,
      };
    },
    /** Every rider who sat in the overall top 10 after at least one stage, in order of first appearance. */
    replayCast(E) {
      const seen = [];
      E.stages.forEach((s) => E.gcAfter(s.id).slice(0, 10).forEach((e) => { if (!seen.includes(e.bib)) seen.push(e.bib); }));
      return seen;
    },
    /** Each cast member after a stage: position and gap in seconds, or nulls once the rider has left the race. */
    replayFrame(E, stageId, cast) {
      const by = new Map(E.gcAfter(stageId).map((e) => [e.bib, e]));
      return cast.map((bib) => {
        const e = by.get(bib);
        return e ? { bib, position: e.position, gap: e.gap } : { bib, position: null, gap: null };
      });
    },
    /** Final top 10 by stage: cells [stage index, rider index, minutes behind (1 decimal), seconds behind, position]. */
    raceGrid(E) {
      const bibs = E.gcTop10.slice();
      const cells = [];
      E.stages.forEach((s, si) => {
        const by = new Map(E.gcAfter(s.id).map((e) => [e.bib, e]));
        bibs.forEach((bib, ri) => {
          const e = by.get(bib);
          if (e) cells.push([si, ri, Math.round(e.gap / 6) / 10, e.gap, e.position]);
        });
      });
      return { bibs, stages: E.stages.map((s) => s.id), cells };
    },
  };
  if (typeof module === 'object' && module.exports) { module.exports = CALC; return; }

  /* ---------- browser part ---------- */
  const API = root.TDF_APP;
  if (!API) return;
  const { h, add, clear, E, R, panel, chart, base, tokens, teamShort, fmtTime, fmtGap, fmtBy, fmtInt, ordinal, TL, axisCat, axisVal, tipHead, tipRow, legend, seg, blend } = API;
  const reduceMotion = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /** Call fn(isVisible) whenever el enters or leaves the viewport. Without IntersectionObserver, report visible once. */
  function watchVisible(el, fn, threshold) {
    if (!('IntersectionObserver' in root)) { fn(true); return null; }
    const o = new IntersectionObserver((ens) => ens.forEach((en) => fn(en.isIntersecting)), { threshold: threshold || 0 });
    o.observe(el);
    return o;
  }
  const lookFor = (text) => h('p', { class: 'note sc-look' }, h('b', { text: 'What to look for: ' }), text);

  /* =================== 1. Start tab: 3D podium and counting numbers =================== */
  const PODIUM_ORDER = [1, 0, 2]; // second, winner, third, as on a real podium

  function podiumColumn(p) {
    const r = R(p.bib);
    const timeText = p.position === 1 ? `${fmtTime(p.cum)} in total` : `${fmtGap(p.gap)} behind`;
    return h('div', { class: `sc-col sc-p${p.position}`, dataset: { rider: String(p.bib) } },
      h('div', { class: 'sc-card' },
        h('span', { class: 'sc-name', text: r.name }),
        h('span', { class: 'sc-team', text: teamShort(r.team) }),
        h('span', { class: 'sc-time', text: timeText })),
      h('div', { class: 'sc-block' },
        h('span', { class: 'sc-top', 'aria-hidden': 'true' }),
        h('span', { class: 'sc-side', 'aria-hidden': 'true' }),
        h('button', {
          class: 'sc-front', type: 'button', dataset: { rider: String(p.bib) },
          'aria-label': `${ordinal(p.position)} overall: ${r.name}, ${timeText}. Open profile`,
        }, h('span', { class: 'sc-num', text: String(p.position) }))));
  }

  /** Tilt the podium a little toward the pointer. */
  function addTilt(scene, stage) {
    if (reduceMotion()) return;
    scene.addEventListener('pointermove', (e) => {
      const b = scene.getBoundingClientRect();
      if (!b.width || !b.height) return;
      const x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
      stage.style.setProperty('--ry', `${(x * 16).toFixed(2)}deg`);
      stage.style.setProperty('--rx', `${(-10 - y * 8).toFixed(2)}deg`);
    });
    scene.addEventListener('pointerleave', () => { stage.style.removeProperty('--ry'); stage.style.removeProperty('--rx'); });
  }

  /** Count a number up from 0. The final value is shown first, so the text is right even if no frame ever runs. */
  function countUp(el, target) {
    el.textContent = fmtInt(target);
    if (reduceMotion() || !root.requestAnimationFrame) return;
    const dur = 1300, t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = fmtInt(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) root.requestAnimationFrame(step);
    };
    root.requestAnimationFrame(step);
    setTimeout(() => { el.textContent = fmtInt(target); }, dur + 300);
  }

  function numberTile(label, value, foot) {
    const v = h('span', { class: 'value sc-count', text: fmtInt(value) });
    return { el: h('div', { class: 'tile' }, h('span', { class: 'label', text: label }), v, h('span', { class: 'foot', text: foot })), v, value };
  }

  function podiumPanel() {
    const pod = CALC.podium(E);
    const n = CALC.headline(E);
    const p = panel({ title: 'The final podium', id: 'sc-podium-panel', sub: 'The three riders with the lowest total time after 21 stages. Click a step to open that rider’s full race.' });
    const stage = h('div', { class: 'sc-stage' }, PODIUM_ORDER.map((i) => podiumColumn(pod[i])));
    const scene = h('div', { class: 'sc-scene', role: 'group', 'aria-label': 'Podium of the 2025 Tour de France' }, stage);
    addTilt(scene, stage);
    const tiles = [
      numberTile('Riders', n.riders, `${E.teams.length} teams of 8`),
      numberTile('Stages', n.stages, '3 weeks, 2 rest days'),
      numberTile('Kilometres', n.km, 'raced from start to Paris'),
      numberTile('Finishers', n.finishers, `${n.riders - n.finishers} riders left the race`),
    ];
    add(p.body, h('div', { class: 'sc-hero' }, scene, h('div', { class: 'tiles sc-nums' }, tiles.map((t) => t.el))),
      lookFor('the winner stands on the tall yellow step. The time under each name is the gap to the winner after 3 weeks of racing, so a small gap means a close race.'));
    let counted = false;
    watchVisible(p.el, (vis) => { if (vis && !counted) { counted = true; tiles.forEach((t) => countUp(t.v, t.value)); } }, 0.2);
    return p.el;
  }

  API.extendView('race', (viewRoot) => {
    const el = podiumPanel();
    const anchor = viewRoot.querySelector(':scope > .hero') || viewRoot.querySelector(':scope > .view-head') || viewRoot.firstElementChild;
    if (anchor) anchor.after(el); else viewRoot.appendChild(el);
  });

  /* =================== 2. Outright tab: race replay =================== */
  const SPEEDS = [{ value: 1700, label: 'Slow' }, { value: 1100, label: 'Normal' }, { value: 600, label: 'Fast' }];
  const GONE = -1e7; // value for riders who have left the race: always sorted last, never shown

  function replayColor(t, position) {
    if (position === 1) return t.maillot;
    return position <= 3 ? t.s[0] : blend(t.s[0], t.sheet, 0.5);
  }

  function replayData(t, frame) {
    return frame.map((f) => (f.position == null
      ? { value: GONE, pos: null, gap: null, itemStyle: { color: t.rule } }
      // a tiny tie-break by position keeps riders on the same time in the official order
      : { value: -(f.gap + f.position / 1000), pos: f.position, gap: f.gap, bib: f.bib, itemStyle: { color: replayColor(t, f.position) } }));
  }

  function replayMin(frame) {
    const gaps = frame.filter((f) => f.position != null && f.position <= 10).map((f) => f.gap);
    return -Math.max(30, Math.ceil(Math.max(...gaps) * 1.3));
  }

  function replayOption(t, cast, frame, dur) {
    return Object.assign(base(t), {
      animationDuration: 0, animationDurationUpdate: dur, animationEasing: 'linear', animationEasingUpdate: 'linear',
      grid: { left: 8, right: 92, top: 8, bottom: 6, containLabel: true },
      xAxis: axisVal(t, { min: replayMin(frame), max: 0, startValue: replayMin(frame), axisLabel: { color: t.muted, fontSize: 11, showMinLabel: false, formatter: (v) => (v === 0 ? 'Leader' : fmtBy(Math.round(-v))) } }),
      yAxis: axisCat(t, cast.map((b) => R(b).short), { inverse: true, max: 9, animationDuration: 300, animationDurationUpdate: dur, axisLine: { onZero: false, lineStyle: { color: t.axis } } }),
      tooltip: Object.assign(base(t).tooltip, { trigger: 'item', formatter: (p) => {
        const d = p.data;
        if (!d || d.pos == null) return '';
        const r = R(d.bib);
        return tipHead(r.name) + tipRow(null, 'Team', teamShort(r.team)) + tipRow(null, 'Position', ordinal(d.pos)) + tipRow(null, 'Behind leader', d.pos === 1 ? 'Leader' : fmtGap(d.gap));
      } }),
      series: [{
        type: 'bar', realtimeSort: true, barWidth: '64%', data: replayData(t, frame), itemStyle: { borderRadius: [0, 3, 3, 0] },
        label: { show: true, position: 'right', color: t.ink2, fontSize: 12, valueAnimation: false,
          formatter: (p) => (p.data.pos == null ? '' : p.data.pos === 1 ? 'Yellow jersey' : p.data.gap === 0 ? 'same time' : fmtGap(p.data.gap)) },
      }],
    });
  }

  function replayCaption(cap, stageId) {
    const s = E.stageById.get(stageId);
    const w = R(s.winnerBib);
    clear(cap);
    cap.style.setProperty('--tc', `var(--${s.code})`);
    add(cap,
      h('span', { class: 'sc-cap-n', text: `Stage ${s.id}` }),
      h('span', { class: 'sc-cap-t' }, API.terrEl(s.code), ` · ${s.route} · ${Math.round(s.distance)} km`),
      h('span', { class: 'sc-cap-w' }, 'Won by ', h('b', { text: w.name })));
    cap.classList.remove('sc-swap');
    void cap.offsetWidth; // restart the short fade
    cap.classList.add('sc-swap');
  }

  function replayControls(st, onPlay, onStage, onSpeed) {
    const playBtn = h('button', { class: 'btn primary sc-play', type: 'button', 'aria-pressed': 'false', text: 'Play', on: { click: onPlay } });
    const slider = h('input', { type: 'range', id: 'sc-replay-stage', class: 'sc-range', min: '1', max: String(E.stages.length), step: '1', value: String(st.stage), 'aria-label': 'Stage to show' });
    slider.addEventListener('input', () => onStage(Number(slider.value)));
    const speed = seg(SPEEDS, st.speed, onSpeed, 'Replay speed');
    const wrap = h('div', { class: 'sc-ctrl' }, playBtn,
      h('label', { class: 'field sc-slide', for: 'sc-replay-stage' }, h('span', { text: 'Stage' }), slider),
      h('span', { class: 'field' }, h('span', { text: 'Speed' }), speed));
    return { wrap, playBtn, slider };
  }

  function replayPanel() {
    const cast = CALC.replayCast(E);
    const st = { stage: 1, playing: false, speed: SPEEDS[1].value, timer: 0, autoplayed: false };
    const p = panel({ title: 'Race replay', span: 12, fnAlso: [['E10', 'Temporal GC storyline']],
      sub: 'The overall top 10 after every stage, by total adjusted time (finish time minus bonus seconds plus penalties). The leader’s bar reaches the line on the right; the further a bar stops short of it, the more time that rider is behind. Riders who leave the race drop out.' });
    const cap = h('div', { class: 'sc-cap' });
    const box = API.chartBox('tall sc-replay');
    box.setAttribute('aria-label', 'Bar chart race of the overall top 10 after each stage');
    const frame = () => CALC.replayFrame(E, st.stage, cast);
    const dur = () => (reduceMotion() ? 0 : Math.round(st.speed * 0.8));
    const ctl = replayControls(st, () => (st.playing ? stop() : play()), (id) => { stop(); setStage(id); }, (v) => { st.speed = v; });

    function setStage(id) {
      st.stage = id;
      ctl.slider.value = String(id);
      const s = E.stageById.get(id);
      ctl.slider.setAttribute('aria-valuetext', `Stage ${id}, ${TL[s.code]}, won by ${R(s.winnerBib).name}`);
      replayCaption(cap, id);
      const t = tokens(), f = frame();
      const inst = c.ref && c.ref.inst;
      if (inst) inst.setOption({ animationDurationUpdate: dur(), xAxis: { min: replayMin(f), startValue: replayMin(f) }, yAxis: { animationDurationUpdate: dur() }, series: [{ data: replayData(t, f) }] });
    }
    function setPlaying(on) {
      st.playing = on;
      ctl.playBtn.setAttribute('aria-pressed', String(on));
      ctl.playBtn.textContent = on ? 'Pause' : st.stage >= E.stages.length ? 'Replay from stage 1' : 'Play';
    }
    function tick() {
      if (!st.playing) return;
      if (st.stage >= E.stages.length) { stop(); return; }
      setStage(st.stage + 1);
      st.timer = setTimeout(tick, st.speed);
    }
    function play() {
      clearTimeout(st.timer); // never run two timer chains at once
      st.autoplayed = true; // a manual Play counts, so the first-visible autoplay does not start a second chain
      if (st.stage >= E.stages.length) setStage(1);
      setPlaying(true);
      st.timer = setTimeout(tick, st.speed);
    }
    function stop() { clearTimeout(st.timer); setPlaying(false); }

    add(p.body, ctl.wrap, cap,
      legend([{ color: 'var(--maillot)', label: 'Leader (yellow jersey)' }, { color: 'var(--s1)', label: '2nd and 3rd' }, { color: `color-mix(in srgb, var(--s1) 50%, var(--sheet))`, label: '4th to 10th' }]),
      box,
      lookFor('press Play and watch who climbs into the top 10 and who falls out. Flat stages barely change the order; the big moves come on the hilly days of week 1, the stage 5 time trial and the mountain stages 10, 12, 14 and 18.'));
    const c = { ref: null };
    const mount = () => {
      c.ref = chart(box, (t) => replayOption(t, cast, frame(), dur()));
      replayCaption(cap, st.stage);
      ctl.slider.setAttribute('aria-valuetext', `Stage ${st.stage}`);
    };
    watchVisible(p.el, (vis) => {
      if (!vis) { if (st.playing) stop(); return; }
      if (!st.autoplayed && !st.playing && !reduceMotion()) play();
    }, 0.35);
    return { el: p.el, mount, chartRef: c };
  }

  /* =================== 3. Outright tab: the race in 3D =================== */
  let webglOk = null;
  function hasWebGL() {
    if (webglOk != null) return webglOk;
    try {
      const cv = document.createElement('canvas');
      const gl = root.WebGLRenderingContext && (cv.getContext('webgl') || cv.getContext('experimental-webgl'));
      webglOk = !!gl;
      const lose = gl && gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    } catch (err) { webglOk = false; }
    return webglOk;
  }

  const gridColors = (t) => t.seq.slice(1); // skip the palest step so short bars stay visible
  function gridTip(t, grid, cell) {
    if (!cell) return '';
    const r = R(grid.bibs[cell[1]]), s = E.stages[cell[0]];
    return tipHead(r.name) + tipRow(t.terr[s.code], `After stage ${s.id}`, TL[s.code]) + tipRow(null, 'Position', ordinal(cell[4])) + tipRow(null, 'Behind leader', cell[3] === 0 ? 'Leader' : fmtGap(cell[3]));
  }

  function race3dOption(t, grid, rotate) {
    const maxZ = Math.max(...grid.cells.map((c) => c[2]));
    const axisStyle = { axisLine: { lineStyle: { color: t.axis } }, axisLabel: { textStyle: { color: t.ink2, fontSize: 11 } }, nameTextStyle: { color: t.muted, fontSize: 12 }, splitLine: { lineStyle: { color: t.grid } } };
    return {
      backgroundColor: 'transparent',
      tooltip: Object.assign(base(t).tooltip, { formatter: (p) => gridTip(t, grid, grid.cells[p.dataIndex]) }),
      visualMap: { show: false, min: 0, max: maxZ, dimension: 2, inRange: { color: gridColors(t) } },
      xAxis3D: Object.assign({ type: 'category', name: 'Stage', data: grid.stages.map(String) }, axisStyle),
      yAxis3D: Object.assign({ type: 'category', name: '', data: grid.bibs.map((b) => R(b).short) }, axisStyle),
      zAxis3D: Object.assign({ type: 'value', name: 'Minutes behind' }, axisStyle),
      grid3D: {
        boxWidth: 210, boxDepth: 100, boxHeight: 70,
        viewControl: { autoRotate: rotate, autoRotateSpeed: 5, distance: 250, alpha: 24, beta: 38, minDistance: 140, maxDistance: 420 },
        light: { main: { intensity: 1.1, shadow: false, alpha: 40, beta: 30 }, ambient: { intensity: 0.45 } },
        axisPointer: { lineStyle: { color: t.ink2 } },
      },
      series: [{ type: 'bar3D', shading: 'lambert', bevelSize: 0.15, minHeight: 0.2, data: grid.cells.map((c) => ({ value: [c[0], c[1], c[2]] })), emphasis: { itemStyle: { color: t.ink } } }],
    };
  }

  function heatOption(t, grid) {
    const maxZ = Math.max(...grid.cells.map((c) => c[2]));
    return Object.assign(base(t), {
      grid: { left: 8, right: 16, top: 8, bottom: 46, containLabel: true },
      xAxis: axisCat(t, grid.stages.map(String), { name: 'Stage', nameLocation: 'middle', nameGap: 24 }),
      yAxis: axisCat(t, grid.bibs.map((b) => R(b).short), { inverse: true }),
      visualMap: { min: 0, max: maxZ, dimension: 2, orient: 'horizontal', left: 'center', bottom: 0, itemHeight: 140, itemWidth: 12, calculable: false,
        inRange: { color: gridColors(t) }, text: [`${Math.round(maxZ)} min behind`, 'Leader'], textStyle: { color: t.muted, fontSize: 11 } },
      tooltip: Object.assign(base(t).tooltip, { trigger: 'item', formatter: (p) => gridTip(t, grid, grid.cells[p.dataIndex]) }),
      series: [{ type: 'heatmap', data: grid.cells.map((c) => [c[0], c[1], c[2]]), itemStyle: { borderColor: t.sheet, borderWidth: 1 } }],
    });
  }

  /** Real 3D chart on its own canvas renderer. Returns null if ECharts GL could not start. */
  function mount3d(box, grid, st) {
    let inst = null;
    try {
      inst = root.echarts.init(box, null, { renderer: 'canvas' });
      inst.setOption(race3dOption(tokens(), grid, st.rotate && st.visible));
    } catch (err) {
      if (inst) inst.dispose();
      clear(box);
      return null;
    }
    const retheme = () => { if (!inst.isDisposed()) inst.setOption(race3dOption(tokens(), grid, st.rotate && st.visible), true); };
    const mo = new MutationObserver(retheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    const mq = root.matchMedia ? root.matchMedia('(prefers-color-scheme: dark)') : null;
    if (mq) mq.addEventListener('change', retheme);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
      if (!box.isConnected) { dispose(); return; }
      if (box.clientWidth > 0 && !inst.isDisposed()) inst.resize();
    }) : null;
    if (ro) ro.observe(box);
    // The mouse wheel scrolls the page as usual; Ctrl or Cmd plus the wheel zooms the 3D chart.
    box.addEventListener('wheel', (e) => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); }, { capture: true });
    function dispose() { if (ro) ro.disconnect(); mo.disconnect(); if (mq) mq.removeEventListener('change', retheme); if (!inst.isDisposed()) inst.dispose(); }
    return {
      setRotate(on) { if (!inst.isDisposed()) inst.setOption({ grid3D: { viewControl: { autoRotate: on } } }); },
      dispose,
    };
  }

  function race3dPanel() {
    const grid = CALC.raceGrid(E);
    const st = { rotate: !reduceMotion(), visible: false, view: null, started: false };
    const rotBtn = h('button', { class: 'btn', type: 'button', 'aria-pressed': String(st.rotate), text: st.rotate ? 'Stop rotating' : 'Auto rotate',
      on: { click: () => {
        st.rotate = !st.rotate;
        rotBtn.setAttribute('aria-pressed', String(st.rotate));
        rotBtn.textContent = st.rotate ? 'Stop rotating' : 'Auto rotate';
        if (st.view) st.view.setRotate(st.rotate && st.visible);
      } } });
    const p = panel({ title: 'The race in 3D', span: 12, fnAlso: [['E10', 'Temporal GC storyline']], tools: rotBtn,
      sub: 'The final top 10 (front to back) across all 21 stages (left to right). Bar height is minutes behind the race leader after that stage. Drag to turn it, hold Ctrl (or Cmd) and scroll to zoom, hover a bar for details.' });
    const box = h('div', { class: 'chart sc-3d', role: 'img', 'aria-label': '3D bar chart: minutes behind the leader for the final top 10 after every stage' });
    const note = lookFor('short bars are close to the leader and tall bars are far behind (the colour gets stronger with height). Pogacar’s row stays almost flat all race (his largest gap was 29 seconds, after stages 10 and 11), while the rows behind him rise in steps on the mountain stages.');
    add(p.body, box, note);

    function start() {
      st.started = true;
      if (hasWebGL()) st.view = mount3d(box, grid, st);
      if (st.view) return;
      rotBtn.hidden = true;
      box.classList.add('sc-flat');
      box.setAttribute('aria-label', 'Heatmap: minutes behind the leader for the final top 10 after every stage');
      p.body.insertBefore(h('p', { class: 'note', text: 'Your browser cannot draw 3D graphics here, so this is the same data as a flat heatmap: the stronger the colour, the further behind the leader.' }), note);
      chart(box, (t) => heatOption(t, grid));
    }
    watchVisible(box, (vis) => {
      st.visible = vis;
      if (vis && !st.started) start();
      else if (st.view) st.view.setRotate(st.rotate && vis);
    }, 0.15);
    return p.el;
  }

  API.extendView('outright', (viewRoot) => {
    const replay = replayPanel();
    viewRoot.appendChild(replay.el);
    viewRoot.appendChild(race3dPanel());
    replay.mount();
  });
})(typeof self !== 'undefined' ? self : this);
