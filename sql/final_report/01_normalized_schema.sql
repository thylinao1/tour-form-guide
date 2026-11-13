-- BT5110 Project, Group 31. Task 4, final version of the relational schema of Task 2.
-- PostgreSQL 18. Run inside the target database:  psql -d tdf -f sql/final_report/01_normalized_schema.sql
--
-- Changes against the SQL file submitted for Task 2 (each is marked "CHANGE" below):
--   (1) CLASSIFICATION_AWARD records who can receive the award (recipient_type), and WIN
--       and EARN check it with a composite foreign key.
--   (2) The CHECK (start_location <> finish_location) on STAGE is removed, because three
--       stages of the 2025 race start and finish in the same town.
--   (3) The UNIQUE (stage_id, rank) on RESULT is removed, because two riders share
--       rank 108 on stage 13.

DROP VIEW  IF EXISTS result_adjusted;
DROP TABLE IF EXISTS result, exit, earn, win, classification_award,
                     stage, location, rider, team, country CASCADE;
DROP FUNCTION IF EXISTS check_team_has_rider, check_location_is_used,
                        check_no_result_after_exit CASCADE;

-- Entity set country.
CREATE TABLE country (
    country_code CHAR(3) PRIMARY KEY,
    country_name TEXT NOT NULL,
    -- The CHECK tests the format only: three capital letters, as in ISO 3166-1 alpha-3.
    -- The data preparation maps the source codes to ISO codes. XXX stands for Not specified.
    CHECK (country_code ~ '^[A-Z]{3}$')
);

-- Entity set team. The foreign key represents the relationship set based in.
CREATE TABLE team (
    team_name    TEXT PRIMARY KEY,
    team_country CHAR(3) NOT NULL REFERENCES country (country_code)
);

-- Entity set rider. The foreign keys represent the relationship sets belong to and represent.
CREATE TABLE rider (
    bib_number    INTEGER PRIMARY KEY,
    rider_name    TEXT NOT NULL,
    dob           DATE NOT NULL,
    rider_team    TEXT NOT NULL REFERENCES team (team_name),
    rider_country CHAR(3) NOT NULL REFERENCES country (country_code)
);

-- Entity set location. The foreign key represents the relationship set located in.
CREATE TABLE location (
    location_name    TEXT PRIMARY KEY,
    location_country CHAR(3) NOT NULL REFERENCES country (country_code)
);

-- Entity set stage. The foreign keys represent the relationship sets start at and finish at.
-- CHANGE (2): no CHECK (start_location <> finish_location). Stages 1, 5 and 11 of the
-- 2025 race start and finish in the same town.
CREATE TABLE stage (
    stage_id        INTEGER PRIMARY KEY,
    date            DATE NOT NULL,
    distance        NUMERIC NOT NULL,
    type            TEXT NOT NULL,
    start_location  TEXT NOT NULL REFERENCES location (location_name),
    finish_location TEXT NOT NULL REFERENCES location (location_name),
    -- the four stage types.
    CHECK (type IN ('flat', 'hilly', 'mountain', 'individual time-trial'))
);

-- Entity set classification/award.
-- CHANGE (1): recipient_type states whether the award is given to a rider or to a team.
-- The pair (award_name, recipient_type) is declared UNIQUE so that WIN and EARN can
-- reference it. award_name is the primary key, so each award has exactly one type.
CREATE TABLE classification_award (
    award_name     TEXT PRIMARY KEY,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('rider', 'team')),
    UNIQUE (award_name, recipient_type)
);

-- Relationship set win: classification/award (0,1), rider (0,n). The primary key allows
-- at most one row for each classification/award.
-- CHANGE (1): recipient_type is fixed to 'rider' and the composite foreign key requires
-- the award to have that type. A team award cannot be stored in WIN.
CREATE TABLE win (
    award_name     TEXT PRIMARY KEY,
    recipient_type TEXT NOT NULL DEFAULT 'rider' CHECK (recipient_type = 'rider'),
    winner_bib     INTEGER NOT NULL REFERENCES rider (bib_number),
    FOREIGN KEY (award_name, recipient_type)
        REFERENCES classification_award (award_name, recipient_type)
);

-- Relationship set earn: classification/award (0,1), team (0,n).
-- CHANGE (1): recipient_type is fixed to 'team'. A rider award cannot be stored in EARN.
-- An award has one type, so it can never appear in both WIN and EARN.
CREATE TABLE earn (
    award_name     TEXT PRIMARY KEY,
    recipient_type TEXT NOT NULL DEFAULT 'team' CHECK (recipient_type = 'team'),
    earner_team    TEXT NOT NULL REFERENCES team (team_name),
    FOREIGN KEY (award_name, recipient_type)
        REFERENCES classification_award (award_name, recipient_type)
);

