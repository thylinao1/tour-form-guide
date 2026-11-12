SELECT r.rider_name, r.rider_team,
       SUM(x.finish_time - x.time_bonus + x.time_penalty) AS mountain_time
FROM result x
JOIN rider r ON r.bib_number = x.bib_number
JOIN stage s ON s.stage_id = x.stage_id
WHERE s.type = 'mountain'
  AND r.dob >= DATE '2000-01-01'
  AND NOT EXISTS (SELECT 1 FROM exit e WHERE e.bib_number = r.bib_number)
GROUP BY r.bib_number, r.rider_name, r.rider_team
ORDER BY mountain_time, r.bib_number
