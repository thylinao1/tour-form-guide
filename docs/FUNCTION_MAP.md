# Function map: E1 to E15

The lecturer listed 15 demonstration prompts. All 15 are built into the dashboard. In the page, each panel carries a yellow badge with its code, and the **Function map** tab has a card and a "Show me" button for each one.

The OLAP words used below:

- **Roll up**: add detail rows into a bigger total (riders into a team, stages into a terrain).
- **Drill down**: open a total to see the rows inside it.
- **Slice**: look at one piece, such as one stage or one terrain.
- **Dice**: slice on several things at once, such as one team on mountain stages.
- **Pivot**: turn rows into columns, such as a team by terrain grid.

SQL is in `sql/04_functions_e1_e15.sql`. It runs on the star schema built by `sql/03_star_schema.sql`. Each query has a comment line that starts with the code (for example `-- E7.`). A shorter version of each query is shown by the SQL button on the Function map tab (from `src/plugins/05-sql.js`).

| Code | Lecturer's title | Tab | Panel title | OLAP operation | Matching query in `sql/04_functions_e1_e15.sql` |
|---|---|---|---|---|---|
| E1 | GC leaderboard with contextual descent | Overall winner | Final overall standings, and Biggest day against the top ten | Roll up, drill down | `E1`: total adjusted time per rider with gap, then the stage where one rider gained or lost the most time on the median of the final top ten |
| E2 | A stage in focus | Stages | Stage in focus | Slice, pivot | `E2`: leading finishers of one stage, then the same slice by team |
| E3 | Team burden and contribution | Teams | Team burden and contribution | Roll up, drill down | `E3`: ROLLUP of the three counted times per stage into each team's classification time, with each rider's share under it |
| E4 | Parallel classifications | Jerseys | Parallel classifications | Pivot, slice | `E4`: overall rank, young rider rank and a mountain-only total |
| E5 | Mountain contours | Terrain | Mountain contours | Slice, roll up, drill down | `E5`: podiums and mean gap on Mountain stages, then one rider's daily results |
| E6 | Speed as a simple ratio | Terrain | Speed by terrain | Roll up, pivot | `E6`: kilometres divided by hours per terrain, GROUPING SETS for riders and teams |
| E7 | Bonuses, penalties and counterfactuals | Overall winner | Bonuses and penalties per rider, and What if bonuses or penalties did not count? | Roll up, slice | `E7`: bonus and penalty totals, and the standings with and without them |
| E8 | Participation by nation | Nations | Where the riders and teams come from | Roll up, drill down | `E8`: teams and riders per country, then one country's riders and teams |
| E9 | National outcomes | Nations | National outcomes (and the map panel above it) | Roll up, drill down | `E9`: best overall place, wins, podiums and top tens per country, then the stages behind them |
| E10 | Temporal GC storyline | Overall winner | The fight for yellow, stage by stage (with Race replay and The race in 3D) | Roll up, dice | `E10`: cumulative time and position after each stage, with a flag where the position changed |
| E11 | Against the clock | Stages | Against the clock | Slice | `E11`: the time trial catalogue with date, distance, winner and speed |
| E12 | Consistency near the front | Form and risk | Consistency near the front | Roll up, slice, drill down | `E12`: riders with the most top ten finishes and the stages behind them |
| E13 | Depth of squads | Teams | Depth of squads | Roll up, drill down | `E13`: distinct riders per team (started, finished, top ten) and nations in the squad |
| E14 | Top-ten intensity by team | Teams | Top-ten intensity by team | Pivot, roll up, drill down | `E14`: filtered counts, one column per terrain, ROLLUP for the race total, then the stages and riders |
| E15 | The long day | Stages | The long day | Slice, drill down | `E15`: stages sorted by distance, then the leading finishers of the longest one |

## Notes

- **Where a code is on the page.** Panels set a `data-fn` tag, so the Function map can scroll to the right panel and flash it. E10 appears on three panels in the Overall winner tab (the line chart first, then the replay and the 3D chart). E8 and E9 share the map panel, and E9 also has its own table.
- **Drill down for requirement a.** The Stages tab also has a panel called "Roll up and drill down" (terrain, then stage, then top five), tagged "OLAP" on the page. It is not one of the 15 prompts. It is there to show the drill down by stage clearly.
- **Same answers in SQL and in the page.** The dashboard computes from the same cleaned data as the SQL. `tests/sql_check.sh` checks key values in the SQL (Pogacar 277,349 seconds, Vingegaard +264, Lipowitz +660, France 38 riders and 5 teams, stage 2 the longest at 209.1 km, time trials on stages 5 and 13, Pogacar 13 top tens), and `tests/engine.test.mjs` checks the same values in the page code against an independent reference.
- **The team total in E3 uses the official rule.** The brief asks for each team's aggregate adjusted time. Adding every rider's time makes totals depend on how many riders dropped out, so the ROLLUP counts the three best times per stage, which matches the Teams tab. The page still shows the all rider total through the Official / With bonuses switch and the workload figure.
