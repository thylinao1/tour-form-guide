-- =====================================================================================
-- 04_functions_e1_e15.sql
-- One query (sometimes a summary plus its drill down) for each of the 15
-- analysis functions E1 to E15, written on the star schema of 03_star_schema.sql.
-- Times are in seconds. adjusted_time = finish_time - time_bonus + time_penalty.
-- Values you can change (a rider, a stage, a team, a country) are marked
-- "-- choose".
--
-- Overall standing (GC) rule used everywhere: only riders with a result on all 21
-- stages are ranked (160 riders). Otherwise riders who left early would have the
-- smallest totals and appear at the top.
-- =====================================================================================

-- E1. GC leaderboard with contextual descent ------------------------------------------
-- Roll up: total adjusted time per rider, ranked, with the gap to the leader.
WITH gc AS (
    SELECT f.rider_key, SUM(f.adjusted_time) AS total_time
    FROM fact_results f
    GROUP BY f.rider_key
    HAVING COUNT(*) = (SELECT COUNT(*) FROM dim_stage)
)
SELECT RANK() OVER (ORDER BY gc.total_time)           AS gc_rank,
       r.rider_name, r.team_name, gc.total_time,
       gc.total_time - MIN(gc.total_time) OVER ()     AS gap_to_leader
FROM gc JOIN dim_rider r USING (rider_key)
ORDER BY gc_rank
LIMIT 10;

-- Drill down to the stage grain for one contender: the pivotal day is the stage where the
-- rider's adjusted time was furthest from the median of the final top ten that day.
WITH gc AS (
    SELECT rider_key, SUM(adjusted_time) AS total_time
    FROM fact_results GROUP BY rider_key
    HAVING COUNT(*) = (SELECT COUNT(*) FROM dim_stage)
), top10 AS (
    SELECT rider_key FROM gc ORDER BY total_time LIMIT 10
), bench AS (
    SELECT stage_key,
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY adjusted_time) AS top10_median
    FROM fact_results WHERE rider_key IN (SELECT rider_key FROM top10)
    GROUP BY stage_key
)
SELECT s.stage_key, s.stage_type, f.adjusted_time, b.top10_median,
       f.adjusted_time - b.top10_median AS time_vs_top10   -- negative = gained time
FROM fact_results f
JOIN bench b      USING (stage_key)
JOIN dim_stage s  USING (stage_key)
WHERE f.rider_key = 11                                      -- choose a rider (11 = Vingegaard)
ORDER BY ABS(f.adjusted_time - b.top10_median) DESC
LIMIT 1;

-- E2. A stage in focus ------------------------------------------------------------------
-- Slice to one stage: leading finishers with route, distance and terrain.
SELECT f.rank, r.rider_name, f.team_key AS team, f.adjusted_time,
       s.start_location, s.finish_location, s.distance_km, s.stage_type
FROM fact_results f
JOIN dim_rider r USING (rider_key)
JOIN dim_stage s USING (stage_key)
WHERE f.stage_key = 12                                       -- choose a stage
ORDER BY f.rank
LIMIT 10;

-- Pivot the same slice to the team perspective: which squads filled that top ten.
SELECT f.team_key AS team, COUNT(*) AS riders_in_top10, MIN(f.rank) AS best_place
FROM fact_results f
WHERE f.stage_key = 12 AND f.is_top10                        -- choose a stage
GROUP BY f.team_key
ORDER BY riders_in_top10 DESC, best_place;

-- E3. Team burden and contribution ------------------------------------------------------
-- The team time counts the three best times of each team on every stage (the official rule).
-- ROLLUP gives, per team, the classification time (the row where rider_name IS NULL) and,
-- under it, how many stages and seconds each rider supplied to it. Totals can be compared
-- between teams because every team has exactly three counted times per stage.
WITH counted AS (
    SELECT team_key, rider_key, finish_time,
           ROW_NUMBER() OVER (PARTITION BY team_key, stage_key ORDER BY finish_time, rider_key) AS n
    FROM fact_results
)
SELECT c.team_key                       AS team,
       COALESCE(r.rider_name, '(team total)') AS rider,
       SUM(c.finish_time)               AS counted_time,
       COUNT(*)                         AS stages_counted,
       GROUPING(r.rider_name)           AS is_team_total
