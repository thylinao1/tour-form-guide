// Checks src/engine.js against the independent pandas reference in tests/expected/.
//   node tests/engine.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadData, parseCSV } from '../build.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const T = require('../src/engine.js');
const E = T.createEngine(loadData());
const exp = (f) => parseCSV(fs.readFileSync(path.join(here, 'expected', f), 'utf8'));

let pass = 0, fail = 0;
const failures = [];
function check(name, fn) {
  const errs = [];
  const eq = (a, b, what, tol = 1e-6) => {
    const na = typeof a === 'number' || (a !== '' && a != null && !isNaN(Number(a)));
    const ok = (a == null || a === '') && (b == null || b === '')
      ? true
      : na && !isNaN(Number(b)) && b !== '' && b != null ? Math.abs(Number(a) - Number(b)) <= tol : String(a) === String(b);
    if (!ok && errs.length < 8) errs.push(`${what}: engine=${a} expected=${b}`);
    return ok;
  };
  try { fn(eq); } catch (e) { errs.push(`threw: ${e.stack}`); }
  if (errs.length) { fail++; failures.push(`FAIL ${name}\n   ${errs.join('\n   ')}`); } else { pass++; console.log(`pass ${name}`); }
}
const bool = (x) => x === 'True' || x === 'true' || x === true;
const blank = (x) => (x == null ? '' : x);

check('GC final: 160 finishers, order, totals, gaps', (eq) => {
  const e = exp('gc_final.csv');
  eq(E.gcFinal.length, e.length, 'count');
  e.forEach((r, i) => {
    const g = E.gcFinal[i];
    eq(g.bib, r.bib, `pos ${r.rank} bib`); eq(g.cum, r.total_adjusted_s, `pos ${r.rank} total`); eq(g.gap, r.gap_s, `pos ${r.rank} gap`);
    eq(g.cumRanks, r.sum_stage_ranks, `pos ${r.rank} sum ranks`);
  });
  eq(T.fmtTime(E.gcFinal[0].cum), `77h 02' 29"`, 'winner time text');
  eq(T.fmtGap(E.gcFinal[1].gap), `+4' 24"`, 'gap text 2nd');
});

check('GC after every stage: rank, position, gap (3,602 rows)', (eq) => {
  exp('gc_progress.csv').forEach((r) => {
    const g = E.gcAfter(Number(r.stage_id)).find((x) => x.bib === Number(r.bib));
    if (!g) { eq('missing', r.bib, `stage ${r.stage_id} bib ${r.bib}`); return; }
    eq(g.cum, r.cum_adjusted_s, `s${r.stage_id} b${r.bib} cum`);
    eq(g.rank, r.gc_rank_after_stage, `s${r.stage_id} b${r.bib} rank`);
    eq(g.position, r.gc_position_after_stage, `s${r.stage_id} b${r.bib} position`);
    eq(g.gap, r.gap_to_leader_s, `s${r.stage_id} b${r.bib} gap`);
  });
});

check('Yellow jersey after each stage', (eq) => {
  exp('leader_by_stage.csv').forEach((r, i) => {
    const l = E.leaders[i];
    eq(l.bib, r.leader_bib, `s${r.stage_id} leader`); eq(l.secondBib, r.second_bib, `s${r.stage_id} second`);
    eq(l.margin, r.margin_to_second_s, `s${r.stage_id} margin`); eq(l.changed, bool(r.leader_changed), `s${r.stage_id} changed`);
    eq(l.levelOnTime, r.riders_level_on_time_with_leader, `s${r.stage_id} level`);
  });
});

check('Young rider classification (born on/after 2000-01-01)', (eq) => {
  const y = E.youngClassification();
  const e = exp('young_final.csv');
  eq(y.length, e.length, 'count');
  e.forEach((r, i) => { eq(y[i].bib, r.bib, `young ${r.young_rank}`); eq(y[i].gap, r.young_gap_s, `young ${r.young_rank} gap`); eq(y[i].gcRank, r.gc_rank, `young ${r.young_rank} gc`); });
});

check('Team classification: raw (official) and adjusted variants', (eq) => {
  exp('team_classification.csv').forEach((r) => {
    const t = E.TEAMCLASS.list.find((x) => x.team === r.team);
    eq(t.rank, r.team_class_rank_raw, `${r.team} rank`); eq(t.total, r.total_raw_s, `${r.team} total`); eq(t.gap, r.gap_raw_s, `${r.team} gap`);
    eq(t.firsts, r.stage_team_firsts, `${r.team} firsts`);
    const a = E.TEAMCLASS_ADJ.list.find((x) => x.team === r.team);
    eq(a.rank, r.team_class_rank_adj, `${r.team} adj rank`); eq(a.total, r.total_adj_s, `${r.team} adj total`);
  });
});