-- Relationship set exit: rider (0,1), stage (0,n). The primary key allows at most one
-- row for each rider.
CREATE TABLE exit (
    bib_number INTEGER PRIMARY KEY REFERENCES rider (bib_number),
    exit_stage INTEGER NOT NULL REFERENCES stage (stage_id),
    reason     TEXT NOT NULL
);

-- Relationship set result: rider (0,n), stage (0,n). The derived attribute adjusted
-- time is not stored (see the view result_adjusted).
-- CHANGE (3): no UNIQUE (stage_id, rank). Two riders share rank 108 on stage 13.
CREATE TABLE result (
    bib_number   INTEGER NOT NULL REFERENCES rider (bib_number),
    stage_id     INTEGER NOT NULL REFERENCES stage (stage_id),
    finish_time  INTEGER NOT NULL CHECK (finish_time > 0),
    rank         INTEGER NOT NULL CHECK (rank >= 1),
    time_bonus   INTEGER NOT NULL DEFAULT 0 CHECK (time_bonus >= 0),
    time_penalty INTEGER NOT NULL DEFAULT 0 CHECK (time_penalty >= 0),
    PRIMARY KEY (bib_number, stage_id)
);

-- ER diagram: team is (1,n) in belong to, so every team has at least one rider.
CREATE FUNCTION check_team_has_rider() RETURNS trigger AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM team
               WHERE NOT EXISTS (SELECT 1 FROM rider
                                 WHERE rider.rider_team = team.team_name)) THEN
        RAISE EXCEPTION 'every team must have at least one rider';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Checked at the end of the transaction, so that a team and its first rider can be
-- inserted together.
CREATE CONSTRAINT TRIGGER team_has_rider
    AFTER INSERT ON team
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_team_has_rider();

-- Checked again when a rider is deleted or moved to another team.
CREATE CONSTRAINT TRIGGER rider_leaves_team
    AFTER DELETE OR UPDATE OF rider_team ON rider
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_team_has_rider();

-- Only locations that are the start or the finish of at least one stage are stored.
CREATE FUNCTION check_location_is_used() RETURNS trigger AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM location
               WHERE NOT EXISTS (SELECT 1 FROM stage
                                 WHERE location.location_name
                                       IN (stage.start_location,
                                           stage.finish_location))) THEN
        RAISE EXCEPTION 'every location must be used by at least one stage';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Checked at the end of the transaction, so that a location and the first stage that
-- uses it can be inserted together.
CREATE CONSTRAINT TRIGGER location_is_used
    AFTER INSERT ON location
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_location_is_used();

-- Checked again when a stage is deleted or its locations are changed.
CREATE CONSTRAINT TRIGGER stage_leaves_location
    AFTER DELETE OR UPDATE OF start_location, finish_location ON stage
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_location_is_used();

-- If a rider exits at stage S, no result exists for that rider from stage S onwards.
-- The order of the stages is taken from the stage date.
CREATE FUNCTION check_no_result_after_exit() RETURNS trigger AS $$
BEGIN
    IF EXISTS (SELECT 1
               FROM exit
               JOIN stage AS exit_stage ON exit_stage.stage_id = exit.exit_stage
               JOIN result ON result.bib_number = exit.bib_number
               JOIN stage AS result_stage ON result_stage.stage_id = result.stage_id
               WHERE result_stage.date >= exit_stage.date) THEN
        RAISE EXCEPTION 'a rider has no result from the exit stage onwards';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- The rule is checked whenever a result, an exit or a stage date changes.
CREATE TRIGGER result_respects_exit
    AFTER INSERT OR UPDATE ON result
    FOR EACH STATEMENT EXECUTE FUNCTION check_no_result_after_exit();

CREATE TRIGGER exit_respects_results
    AFTER INSERT OR UPDATE ON exit
    FOR EACH STATEMENT EXECUTE FUNCTION check_no_result_after_exit();

CREATE TRIGGER stage_date_respects_exit
    AFTER UPDATE OF date ON stage
    FOR EACH STATEMENT EXECUTE FUNCTION check_no_result_after_exit();

-- adjusted time = finish time - time bonus + time penalty. The attribute is derived, so
-- it is computed by a view and not stored.
CREATE VIEW result_adjusted AS
    SELECT bib_number, stage_id,
           finish_time - time_bonus + time_penalty AS adjusted_time
    FROM result;
