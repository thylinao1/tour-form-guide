SELECT r.rider_name, r.rider_team, c.country_name,
       SUM(x.finish_time - x.time_bonus + x.time_penalty) AS total_time
FROM result x
JOIN rider r   ON r.bib_number = x.bib_number
JOIN country c ON c.country_code = r.rider_country
WHERE NOT EXISTS (SELECT 1 FROM exit e WHERE e.bib_number = r.bib_number)
GROUP BY r.bib_number, r.rider_name, r.rider_team, c.country_name
ORDER BY total_time, r.bib_number
