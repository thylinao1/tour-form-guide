-- BT5110 Project, Group 31. Loads the cleaned 2025 race data into the relational schema.
-- Run from the project root:  psql -d tdf -f sql/final_report/02_load.sql
-- One transaction: the deferred constraint triggers (every team has a rider, every
-- location is used by a stage) are checked at COMMIT, after all tables are loaded.

BEGIN;

\copy country  (country_code, country_name)                        FROM 'data/cleaned/country.csv'  WITH (FORMAT csv, HEADER true)
\copy team     (team_name, team_country)                           FROM 'data/cleaned/team.csv'     WITH (FORMAT csv, HEADER true)
\copy rider    (bib_number, rider_name, dob, rider_team, rider_country) FROM 'data/cleaned/rider.csv' WITH (FORMAT csv, HEADER true)
\copy location (location_name, location_country)                   FROM 'data/cleaned/location.csv' WITH (FORMAT csv, HEADER true)
\copy stage    (stage_id, date, distance, type, start_location, finish_location) FROM 'data/cleaned/stage.csv' WITH (FORMAT csv, HEADER true)
\copy result   (bib_number, stage_id, finish_time, rank, time_bonus, time_penalty) FROM 'data/cleaned/result.csv' WITH (FORMAT csv, HEADER true)
\copy exit     (bib_number, exit_stage, reason)                    FROM 'data/cleaned/exit.csv'     WITH (FORMAT csv, HEADER true)

-- The course data files hold no award data. The five awards of the 2025 race are
-- entered here. The winners agree with the results computed from the data
-- (General Classification, Young Rider, Best Team) and with the published standings
-- (Points, Mountains).
INSERT INTO classification_award (award_name, recipient_type) VALUES
    ('General Classification', 'rider'),
    ('Points',                 'rider'),
    ('Mountains',              'rider'),
    ('Young Rider',            'rider'),
    ('Best Team',              'team');

INSERT INTO win (award_name, winner_bib) VALUES
    ('General Classification', 1),     -- Tadej Pogacar
    ('Points',                 81),    -- Jonathan Milan
    ('Mountains',              1),     -- Tadej Pogacar
    ('Young Rider',            72);    -- Florian Lipowitz

INSERT INTO earn (award_name, earner_team) VALUES
    ('Best Team', 'TEAM VISMA | LEASE A BIKE');

COMMIT;

ANALYZE;
