SELECT r.rider_name, r.rider_team, c.country_name, t.total_time
FROM (SELECT x.bib_number,
             SUM(x.finish_time - x.time_bonus + x.time_penalty) AS total_time
      FROM result x
      GROUP BY x.bib_number) AS t
JOIN rider r   ON r.bib_number = t.bib_number
JOIN country c ON c.country_code = r.rider_country
WHERE NOT EXISTS (SELECT 1 FROM exit e WHERE e.bib_number = r.bib_number)
ORDER BY t.total_time, r.bib_number
