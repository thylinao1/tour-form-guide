SELECT d.rider_name, d.team_name, d.rider_country_name,
       SUM(f.adjusted_time) AS total_time
FROM fact_results f
JOIN dim_rider d ON d.rider_key = f.rider_key
WHERE d.finished_race
GROUP BY d.bib_number, d.rider_name, d.team_name, d.rider_country_name
ORDER BY total_time, d.bib_number
