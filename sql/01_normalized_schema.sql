-- =====================================================================================
-- 01_normalized_schema.sql
-- BT5110 Group 31. The relational schema (10 tables), as used by the dashboard.
-- Runs in DuckDB and reads as standard PostgreSQL. Run from the repository root:
--     duckdb -c ".read sql/01_normalized_schema.sql"
--
-- Four design points, each marked "NOTE" below:
--   (i)   WIN and EARN: an award records who can receive it
--         (recipient_type 'rider' or 'team'), so a team award cannot go to a rider and
--         no award can sit in both WIN and EARN;
--   (ii)  rank >= 1 (a stage winner has rank 1);
--   (iii) no CHECK start_location <> finish_location (stages 1, 5 and 11 start and
--         finish in the same town: Lille Metropole, Caen and Toulouse);
--   (iv)  no UNIQUE (stage_id, rank) (stage 13 has a dead heat: riders 23 and 197 share
--         rank 108).
--
-- Cross-table rules (every team has a rider, every location is used by a
-- stage, no result from the exit stage onwards) need triggers. DuckDB has no triggers,
-- so the PostgreSQL trigger code is kept in a comment at the end of this file and the
-- same rules are checked as queries in tests/sql_check.sh.
-- =====================================================================================

DROP VIEW  IF EXISTS result_adjusted;
DROP TABLE IF EXISTS result;
DROP TABLE IF EXISTS exit;
DROP TABLE IF EXISTS earn;
DROP TABLE IF EXISTS win;
DROP TABLE IF EXISTS classification_award;
DROP TABLE IF EXISTS stage;
DROP TABLE IF EXISTS location;
DROP TABLE IF EXISTS rider;
DROP TABLE IF EXISTS team;
DROP TABLE IF EXISTS country;

-- COUNTRY: three letter ISO 3166-1 alpha-3 code. 'XXX' (ISO user range) marks the one
-- rider whose nationality is missing in the source data.
CREATE TABLE country (
    country_code  CHAR(3)      PRIMARY KEY
                  CHECK (country_code SIMILAR TO '[A-Z]{3}'),
    country_name  VARCHAR(100) NOT NULL
);

-- TEAM: entity set; "based in" (team is (1,1)) becomes the NOT NULL foreign key.
CREATE TABLE team (
    team_name     VARCHAR(100) PRIMARY KEY,
    team_country  CHAR(3)      NOT NULL REFERENCES country (country_code)
);

-- RIDER: "belong to" and "represent" (rider is (1,1)) become NOT NULL foreign keys.
CREATE TABLE rider (
    bib_number    INTEGER      PRIMARY KEY,
    rider_name    VARCHAR(100) NOT NULL,
    dob           DATE         NOT NULL,
    rider_team    VARCHAR(100) NOT NULL REFERENCES team (team_name),
    rider_country CHAR(3)      NOT NULL REFERENCES country (country_code)
);

-- LOCATION: a start or finish town.
CREATE TABLE location (
    location_name    VARCHAR(100) PRIMARY KEY,
    location_country CHAR(3)      NOT NULL REFERENCES country (country_code)
);

-- STAGE: "start at" and "finish at" (stage is (1,1)) become NOT NULL foreign keys.
-- NOTE (iii): no CHECK (start_location <> finish_location). Stages 1, 5 and 11
-- are loops that start and finish in the same town; the check would reject them,
-- their 533 results and 4 exits.
CREATE TABLE stage (
    stage_id        INTEGER      PRIMARY KEY,
    date            DATE         NOT NULL,
    distance        DECIMAL(5,1) NOT NULL CHECK (distance > 0),
    type            VARCHAR(30)  NOT NULL
                    CHECK (type IN ('flat', 'hilly', 'mountain', 'individual time-trial')),
    start_location  VARCHAR(100) NOT NULL REFERENCES location (location_name),
    finish_location VARCHAR(100) NOT NULL REFERENCES location (location_name)
);

