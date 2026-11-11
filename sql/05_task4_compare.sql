-- =====================================================================================
-- 05_task4_compare.sql
-- Normalized schema against star schema: three representative questions, each written twice, first on the normalized
-- schema (01, 02) and then on the star schema (03), with a note on the joins needed.
-- Both versions return the same rows.
-- =====================================================================================

-- Q1. Cumulative (total) adjusted time per rider, for riders who finished every stage.
-- Normalized: RESULT has no team or adjusted time, so we join RIDER for name and team and
-- compute the adjusted time inline (or read the view result_adjusted). 1 join.
SELECT r.bib_number, r.rider_name, r.rider_team,
       SUM(x.finish_time - x.time_bonus + x.time_penalty) AS total_time
FROM result x
JOIN rider r ON r.bib_number = x.bib_number
GROUP BY r.bib_number, r.rider_name, r.rider_team
HAVING COUNT(*) = (SELECT COUNT(*) FROM stage)
ORDER BY total_time
LIMIT 10;

-- Star: adjusted_time is a stored measure and the team is already on dim_rider. 1 join.
SELECT d.rider_key AS bib_number, d.rider_name, d.team_name AS rider_team,
       SUM(f.adjusted_time) AS total_time
FROM fact_results f
JOIN dim_rider d USING (rider_key)
GROUP BY d.rider_key, d.rider_name, d.team_name
HAVING COUNT(*) = (SELECT COUNT(*) FROM dim_stage)
ORDER BY total_time
LIMIT 10;

-- Q2. Best team classification: the three best raw times of each team on each stage,
-- added over the race (the official method; Visma wins with 835,292 s).
-- Normalized: the team of a result is only reachable through RIDER. 1 join.
WITH ranked AS (
    SELECT r.rider_team AS team, x.stage_id, x.finish_time,
           ROW_NUMBER() OVER (PARTITION BY r.rider_team, x.stage_id ORDER BY x.finish_time) AS n
    FROM result x
    JOIN rider r ON r.bib_number = x.bib_number
)
SELECT team, SUM(finish_time) AS team_time
FROM ranked WHERE n <= 3
GROUP BY team ORDER BY team_time LIMIT 5;

-- Star: team_key is a foreign key on the fact table itself. No join at all.
WITH ranked AS (
    SELECT team_key AS team, stage_key, finish_time,
           ROW_NUMBER() OVER (PARTITION BY team_key, stage_key ORDER BY finish_time) AS n
    FROM fact_results
)
SELECT team, SUM(finish_time) AS team_time
FROM ranked WHERE n <= 3
GROUP BY team ORDER BY team_time LIMIT 5;

-- Q3. Stage by stage performance of one rider (Tadej Pogacar, bib 1): stage, terrain,
-- place, adjusted time and running total.
-- Normalized: STAGE for date and type. 1 join (2 if the rider is chosen by name).
SELECT s.stage_id, s.date, s.type, x.rank,
       x.finish_time - x.time_bonus + x.time_penalty AS adjusted_time,
       SUM(x.finish_time - x.time_bonus + x.time_penalty)
           OVER (ORDER BY s.stage_id) AS running_total
FROM result x
JOIN stage s ON s.stage_id = x.stage_id
WHERE x.bib_number = 1
ORDER BY s.stage_id;

-- Star: the same shape, one join to dim_stage; flags such as is_top10 are ready to use.
SELECT s.stage_key AS stage_id, s.stage_date AS date, s.stage_type AS type, f.rank,
       f.adjusted_time,
       SUM(f.adjusted_time) OVER (ORDER BY s.stage_key) AS running_total
FROM fact_results f
JOIN dim_stage s USING (stage_key)
WHERE f.rider_key = 1
ORDER BY s.stage_key;

-- Summary of joins: Q1 1 vs 1, Q2 1 vs 0, Q3 1 vs 1. The star schema needs no more
-- joins than the normalized one and removes the RIDER hop for team questions, at the cost
-- of storing team, country and adjusted time redundantly in the fact table. Questions by
-- nationality (E9) need 2 joins in the normalized schema (RESULT to RIDER to COUNTRY)
-- and 1 in the star schema (fact_results to dim_country).
