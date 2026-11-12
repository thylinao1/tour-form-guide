SELECT t.team_country_name, t.team_name,
       COUNT(*) AS top10_finishes,
       COUNT(DISTINCT f.rider_key) AS riders_in_top10
FROM fact_results f
JOIN dim_team t ON t.team_key = f.team_key
WHERE f.rank <= 10
GROUP BY ROLLUP (t.team_country_name, t.team_name)
ORDER BY t.team_country_name, t.team_name
