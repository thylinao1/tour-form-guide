/* SQL behind each demonstration prompt E1 to E15 (data only, no DOM work).
   Short versions of the queries in sql/04_functions_e1_e15.sql, written on the star schema of
   sql/03_star_schema.sql: fact_results (one rider on one stage) with dim_rider, dim_team, dim_stage
   and dim_country. Times are in seconds; adjusted_time = finish_time - time_bonus + time_penalty.
   The Function map tab reads window.TDF_SQL[code] = { title, sql, note }. */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;

  // Riders who rode all 21 stages; only they get an overall (GC) rank.
  const FINISHERS = 'HAVING COUNT(*) = (SELECT COUNT(*) FROM dim_stage)';

  const SQL = {
    E1: {
      title: 'Overall standings, then the day that moved one rider most',
      note: 'Returns the top ten by total adjusted time with the gap to the leader; the drill down finds the stage where a chosen rider was furthest from the top ten median.',
      sql: `WITH gc AS (
  SELECT rider_key, SUM(adjusted_time) AS total_time
  FROM fact_results GROUP BY rider_key
  ${FINISHERS}
)
SELECT RANK() OVER (ORDER BY total_time) AS gc_rank,
       r.rider_name, r.team_name, total_time,
       total_time - MIN(total_time) OVER () AS gap_to_leader
FROM gc JOIN dim_rider r USING (rider_key)
ORDER BY gc_rank LIMIT 10;

-- drill down: the stage where one contender was furthest
-- from the median time of the final top ten that day
WITH b AS (
  SELECT stage_key, MEDIAN(adjusted_time) AS top10_median
  FROM fact_results WHERE rider_key IN (1, 11, 72, 191, 151,
    221, 131, 71, 31, 186)            -- final top ten (query above)
  GROUP BY stage_key
)
SELECT stage_key, adjusted_time - top10_median AS time_vs_top10
FROM fact_results JOIN b USING (stage_key)
WHERE rider_key = 11                -- choose a rider
ORDER BY ABS(adjusted_time - top10_median) DESC
LIMIT 1;`,
    },
    E2: {
      title: 'One stage up close, then seen by team',
      note: 'Returns the first ten finishers of a stage with route, distance and terrain, then how many of them each team supplied.',
      sql: `SELECT f.rank, r.rider_name, f.team_key AS team, f.adjusted_time,
       s.start_location, s.finish_location, s.distance_km, s.stage_type
FROM fact_results f
JOIN dim_rider r USING (rider_key)
JOIN dim_stage s USING (stage_key)
WHERE f.stage_key = 12              -- choose a stage
ORDER BY f.rank LIMIT 10;

-- pivot to teams: who filled that top ten
SELECT team_key AS team, COUNT(*) AS riders_in_top10,
       MIN(rank) AS best_place
FROM fact_results
WHERE stage_key = 12 AND is_top10
GROUP BY team_key
ORDER BY riders_in_top10 DESC, best_place;`,
    },
    E3: {
      title: 'Team totals rolled up from their riders',
      note: 'Returns each team\'s classification time (three best times per stage, the row marked team total) and, under it, how many stages and seconds each rider supplied.',
      sql: `WITH counted AS (
  SELECT team_key, rider_key, finish_time,
         ROW_NUMBER() OVER (PARTITION BY team_key, stage_key ORDER BY finish_time, rider_key) AS n
  FROM fact_results)
SELECT c.team_key AS team,
       COALESCE(r.rider_name, '(team total)') AS rider,
       SUM(c.finish_time) AS counted_time,
       COUNT(*) AS stages_counted
FROM counted c
JOIN dim_rider r USING (rider_key)
WHERE n <= 3
GROUP BY ROLLUP (c.team_key, r.rider_name)
HAVING c.team_key IS NOT NULL
ORDER BY team, GROUPING(r.rider_name) DESC, stages_counted DESC;`,
    },
    E4: {
      title: 'Overall, young rider and mountains only ranks side by side',
      note: 'Returns each finisher with their overall rank, young rider rank (born on or after 1 January 2000) and a rank that counts only the six mountain stages.',
      sql: `WITH t AS (
  SELECT f.rider_key,
         SUM(f.adjusted_time) AS total_time,
         SUM(f.adjusted_time) FILTER (WHERE s.is_mountain) AS mountain_time
  FROM fact_results f JOIN dim_stage s USING (stage_key)
  GROUP BY f.rider_key
  ${FINISHERS}
)
SELECT r.rider_name, r.age_at_start,
       RANK() OVER (ORDER BY total_time) AS gc_rank,
       CASE WHEN r.is_young THEN RANK() OVER
         (PARTITION BY r.is_young ORDER BY total_time) END AS young_rank,
       RANK() OVER (ORDER BY mountain_time) AS mountain_gc_rank
FROM t JOIN dim_rider r USING (rider_key)
ORDER BY gc_rank;`,
    },
    E5: {
      title: 'Mountain podiums and gap to the stage winner',
      note: 'Returns, for mountain stages only, how often each rider finished in the first three and their average gap to the stage winner in seconds.',
      sql: `SELECT r.rider_name,
       COUNT(*) AS mountain_starts,
       SUM(CASE WHEN f.is_podium THEN 1 ELSE 0 END) AS mountain_podiums,
       ROUND(AVG(f.finish_time - w.finish_time)) AS mean_gap_to_winner
FROM fact_results f
JOIN dim_stage s USING (stage_key)
JOIN fact_results w ON w.stage_key = f.stage_key AND w.is_winner
JOIN dim_rider r ON r.rider_key = f.rider_key
WHERE s.is_mountain
GROUP BY r.rider_name
ORDER BY mountain_podiums DESC, mean_gap_to_winner
LIMIT 10;`,
    },
    E6: {
      title: 'Average speed on each terrain, for riders and whole teams',
      note: 'Returns km per hour on flat, hilly, mountain and time trial stages, and mountain speed as a share of flat speed: a higher share means less slowdown when the road climbs.',
      sql: `SELECT f.team_key AS team,
       COALESCE(r.rider_name, '(whole team)') AS rider,
       SUM(s.distance_km) FILTER (WHERE s.terrain = 'flat') * 3600
         / SUM(f.finish_time) FILTER (WHERE s.terrain = 'flat') AS flat_kmh,
       SUM(s.distance_km) FILTER (WHERE s.terrain = 'mountain') * 3600
         / SUM(f.finish_time) FILTER (WHERE s.terrain = 'mountain') AS mountain_kmh
       -- hilly_kmh and itt_kmh follow the same pattern
FROM fact_results f
JOIN dim_stage s USING (stage_key)
JOIN dim_rider r USING (rider_key)
WHERE r.finished
GROUP BY GROUPING SETS ((f.team_key, r.rider_name), (f.team_key))
ORDER BY mountain_kmh / flat_kmh DESC;`,
    },
    E7: {
      title: 'Bonuses, penalties and the standings without them',
      note: 'Returns each finisher with total bonus and penalty seconds and their overall rank three ways: as raced, without bonuses, and without bonuses or penalties.',
      sql: `WITH t AS (
  SELECT rider_key,
         SUM(time_bonus) AS bonus_total,
         SUM(time_penalty) AS penalty_total,
         SUM(adjusted_time) AS actual_time,
         SUM(finish_time + time_penalty) AS time_without_bonuses,
         SUM(finish_time) AS time_without_both
  FROM fact_results GROUP BY rider_key
  ${FINISHERS}
)
SELECT r.rider_name, bonus_total, penalty_total,
       RANK() OVER (ORDER BY actual_time) AS rank_actual,
       RANK() OVER (ORDER BY time_without_bonuses) AS rank_no_bonus,
       RANK() OVER (ORDER BY time_without_both) AS rank_no_bonus_no_penalty
FROM t JOIN dim_rider r USING (rider_key)
ORDER BY rank_actual;`,
    },
    E8: {
      title: 'Teams and riders per nation, then one nation opened up',
      note: 'Returns how many teams are based in and how many riders come from each nation, then the riders of one nation grouped by team with a total row.',
      sql: `SELECT c.country_key, c.country_name,
  (SELECT COUNT(*) FROM dim_team t
    WHERE t.team_country_key = c.country_key) AS teams,
  (SELECT COUNT(*) FROM dim_rider r
    WHERE r.country_key = c.country_key) AS riders
FROM dim_country c
ORDER BY riders DESC, teams DESC;

-- drill down into one nation
SELECT COALESCE(team_name, '(all teams)') AS team,
       COUNT(*) AS riders,
       STRING_AGG(rider_name, ', ' ORDER BY rider_name) AS names
FROM dim_rider
WHERE country_key = 'FRA'           -- choose a country
GROUP BY ROLLUP (team_name)
ORDER BY GROUPING(team_name), riders DESC;`,
    },
    E9: {
      title: 'Best overall place, wins and podiums per nation',
      note: 'Returns, for each nation, the best overall rank any of its riders reached and its stage wins, podiums and top ten finishes.',
      sql: `WITH gc AS (
  SELECT rider_key,
         RANK() OVER (ORDER BY SUM(adjusted_time)) AS gc_rank
  FROM fact_results GROUP BY rider_key
  ${FINISHERS}
)
SELECT c.country_name,
       MIN(gc.gc_rank) AS best_gc_rank,
       SUM(CASE WHEN f.is_winner THEN 1 ELSE 0 END) AS stage_wins,
       SUM(CASE WHEN f.is_podium THEN 1 ELSE 0 END) AS podiums,
       SUM(CASE WHEN f.is_top10  THEN 1 ELSE 0 END) AS top10s
FROM fact_results f
JOIN dim_country c USING (country_key)
LEFT JOIN gc USING (rider_key)
GROUP BY c.country_name
ORDER BY stage_wins DESC, podiums DESC, best_gc_rank;`,
    },
    E10: {
      title: 'Running total time and position after every stage',
      note: 'Returns, for chosen riders, their total time and overall position after each stage, with mountain stages marked.',
      sql: `WITH cum AS (
  SELECT f.rider_key, f.stage_key, s.is_mountain,
         SUM(f.adjusted_time) OVER w AS cum_time,
         COUNT(*) OVER w AS stages_done
  FROM fact_results f JOIN dim_stage s USING (stage_key)
  WINDOW w AS (PARTITION BY f.rider_key ORDER BY f.stage_key)
)
SELECT stage_key, is_mountain, r.rider_name, cum_time,
       RANK() OVER (PARTITION BY stage_key ORDER BY cum_time) AS position
FROM cum JOIN dim_rider r USING (rider_key)
WHERE stages_done = stage_key       -- still in the race
QUALIFY rider_key IN (1, 11, 72, 191, 151)  -- choose riders
ORDER BY stage_key, position;`,
    },
    E11: {
      title: 'The time trial catalogue',
      note: 'Returns each individual time trial with its date, distance, route, winner and winning speed.',
      sql: `SELECT s.stage_key, s.stage_date, s.distance_km,
       s.start_location, s.finish_location,
       r.rider_name AS winner, f.finish_time AS winning_time,
       ROUND(s.distance_km * 3600 / f.finish_time, 2) AS winner_kmh
FROM dim_stage s
JOIN fact_results f ON f.stage_key = s.stage_key AND f.is_winner
JOIN dim_rider r ON r.rider_key = f.rider_key
WHERE s.is_time_trial
ORDER BY s.stage_key;`,
    },
    E12: {
      title: 'Who finishes in the top ten most often',
      note: 'Returns the riders with the most top ten stage finishes and, for each, the stages, places and terrain behind the count.',
      sql: `SELECT r.rider_name, f.team_key AS team,
       COUNT(*) AS top10s,
       STRING_AGG('stage ' || f.stage_key || ': ' || f.rank
                  || ' (' || s.terrain || ')',
                  ', ' ORDER BY f.stage_key) AS stages
FROM fact_results f
JOIN dim_rider r USING (rider_key)
JOIN dim_stage s USING (stage_key)
WHERE f.is_top10
GROUP BY r.rider_name, f.team_key
ORDER BY top10s DESC
LIMIT 10;`,
    },
    E13: {
      title: 'Depth of each squad',
      note: 'Returns, per team, how many distinct riders started, finished and reached a top ten, how many nations the squad mixes, and the full roster.',
      sql: `SELECT r.team_name,
  COUNT(DISTINCT r.rider_key) AS riders,
  COUNT(DISTINCT r.rider_key) FILTER (WHERE r.finished) AS finishers,
  COUNT(DISTINCT f.rider_key) FILTER (WHERE f.is_top10)
    AS riders_with_top10,
  COUNT(DISTINCT r.country_key) AS nations,
  STRING_AGG(DISTINCT r.rider_name || ' (' || r.country_key || ')', ', ')
    AS roster
FROM dim_rider r
LEFT JOIN fact_results f USING (rider_key)
GROUP BY r.team_name
ORDER BY riders_with_top10 DESC, finishers DESC;`,
    },
    E14: {
      title: 'Team top ten finishes by terrain',
      note: 'Returns a team by terrain table of top ten finishes with a total column and a total row for the whole race.',
      sql: `SELECT COALESCE(f.team_key, '(all teams)') AS team,
  COUNT(*) FILTER (WHERE s.terrain = 'flat')     AS flat,
  COUNT(*) FILTER (WHERE s.terrain = 'hilly')    AS hilly,
  COUNT(*) FILTER (WHERE s.terrain = 'mountain') AS mountain,
  COUNT(*) FILTER (WHERE s.terrain = 'itt')      AS time_trial,
  COUNT(*) AS top10s
FROM fact_results f
JOIN dim_stage s USING (stage_key)
WHERE f.is_top10
GROUP BY ROLLUP (f.team_key)
ORDER BY GROUPING(f.team_key), top10s DESC;`,
    },
    E15: {
      title: 'Stages from longest to shortest, then the longest day',
      note: 'Returns every stage sorted by distance with date, terrain, route and winner, then the first ten finishers of the longest stage.',
      sql: `SELECT s.stage_key, s.stage_date, s.stage_type, s.distance_km,
       s.start_location, s.finish_location, r.rider_name AS winner
FROM dim_stage s
JOIN fact_results f ON f.stage_key = s.stage_key AND f.is_winner
JOIN dim_rider r ON r.rider_key = f.rider_key
ORDER BY s.distance_km DESC;

-- leading finishers of the longest stage
SELECT f.rank, r.rider_name, f.team_key AS team, f.adjusted_time
FROM fact_results f JOIN dim_rider r USING (rider_key)
WHERE f.stage_key = (SELECT stage_key FROM dim_stage
                     ORDER BY distance_km DESC LIMIT 1)
ORDER BY f.rank LIMIT 10;`,
    },
  };

  SQL.meta = {
    schema: 'star',
    files: [
      'sql/01_normalized_schema.sql',
      'sql/02_load.sql',
      'sql/03_star_schema.sql',
      'sql/04_functions_e1_e15.sql',
      'sql/05_task4_compare.sql',
    ],
  };
  W.TDF_SQL = SQL;
})();