check('Team classification per stage (cumulative)', (eq) => {
  exp('team_class_by_stage.csv').forEach((r) => {
    const d = E.TEAMCLASS.perStage.get(Number(r.stage_id)).find((x) => x.team === r.team);
    eq(d.top3, r.top3_raw_s, `s${r.stage_id} ${r.team} top3`);
    const c = E.TEAMCLASS.list.find((x) => x.team === r.team).cum.find((x) => x.stage === Number(r.stage_id));
    eq(c.cum, r.cum_raw_s, `s${r.stage_id} ${r.team} cum`);
  });
});

check('Stage summary: winner, speed, bunch, margins, GC context', (eq) => {
  exp('stage_summary.csv').forEach((r) => {
    const s = E.stageById.get(Number(r.stage_id));
    eq(s.winnerBib, r.winner_bib, `s${r.stage_id} winner`); eq(s.winnerTime, r.winner_finish_time_s, `s${r.stage_id} time`);
    eq(s.speed, r.avg_speed_kmh, `s${r.stage_id} speed`, 1e-3); eq(s.field, r.riders_finished, `s${r.stage_id} field`);
    eq(s.inWinnerTime, r.riders_in_winner_time, `s${r.stage_id} in winner time`);
    eq(s.fasterThanWinner, r.riders_credited_faster_than_winner, `s${r.stage_id} faster`);
    eq(blank(s.marginNextGroup), r.winning_margin_s, `s${r.stage_id} margin next group`);
    eq(s.marginToSecond, r.margin_to_second_s, `s${r.stage_id} margin to 2nd`);
    eq(s.bunch, bool(r.bunch_sprint), `s${r.stage_id} bunch`);
    eq(blank(s.winnerGcBefore), r.winner_gc_rank_before_stage, `s${r.stage_id} gc before`);
    eq(s.winnerGcAfter, r.winner_gc_rank_after_stage, `s${r.stage_id} gc after`);
    eq(blank(s.winnerFinalGc), r.winner_final_gc_rank, `s${r.stage_id} final gc`);
    eq(blank(s.top10Shuffle), r.gc_top10_shuffle, `s${r.stage_id} shuffle`);
    eq(E.riderByBib.get(s.yellowAfter).name, r.yellow_after_stage, `s${r.stage_id} yellow`);
  });
});

check('Rider x terrain stats (715 rows)', (eq) => {
  exp('rider_terrain.csv').forEach((r) => {
    const t = E.riderByBib.get(Number(r.bib)).terrain[r.type_code];
    if (!t) { eq('missing', r.type_code, `bib ${r.bib}`); return; }
    const k = `b${r.bib} ${r.type_code}`;
    eq(t.starts, r.starts, `${k} starts`); eq(t.wins, r.wins, `${k} wins`); eq(t.podiums, r.podiums, `${k} podiums`);
    eq(t.top10s, r.top10s, `${k} top10`); eq(t.avgRank, r.avg_rank, `${k} avg rank`, 1e-3); eq(t.medianRank, r.median_rank, `${k} median`);
    eq(t.bestRank, r.best_rank, `${k} best`); eq(t.avgGap, r.avg_gap_to_winner_s, `${k} gap`, 1e-3); eq(t.avgPct, r.avg_pct_rank, `${k} pct`, 1e-3);
    eq(t.pointsType, r.points, `${k} type points`);
  });
});

check('Rider overall (184 riders)', (eq) => {
  exp('rider_overall.csv').forEach((r) => {
    const x = E.riderByBib.get(Number(r.bib));
    const k = `b${r.bib}`;
    eq(x.age, r.age_at_start, `${k} age`); eq(x.young, bool(r.is_young), `${k} young`); eq(x.starts, r.starts, `${k} starts`);
    eq(x.finished, bool(r.finished_race), `${k} finished`); eq(x.wins, r.wins, `${k} wins`); eq(x.top10s, r.top10s, `${k} top10`);
    eq(blank(x.avgRank), r.avg_rank, `${k} avg rank`, 1e-3); eq(blank(x.rankStdev), r.rank_stdev, `${k} stdev`, 1e-3);
    eq(x.bonuses, r.bonuses_s, `${k} bonus`); eq(x.penalties, r.penalties_s, `${k} pen`);
    eq(blank(x.gcRank), r.gc_rank, `${k} gc`); eq(blank(x.youngRank), r.young_rank, `${k} young rank`);
    eq(blank(x.mountainRank), r.kom_proxy_rank, `${k} mountain proxy`); eq(x.stagesInYellow, r.stages_in_yellow, `${k} yellow days`);
    eq(blank(x.exitStage), r.exit_stage, `${k} exit`);
  });
});

