# Data and methods

Everything in the dashboard is computed in the browser from the cleaned 2025 race tables, except the official points and mountains standings, which are published figures. Times are in seconds inside the data and shown as hours, minutes and seconds on the page.

## Definitions

**Adjusted time.** Finish time, minus the time bonus, plus the time penalty. A time bonus is seconds taken off a rider's time for finishing first, second or third on a road stage (10, 6 and 4 seconds; none in the two time trials). A time penalty is seconds added for a rule break. Four result rows have a penalty. The overall standing adds adjusted time over the stages.

**Overall standing (General Classification, GC).** The lowest total adjusted time wins. Only riders with a result on every stage counted so far are ranked, so after stage 21 there are 160 ranked riders out of 184. Without this rule, riders who left early would have the smallest totals and appear at the top. Ties are broken by the sum of stage placings, as in the UCI rules.

**Placings and gaps.** Placings use the order riders crossed the line. Gaps use the credited time. Riders in one bunch get the same time, so a rider can cross later than another and still have an equal or lower time (12 result rows on stages 1, 17 and 21). The page uses rank for "top 10" and "winner" and time for gaps.

**Young rider rule.** Born on or after 1 January 2000 (2025 regulations, article 24d). The leader is the best placed eligible rider in the overall standing. Applying this to our data reproduces the official top 10, in order and to the second. The age slider in the Parallel classifications panel (E4) lets you try an age at race start rule instead. The official rule is the default.

**Team classification rule.** On each stage, add the three best individual finish times of a team, then add the 21 stage totals. Bonuses and penalties are not included. Our totals equal the official ones: Visma 232:01:32, UAE +24:26, Red Bull - Bora - Hansgrohe +1:24:47. A switch on the Teams tab ("Official" and "With bonuses") shows the version with adjusted times for comparison.

**Pivotal day (E1).** For one rider, the stage with the largest difference between his adjusted time and the median adjusted time of the final top ten riders on that stage. A negative difference means he was faster than the contenders. Examples: Vingegaard, stage 19, 101.5 seconds faster; Pogacar, stage 12, 206.5 seconds faster.

**Mountains-only standing (E4).** Adjusted time added up on the six mountain stages only. It is a proxy built from our race data. The official Mountains jersey is about climb points and is shown separately from the published standings.

**Points (green jersey) finish scale.** Stage finish points follow the 2025 regulations: 50, 30 or 20 points to the winner depending on the stage's coefficient, not its terrain name. This differs from our terrain label on five stages (2, 4, 7 and 15 are hilly but used the 50 point scale, stage 16 is mountain but used the 30 point scale). Intermediate sprint points are not in the race data, so the final standings come from published results.

**Speed index (E6).** Total distance divided by total time on a terrain (km per hour), divided by the median finisher (for riders) or the median team (for teams). Above 1 means faster than typical on that terrain.

**Bunch finish.** At least 20 riders on the winner's time.

**Rider types.** A label from the first rule that matches: fewer than 5 starts, overall top 10 (GC contender), sprinter, time-trialist, climber, puncheur (hilly specialist), support rider. The rules are in the Method tab.

**Head-to-head on finishing place.** For two riders, compare their finishing places on every stage both finished. The record is how many of those stages each was ahead. Time is never used, because riders in a bunch share one time. For two teams, each team is represented by its best placed rider on each stage. Pogacar finished ahead of Vingegaard on 18 of 21 stages.

**"History says" share and fair odds (Bet builder).** From the stages where one side finished ahead (a tie is left out):

- share for side A = (A wins + 1) / (decided stages + 2)
- share for side B = 1 minus share for A
- fair odds = 1 / share

The "+ 1" and "+ 2" pull small samples towards 50 percent, so 1 win from 1 stage reads as 67 percent and not 100 percent. Example: Pogacar ahead of Vingegaard on 18 of 21 stages gives 19 / 23 = 83 percent and fair odds of 1.21. These are "fair" odds because no bookmaker margin is added. They are a frequency from one race, not a price and not a forecast.

**Evidence strength.** Based on the number of stages in the slice: under 4 is "very thin", 4 to 7 is "thin", 8 or more is "fair".

**Weather filters (Bet builder).** From Open-Meteo race-day weather at each finish town, for the race hours 13:00 to 18:00 local time. Wet is at least 1 mm of rain. Hot is at least 28 degrees Celsius. Windy is wind of at least 20 km/h.

## Data cleaning summary

