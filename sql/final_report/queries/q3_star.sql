SELECT d.rider_name, s.stage_id, s.stage_date, s.stage_type,
       s.start_location, s.finish_location, f.rank,
       f.adjusted_time,
       (SELECT SUM(p.adjusted_time)
        FROM fact_results p
        JOIN dim_stage ps ON ps.stage_key = p.stage_key
        WHERE p.rider_key = f.rider_key
          AND ps.stage_date <= s.stage_date) AS cumulative_time
FROM fact_results f
JOIN dim_rider d ON d.rider_key = f.rider_key
JOIN dim_stage s ON s.stage_key = f.stage_key
WHERE d.bib_number = 1
ORDER BY s.stage_date