check('Archetype rule (same rule codes R0-R6)', (eq) => {
  exp('rider_archetype.csv').forEach((r) => { eq(E.riderByBib.get(Number(r.bib)).archetypeRule, r.rule, `b${r.bib} ${r.name}`); });
});

check('Mountain-stage GC proxy (E4/E5)', (eq) => {
  exp('kom_proxy.csv').forEach((r, i) => {
    const m = E.mountainGC[i];
    eq(m.bib, r.bib, `proxy ${r.kom_proxy_rank}`); eq(m.total, r.mountain_adjusted_s, `proxy ${r.kom_proxy_rank} time`);
    eq(m.podiums, r.mountain_podiums, `proxy ${r.kom_proxy_rank} podiums`); eq(m.avgGap, r.mountain_avg_gap_to_winner_s, `proxy ${r.kom_proxy_rank} gap`, 1e-3);
  });
});

check('Points estimate: stage-type scale (reference set)', (eq) => {
  const pr = E.pointsRanking('pointsType');
  exp('points_estimate.csv').forEach((r) => {
    const p = pr.find((x) => x.bib === Number(r.bib));
    eq(p.points, r.points_total, `b${r.bib} points`); eq(p.position, r.points_position, `b${r.bib} position`); eq(p.rank, r.points_rank, `b${r.bib} rank`);
  });
});

check('Points estimate: official 2025 finish scale', (eq) => {
  exp('extra_points_official_scale.csv').forEach((r) => { eq(E.riderByBib.get(Number(r.bib)).points, r.points_official_scale, `b${r.bib}`); });
  eq(E.riderByBib.get(11).points, 182, 'Vingegaard = official 182');
});

check('Team summary', (eq) => {
  exp('team_summary.csv').forEach((r) => {
    const t = E.teamByName.get(r.team);
    const k = r.team;
    eq(t.finished, r.riders_finished, `${k} finished`); eq(t.exits, r.exits_total, `${k} exits`); eq(t.dns, r.exits_dns, `${k} dns`);
    eq(t.wins, r.stage_wins, `${k} wins`); eq(t.podiums, r.podiums, `${k} podiums`); eq(t.top10s, r.top10s, `${k} top10`);
    ['flat', 'hilly', 'mountain', 'itt'].forEach((c) => { eq(t.byTerrain[c].wins, r[`wins_${c}`], `${k} wins ${c}`); eq(t.byTerrain[c].top10s, r[`top10_${c}`], `${k} top10 ${c}`); });
    eq(blank(t.bestGcRank), r.best_gc_rank, `${k} best gc`); eq(blank(t.avgGcRank), r.avg_gc_rank_finishers, `${k} avg gc`, 1e-3);
    eq(t.classRank, r.team_class_rank_raw, `${k} class`); eq(t.classRankAdj, r.team_class_rank_adj, `${k} class adj`);
    eq(t.workload, r.total_adjusted_s_finishers, `${k} workload`); eq(t.mountainSupport, r.mountain_support, `${k} support`, 1e-3);
    eq(t.splitPriorities, bool(r.split_priorities), `${k} split`);
  });
});

check('Nations (E8/E9)', (eq) => {
  exp('nation_summary.csv').forEach((r) => {
    const n = E.nations.find((x) => x.code === r.country_code);
    const k = r.country_code;
    eq(n.riders, r.riders, `${k} riders`); eq(n.teams, r.teams_registered_in_country, `${k} teams`); eq(n.finished, r.riders_finished, `${k} fin`);
    eq(n.wins, r.stage_wins, `${k} wins`); eq(n.podiums, r.podiums, `${k} podiums`); eq(n.top10s, r.top10s, `${k} top10`);
    eq(blank(n.bestGcRank), r.best_gc_rank, `${k} best gc`); eq(n.gcTop20, r.riders_in_gc_top20, `${k} top20`);
  });
  eq(E.nations.map((n) => n.code).join(','), exp('nation_summary.csv').map((r) => r.country_code).join(','), 'order');
});

