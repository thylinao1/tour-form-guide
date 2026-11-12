SELECT t.team_name, c.country_name, SUM(k.finish_time) AS team_time
FROM (SELECT r.rider_team, x.finish_time,
             ROW_NUMBER() OVER (PARTITION BY r.rider_team, x.stage_id
                                ORDER BY x.finish_time, x.bib_number) AS position
      FROM result x
      JOIN rider r ON r.bib_number = x.bib_number) AS k
JOIN team t    ON t.team_name = k.rider_team
JOIN country c ON c.country_code = t.team_country
WHERE k.position <= 3
GROUP BY t.team_name, c.country_name
ORDER BY team_time, t.team_name
