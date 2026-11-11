# Cleaned data – Tour de France (Group 31)

These files turn the three source files (`riders.csv`, `individual_results.csv`, `exits.csv`) into **one CSV per table of the Task 2 relational schema**. Each file can be loaded into PostgreSQL with `\copy`, and Power BI can import each one as a table.

Regenerate: `python clean_data.py` from the `data/` folder (needs pandas). The script checks every Task 2 constraint on the output and stops if one fails.

## Files

| File | Task 2 table | Rows | Columns |
|---|---|---:|---|
| `country.csv` | COUNTRY | 30 | `country_code`, `country_name` |
| `team.csv` | TEAM | 23 | `team_name`, `team_country` |
| `rider.csv` | RIDER | 184 | `bib_number`, `rider_name`, `dob`, `rider_team`, `rider_country` |
| `location.csv` | LOCATION | 39 | `location_name`, `location_country` |
| `stage.csv` | STAGE | 21 | `stage_id`, `date`, `distance`, `type`, `start_location`, `finish_location` |
| `result.csv` | RESULT | 3,602 | `bib_number`, `stage_id`, `finish_time`, `rank`, `time_bonus`, `time_penalty` |
| `exit.csv` | EXIT | 24 | `bib_number`, `exit_stage`, `reason` |
| `country_code_map.csv` | *(not a table)* | 30 | `source_code`, `country_code`, `country_name`: maps each original code to the code used here |

Column names follow Table 2 of the Task 2 report. Units: `distance` in km, all times in seconds, dates as `YYYY-MM-DD`. Encoding is UTF-8 without BOM. In Excel, open the files with *Data → From Text/CSV* and choose UTF-8, or accented names will show as `MÃ©tropole`.

CLASSIFICATION_AWARD, WIN and EARN are **not** included. The source files don't contain them, and they come from analysis: GC, young rider and best team are computed from results, and Points and KOM come from the official site.

## Why three source files become eight

All eight CSVs here are written by a single run of `clean_data.py`; none are made by hand or by another tool.

The three source files don't match the Task 2 schema. Each one mixes several kinds of record, so the same fact repeats on many rows. For example, every row of `individual_results.csv` repeats the stage's date, distance, type, start and finish towns, and the country names. The Task 2 schema stores each fact once, in the table for its entity. The script therefore splits each source file into those tables, checking first that the repeated values always agree:

| Source file | Source columns | Output file(s) |
|---|---|---|
| `riders.csv` | `bib`, `rider_name`, `dob`, `team`, `rider_country_code` | `rider.csv` |
| | `team`, `team_country_code` | `team.csv` (184 rows → 23 teams) |
| | `rider_country_code/name`, `team_country_code/name` | `country.csv` (part) |
| `individual_results.csv` | `rider`, `day`, `time`, `rank`, `bonus`, `penalty` | `result.csv` (`day` becomes `stage_id`) |
| | `day`, `length`, `type`, `start_location`, `finish_location` | `stage.csv` (3,602 rows → 21 stages) |
| | `start_/finish_location`, `start_/finish_country_code` | `location.csv` (39 towns) |
| | `start_/finish_country_code/name` | `country.csv` (part) |
| | `name`, `team` | dropped: identical to `riders.csv` (checked) |
| `exits.csv` | `bib`, `stage`, `reason` | `exit.csv` |
| | `name` | dropped: identical to `riders.csv` (checked) |
| *(all three)* | original country codes | `country_code_map.csv` (lookup only, not a schema table) |

`country.csv` combines every country mentioned anywhere: rider nationalities, team countries and stage locations. That's 29 countries, plus the `XXX` placeholder.

This gives 7 files, one for each Task 2 table the source data can fill. The schema has 10 tables; the other three (CLASSIFICATION_AWARD, WIN and EARN) have no source data, as noted above. The 8th file, `country_code_map.csv`, records each original code next to the ISO code used here, so the code changes can be traced.

## What was cleaned and why