check('Exits by stage', (eq) => {
  exp('exits_by_stage.csv').forEach((r, i) => {
    const x = E.exitsByStage[i];
    eq(x.started, r.riders_started, `s${r.stage_id} started`); eq(x.finished, r.riders_finished, `s${r.stage_id} finished`);
    eq(x.dns, r.exits_dns, `s${r.stage_id} dns`); eq(x.withdrawals, r.exits_withdrawal, `s${r.stage_id} wd`); eq(x.cumulative, r.cumulative_exits, `s${r.stage_id} cum`);
  });
});

check('Head-to-head (90 pairs)', (eq) => {
  exp('h2h.csv').forEach((r) => {
    const h = E.h2h(Number(r.bib_a), Number(r.bib_b));
    const k = `${r.name_a} v ${r.name_b}`;
    eq(h.common, r.common_stages, `${k} common`); eq(h.aAhead, r.a_ahead, `${k} a`); eq(h.bAhead, r.b_ahead, `${k} b`); eq(h.level, r.level, `${k} level`);
    ['flat', 'hilly', 'mountain', 'itt'].forEach((c) => { eq(h.byTerrain[c].a, r[`${c}_a_ahead`], `${k} ${c} a`); eq(h.byTerrain[c].b, r[`${c}_b_ahead`], `${k} ${c} b`); });
    eq(blank(h.finalGap), r.final_gc_gap_s, `${k} gap`);
  });
});

check('Week form (GC top 20 x 3 weeks)', (eq) => {
  const e = exp('week_form.csv');
  const bibs = [...new Set(e.map((r) => Number(r.bib)))];
  const w = E.weekForm(bibs);
  e.forEach((r) => {
    const x = w.find((o) => o.bib === Number(r.bib) && o.week === Number(r.week));
    const k = `b${r.bib} w${r.week}`;
    eq(x.n, r.n_stages, `${k} n`); eq(x.avgRank, r.avg_rank, `${k} rank`, 1e-3); eq(x.avgGap, r.avg_gap_to_winner_s, `${k} gap`, 1e-3);
    eq(x.top10s, r.top10s, `${k} top10`); eq(x.weekAdj, r.week_adjusted_s, `${k} adj`); eq(x.weekRank, r.week_time_rank_in_top20, `${k} week rank`);
  });
});

check('Counterfactual GC without bonuses / penalties (E7)', (eq) => {
  const map = { actual: {}, no_bonus: { bonus: false }, no_penalty: { penalty: false }, neither: { bonus: false, penalty: false } };
  exp('extra_counterfactual.csv').forEach((r) => {
    const g = E.gcAfter(21, map[r.scenario])[Number(r.position) - 1];
    eq(g.bib, r.bib, `${r.scenario} pos ${r.position} bib`); eq(g.cum, r.total_s, `${r.scenario} pos ${r.position} total`); eq(g.gap, r.gap_s, `${r.scenario} pos ${r.position} gap`);
  });
});

check('Pivotal day vs final top-10 median (E1)', (eq) => {
  exp('extra_pivotal.csv').forEach((r) => {
    const p = E.pivotal(Number(r.bib)).pivotal;
    eq(p.stage, r.pivotal_stage, `b${r.bib} stage`); eq(p.delta, r.delta_s, `b${r.bib} delta`);
  });
});

check('Speed profile and terrain index (E6)', (eq) => {
  const med = exp('extra_speed_medians.csv');
  med.forEach((m) => eq(E.finisherSpeedMedian[m.group], m.median_speed, `median ${m.group}`, 1e-6));
  exp('extra_speed.csv').forEach((r) => {
    const sp = E.speedProfile(Number(r.bib));
    ['all', 'flat', 'hilly', 'mountain', 'itt', 'flathilly'].forEach((g) => {
      eq(blank(sp[g].speed), r[`speed_${g}`], `b${r.bib} ${g} speed`, 1e-6); eq(blank(sp[g].index), r[`index_${g}`], `b${r.bib} ${g} index`, 1e-6);
    });
    eq(blank(sp.mountainShift), r.mountain_shift, `b${r.bib} shift`, 1e-6);
  });
});

