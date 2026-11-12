-- BT5110 Project, Group 31. Task 4: tests of the revised award constraints and of the
-- three rules enforced by triggers. The database must reject each of the statements
-- T1 to T12. The last block is a valid new award and must be accepted.
-- Run:  psql -d tdf -f sql/final_report/06_constraint_tests.sql   (without ON_ERROR_STOP)

-- T1. A team award given to a rider.
INSERT INTO win (award_name, winner_bib) VALUES ('Best Team', 11);
-- T2. The same, with the type stated as 'team'.
INSERT INTO win (award_name, recipient_type, winner_bib) VALUES ('Best Team', 'team', 11);
-- T3. A rider award given to a team.
INSERT INTO earn (award_name, earner_team) VALUES ('General Classification', 'UAE TEAM EMIRATES XRG');
-- T4. The same, with the type stated as 'rider'.
INSERT INTO earn (award_name, recipient_type, earner_team) VALUES ('Points', 'rider', 'LIDL-TREK');
-- T5. An award that is already in WIN changes its type (it could then also be earned by a team).
UPDATE classification_award SET recipient_type = 'team' WHERE award_name = 'Points';
-- T6. An award with a type other than 'rider' or 'team'.
INSERT INTO classification_award (award_name, recipient_type) VALUES ('Combativity', 'both');
-- T7. A second winner of the same award.
INSERT INTO win (award_name, winner_bib) VALUES ('Points', 1);
-- T8. A row of WIN is changed to a team award.
UPDATE win SET award_name = 'Best Team' WHERE award_name = 'Young Rider';
-- T9. A row of EARN is changed to the type 'rider'.
UPDATE earn SET recipient_type = 'rider' WHERE award_name = 'Best Team';
-- T10. A team without a rider (trigger, checked at COMMIT).
BEGIN; INSERT INTO team (team_name, team_country) VALUES ('EMPTY TEAM', 'FRA'); COMMIT;
-- T11. A location that no stage uses (trigger, checked at COMMIT).
BEGIN; INSERT INTO location (location_name, location_country) VALUES ('Singapore', 'FRA'); COMMIT;
-- T12. A result after the exit of the rider (rider 64 left the race at stage 1).
INSERT INTO result (bib_number, stage_id, finish_time, rank) VALUES (64, 2, 17000, 200);

-- A valid new award: accepted. The two rows are then removed with ROLLBACK.
BEGIN;
INSERT INTO classification_award (award_name, recipient_type) VALUES ('Combativity', 'rider');
INSERT INTO win (award_name, winner_bib) VALUES ('Combativity', 1);
ROLLBACK;
