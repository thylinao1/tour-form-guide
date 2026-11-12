SELECT c.country_name, t.team_name,
       COUNT(*) AS top10_finishes,
       COUNT(DISTINCT x.bib_number) AS riders_in_top10
FROM result x
JOIN rider r   ON r.bib_number = x.bib_number
JOIN team t    ON t.team_name = r.rider_team
JOIN country c ON c.country_code = t.team_country
WHERE x.rank <= 10
GROUP BY ROLLUP (c.country_name, t.team_name)
ORDER BY c.country_name, t.team_name
