SELECT t.team_name, c.country_name, SUM(x.finish_time) AS team_time
FROM result x
JOIN rider r   ON r.bib_number = x.bib_number
JOIN team t    ON t.team_name = r.rider_team
JOIN country c ON c.country_code = t.team_country
WHERE (SELECT COUNT(*)
       FROM result y
       JOIN rider m ON m.bib_number = y.bib_number
       WHERE m.rider_team = r.rider_team
         AND y.stage_id = x.stage_id
         AND (y.finish_time < x.finish_time
              OR (y.finish_time = x.finish_time
                  AND y.bib_number < x.bib_number))) < 3
GROUP BY t.team_name, c.country_name
ORDER BY team_time, t.team_name
