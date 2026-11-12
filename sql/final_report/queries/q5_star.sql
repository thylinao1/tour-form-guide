SELECT d.rider_name, d.team_name,
       SUM(f.adjusted_time) AS mountain_time
FROM fact_results f
JOIN dim_rider d ON d.rider_key = f.rider_key
JOIN dim_stage s ON s.stage_key = f.stage_key
WHERE s.stage_type = 'mountain'
  AND d.is_young_rider
  AND d.finished_race
GROUP BY d.bib_number, d.rider_name, d.team_name
ORDER BY mountain_time, d.bib_number
