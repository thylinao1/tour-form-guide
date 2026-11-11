# SQL layer (BT5110 Group 31)

Run from the repository root with DuckDB (`brew install duckdb`). The files also read as standard PostgreSQL, apart from `read_csv` in 02 (use `\copy` in psql) and `MEDIAN` in the dashboard's short E1 query.

| File | What it does |
|---|---|
| `01_normalized_schema.sql` | The Task 2 schema: 10 tables, keys, CHECKs and the `result_adjusted` view, with four marked corrections (award recipient type for WIN and EARN, `rank >= 1`, loop stages allowed, dead heats allowed) |
| `02_load.sql` | Loads `data/cleaned/*.csv` and seeds the five 2025 awards |
| `03_star_schema.sql` | Star schema built from the normalized tables: `fact_results` (one rider on one stage) with `dim_rider`, `dim_team`, `dim_stage`, `dim_country` |
| `04_functions_e1_e15.sql` | One commented query (plus drill down where the prompt asks) for each prompt E1 to E15, using ROLLUP, GROUPING SETS, FILTER pivots and window functions |
| `05_task4_compare.sql` | Three questions written on both schemas, with the joins each one needs |

```sh
duckdb -c ".read sql/01_normalized_schema.sql" -c ".read sql/02_load.sql" \
       -c ".read sql/03_star_schema.sql" -c ".read sql/04_functions_e1_e15.sql"
tests/sql_check.sh        # PASS or FAIL per check
```

The dashboard's Function map shows a short version of each E query (from `src/plugins/05-sql.js`).