FROM counted c
JOIN dim_rider r USING (rider_key)
WHERE n <= 3
GROUP BY ROLLUP (c.team_key, r.rider_name)
HAVING c.team_key IS NOT NULL
ORDER BY team, is_team_total DESC, stages_counted DESC;

-- The team classification ranked, with the gap to the winning team.
WITH ranked AS (
    SELECT team_key, stage_key, finish_time,
           ROW_NUMBER() OVER (PARTITION BY team_key, stage_key ORDER BY finish_time) AS n
    FROM fact_results
)
SELECT team_key AS team, SUM(finish_time) AS team_time,
       SUM(finish_time) - MIN(SUM(finish_time)) OVER () AS gap
FROM ranked WHERE n <= 3
GROUP BY team_key
ORDER BY team_time;

-- E4. Parallel classifications ----------------------------------------------------------
-- Overall rank, young rider rank (born on or after 1 Jan 2000, age shown at race start)
-- and a mountain only GC that adds adjusted time on the six Mountain stages.
WITH finishers AS (
    SELECT f.rider_key,
           SUM(f.adjusted_time)                                AS total_time,
           SUM(f.adjusted_time) FILTER (WHERE s.is_mountain)   AS mountain_time
    FROM fact_results f JOIN dim_stage s USING (stage_key)
    GROUP BY f.rider_key
    HAVING COUNT(*) = (SELECT COUNT(*) FROM dim_stage)
)
SELECT r.rider_name, r.age_at_start, r.is_young,
       RANK() OVER (ORDER BY total_time)                       AS gc_rank,
       CASE WHEN r.is_young THEN RANK() OVER (PARTITION BY r.is_young ORDER BY total_time) END
                                                               AS young_rank,
       RANK() OVER (ORDER BY mountain_time)                    AS mountain_gc_rank,
       RANK() OVER (ORDER BY total_time) - RANK() OVER (ORDER BY mountain_time)
                                                               AS places_gained_on_mountains
FROM finishers JOIN dim_rider r USING (rider_key)
ORDER BY gc_rank
LIMIT 20;

-- E5. Mountain contours -----------------------------------------------------------------
-- Podiums on Mountain stages and mean gap to the stage winner (raw time) on that terrain.
WITH winner AS (
    SELECT stage_key, finish_time AS winner_time FROM fact_results WHERE is_winner
)
SELECT r.rider_name,
       COUNT(*)                              AS mountain_starts,
       SUM(CASE WHEN f.is_podium THEN 1 ELSE 0 END) AS mountain_podiums,
       ROUND(AVG(f.finish_time - w.winner_time))    AS mean_gap_to_winner
FROM fact_results f
JOIN dim_stage s USING (stage_key)
JOIN winner w    USING (stage_key)
JOIN dim_rider r USING (rider_key)
WHERE s.is_mountain
GROUP BY r.rider_name
ORDER BY mountain_podiums DESC, mean_gap_to_winner
LIMIT 10;

-- Return to the daily traces behind one rider's summary.
SELECT f.stage_key, s.finish_location, f.rank, f.finish_time - w.finish_time AS gap_to_winner
FROM fact_results f
JOIN dim_stage s USING (stage_key)
JOIN fact_results w ON w.stage_key = f.stage_key AND w.is_winner
WHERE s.is_mountain AND f.rider_key = 1                      -- choose a rider
ORDER BY f.stage_key;

