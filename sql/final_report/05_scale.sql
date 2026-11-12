-- BT5110 Project, Group 31. Task 4: larger test databases for the response time comparison.
-- Run in a database that already holds the 2025 race (01 and 02), with the number of
-- copies in the psql variable k:   psql -d tdf_k100 -v k=100 -f sql/final_report/05_scale.sql
--
-- The race is copied k - 1 times. Copy e has its own teams (name with the suffix
-- ' #e'), riders (bib number + 1000 * e), stages (stage id + 100 * e), results and
-- exits. Countries and locations are shared. All times, ranks, dates and exits are
-- the real values, so each copy is the 2025 race again. The triggers are switched off
-- during the copy, because the copies are consistent by construction.

ALTER TABLE team   DISABLE TRIGGER USER;
ALTER TABLE rider  DISABLE TRIGGER USER;
ALTER TABLE stage  DISABLE TRIGGER USER;
ALTER TABLE result DISABLE TRIGGER USER;
ALTER TABLE exit   DISABLE TRIGGER USER;

BEGIN;

INSERT INTO team (team_name, team_country)
SELECT t.team_name || ' #' || e, t.team_country
FROM team t, generate_series(1, :k - 1) AS e;

INSERT INTO rider (bib_number, rider_name, dob, rider_team, rider_country)
SELECT r.bib_number + 1000 * e, r.rider_name, r.dob, r.rider_team || ' #' || e, r.rider_country
FROM rider r, generate_series(1, :k - 1) AS e
WHERE r.bib_number < 1000;

INSERT INTO stage (stage_id, date, distance, type, start_location, finish_location)
SELECT s.stage_id + 100 * e, s.date, s.distance, s.type, s.start_location, s.finish_location
FROM stage s, generate_series(1, :k - 1) AS e
WHERE s.stage_id < 100;

INSERT INTO result (bib_number, stage_id, finish_time, rank, time_bonus, time_penalty)
SELECT x.bib_number + 1000 * e, x.stage_id + 100 * e, x.finish_time, x.rank, x.time_bonus, x.time_penalty
FROM result x, generate_series(1, :k - 1) AS e
WHERE x.bib_number < 1000;

INSERT INTO exit (bib_number, exit_stage, reason)
SELECT x.bib_number + 1000 * e, x.exit_stage + 100 * e, x.reason
FROM exit x, generate_series(1, :k - 1) AS e
WHERE x.bib_number < 1000;

COMMIT;

ALTER TABLE team   ENABLE TRIGGER USER;
ALTER TABLE rider  ENABLE TRIGGER USER;
ALTER TABLE stage  ENABLE TRIGGER USER;
ALTER TABLE result ENABLE TRIGGER USER;
ALTER TABLE exit   ENABLE TRIGGER USER;

ANALYZE;
