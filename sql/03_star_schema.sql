-- =====================================================================================
-- 03_star_schema.sql
-- Star schema for the OLAP dashboard, built FROM the normalized tables of 01 and 02.
--
--   Grain of the fact table: one rider on one stage (one row of RESULT), 3,602 rows.
--
--                       dim_stage
--                           |
--        dim_rider ---- fact_results ---- dim_team
--                           |
--                       dim_country   (the rider's nationality)
--
-- The fact table carries all four dimension keys, so every query is one join per
-- dimension (a star, not a snowflake). Keys are the natural keys of the normalized
-- schema (bib number, stage number, team name, ISO code); they are short and stable.
-- =====================================================================================

DROP TABLE IF EXISTS fact_results;
DROP TABLE IF EXISTS dim_rider;
DROP TABLE IF EXISTS dim_team;
DROP TABLE IF EXISTS dim_stage;
DROP TABLE IF EXISTS dim_country;

-- Country dimension: one row per country (rider nationality and team base).
CREATE TABLE dim_country (
    country_key   CHAR(3)      PRIMARY KEY,
    country_name  VARCHAR(100) NOT NULL
);
INSERT INTO dim_country SELECT country_code, country_name FROM country;

-- Team dimension: the team's registered country is denormalized in (name and code).
CREATE TABLE dim_team (
    team_key          VARCHAR(100) PRIMARY KEY,
    team_country_key  CHAR(3)      NOT NULL REFERENCES dim_country (country_key),
    team_country_name VARCHAR(100) NOT NULL
);
INSERT INTO dim_team
SELECT t.team_name, t.team_country, c.country_name
FROM team t JOIN country c ON c.country_code = t.team_country;

-- Rider dimension: team and nationality denormalized in, plus attributes used to slice:
-- age at race start (5 July 2025), young rider flag (born on or after 1 January 2000,
-- the 2025 rule for the white jersey) and how the rider's race ended.
CREATE TABLE dim_rider (
    rider_key      INTEGER      PRIMARY KEY,           -- bib number
    rider_name     VARCHAR(100) NOT NULL,
    dob            DATE         NOT NULL,
    age_at_start   INTEGER      NOT NULL,
    is_young       BOOLEAN      NOT NULL,
    team_name      VARCHAR(100) NOT NULL,
    country_key    CHAR(3)      NOT NULL,
    country_name   VARCHAR(100) NOT NULL,
    exit_stage     INTEGER,                            -- NULL when the rider finished
    exit_reason    VARCHAR(30),
    finished       BOOLEAN      NOT NULL
);
INSERT INTO dim_rider
SELECT r.bib_number, r.rider_name, r.dob,
       date_part('year', age(DATE '2025-07-05', r.dob))::INTEGER,
       r.dob >= DATE '2000-01-01',
       r.rider_team, r.rider_country, c.country_name,
       e.exit_stage, e.reason, e.bib_number IS NULL
FROM rider r
JOIN country c    ON c.country_code = r.rider_country
LEFT JOIN exit e  ON e.bib_number = r.bib_number;

-- Stage dimension: route, terrain and a short terrain code (flat, hilly, mountain, itt).
CREATE TABLE dim_stage (
    stage_key        INTEGER      PRIMARY KEY,         -- stage number 1 to 21
    stage_date       DATE         NOT NULL,
    distance_km      DECIMAL(5,1) NOT NULL,
    stage_type       VARCHAR(30)  NOT NULL,
    terrain          VARCHAR(10)  NOT NULL,
    start_location   VARCHAR(100) NOT NULL,
    finish_location  VARCHAR(100) NOT NULL,
    is_mountain      BOOLEAN      NOT NULL,
    is_time_trial    BOOLEAN      NOT NULL
);
INSERT INTO dim_stage
SELECT s.stage_id, s.date, s.distance, s.type,
       CASE WHEN s.type = 'individual time-trial' THEN 'itt' ELSE s.type END,
       s.start_location, s.finish_location,
       s.type = 'mountain', s.type = 'individual time-trial'
FROM stage s;

-- Fact table: measures in seconds, plus flags that make counting a SUM or a FILTER.
CREATE TABLE fact_results (
    rider_key     INTEGER      NOT NULL REFERENCES dim_rider   (rider_key),
    stage_key     INTEGER      NOT NULL REFERENCES dim_stage   (stage_key),
    team_key      VARCHAR(100) NOT NULL REFERENCES dim_team    (team_key),
    country_key   CHAR(3)      NOT NULL REFERENCES dim_country (country_key),
    finish_time   INTEGER      NOT NULL,
    time_bonus    INTEGER      NOT NULL,
    time_penalty  INTEGER      NOT NULL,
    adjusted_time INTEGER      NOT NULL,   -- finish_time - time_bonus + time_penalty
    rank          INTEGER      NOT NULL,
    is_top10      BOOLEAN      NOT NULL,
    is_podium     BOOLEAN      NOT NULL,
    is_winner     BOOLEAN      NOT NULL,
    PRIMARY KEY (rider_key, stage_key)
);
INSERT INTO fact_results
SELECT ra.bib_number, ra.stage_id, r.rider_team, r.rider_country,
       ra.finish_time, ra.time_bonus, ra.time_penalty, ra.adjusted_time, ra.rank,
       ra.rank <= 10, ra.rank <= 3, ra.rank = 1
FROM result_adjusted ra
JOIN rider r ON r.bib_number = ra.bib_number;