| # | Issue in source | Action | Rows affected |
|---|---|---|---:|
| 1 | Country codes are IOC/UCI-style, but the brief requires ISO 3166-1 alpha-3 | Mapped by country name to ISO alpha-3. Two codes would otherwise point to the wrong country: `BRN` is Brunei in ISO, not Bahrain. | 9 codes: GER→DEU, NED→NLD, SLO→SVN, SUI→CHE, DEN→DNK, LAT→LVA, POR→PRT, UAE→ARE, BRN→BHR |
| 2 | Rider 78 (Aleksandr Vlasov) has the literal text `NULL` as country code and name. RIDER.rider_country is NOT NULL with a foreign key. | Assigned placeholder country `XXX` "Not specified" (ISO's user-assigned range XAA–XZZ). The source gives no nationality, so none is invented. | 1 rider |
| 3 | No stage ID in the source | `stage_id` = 1–21 in date order. Rest days (15 and 21 July) get no number, so dates are not consecutive. This numbering matches `exits.csv` exactly. | 21 stages |
| 4 | Stage attributes repeated on every result row | Extracted once per stage into STAGE and LOCATION. Checked first that each day has one consistent set of values. | 3,602 → 21 |
| 5 | Team country repeated on every rider row (transitive dependency) | Moved to TEAM. Checked that each team has exactly one country. | 184 → 23 |
| 6 | Rider name and team repeated in results; name repeated in exits | Checked that all agree with `riders.csv`, then dropped | 3,602 + 24 |
| 7 | Country names repeated in every file | Moved to COUNTRY. Checked that each code has exactly one name. | — |
| 8 | Adjusted time | Not stored (derived attribute in Task 2). Compute it as `finish_time - time_bonus + time_penalty`. | — |

These checks found nothing to fix: no duplicate rows, no stray or double spaces, no empty cells (other than the `NULL` above), no near-duplicate names (accent- and case-insensitive) among locations, teams or riders, all dates valid, all numbers non-negative integers, and all text in Unicode NFC.

## ⚠ Conflict with the Task 2 schema: stages 1, 5 and 11

Task 2 declares `CHECK (start_location <> finish_location)`, but three real stages start and finish in the same place:

| stage_id | Route | Type |
|---:|---|---|
| 1 | Lille Métropole → Lille Métropole | flat |
| 5 | Caen → Caen | individual time-trial |
| 11 | Toulouse → Toulouse | flat |

If the CHECK is enforced, these 3 stages are rejected, and so are their **533 results** and **4 exits** (riders 64 and 154 left at stage 1; riders 185 and 213 left at stage 5). The race would then be missing three stages and the GC would be wrong.

The data is left as it is, because renaming one end of the route (such as "Lille Métropole (finish)") would invent a location. **When creating the database for Task 3/4, leave out this one CHECK** and mention it in the final report as a conflict between the brief and the real race data. The graded Task 2 document does not need to change.

Also check the `rank` CHECK in `BT5110_Task2_Group31_SQLcode.sql`. The Task 2 report says "rank is greater than 1", which would reject all 21 stage winners. The data needs `rank >= 1`.

## Data quirks kept as-is (not errors)

- **Rank isn't always in time order** (12 rows on stages 1, 17 and 21). `rank` is the order riders crossed the line; `finish_time` is the time credited to them. Credited times can be equalised for incidents near the finish or neutralised, so a rider can cross later with an equal or lower time. Use `rank` for placings (top 10, winner) and time for gaps.
- **Tie on stage 13.** Riders 23 and 197 share rank 108, and the next rank is 110.
- **Stage 8.** The winner (rank 1, Jonathan Milan, bib 81) has a 10 s penalty, so the lowest adjusted time that day belongs to rank 2 (Wout Van Aert, bib 17), who got the 6 s bonus.
- **Bonuses** are 10/6/4 s for ranks 1–3 on every stage except the two time trials (stages 5 and 13). Penalties occur on 4 rows.
- **Exit reasons** are `DNS` (12) and `withdrawal` (12), kept exactly as in the source. For both, the rider has no result from `exit_stage` onwards. Riders 64 and 154 exited at stage 1, so they appear in RIDER with no results at all.
- **160 riders finished all 21 stages.** Rank GC only on riders with a result for every stage counted. Otherwise riders who left early have the lowest totals and appear at the top.
- All 39 locations are in France. The dates are from the 2025 Tour.

## Validation performed

| Check | Result |
|---|---|
| Primary keys unique, no NULL or empty values in any table | pass |
| All 10 foreign keys between these seven tables resolve | pass |
| `country_code` is three uppercase letters; `type` ∈ {flat, hilly, mountain, individual time-trial} | pass |
| `finish_time`, `time_bonus`, `time_penalty` ≥ 0; `rank` ≥ 1 | pass |
| Every team has ≥ 1 rider (trigger) | pass (8 per team) |
| Every location is used as a start or finish (trigger) | pass |
| No result at or after a rider's exit stage (trigger) | pass |
| Every rider with fewer than 21 results has an exit, and their results are stages 1 … S−1 with no gaps | pass |
| Row counts match the source (184 riders, 3,602 results, 24 exits); total adjusted time unchanged | pass |
| Test load into an in-memory SQLite copy of the schema | all 3,923 rows load without the loop-stage CHECK; with it, see the section above |
| GC from cleaned data | Pogacar 277,349 s; Vingegaard +264 s; Lipowitz +660 s |

## Loading into PostgreSQL

Run from `psql` inside `data/cleaned/`, in this order (foreign keys), in one transaction so the cross-table triggers see complete data. Adjust the column lists if names in the `.sql` file differ from the Task 2 report.

```sql
BEGIN;
\copy country(country_code, country_name) FROM 'country.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy team(team_name, team_country) FROM 'team.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy rider(bib_number, rider_name, dob, rider_team, rider_country) FROM 'rider.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy location(location_name, location_country) FROM 'location.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy stage(stage_id, date, distance, type, start_location, finish_location) FROM 'stage.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy result(bib_number, stage_id, finish_time, rank, time_bonus, time_penalty) FROM 'result.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy exit(bib_number, exit_stage, reason) FROM 'exit.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
COMMIT;
```

If the "team has at least one rider" or "location is used by a stage" triggers fire per row rather than at commit, TEAM and LOCATION rows will be rejected before their riders or stages exist. Make those triggers `DEFERRABLE INITIALLY DEFERRED`, or disable them during the load and run the checks afterwards.
