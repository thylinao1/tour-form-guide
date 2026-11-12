# SQL of the final report (PostgreSQL 18)

These files belong to the final report of BT5110 Group 31. They are the PostgreSQL version of the project database. The files one level up (`sql/01` to `sql/05`) are the DuckDB version that is used to check the dashboard.

| File | What it does |
|---|---|
| `01_normalized_schema.sql` | The relational schema: 10 tables, keys, CHECK constraints, three trigger functions and the view for the adjusted time |
| `02_load.sql` | Loads `data/cleaned/*.csv` and enters the five awards of the 2025 race |
| `03_star_schema.sql` | Star schema with surrogate keys: `fact_results` and `dim_rider`, `dim_team`, `dim_stage`, `dim_country`, built from the normalized tables |
| `04_indexes.sql` | Indexes on the foreign key columns that the queries use |
| `05_scale.sql` | Adds copies of the race for the response time comparison |
| `06_constraint_tests.sql` | Statements that the database must reject, and one valid new award |
| `queries/q1` to `q5` | Five analytical queries, each on the normalized schema (`_norm`) and on the star schema (`_star`) |
| `queries/q1t_norm`, `queries/q2w_*` | Two variants: Q1 with the sum before the joins, Q2 with a window function |
| `queries/roles_star.sql` | Stage wins by country of the rider and country of the team |

Run from the repository root:

```sh
createdb tdf
psql -d tdf -f sql/final_report/01_normalized_schema.sql
psql -d tdf -f sql/final_report/02_load.sql
psql -d tdf -f sql/final_report/03_star_schema.sql
psql -d tdf -f sql/final_report/04_indexes.sql
psql -d tdf -f sql/final_report/06_constraint_tests.sql
psql -d tdf -f sql/final_report/queries/q1_star.sql
```

The star schema here differs from `sql/03_star_schema.sql` in two points: each dimension has a surrogate key, and `dim_country` is referenced twice from the fact table (country of the rider and country of the team).
