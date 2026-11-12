-- BT5110 Project, Group 31. Task 4: indexes used in the comparison.
-- PostgreSQL creates an index for each primary key and UNIQUE constraint, but not for
-- a foreign key. Both schemas therefore receive an index on the foreign key columns
-- that the analytical queries use for joins and lookups.

-- Normalized schema.
CREATE INDEX IF NOT EXISTS rider_team_idx   ON rider (rider_team);
CREATE INDEX IF NOT EXISTS result_stage_idx ON result (stage_id);

-- Star schema. team_key is a column of the fact table, so one index can cover the
-- pair (team, stage), which the team classification needs.
CREATE INDEX IF NOT EXISTS fact_stage_idx      ON fact_results (stage_key);
CREATE INDEX IF NOT EXISTS fact_team_stage_idx ON fact_results (team_key, stage_key);

ANALYZE;