The three course files (`riders.csv`, `individual_results.csv`, `exits.csv`) were split by `tools/clean_data.py` into one CSV per table of the relational schema. The full list of steps, with row counts, is in `data/cleaned/README.md`. In short:

- Country codes were mapped to ISO 3166-1 alpha-3 (for example GER to DEU, NED to NLD, UAE to ARE). The code BRN is Brunei in ISO, so the source's Bahrain code was mapped to BHR.
- One rider (Aleksandr Vlasov) has no nationality in the source. He gets the placeholder country `XXX` "Not specified", so no nationality is invented.
- `stage_id` was created as 1 to 21 in date order. Rest days get no number.
- Facts that repeated on every row (stage details, team country, country names) were moved to their own tables. The script first checked that every repeat agreed.
- Adjusted time is not stored. It is computed as finish time minus bonus plus penalty.
- Checks found no duplicate rows, no empty cells apart from the Vlasov value, and valid dates and numbers. Row counts: 184 riders, 23 teams, 21 stages, 3,602 results, 24 exits, 30 countries, 39 locations.
- Data quirks kept as they are: rank is not always in time order; stage 13 has a tie (riders 23 and 197 share rank 108 and the next rank is 110); on stage 8 the winner has a 10 second penalty, so the lowest adjusted time belongs to the runner-up; 160 riders finished all 21 stages.

Official classifications were collected and checked separately. See `data/official/official_sources.md` for sources, rules and the disagreements found between sources.

## Schema notes

The schema in `sql/01_normalized_schema.sql` is our relational schema of 10 tables. Four points are marked "NOTE" in the file:

1. **Award recipient type.** `classification_award` has a `recipient_type` ('rider' or 'team') and a unique pair (`award_name`, `recipient_type`). WIN is fixed to 'rider' and EARN to 'team', and each uses a composite foreign key to the award. A team award such as Best Team cannot be inserted into WIN, and Points cannot be inserted into EARN. `tests/sql_check.sh` tries five wrong inserts and checks that all fail.
2. **Rank at least 1.** The check is `rank >= 1`, because a stage winner has rank 1.
3. **Loop stages.** There is no check `start_location <> finish_location`. Stages 1 (Lille Metropole), 5 (Caen) and 11 (Toulouse) start and finish in the same town. With the check, those 3 stages, their 533 results and 4 exits would be rejected, and the overall standing would be wrong.
4. **Dead heat.** There is no unique constraint on (`stage_id`, `rank`), because two riders share rank 108 on stage 13.

DuckDB has no triggers. The three cross-table rules (every team has a rider, every location is used by a stage, no result from a rider's exit stage onwards) are kept as PostgreSQL trigger code in a comment at the end of the schema file, and checked as queries in `tests/sql_check.sh`.

The star schema (`sql/03_star_schema.sql`) has `fact_results` (3,602 rows, one rider on one stage) and the dimensions `dim_rider`, `dim_team`, `dim_stage` and `dim_country`. `sql/05_task4_compare.sql` writes three questions on both schemas and counts the joins each one needs.

## Known limits

- **One race.** 21 stages is a small sample: 7 flat, 6 hilly, 6 mountain and 2 time trials. Rates are signals, not probabilities. Slices such as "mountain stages" cover only 6 stages.
- **Stage 21 timing.** Rain meant the overall was timed 50.3 km before the finish. The data holds the full stage time, so total times are 3,717 seconds longer than official (77:02:29 for Pogacar, official 76:00:32). All gaps are unchanged. The team classification uses the same full-stage times, which is the only way to reproduce the official team totals.
- **Points and mountains.** The race data has no intermediate sprint or climb points. These two jerseys use published standings (top 10 official, full lists from CyclingDB, checked against the top 10). Published points are at least the finish points we compute for all 132 riders. The difference is intermediate sprint points.
- **Source disagreements.** Sources differ on a few details, such as one French source giving 232:03:32 for the winning team where other sources and our own recomputation give 232:01:32. The choice made in each case, and why, is in `data/official/official_sources.md`.
- **Team total in E3 (SQL).** The ROLLUP counts the three best times of each team on every stage (the official rule), so team totals can be compared and match the Teams tab. Under each team total it shows how many stages and seconds each rider supplied. The all rider adjusted total is shown on the page by the Official / With bonuses switch and the workload figure.
- **Weather.** One weather point per finish town and one time window. It describes the finish, not the whole route.
- **Betting.** Nothing here is a prediction or advice. There is no money, stake or bet button. Past results do not guarantee future ones.
