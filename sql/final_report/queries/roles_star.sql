SELECT rc.country_name AS rider_country, tc.country_name AS team_country,
       COUNT(*) AS stage_wins
FROM fact_results f
JOIN dim_country rc ON rc.country_key = f.rider_country_key
JOIN dim_country tc ON tc.country_key = f.team_country_key
WHERE f.rank = 1
GROUP BY rc.country_name, tc.country_name
ORDER BY stage_wins DESC, rider_country, team_country