-- CLASSIFICATION_AWARD
-- NOTE (i): recipient_type says whether the award goes to a rider or a team.
-- UNIQUE (award_name, recipient_type) is the target of the composite foreign keys in
-- WIN and EARN below. Because award_name is also the primary key, each award has
-- exactly one recipient type.
CREATE TABLE classification_award (
    award_name     VARCHAR(50) PRIMARY KEY,
    recipient_type VARCHAR(5)  NOT NULL CHECK (recipient_type IN ('rider', 'team')),
    UNIQUE (award_name, recipient_type)
);

-- WIN: award won by a rider. Primary key award_name keeps the (0,1) maximum.
-- NOTE (i): recipient_type is fixed to 'rider' and the pair references the award,
-- so a team award (such as 'Best Team') cannot be inserted here.
CREATE TABLE win (
    award_name     VARCHAR(50) PRIMARY KEY,
    recipient_type VARCHAR(5)  NOT NULL DEFAULT 'rider' CHECK (recipient_type = 'rider'),
    winner_bib     INTEGER     NOT NULL REFERENCES rider (bib_number),
    FOREIGN KEY (award_name, recipient_type)
        REFERENCES classification_award (award_name, recipient_type)
);

-- EARN: award earned by a team. Same idea with recipient_type fixed to 'team', so a
-- rider award cannot be inserted here and no award can be in both WIN and EARN.
CREATE TABLE earn (
    award_name     VARCHAR(50)  PRIMARY KEY,
    recipient_type VARCHAR(5)   NOT NULL DEFAULT 'team' CHECK (recipient_type = 'team'),
    earner_team    VARCHAR(100) NOT NULL REFERENCES team (team_name),
    FOREIGN KEY (award_name, recipient_type)
        REFERENCES classification_award (award_name, recipient_type)
);

-- EXIT: a rider leaves the race at most once (primary key bib_number).
CREATE TABLE exit (
    bib_number  INTEGER     PRIMARY KEY REFERENCES rider (bib_number),
    exit_stage  INTEGER     NOT NULL REFERENCES stage (stage_id),
    reason      VARCHAR(30) NOT NULL
);

-- RESULT: the many-to-many relationship between rider and stage.
-- NOTE (ii): rank >= 1, so a stage winner (rank 1) is allowed.
-- NOTE (iv): no UNIQUE (stage_id, rank); stage 13 has two riders at rank 108.
CREATE TABLE result (
    bib_number   INTEGER NOT NULL REFERENCES rider (bib_number),
    stage_id     INTEGER NOT NULL REFERENCES stage (stage_id),
    finish_time  INTEGER NOT NULL CHECK (finish_time  >= 0),   -- seconds
    rank         INTEGER NOT NULL CHECK (rank         >= 1),
    time_bonus   INTEGER NOT NULL CHECK (time_bonus   >= 0),   -- seconds
    time_penalty INTEGER NOT NULL CHECK (time_penalty >= 0),   -- seconds
    PRIMARY KEY (bib_number, stage_id)
);

-- Derived attribute "adjusted time" is not stored; it is computed by this view.
CREATE VIEW result_adjusted AS
SELECT r.*,
       r.finish_time - r.time_bonus + r.time_penalty AS adjusted_time
FROM result r;

-- -------------------------------------------------------------------------------------
-- PostgreSQL only (DuckDB has no triggers). The three cross-table rules as triggers:
--
-- CREATE FUNCTION no_result_after_exit() RETURNS trigger AS $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM exit e
--              WHERE e.bib_number = NEW.bib_number AND NEW.stage_id >= e.exit_stage) THEN
--     RAISE EXCEPTION 'rider % has left the race before stage %', NEW.bib_number, NEW.stage_id;
--   END IF;
--   RETURN NEW;
-- END $$ LANGUAGE plpgsql;
-- CREATE TRIGGER result_after_exit BEFORE INSERT OR UPDATE ON result
--   FOR EACH ROW EXECUTE FUNCTION no_result_after_exit();
--
-- "Every team has a rider" and "every location is used by a stage" are written as
-- CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED, so they are checked at COMMIT,
-- after the riders and stages of the same transaction are loaded.
-- -------------------------------------------------------------------------------------