-- E6. Speed as a simple ratio -----------------------------------------------------------
-- Average speed (km/h) = total km / total hours on each terrain, for riders who finished
-- all 21 stages. GROUPING SETS gives rider rows and whole team rows from one scan.
-- mountain_pct_of_flat: mountain speed as a share of flat speed. A higher share means the
-- rider or team loses less speed when the road climbs, so they gain on Mountain stages.
WITH by_terrain AS (
    SELECT f.team_key AS team,
           COALESCE(r.rider_name, '(whole team)')                           AS rider,
           SUM(s.distance_km) FILTER (WHERE s.terrain = 'flat')     * 3600
             / SUM(f.finish_time) FILTER (WHERE s.terrain = 'flat')         AS flat_kmh,
           SUM(s.distance_km) FILTER (WHERE s.terrain = 'hilly')    * 3600
             / SUM(f.finish_time) FILTER (WHERE s.terrain = 'hilly')        AS hilly_kmh,
           SUM(s.distance_km) FILTER (WHERE s.terrain = 'mountain') * 3600
             / SUM(f.finish_time) FILTER (WHERE s.terrain = 'mountain')     AS mountain_kmh,
           SUM(s.distance_km) FILTER (WHERE s.terrain = 'itt')      * 3600
             / SUM(f.finish_time) FILTER (WHERE s.terrain = 'itt')          AS itt_kmh
    FROM fact_results f
    JOIN dim_stage s USING (stage_key)
    JOIN dim_rider r USING (rider_key)
    WHERE r.finished
    GROUP BY GROUPING SETS ((f.team_key, r.rider_name), (f.team_key))
)
SELECT team, rider,
       ROUND(flat_kmh, 2) AS flat_kmh, ROUND(hilly_kmh, 2) AS hilly_kmh,
       ROUND(mountain_kmh, 2) AS mountain_kmh, ROUND(itt_kmh, 2) AS itt_kmh,
       ROUND(100 * mountain_kmh / flat_kmh, 1) AS mountain_pct_of_flat
FROM by_terrain
ORDER BY mountain_pct_of_flat DESC
LIMIT 20;

-- E7. Bonuses, penalties and counterfactuals --------------------------------------------
-- Cumulative bonuses and penalties per rider, and the GC replayed three ways:
-- actual (adjusted time), without bonuses, and without bonuses and penalties (raw time).
WITH totals AS (
    SELECT rider_key,
           SUM(time_bonus)                  AS bonus_total,
           SUM(time_penalty)                AS penalty_total,
           SUM(adjusted_time)               AS actual_time,
           SUM(finish_time + time_penalty)  AS time_without_bonuses,
           SUM(finish_time)                 AS time_without_both
    FROM fact_results
    GROUP BY rider_key
    HAVING COUNT(*) = (SELECT COUNT(*) FROM dim_stage)
), ranked AS (
    SELECT t.*,
           RANK() OVER (ORDER BY actual_time)          AS rank_actual,
           RANK() OVER (ORDER BY time_without_bonuses) AS rank_no_bonus,
           RANK() OVER (ORDER BY time_without_both)    AS rank_no_bonus_no_penalty
    FROM totals t
)
SELECT r.rider_name, bonus_total, penalty_total,
       rank_actual, rank_no_bonus, rank_no_bonus_no_penalty,
       CASE WHEN rank_actual <= 10 AND rank_no_bonus_no_penalty > 10 THEN 'drops out of top 10'
            WHEN rank_actual > 10 AND rank_no_bonus_no_penalty <= 10 THEN 'moves into top 10'
            ELSE '' END                                AS top10_change
FROM ranked JOIN dim_rider r USING (rider_key)
WHERE LEAST(rank_actual, rank_no_bonus, rank_no_bonus_no_penalty) <= 12
ORDER BY rank_actual;

-- E8. Participation by nation -----------------------------------------------------------
-- Roll up: teams based in and riders from each nation (teams use the team's registered
-- country, riders use their nationality).
SELECT c.country_key, c.country_name,
       (SELECT COUNT(*) FROM dim_team  t WHERE t.team_country_key = c.country_key) AS teams,
       (SELECT COUNT(*) FROM dim_rider r WHERE r.country_key      = c.country_key) AS riders
