SELECT t.team_name, t.team_country_name, SUM(k.finish_time) AS team_time
FROM (SELECT f.team_key, f.finish_time,
             ROW_NUMBER() OVER (PARTITION BY f.team_key, f.stage_key
                                ORDER BY f.finish_time, f.rider_key) AS position
      FROM fact_results f) AS k
JOIN dim_team t ON t.team_key = k.team_key
WHERE k.position <= 3
GROUP BY t.team_name, t.team_country_name
ORDER BY team_time, t.team_name
