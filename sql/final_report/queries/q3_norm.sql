SELECT r.rider_name, s.stage_id, s.date, s.type,
       s.start_location, s.finish_location, x.rank,
       x.finish_time - x.time_bonus + x.time_penalty AS adjusted_time,
       (SELECT SUM(p.finish_time - p.time_bonus + p.time_penalty)
        FROM result p
        JOIN stage ps ON ps.stage_id = p.stage_id
        WHERE p.bib_number = x.bib_number
          AND ps.date <= s.date) AS cumulative_time
FROM result x
JOIN rider r ON r.bib_number = x.bib_number
JOIN stage s ON s.stage_id = x.stage_id
WHERE r.bib_number = 1
ORDER BY s.date