check('Team contribution: stages counted in best 3 (E3)', (eq) => {
  const e = exp('extra_team_contribution.csv');
  E.teams.forEach((t) => {
    const c = E.teamContribution(t.name);
    c.list.forEach((x) => {
      const r = e.find((y) => y.team === t.name && Number(y.bib) === x.bib);
      eq(x.stagesCounted, r ? r.stages_counted : 0, `${t.name} b${x.bib} counted`); eq(x.secondsCounted, r ? r.seconds_counted : 0, `${t.name} b${x.bib} seconds`);
    });
    eq(c.teamTotal, E.TEAMCLASS.list.find((x) => x.team === t.name).total, `${t.name} total`);
  });
});

check('Top-10 presences by team x terrain (E14)', (eq) => {
  exp('extra_team_top10_terrain.csv').forEach((r) => {
    eq(E.teamTop10Detail(r.team, r.code).length, r.top10s, `${r.team} ${r.code}`);
  });
});

check('Headline summary', (eq) => {
  const s = JSON.parse(fs.readFileSync(path.join(here, 'expected', 'summary.json'), 'utf8'));
  eq(E.stages.reduce((a, x) => a + x.distance, 0), s.total_distance_km, 'distance', 1e-6);
  eq(E.riders.filter((r) => r.finished).length, s.finishers_all_21, 'finishers');
  eq(new Set(E.stages.map((x) => x.winnerBib)).size, s.distinct_stage_winners, 'distinct winners');
  eq(new Set(E.riders.filter((r) => r.country !== 'XXX').map((r) => r.country)).size, s.nations_excluding_XXX, 'nations ex XXX');
  eq(E.exits.length, 24, 'exits');
});

check('Official classifications table loaded (50 rows, jersey winners)', (eq) => {
  eq(E.official.length, 50, 'rows');
  const w = (c) => E.official.find((o) => o.c === c && o.rank === 1);
  eq(w('gc').bib, 1, 'yellow'); eq(w('points').bib, 81, 'green'); eq(w('kom').bib, 1, 'polka'); eq(w('young').bib, 72, 'white'); eq(w('team').name, 'TEAM VISMA | LEASE A BIKE', 'team');
  // our recomputed young and team top 10 must equal the official ones
  const yo = E.youngClassification().slice(0, 10).map((y) => y.bib).join(',');
  eq(yo, E.official.filter((o) => o.c === 'young').sort((a, b) => a.rank - b.rank).map((o) => o.bib).join(','), 'young top10 = official');
  const tm = E.TEAMCLASS.list.slice(0, 10).map((t) => t.team).join(',');
  eq(tm, E.official.filter((o) => o.c === 'team').sort((a, b) => a.rank - b.rank).map((o) => o.name).join(','), 'team top10 = official');
  const gcOff = E.official.filter((o) => o.c === 'gc').sort((a, b) => a.rank - b.rank);
  gcOff.forEach((o, i) => { eq(E.gcFinal[i].bib, o.bib, `gc ${o.rank} = official`); eq(E.gcFinal[i].gap, o.num - gcOff[0].num, `gc ${o.rank} gap = official`); });
});

check('Published points and mountains standings (full lists, top 10 = official)', (eq) => {
  eq(E.published.points.length, 132, 'points riders'); eq(E.published.kom.length, 55, 'kom riders');
  for (const c of ['points', 'kom']) {
    const off = E.official.filter((o) => o.c === c).sort((a, b) => a.rank - b.rank);
    off.forEach((o, i) => { const p = E.published[c][i]; eq(`${p.rank}/${p.bib}/${p.points}`, `${o.rank}/${o.bib}/${o.num}`, `${c} ${o.rank} = official`); });
  }
  // published points never fall below our finish-line points; the difference is intermediate sprints
  E.riders.filter((r) => r.pubPoints).forEach((r) => eq(r.otherPoints >= 0, true, `bib ${r.bib} otherPoints >= 0`));
  eq(E.riderByBib.get(11).otherPoints, 0, 'Vingegaard scored only at finishes (official 182)');
  eq(E.riderByBib.get(81).otherPoints, 212, 'Milan 372 published - 160 finish-line');
  // riders with finish-line points but no published points all left the race (classifications list finishers only)
  E.riders.filter((r) => r.points > 0 && !r.pubPoints).forEach((r) => eq(r.finished, false, `bib ${r.bib} unclassified only if out of the race`));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) { console.log('\n' + failures.join('\n')); process.exit(1); }
