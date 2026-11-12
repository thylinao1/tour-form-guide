SELECT t.team_name, t.team_country_name, SUM(f.finish_time) AS team_time
FROM fact_results f
JOIN dim_team t ON t.team_key = f.team_key
WHERE (SELECT COUNT(*)
       FROM fact_results g
       WHERE g.team_key = f.team_key
         AND g.stage_key = f.stage_key
         AND (g.finish_time < f.finish_time
              OR (g.finish_time = f.finish_time
                  AND g.rider_key < f.rider_key))) < 3
GROUP BY t.team_name, t.team_country_name
ORDER BY team_time, t.team_name
