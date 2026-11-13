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
| `queries/q1t_*`, `queries/q2w_*` | Two variants: Q1 with the sum before the joins (`q1t_star` repeats the star version of Q1 for the paired run), Q2 with a window function |
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

## Response time measurement

| File | What it holds |
|---|---|
| `bench/bench.py` | The script of the comparison. It checks that both versions of a query return the same rows, runs them in turn with `EXPLAIN (ANALYZE, TIMING OFF)` and saves the plans. Python 3, standard library only |
| `bench/results.json` | Summary of the measurements in the report: median, quartiles, minimum, maximum and number of runs for each query, schema and database size, with the planning times |
| `bench/plans/` | The `EXPLAIN` plan of every query on both schemas at the four sizes (`k1` is the real data, `k10`, `k100` and `k1000` are the databases with copies) |

The larger databases are built with `05_scale.sql`. The measurement of the report was started with:

```sh
python3 sql/final_report/bench/bench.py 5432 tdf:k1:30:3 tdf_k10:k10:30:3 tdf_k100:k100:15:3 tdf_k1000:k1000:7:1
```

Each argument is database, label, number of measured runs and number of warm-up runs. The script connects as the user `postgres`.