FROM dim_country c
ORDER BY riders DESC, teams DESC, c.country_key;

-- Drill down into one nation: its riders and their teams, with a ROLLUP subtotal per team.
SELECT COALESCE(r.team_name, '(all teams)') AS team,
       COUNT(*)                             AS riders,
       STRING_AGG(r.rider_name, ', ' ORDER BY r.rider_name) AS rider_names
FROM dim_rider r
WHERE r.country_key = 'FRA'                                  -- choose a country
GROUP BY ROLLUP (r.team_name)
ORDER BY GROUPING(r.team_name), riders DESC, team;

-- E9. National outcomes -----------------------------------------------------------------
-- Best GC rank, stage wins, podiums and top tens per nation.
WITH gc AS (
    SELECT rider_key, RANK() OVER (ORDER BY SUM(adjusted_time)) AS gc_rank
    FROM fact_results GROUP BY rider_key
    HAVING COUNT(*) = (SELECT COUNT(*) FROM dim_stage)
)
SELECT c.country_name,
       COUNT(DISTINCT f.rider_key)                   AS riders_started,
       MIN(gc.gc_rank)                               AS best_gc_rank,
       SUM(CASE WHEN f.is_winner THEN 1 ELSE 0 END)  AS stage_wins,
       SUM(CASE WHEN f.is_podium THEN 1 ELSE 0 END)  AS podiums,
       SUM(CASE WHEN f.is_top10  THEN 1 ELSE 0 END)  AS top10s
FROM fact_results f
JOIN dim_country c USING (country_key)
LEFT JOIN gc       USING (rider_key)
GROUP BY c.country_name
ORDER BY stage_wins DESC, podiums DESC, best_gc_rank;

-- Pathway back to the stages and riders behind one nation's wins.
SELECT f.stage_key, s.stage_type, r.rider_name
FROM fact_results f JOIN dim_rider r USING (rider_key) JOIN dim_stage s USING (stage_key)
WHERE f.country_key = 'SVN' AND f.is_winner                  -- choose a country
ORDER BY f.stage_key;

-- E10. Temporal GC storyline ------------------------------------------------------------
-- Cumulative adjusted time after each stage, position after each stage among riders
-- still in the race, Mountain stages marked, and a flag where the position changed.
WITH cum AS (
    SELECT f.rider_key, f.stage_key, s.is_mountain,
           SUM(f.adjusted_time) OVER (PARTITION BY f.rider_key ORDER BY f.stage_key) AS cum_time,
           COUNT(*)             OVER (PARTITION BY f.rider_key ORDER BY f.stage_key) AS stages_done
    FROM fact_results f JOIN dim_stage s USING (stage_key)
), pos AS (
    SELECT c.*,
           RANK() OVER (PARTITION BY stage_key ORDER BY cum_time) AS position,
           cum_time - MIN(cum_time) OVER (PARTITION BY stage_key) AS gap_to_leader
    FROM cum c
    WHERE stages_done = stage_key                             -- still in the race
)
SELECT p.stage_key, p.is_mountain, r.rider_name, p.cum_time, p.position, p.gap_to_leader,
       p.position <> LAG(p.position) OVER (PARTITION BY p.rider_key ORDER BY p.stage_key)
                                                              AS position_changed
FROM pos p JOIN dim_rider r USING (rider_key)
WHERE p.rider_key IN (1, 11, 72, 191, 151)                    -- choose riders (final top five)
ORDER BY p.stage_key, p.position;

-- E11. Against the clock ----------------------------------------------------------------
-- The time trial catalogue: date, distance, route, winner and winning speed.
SELECT s.stage_key, s.stage_date, s.distance_km, s.start_location, s.finish_location,
       r.rider_name AS winner, f.team_key AS winner_team, f.finish_time AS winning_time,
       ROUND(s.distance_km * 3600 / f.finish_time, 2) AS winner_kmh
