/*
 * Tour 2025 Form Guide - analytics engine.
 * Pure functions over the cleaned CSV tables (no DOM). The same file runs in the
 * browser (window.TDF) and in Node tests (module.exports), so the numbers the
 * tests check are the numbers the dashboard shows.
 *
 * Definitions follow the group's verified data notes (cleaned/README.md):
 *   adjusted time = finish_time - time_bonus + time_penalty
 *   placings use rank (crossing order); time gaps use finish_time (credited time)
 *   GC after stage s ranks only riders with a result on every stage 1..s
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TDF = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TERRAINS = ['flat', 'hilly', 'mountain', 'itt'];
  const TERRAIN_LABEL = { flat: 'Flat', hilly: 'Hilly', mountain: 'Mountain', itt: 'Time trial' };
  const RACE_START = '2025-07-05';
  const YOUNG_CUTOFF = '2000-01-01'; // 2025 regulations art. 24d (born on or after 1 Jan 2000)
  const BUNCH_MIN = 20;              // a "bunch finish": at least 20 riders share the winner's time
  const TEAM_SCORERS = 3;            // team classification: best 3 times per stage

  // Stage-type finish scales (the data's own stage type)
  const SCALE_50 = [50, 30, 20, 18, 16, 14, 12, 10, 8, 7, 6, 5, 4, 3, 2];
  const SCALE_30 = [30, 25, 22, 19, 17, 15, 13, 11, 9, 7, 6, 5, 4, 3, 2];
  const SCALE_20 = [20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const TYPE_SCALE = { flat: SCALE_50, hilly: SCALE_30, mountain: SCALE_20, itt: SCALE_20 };
  // Official 2025 finish scale per stage (regulations art. 22 coefficients / art. 24b):
  // 50-pt scale on stages 1,2,3,4,7,8,9,11,15,17,21; 30-pt on 6,16,20; 20-pt on 5,10,12,13,14,18,19.
  const OFFICIAL_FINISH_SCALE = { 1: 50, 2: 50, 3: 50, 4: 50, 5: 20, 6: 30, 7: 50, 8: 50, 9: 50, 10: 20, 11: 50,
    12: 20, 13: 20, 14: 20, 15: 50, 16: 30, 17: 50, 18: 20, 19: 20, 20: 30, 21: 50 };
  const SCALE_BY_TOP = { 50: SCALE_50, 30: SCALE_30, 20: SCALE_20 };

  /* ---------- small helpers ---------- */
  const typeCode = (t) => (t === 'individual time-trial' ? 'itt' : t);
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const mean = (a) => (a.length ? sum(a) / a.length : null);
  function median(a) {
    if (!a.length) return null;
    const s = a.slice().sort((x, y) => x - y);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function stdevSample(a) {
    if (a.length < 2) return null;
    const m = mean(a);
    return Math.sqrt(sum(a.map((x) => (x - m) * (x - m))) / (a.length - 1));
  }
  /** competition ranks (1,1,3) for an already-sorted array, by key fn */
  function competitionRanks(sorted, key) {
    const out = [];
    let prevKey, prevRank = 0;
    sorted.forEach((item, i) => {
      const k = key(item);
      const r = i > 0 && k === prevKey ? prevRank : i + 1;
      out.push(r); prevKey = k; prevRank = r;
    });
    return out;
  }
  function ageAt(dob, onDate) {
    const [y, m, d] = dob.split('-').map(Number);
    const [Y, M, D] = onDate.split('-').map(Number);
    let age = Y - y;
    if (M < m || (M === m && D < d)) age -= 1;
    return age;
  }

  /* ---------- formatting (shared by UI and tests) ---------- */
  const pad2 = (n) => String(n).padStart(2, '0');
  /** 277349 -> 77h 02' 29" */
  function fmtTime(s) {
    if (s == null || isNaN(s)) return '–';
    const neg = s < 0; s = Math.abs(Math.round(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (neg ? '−' : '') + `${h}h ${pad2(m)}' ${pad2(sec)}"`;
  }
  /** 264 -> +4' 24" ; 3723 -> +1h 02' 03" ; 0 -> leader dash */
  function fmtGap(s, zero) {
    if (s == null || isNaN(s)) return '–';
    if (s === 0 && zero !== undefined) return zero;
    const sign = s < 0 ? '−' : '+';
    let a = Math.abs(s);
    const half = Math.abs(a - Math.round(a)) > 1e-9;
    if (!half) a = Math.round(a);
    const h = Math.floor(a / 3600), m = Math.floor((a % 3600) / 60), sec = a - h * 3600 - m * 60;
    const secTxt = half ? sec.toFixed(1).padStart(4, '0') : pad2(sec);
    if (h > 0) return `${sign}${h}h ${pad2(m)}' ${secTxt}"`;
    return `${sign}${m}' ${secTxt}"`;
  }
  /** 13991 -> 3:53:11 */
  function fmtClock(s) {
    if (s == null) return '–';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${h}:${pad2(m)}:${pad2(sec)}`;
  }

  /* ======================================================================= */
  function createEngine(raw) {
    const countries = raw.countries.map(([code, name]) => ({ code, name }));
    const countryName = new Map(countries.map((c) => [c.code, c.name]));
    const teams = raw.teams.map(([name, country]) => ({ name, country, countryName: countryName.get(country) || country }));
    const teamByName = new Map(teams.map((t) => [t.name, t]));
    const riders = raw.riders.map(([bib, name, dob, team, country]) => ({
      bib, name, dob, team, country, countryName: countryName.get(country) || country,
      age: ageAt(dob, RACE_START), young: dob >= YOUNG_CUTOFF,
    }));
    const riderByBib = new Map(riders.map((r) => [r.bib, r]));
    const stages = raw.stages.map(([id, date, distance, type, start, finish]) => ({
      id, date, distance, type, code: typeCode(type), terrain: TERRAIN_LABEL[typeCode(type)],
      start, finish, route: start === finish ? `${start} (loop)` : `${start} → ${finish}`,
      week: id <= 9 ? 1 : id <= 15 ? 2 : 3, officialScaleTop: OFFICIAL_FINISH_SCALE[id],
    }));
    stages.sort((a, b) => a.id - b.id);
    const stageById = new Map(stages.map((s) => [s.id, s]));
    const LAST = stages[stages.length - 1].id;
    const exits = raw.exits.map(([bib, stage, reason]) => ({ bib, stage, reason }));
    const exitByBib = new Map(exits.map((e) => [e.bib, e]));

    const results = raw.results.map(([bib, stage, time, rank, bonus, penalty]) => ({
      bib, stage, time, rank, bonus, penalty, adj: time - bonus + penalty,
    }));
    const byStage = new Map(stages.map((s) => [s.id, []]));
    const byRider = new Map(riders.map((r) => [r.bib, []]));
    results.forEach((r) => { byStage.get(r.stage).push(r); byRider.get(r.bib).push(r); });
    byStage.forEach((rows) => rows.sort((a, b) => a.rank - b.rank || a.bib - b.bib));
    byRider.forEach((rows) => rows.sort((a, b) => a.stage - b.stage));

    /* ---- per-stage facts ---- */
    stages.forEach((s) => {
      const rows = byStage.get(s.id);
      const winners = rows.filter((r) => r.rank === 1);
      const w = winners[0];
      s.winnerBib = w.bib;
      s.winnerTime = w.time;
      s.field = rows.length;
      const second = rows.find((r) => r.rank === 2);
      s.marginToSecond = second ? second.time - w.time : null;
      const slower = rows.filter((r) => r.time > w.time).map((r) => r.time);
      s.marginNextGroup = slower.length ? Math.min(...slower) - w.time : null;
      s.inWinnerTime = rows.filter((r) => r.time === w.time).length;
      s.fasterThanWinner = rows.filter((r) => r.time < w.time).length;
      s.bunch = s.inWinnerTime >= BUNCH_MIN;
      s.speed = s.distance / (w.time / 3600);
      const scaleType = TYPE_SCALE[s.code];
      const scaleOff = SCALE_BY_TOP[s.officialScaleTop];
      rows.forEach((r) => {
        r.gap = r.time - w.time;
        r.pct = r.rank / rows.length;
        r.ptsType = r.rank <= 15 ? scaleType[r.rank - 1] : 0;
        r.pts = r.rank <= 15 ? scaleOff[r.rank - 1] : 0;
        r.speed = s.distance / (r.time / 3600);
        r.code = s.code;
      });
    });

    /* ---- per-rider basics ---- */
    riders.forEach((r) => {
      const rows = byRider.get(r.bib);
      r.starts = rows.length;
      r.finished = rows.length === LAST;
      r.lastStage = rows.length ? rows[rows.length - 1].stage : 0;
      const ex = exitByBib.get(r.bib);
      r.exitStage = ex ? ex.stage : null;
      r.exitReason = ex ? ex.reason : null;
      r.status = r.finished ? 'Finished' : ex ? (ex.reason === 'DNS' ? `Did not start stage ${ex.stage}` : `Abandoned stage ${ex.stage}`) : 'Unknown';
      r.wins = rows.filter((x) => x.rank === 1).length;
      r.podiums = rows.filter((x) => x.rank <= 3).length;
      r.top10s = rows.filter((x) => x.rank <= 10).length;
      r.avgRank = mean(rows.map((x) => x.rank));
      r.rankStdev = stdevSample(rows.map((x) => x.rank));
      r.bonuses = sum(rows.map((x) => x.bonus));
      r.penalties = sum(rows.map((x) => x.penalty));
      r.totalAdj = sum(rows.map((x) => x.adj));
      r.pointsType = sum(rows.map((x) => x.ptsType));
      r.points = sum(rows.map((x) => x.pts));
      r.teamCountry = (teamByName.get(r.team) || {}).country;
    });

    /* ---- GC after every stage (memoised per option set) ---- */
    const gcCache = new Map();
    /** opts: {bonus: true|false, penalty: true|false} -> array[stage index] of ranked entries */
    function gcProgress(opts) {
      const o = { bonus: true, penalty: true, ...(opts || {}) };
      const key = `${o.bonus ? 1 : 0}${o.penalty ? 1 : 0}`;
      if (gcCache.has(key)) return gcCache.get(key);
      const acc = new Map();
      const out = {};
      stages.forEach((s) => {
        byStage.get(s.id).forEach((r) => {
          const a = acc.get(r.bib) || { bib: r.bib, cum: 0, cumRanks: 0, count: 0 };
          a.cum += r.time - (o.bonus ? r.bonus : 0) + (o.penalty ? r.penalty : 0);
          a.cumRanks += r.rank; a.count += 1; a.stageRank = r.rank;
          acc.set(r.bib, a);
        });
        const pop = [];
        byStage.get(s.id).forEach((r) => {
          const a = acc.get(r.bib);
          if (a.count === s.id) pop.push({ bib: a.bib, cum: a.cum, cumRanks: a.cumRanks, stageRank: a.stageRank });
        });
        pop.sort((x, y) => x.cum - y.cum || x.cumRanks - y.cumRanks || x.stageRank - y.stageRank || x.bib - y.bib);
        const ranks = competitionRanks(pop, (e) => e.cum);
        const lead = pop[0].cum;
        pop.forEach((e, i) => { e.position = i + 1; e.rank = ranks[i]; e.gap = e.cum - lead; });
        out[s.id] = pop;
      });
      gcCache.set(key, out);
      return out;
    }
    const GC = gcProgress();
    const gcFinal = GC[LAST];
    const gcPosByBib = new Map(gcFinal.map((e) => [e.bib, e]));
    riders.forEach((r) => {
      const e = gcPosByBib.get(r.bib);
      r.gcRank = e ? e.position : null;
      r.gcTotal = e ? e.cum : null;
      r.gcGap = e ? e.gap : null;
    });
    const gcTop10 = gcFinal.slice(0, 10).map((e) => e.bib);

    /* ---- full published points and mountains standings (top 10 = official file) ---- */
    const published = { points: [], kom: [] };
    (raw.published || []).forEach(([c, rank, bib, pts]) => { if (published[c]) published[c].push({ rank, bib, points: pts }); });
    Object.values(published).forEach((l) => l.sort((x, y) => x.rank - y.rank));
    const pubBy = { points: new Map(published.points.map((x) => [x.bib, x])), kom: new Map(published.kom.map((x) => [x.bib, x])) };
    riders.forEach((r) => {
      r.pubPoints = pubBy.points.get(r.bib) || null;   // { rank, points } or null if not classified
      r.pubKom = pubBy.kom.get(r.bib) || null;
      // published points minus finish-line points from the data = points won away from the finish (intermediate sprints)
      r.otherPoints = r.pubPoints ? r.pubPoints.points - r.points : null;
    });

    function gcAfter(stageId, opts) { return gcProgress(opts)[stageId]; }
    function gcPositionAfter(bib, stageId, opts) {
      const e = gcProgress(opts)[stageId].find((x) => x.bib === bib);
      return e || null;
    }

    /* ---- yellow jersey after each stage ---- */
    const leaders = stages.map((s, i) => {
      const pop = GC[s.id];
      const L = pop[0], second = pop[1];
      return {
        stage: s.id, bib: L.bib, cum: L.cum, secondBib: second.bib, margin: second.cum - L.cum,
        levelOnTime: pop.filter((e) => e.cum === L.cum).length - 1, ranked: pop.length,
        changed: i > 0 && GC[stages[i - 1].id][0].bib !== L.bib,
      };
    });
    riders.forEach((r) => { r.stagesInYellow = leaders.filter((l) => l.bib === r.bib).length; });

    /* GC ranks of each stage winner, before/after */
    stages.forEach((s, i) => {
      const after = GC[s.id].find((e) => e.bib === s.winnerBib);
      s.winnerGcAfter = after ? after.rank : null;
      if (i > 0) {
        const before = GC[stages[i - 1].id].find((e) => e.bib === s.winnerBib);
        s.winnerGcBefore = before ? before.rank : null;
      } else s.winnerGcBefore = null;
      s.winnerFinalGc = riderByBib.get(s.winnerBib).gcRank;
      s.yellowAfter = leaders[i].bib;
      if (i > 0) {
        const prevTop = new Set(GC[stages[i - 1].id].slice(0, 10).map((e) => e.bib));
        const nowTop = GC[s.id].slice(0, 10).map((e) => e.bib);
        s.top10Shuffle = nowTop.filter((b) => !prevTop.has(b)).length;
      } else s.top10Shuffle = null;
    });

    /* ---- terrain stats per rider ---- */
    function terrainStats(bib, code) {
      const rows = byRider.get(bib).filter((x) => !code || code === 'all' || x.code === code);
      if (!rows.length) return null;
      const dist = sum(rows.map((x) => stageById.get(x.stage).distance));
      const time = sum(rows.map((x) => x.time));
      return {
        starts: rows.length,
        wins: rows.filter((x) => x.rank === 1).length,
        podiums: rows.filter((x) => x.rank <= 3).length,
        top10s: rows.filter((x) => x.rank <= 10).length,
        top10Rate: rows.filter((x) => x.rank <= 10).length / rows.length,
        avgRank: mean(rows.map((x) => x.rank)),
        medianRank: median(rows.map((x) => x.rank)),
        bestRank: Math.min(...rows.map((x) => x.rank)),
        avgGap: mean(rows.map((x) => x.gap)),
        avgPct: mean(rows.map((x) => x.pct)),
        points: sum(rows.map((x) => x.pts)),
        pointsType: sum(rows.map((x) => x.ptsType)),
        speed: dist * 3600 / time,
        rows,
      };
    }
    riders.forEach((r) => {
      r.terrain = {};
      TERRAINS.forEach((t) => { r.terrain[t] = terrainStats(r.bib, t); });
    });

    /* ---- archetype (rule-based label; first matching rule wins) ---- */
    function archetypeOf(r) {
      const f = (t) => {
        const s = r.terrain[t];
        return s ? { top10: s.top10s, wins: s.wins, score: s.top10s + s.wins, pct: s.avgPct } : { top10: 0, wins: 0, score: 0, pct: null };
      };
      const fl = f('flat'), hi = f('hilly'), mo = f('mountain'), it = f('itt');
      if (r.starts < 5) return { label: 'Too few starts', rule: 'R0' };
      if (r.gcRank != null && r.gcRank <= 10) return { label: 'GC contender', rule: 'R1' };
      if (fl.score >= 2 && fl.top10 > hi.top10 + mo.top10) return { label: 'Sprinter', rule: 'R2' };
      if (it.top10 >= 1 && it.pct != null && mo.pct != null && it.pct <= 0.10 && it.pct < mo.pct) return { label: 'Time-trialist', rule: 'R3' };
      if (mo.score >= 2 || (mo.top10 >= 1 && mo.pct != null && mo.pct <= 0.15)) return { label: 'Climber', rule: 'R4' };
      if (hi.score >= 2 || (hi.top10 >= 1 && hi.pct != null && hi.pct <= 0.15)) return { label: 'Puncheur', rule: 'R5' };
      return { label: 'Support rider', rule: 'R6' };
    }
    riders.forEach((r) => { const a = archetypeOf(r); r.archetype = a.label; r.archetypeRule = a.rule; });

    /* ---- young rider classification (E4) ---- */
    /** rule: {mode:'calendar'} (born on/after 1 Jan 2000) or {mode:'age', maxAge:n} (age at race start) */
    function youngClassification(rule) {
      const ru = rule || { mode: 'calendar' };
      const ok = (r) => (ru.mode === 'age' ? r.age <= ru.maxAge : r.dob >= YOUNG_CUTOFF);
      const list = gcFinal.filter((e) => ok(riderByBib.get(e.bib)));
      const lead = list.length ? list[0].cum : 0;
      return list.map((e, i) => ({ bib: e.bib, youngRank: i + 1, gcRank: e.position, total: e.cum, gap: e.cum - lead }));
    }
    const youngDefault = youngClassification();
    const youngRankByBib = new Map(youngDefault.map((y) => [y.bib, y.youngRank]));
    riders.forEach((r) => { r.youngRank = youngRankByBib.get(r.bib) || null; });

    /* ---- mountain-stage GC proxy (E4/E5) ---- */
    const mountainIds = stages.filter((s) => s.code === 'mountain').map((s) => s.id);
    const mountainGC = (() => {
      const list = [];
      riders.forEach((r) => {
        const rows = byRider.get(r.bib).filter((x) => x.code === 'mountain');
        if (rows.length !== mountainIds.length) return;
        list.push({
          bib: r.bib, total: sum(rows.map((x) => x.adj)), pointsType: sum(rows.map((x) => x.ptsType)),
          wins: rows.filter((x) => x.rank === 1).length, podiums: rows.filter((x) => x.rank <= 3).length,
          top10s: rows.filter((x) => x.rank <= 10).length, avgGap: mean(rows.map((x) => x.gap)),
        });
      });
      list.sort((a, b) => a.total - b.total || b.pointsType - a.pointsType || a.bib - b.bib);
      const lead = list[0].total;
      list.forEach((e, i) => { e.rank = i + 1; e.gap = e.total - lead; });
      return list;
    })();
    const mountainRankByBib = new Map(mountainGC.map((e) => [e.bib, e.rank]));
    riders.forEach((r) => { r.mountainRank = mountainRankByBib.get(r.bib) || null; });

    /* ---- points estimate (finish-line points only) ---- */
    function pointsRanking(field) {
      const f = field || 'points';
      const list = riders.filter((r) => r.starts > 0).map((r) => ({ bib: r.bib, points: r[f], wins: r.wins, gc: r.gcRank }));
      list.sort((a, b) => b.points - a.points || b.wins - a.wins || (a.gc == null ? 9999 : a.gc) - (b.gc == null ? 9999 : b.gc) || a.bib - b.bib);
      const ranks = competitionRanks(list, (e) => e.points);
      list.forEach((e, i) => { e.position = i + 1; e.rank = ranks[i]; });
      return list;
    }

    /* ---- pivotal day (E1): biggest |adj - median(final top-10 adj)| ---- */
    const benchMedian = new Map();
    stages.forEach((s) => {
      const vals = byStage.get(s.id).filter((r) => gcTop10.includes(r.bib)).map((r) => r.adj);
      benchMedian.set(s.id, median(vals));
    });
    function pivotal(bib, stageFilter) {
      const rows = byRider.get(bib).filter((x) => !stageFilter || stageFilter(stageById.get(x.stage)));
      const days = rows.map((x) => ({ stage: x.stage, adj: x.adj, median: benchMedian.get(x.stage), delta: x.adj - benchMedian.get(x.stage) }));
      let best = null;
      days.forEach((d) => { if (!best || Math.abs(d.delta) > Math.abs(best.delta)) best = d; });
      return { days, pivotal: best };
    }

    /* ---- team classification (official method: 3 best raw times per stage) ---- */
    const teamRiders = new Map(teams.map((t) => [t.name, riders.filter((r) => r.team === t.name)]));
    function teamClassification(variant) {
      const v = variant || 'raw';
      const val = (r) => (v === 'adj' ? r.adj : r.time);
      const perStage = new Map();
      const totals = new Map(teams.map((t) => [t.name, { team: t.name, total: 0, firsts: 0, eligible: 0, cum: [] }]));
      stages.forEach((s) => {
        const day = [];
        teams.forEach((t) => {
          const rows = byStage.get(s.id).filter((r) => riderByBib.get(r.bib).team === t.name)
            .slice().sort((a, b) => val(a) - val(b) || a.bib - b.bib);
          if (rows.length < TEAM_SCORERS) { day.push({ team: t.name, eligible: false }); return; }
          const counted = rows.slice(0, TEAM_SCORERS);
          day.push({ team: t.name, eligible: true, top3: sum(counted.map(val)), counted: counted.map((r) => r.bib), riders: rows.length });
        });
        const elig = day.filter((d) => d.eligible).sort((a, b) => a.top3 - b.top3);
        const rk = competitionRanks(elig, (d) => d.top3);
        elig.forEach((d, i) => { d.dayRank = rk[i]; });
        perStage.set(s.id, day);
        day.forEach((d) => {
          const T = totals.get(d.team);
          if (d.eligible) { T.total += d.top3; T.eligible += 1; if (d.dayRank === 1) T.firsts += 1; }
          T.cum.push({ stage: s.id, cum: T.total });
        });
      });
      const list = [...totals.values()].filter((t) => t.eligible === stages.length);
      const bestGc = (team) => Math.min(...teamRiders.get(team).map((r) => (r.gcRank == null ? 9999 : r.gcRank)));
      list.sort((a, b) => a.total - b.total || b.firsts - a.firsts || bestGc(a.team) - bestGc(b.team));
      const lead = list[0].total;
      list.forEach((t, i) => { t.rank = i + 1; t.gap = t.total - lead; t.bestGc = bestGc(t.team); });
      return { list, perStage };
    }
    const TEAMCLASS = teamClassification('raw');
    const TEAMCLASS_ADJ = teamClassification('adj');

    /* ---- team summary ---- */
    teams.forEach((t) => {
      const rs = teamRiders.get(t.name);
      const rows = rs.flatMap((r) => byRider.get(r.bib));
      t.riders = rs.length;
      t.finished = rs.filter((r) => r.finished).length;
      t.exits = rs.filter((r) => r.exitStage != null).length;
      t.dns = rs.filter((r) => r.exitReason === 'DNS').length;
      t.withdrawals = rs.filter((r) => r.exitReason === 'withdrawal').length;
      t.wins = rows.filter((x) => x.rank === 1).length;
      t.podiums = rows.filter((x) => x.rank <= 3).length;
      t.top10s = rows.filter((x) => x.rank <= 10).length;
      t.byTerrain = {};
      TERRAINS.forEach((c) => {
        const rr = rows.filter((x) => x.code === c);
        t.byTerrain[c] = { wins: rr.filter((x) => x.rank === 1).length, podiums: rr.filter((x) => x.rank <= 3).length, top10s: rr.filter((x) => x.rank <= 10).length, starts: rr.length };
      });
      const fin = rs.filter((r) => r.gcRank != null).sort((a, b) => a.gcRank - b.gcRank);
      t.bestGcRank = fin.length ? fin[0].gcRank : null;
      t.bestGcBib = fin.length ? fin[0].bib : null;
      t.avgGcRank = fin.length ? mean(fin.map((r) => r.gcRank)) : null;
      t.workload = sum(fin.map((r) => r.gcTotal));
      t.mountainSupport = mean(mountainIds.map((sid) => byStage.get(sid).filter((x) => x.rank <= 20 && riderByBib.get(x.bib).team === t.name).length));
      const flatTop3x2 = rs.filter((r) => byRider.get(r.bib).filter((x) => x.code === 'flat' && x.rank <= 3).length >= 2);
      const gcTop10Riders = rs.filter((r) => r.gcRank != null && r.gcRank <= 10);
      t.splitPriorities = flatTop3x2.length > 0 && gcTop10Riders.length > 0;
      const tc = TEAMCLASS.list.find((x) => x.team === t.name);
      t.classRank = tc ? tc.rank : null; t.classTotal = tc ? tc.total : null; t.classGap = tc ? tc.gap : null;
      const tca = TEAMCLASS_ADJ.list.find((x) => x.team === t.name);
      t.classRankAdj = tca ? tca.rank : null;
      // rider speed (rider-km / rider-hours)
      t.speed = {};
      ['all', ...TERRAINS].forEach((c) => {
        const rr = rows.filter((x) => c === 'all' || x.code === c);
        const km = sum(rr.map((x) => stageById.get(x.stage).distance)), sec = sum(rr.map((x) => x.time));
        t.speed[c] = sec ? km * 3600 / sec : null;
      });
    });

    /* ---- E3: who carried the team time ---- */
    function teamContribution(teamName) {
      const rs = teamRiders.get(teamName);
      const counted = new Map(rs.map((r) => [r.bib, { bib: r.bib, stagesCounted: 0, secondsCounted: 0, stages: [] }]));
      let teamTotal = 0;
      stages.forEach((s) => {
        const d = TEAMCLASS.perStage.get(s.id).find((x) => x.team === teamName);
        if (!d || !d.eligible) return;
        teamTotal += d.top3;
        d.counted.forEach((b) => {
          const row = byStage.get(s.id).find((x) => x.bib === b);
          const c = counted.get(b); c.stagesCounted += 1; c.secondsCounted += row.time; c.stages.push(s.id);
        });
      });
      const list = [...counted.values()].map((c) => ({ ...c, share: teamTotal ? c.secondsCounted / teamTotal : 0 }));
      list.sort((a, b) => b.stagesCounted - a.stagesCounted || a.bib - b.bib);
      const grid = rs.map((r) => ({
        bib: r.bib,
        cells: stages.map((s) => {
          const row = byStage.get(s.id).find((x) => x.bib === r.bib);
          const d = TEAMCLASS.perStage.get(s.id).find((x) => x.team === teamName);
          return { stage: s.id, rank: row ? row.rank : null, counted: !!(row && d && d.counted && d.counted.includes(r.bib)) };
        }),
      }));
      return { teamTotal, list, grid };
    }

    /* ---- E14: top-ten intensity by team ---- */
    function teamTop10Detail(teamName, code) {
      const out = [];
      stages.forEach((s) => {
        if (code && code !== 'all' && s.code !== code) return;
        byStage.get(s.id).forEach((x) => {
          if (x.rank <= 10 && riderByBib.get(x.bib).team === teamName) out.push({ stage: s.id, bib: x.bib, rank: x.rank, code: s.code });
        });
      });
      return out;
    }

    /* ---- nations (E8 / E9) ---- */
    const nations = countries.map((c) => {
      const rs = riders.filter((r) => r.country === c.code);
      const rows = rs.flatMap((r) => byRider.get(r.bib));
      const fin = rs.filter((r) => r.gcRank != null).sort((a, b) => a.gcRank - b.gcRank);
      return {
        code: c.code, name: c.name, riders: rs.length,
        teams: teams.filter((t) => t.country === c.code).length,
        finished: rs.filter((r) => r.finished).length,
        wins: rows.filter((x) => x.rank === 1).length,
        podiums: rows.filter((x) => x.rank <= 3).length,
        top10s: rows.filter((x) => x.rank <= 10).length,
        bestGcRank: fin.length ? fin[0].gcRank : null, bestGcBib: fin.length ? fin[0].bib : null,
        gcTop20: fin.filter((r) => r.gcRank <= 20).length,
        stagesWon: rows.filter((x) => x.rank === 1).map((x) => ({ stage: x.stage, bib: x.bib })),
      };
    });
    nations.sort((a, b) => b.wins - a.wins || b.podiums - a.podiums || b.riders - a.riders || a.code.localeCompare(b.code));

    /* ---- exits ---- */
    const exitsByStage = (() => {
      let prevFinished = riders.length, cumulative = 0;
      return stages.map((s) => {
        const ex = exits.filter((e) => e.stage === s.id);
        const dns = ex.filter((e) => e.reason === 'DNS').length;
        const wd = ex.filter((e) => e.reason === 'withdrawal').length;
        const started = prevFinished - dns;
        const finished = byStage.get(s.id).length;
        cumulative += ex.length;
        const row = { stage: s.id, started, finished, dns, withdrawals: wd, total: ex.length, cumulative, riders: ex.map((e) => e.bib) };
        prevFinished = finished;
        return row;
      });
    })();

    /* ---- head-to-head: riders ---- */
    function h2h(bibA, bibB) {
      const A = new Map(byRider.get(bibA).map((x) => [x.stage, x]));
      const B = new Map(byRider.get(bibB).map((x) => [x.stage, x]));
      const rows = [];
      let cumA = 0, cumB = 0, both = true;
      stages.forEach((s) => {
        const a = A.get(s.id), b = B.get(s.id);
        if (a && b) {
          if (both) { cumA += a.adj; cumB += b.adj; }
          rows.push({ stage: s.id, code: s.code, rankA: a.rank, rankB: b.rank, gapA: a.gap, gapB: b.gap,
            winner: a.rank < b.rank ? 'A' : a.rank > b.rank ? 'B' : '=', cumGap: both ? cumA - cumB : null });
        } else both = false;
      });
      const by = {};
      TERRAINS.forEach((t) => {
        const rr = rows.filter((r) => r.code === t);
        by[t] = { common: rr.length, a: rr.filter((r) => r.winner === 'A').length, b: rr.filter((r) => r.winner === 'B').length };
      });
      const ra = riderByBib.get(bibA), rb = riderByBib.get(bibB);
      return {
        rows, byTerrain: by, common: rows.length,
        aAhead: rows.filter((r) => r.winner === 'A').length,
        bAhead: rows.filter((r) => r.winner === 'B').length,
        level: rows.filter((r) => r.winner === '=').length,
        finalGap: ra.gcTotal != null && rb.gcTotal != null ? rb.gcTotal - ra.gcTotal : null,
      };
    }

    /* ---- head-to-head: teams ---- */
    function teamH2H(teamA, teamB) {
      const rows = stages.map((s) => {
        const day = TEAMCLASS.perStage.get(s.id);
        const a = day.find((d) => d.team === teamA), b = day.find((d) => d.team === teamB);
        return { stage: s.id, code: s.code, a: a.top3, b: b.top3, dayDiff: a.top3 - b.top3 };
      });
      let c = 0;
      rows.forEach((r) => { c += r.dayDiff; r.cumDiff = c; });
      return { rows, finalDiff: c };
    }

    /* ---- week form ---- */
    function weekForm(bibs) {
      const out = [];
      bibs.forEach((bib) => {
        [1, 2, 3].forEach((w) => {
          const rows = byRider.get(bib).filter((x) => stageById.get(x.stage).week === w);
          out.push({ bib, week: w, n: rows.length, avgRank: mean(rows.map((x) => x.rank)), avgGap: mean(rows.map((x) => x.gap)),
            top10s: rows.filter((x) => x.rank <= 10).length, weekAdj: sum(rows.map((x) => x.adj)) });
        });
      });
      [1, 2, 3].forEach((w) => {
        const wk = out.filter((o) => o.week === w).sort((a, b) => a.weekAdj - b.weekAdj);
        const rk = competitionRanks(wk, (o) => o.weekAdj);
        wk.forEach((o, i) => { o.weekRank = rk[i]; });
      });
      return out;
    }

    /* ---- E12: consistency near the front ---- */
    function consistency(code, minTop10) {
      const list = riders.map((r) => {
        const rows = byRider.get(r.bib).filter((x) => !code || code === 'all' || x.code === code);
        const top = rows.filter((x) => x.rank <= 10);
        return { bib: r.bib, starts: rows.length, top10s: top.length, wins: top.filter((x) => x.rank === 1).length,
          podiums: top.filter((x) => x.rank <= 3).length, rate: rows.length ? top.length / rows.length : 0,
          avgRank: mean(rows.map((x) => x.rank)), stages: top.map((x) => ({ stage: x.stage, rank: x.rank, code: x.code })) };
      }).filter((e) => e.top10s >= (minTop10 || 1));
      list.sort((a, b) => b.top10s - a.top10s || b.wins - a.wins || b.podiums - a.podiums || a.avgRank - b.avgRank || a.bib - b.bib);
      return list;
    }

    /* ---- E6: speed profile ---- */
    const finisherSpeedMedian = {};
    ['all', ...TERRAINS, 'flathilly'].forEach((c) => {
      finisherSpeedMedian[c] = median(riders.filter((r) => r.finished).map((r) => riderSpeed(r.bib, c)));
    });
    function riderSpeed(bib, c) {
      const rows = byRider.get(bib).filter((x) => c === 'all' || x.code === c || (c === 'flathilly' && (x.code === 'flat' || x.code === 'hilly')));
      if (!rows.length) return null;
      const km = sum(rows.map((x) => stageById.get(x.stage).distance)), sec = sum(rows.map((x) => x.time));
      return km * 3600 / sec;
    }
    function speedProfile(bib) {
      const o = {};
      ['all', ...TERRAINS, 'flathilly'].forEach((c) => {
        const v = riderSpeed(bib, c);
        o[c] = { speed: v, index: v == null ? null : v / finisherSpeedMedian[c] };
      });
      o.mountainShift = o.mountain.index != null && o.flathilly.index != null ? o.mountain.index - o.flathilly.index : null;
      return o;
    }

    /* ---- stage detail (E2) ---- */
    function stageDetail(stageId) {
      const s = stageById.get(stageId);
      const rows = byStage.get(stageId);
      const top10 = rows.filter((r) => r.rank <= 10);
      const teamCounts = new Map();
      top10.forEach((r) => { const t = riderByBib.get(r.bib).team; teamCounts.set(t, (teamCounts.get(t) || 0) + 1); });
      const teamsTop10 = [...teamCounts.entries()].map(([team, n]) => ({ team, n, bibs: top10.filter((r) => riderByBib.get(r.bib).team === team).map((r) => r.bib) }))
        .sort((a, b) => b.n - a.n || a.team.localeCompare(b.team));
      return { stage: s, rows, top10, teamsTop10, gcAfter: GC[stageId] };
    }

    return {
      TERRAINS, TERRAIN_LABEL, YOUNG_CUTOFF, RACE_START, BUNCH_MIN,
      riders, riderByBib, teams, teamByName, teamRiders, stages, stageById, results, byStage, byRider,
      exits, exitByBib, countries, countryName, nations, exitsByStage, leaders, mountainIds, mountainGC,
      gcProgress, gcAfter, gcPositionAfter, gcFinal, gcTop10, benchMedian,
      youngClassification, pointsRanking, pivotal, teamClassification, TEAMCLASS, TEAMCLASS_ADJ,
      teamContribution, teamTop10Detail, h2h, teamH2H, weekForm, consistency, terrainStats,
      speedProfile, finisherSpeedMedian, stageDetail, official: raw.official || [], published,
    };
  }

  return { createEngine, fmtTime, fmtGap, fmtClock, median, mean, TERRAINS, TERRAIN_LABEL, TYPE_SCALE, OFFICIAL_FINISH_SCALE };
});
