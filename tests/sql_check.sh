#!/bin/bash
# Runs sql/01 to sql/04 in one in-memory DuckDB session and checks key results.
# Prints one PASS or FAIL line per check and exits 1 if any check fails.
# Usage (from anywhere): tests/sql_check.sh
set -u
cd "$(dirname "$0")/.."
command -v duckdb >/dev/null || { echo "FAIL duckdb is not installed"; exit 1; }

check() {  # check "<label>" "<SQL returning one boolean>"
  local q="'"; local label="${1//$q/$q$q}"   # double any quote inside the label for SQL
  printf "SELECT CASE WHEN (%s) THEN 'PASS %s' ELSE 'FAIL %s' END;\n" "$2" "$label" "$label"
}

SCRIPT=$(cat <<SQL
.bail off
.output /dev/null
.read sql/01_normalized_schema.sql
.read sql/02_load.sql
.read sql/03_star_schema.sql
.read sql/04_functions_e1_e15.sql
.output
$(check "row counts: 184 riders, 23 teams, 21 stages, 3602 results, 24 exits" \
  "(SELECT COUNT(*) FROM rider) = 184 AND (SELECT COUNT(*) FROM team) = 23 AND (SELECT COUNT(*) FROM stage) = 21 AND (SELECT COUNT(*) FROM result) = 3602 AND (SELECT COUNT(*) FROM exit) = 24")
$(check "fact table has one row per result (3602)" "(SELECT COUNT(*) FROM fact_results) = 3602")
$(check "every team has 8 riders" "(SELECT MIN(n) = 8 AND MAX(n) = 8 FROM (SELECT COUNT(*) n FROM rider GROUP BY rider_team))")
$(check "every location is a start or finish (trigger rule)" \
  "NOT EXISTS (SELECT 1 FROM location l WHERE l.location_name NOT IN (SELECT start_location FROM stage UNION SELECT finish_location FROM stage))")
$(check "no result from a rider's exit stage onwards (trigger rule)" \
  "NOT EXISTS (SELECT 1 FROM result x JOIN exit e USING (bib_number) WHERE x.stage_id >= e.exit_stage)")
$(check "GC: 160 ranked riders" \
  "(SELECT COUNT(*) FROM (SELECT rider_key FROM fact_results GROUP BY rider_key HAVING COUNT(*) = 21)) = 160")
$(check "GC winner is bib 1 with 277349 s" \
  "(SELECT rider_key = 1 AND t = 277349 FROM (SELECT rider_key, SUM(adjusted_time) t FROM fact_results GROUP BY rider_key HAVING COUNT(*) = 21 ORDER BY t LIMIT 1))")
$(check "GC: Vingegaard +264 s, Lipowitz +660 s" \
  "(SELECT SUM(adjusted_time) FROM fact_results WHERE rider_key = 11) - 277349 = 264 AND (SELECT SUM(adjusted_time) FROM fact_results WHERE rider_key = 72) - 277349 = 660")
$(check "team classification winner is Visma with 835292 s" \
  "(SELECT team_key = 'TEAM VISMA | LEASE A BIKE' AND t = 835292 FROM (SELECT team_key, SUM(finish_time) t FROM (SELECT team_key, finish_time, ROW_NUMBER() OVER (PARTITION BY team_key, stage_key ORDER BY finish_time) n FROM fact_results) WHERE n <= 3 GROUP BY team_key ORDER BY t LIMIT 1))")
$(check "E3 rollup: Visma counted time is 835292 s and Vingegaard supplied 21 stages, 277647 s" \
  "(SELECT SUM(finish_time) = 835292 FROM (SELECT team_key, finish_time, ROW_NUMBER() OVER (PARTITION BY team_key, stage_key ORDER BY finish_time, rider_key) n FROM fact_results) WHERE n <= 3 AND team_key = 'TEAM VISMA | LEASE A BIKE') AND (SELECT COUNT(*) = 21 AND SUM(f.finish_time) = 277647 FROM (SELECT team_key, rider_key, finish_time, ROW_NUMBER() OVER (PARTITION BY team_key, stage_key ORDER BY finish_time, rider_key) n FROM fact_results) f JOIN dim_rider r USING (rider_key) WHERE n <= 3 AND r.rider_name LIKE '%Vingegaard%')")
$(check "FRA has 38 riders and 5 teams; BEL 29 riders and 4 teams; NLD 13 riders" \
  "(SELECT COUNT(*) FROM dim_rider WHERE country_key = 'FRA') = 38 AND (SELECT COUNT(*) FROM dim_team WHERE team_country_key = 'FRA') = 5 AND (SELECT COUNT(*) FROM dim_rider WHERE country_key = 'BEL') = 29 AND (SELECT COUNT(*) FROM dim_team WHERE team_country_key = 'BEL') = 4 AND (SELECT COUNT(*) FROM dim_rider WHERE country_key = 'NLD') = 13")
$(check "longest stage is stage 2 (209.1 km, hilly)" \
  "(SELECT stage_key = 2 AND distance_km = 209.1 AND terrain = 'hilly' FROM dim_stage ORDER BY distance_km DESC LIMIT 1)")
$(check "time trials are stages 5 and 13" \
  "(SELECT LIST(stage_key ORDER BY stage_key) FROM dim_stage WHERE is_time_trial) = [5, 13]")
$(check "Pogacar has 13 top ten stage finishes" "(SELECT COUNT(*) FROM fact_results WHERE rider_key = 1 AND is_top10) = 13")
$(check "loop stages 1, 5 and 11 are loaded (no start <> finish CHECK)" \
  "(SELECT COUNT(*) FROM stage WHERE start_location = finish_location AND stage_id IN (1, 5, 11)) = 3")
$(check "stage 13 dead heat at rank 108 is loaded (no UNIQUE stage, rank)" \
  "(SELECT COUNT(*) FROM result WHERE stage_id = 13 AND rank = 108) = 2")
$(check "stage winners load (rank >= 1)" "(SELECT COUNT(*) FROM result WHERE rank = 1) = 21")
INSERT INTO win  (award_name, recipient_type, winner_bib)  VALUES ('Best Team', 'rider', 11);
INSERT INTO win  (award_name, winner_bib)                  VALUES ('Best Team', 11);
INSERT INTO earn (award_name, recipient_type, earner_team) VALUES ('Points', 'team', 'LIDL-TREK');
INSERT INTO earn (award_name, earner_team)                 VALUES ('Points', 'LIDL-TREK');
INSERT INTO earn (award_name, recipient_type, earner_team) VALUES ('Best Team', 'rider', 'LIDL-TREK');
$(check "a team award ('Best Team') cannot be inserted into WIN" "(SELECT COUNT(*) FROM win WHERE award_name = 'Best Team') = 0")
$(check "a rider award ('Points') cannot be inserted into EARN" "(SELECT COUNT(*) FROM earn WHERE award_name = 'Points') = 0")
$(check "EARN only accepts recipient_type 'team'" "(SELECT COUNT(*) FROM earn) = 1")
$(check "awards seeded: 4 rider awards in WIN, 1 team award in EARN" \
  "(SELECT COUNT(*) FROM win) = 4 AND (SELECT earner_team FROM earn WHERE award_name = 'Best Team') = 'TEAM VISMA | LEASE A BIKE'")
SQL
)

OUT=$(printf '%s\n' "$SCRIPT" | duckdb -noheader -list :memory: 2>&1)
REJECTED=$(printf '%s\n' "$OUT" | grep -c -E '^(Constraint|Binder) Error')
printf '%s\n' "$OUT" | grep -E '^(PASS|FAIL)'
if [ "$REJECTED" -ge 5 ]; then echo "PASS all 5 wrong award inserts were rejected by a constraint"; else echo "FAIL only $REJECTED of 5 wrong award inserts were rejected"; fi
OTHER=$(printf '%s\n' "$OUT" | grep -v -E '^(PASS|FAIL)' | grep -v -E '^(Constraint|Binder) Error' | grep -v '^\s*$' | grep -v -E '^(INSERT|LINE|\s*\^)' )
[ -n "$OTHER" ] && { echo "FAIL unexpected output:"; printf '%s\n' "$OTHER" | head -20; }
if printf '%s\n' "$OUT" | grep -q '^FAIL' || [ "$REJECTED" -lt 5 ] || [ -n "$OTHER" ]; then exit 1; fi
echo "ALL SQL CHECKS PASSED"