FROM dim_stage s
JOIN fact_results f ON f.stage_key = s.stage_key AND f.is_winner
JOIN dim_rider r    USING (rider_key)
WHERE s.is_time_trial
ORDER BY s.stage_key;

-- E12. Consistency near the front -------------------------------------------------------
-- Riders with the most top ten finishes, with the stages, places and terrain behind them.
SELECT r.rider_name, f.team_key AS team,
       COUNT(*) AS top10s,
       SUM(CASE WHEN f.is_winner THEN 1 ELSE 0 END) AS wins,
       STRING_AGG('stage ' || f.stage_key || ': ' || f.rank || ' (' || s.terrain || ')',
                  ', ' ORDER BY f.stage_key) AS stages
FROM fact_results f
JOIN dim_rider r USING (rider_key)
JOIN dim_stage s USING (stage_key)
WHERE f.is_top10
GROUP BY r.rider_name, f.team_key
ORDER BY top10s DESC, wins DESC
LIMIT 10;

-- E13. Depth of squads ------------------------------------------------------------------
-- Distinct riders per team: started, finished, scored a top ten, and nations in the squad.
SELECT r.team_name,
       COUNT(DISTINCT r.rider_key)                                        AS riders,
       COUNT(DISTINCT r.rider_key) FILTER (WHERE r.finished)              AS finishers,
       COUNT(DISTINCT f.rider_key) FILTER (WHERE f.is_top10)              AS riders_with_top10,
       COUNT(DISTINCT r.country_key)                                      AS nations,
       STRING_AGG(DISTINCT r.rider_name || ' (' || r.country_key || ')', ', ') AS roster
FROM dim_rider r
LEFT JOIN fact_results f USING (rider_key)
GROUP BY r.team_name
ORDER BY riders_with_top10 DESC, finishers DESC, r.team_name;

-- E14. Top ten intensity by team --------------------------------------------------------
-- Pivot with filtered aggregates (one column per terrain); ROLLUP adds a race total row.
SELECT COALESCE(f.team_key, '(all teams)')                      AS team,
       COUNT(*) FILTER (WHERE s.terrain = 'flat')               AS flat,
       COUNT(*) FILTER (WHERE s.terrain = 'hilly')              AS hilly,
       COUNT(*) FILTER (WHERE s.terrain = 'mountain')           AS mountain,
       COUNT(*) FILTER (WHERE s.terrain = 'itt')                AS time_trial,
       COUNT(*)                                                 AS top10s
FROM fact_results f
JOIN dim_stage s USING (stage_key)
WHERE f.is_top10
GROUP BY ROLLUP (f.team_key)
ORDER BY GROUPING(f.team_key), top10s DESC, team;

-- Link back to the stages and riders behind one team's top tens.
SELECT f.stage_key, s.terrain, r.rider_name, f.rank
FROM fact_results f JOIN dim_stage s USING (stage_key) JOIN dim_rider r USING (rider_key)
WHERE f.is_top10 AND f.team_key = 'UAE TEAM EMIRATES XRG'     -- choose a team
ORDER BY f.stage_key, f.rank;

-- E15. The long day ---------------------------------------------------------------------
-- Stages sorted by distance with the winner of each.
SELECT RANK() OVER (ORDER BY s.distance_km DESC) AS length_rank,
       s.stage_key, s.stage_date, s.stage_type, s.distance_km,
       s.start_location, s.finish_location, r.rider_name AS winner
FROM dim_stage s
JOIN fact_results f ON f.stage_key = s.stage_key AND f.is_winner
JOIN dim_rider r    USING (rider_key)
ORDER BY s.distance_km DESC;

-- Leading finishers of the longest stage and their adjusted times.
SELECT f.rank, r.rider_name, f.team_key AS team, f.adjusted_time
FROM fact_results f JOIN dim_rider r USING (rider_key)
WHERE f.stage_key = (SELECT stage_key FROM dim_stage ORDER BY distance_km DESC LIMIT 1)
ORDER BY f.rank
LIMIT 10;
