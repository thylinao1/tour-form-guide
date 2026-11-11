-- =====================================================================================
-- 02_load.sql
-- Loads the cleaned CSV files (one per Task 2 table, made by tools/clean_data.py) into the
-- schema of 01_normalized_schema.sql, then seeds the five classification awards.
-- Paths are relative to the repository root. Order follows the foreign keys.
-- =====================================================================================

INSERT INTO country  SELECT country_code, country_name
                     FROM read_csv('data/cleaned/country.csv',  header = true, all_varchar = true);
INSERT INTO team     SELECT team_name, team_country
                     FROM read_csv('data/cleaned/team.csv',     header = true, all_varchar = true);
INSERT INTO rider    SELECT CAST(bib_number AS INTEGER), rider_name, CAST(dob AS DATE),
                            rider_team, rider_country
                     FROM read_csv('data/cleaned/rider.csv',    header = true, all_varchar = true);
INSERT INTO location SELECT location_name, location_country
                     FROM read_csv('data/cleaned/location.csv', header = true, all_varchar = true);
INSERT INTO stage    SELECT CAST(stage_id AS INTEGER), CAST(date AS DATE),
                            CAST(distance AS DECIMAL(5,1)), type, start_location, finish_location
                     FROM read_csv('data/cleaned/stage.csv',    header = true, all_varchar = true);
INSERT INTO result   SELECT CAST(bib_number AS INTEGER), CAST(stage_id AS INTEGER),
                            CAST(finish_time AS INTEGER), CAST(rank AS INTEGER),
                            CAST(time_bonus AS INTEGER), CAST(time_penalty AS INTEGER)
                     FROM read_csv('data/cleaned/result.csv',   header = true, all_varchar = true);
INSERT INTO exit     SELECT CAST(bib_number AS INTEGER), CAST(exit_stage AS INTEGER), reason
                     FROM read_csv('data/cleaned/exit.csv',     header = true, all_varchar = true);

-- The source files hold no award data. The five 2025 winners below match
-- data/official/official_classifications_2025.csv (rank 1 of gc, points, kom, young, team)
-- and the results computed from data/cleaned (see 04_functions_e1_e15.sql, E1 and E3).
INSERT INTO classification_award (award_name, recipient_type) VALUES
    ('General Classification', 'rider'),   -- yellow jersey: lowest total time
    ('Points',                 'rider'),   -- green jersey: most points
    ('Mountains',              'rider'),   -- polka dot jersey: most climbing points
    ('Young Rider',            'rider'),   -- white jersey: best overall rider born on or after 1 Jan 2000
    ('Best Team',              'team');    -- team classification: three best times per stage

INSERT INTO win (award_name, recipient_type, winner_bib) VALUES
    ('General Classification', 'rider', 1),    -- Tadej Pogacar
    ('Points',                 'rider', 81),   -- Jonathan Milan
    ('Mountains',              'rider', 1),    -- Tadej Pogacar
    ('Young Rider',            'rider', 72);   -- Florian Lipowitz

INSERT INTO earn (award_name, recipient_type, earner_team) VALUES
    ('Best Team', 'team', 'TEAM VISMA | LEASE A BIKE');
