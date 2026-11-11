"""Clean the three source CSVs into one CSV per Task 2 table.

Run from anywhere:  python clean_data.py
Inputs : riders.csv, individual_results.csv, exits.csv (same folder as this script)
Outputs: cleaned/*.csv (UTF-8, no BOM, header row, comma-separated)

Every step is described in cleaned/README.md. The script stops with an
AssertionError if any Task 2 constraint (other than the known
start_location <> finish_location conflict) fails on the output.
"""
from pathlib import Path

import pandas as pd

SRC = Path(__file__).resolve().parent
OUT = SRC / "cleaned"
OUT.mkdir(exist_ok=True)

READ = dict(encoding="utf-8", dtype=str, keep_default_na=False)
riders_raw = pd.read_csv(SRC / "riders.csv", **READ)
results_raw = pd.read_csv(SRC / "individual_results.csv", **READ)
exits_raw = pd.read_csv(SRC / "exits.csv", **READ)

# ---------------------------------------------------------------------------
# 1. Countries: source uses IOC/UCI-style codes; the brief requires ISO 3166-1
#    alpha-3. Map by country name (the source names are ISO short names).
# ---------------------------------------------------------------------------
ISO3 = {
    "Argentina": "ARG", "Australia": "AUS", "Austria": "AUT", "Bahrain": "BHR",
    "Belgium": "BEL", "Canada": "CAN", "Colombia": "COL", "Czechia": "CZE",
    "Denmark": "DNK", "Ecuador": "ECU", "Eritrea": "ERI", "France": "FRA",
    "Germany": "DEU", "Ireland": "IRL", "Israel": "ISR", "Italy": "ITA",
    "Kazakhstan": "KAZ", "Latvia": "LVA", "Netherlands, Kingdom of the": "NLD",
    "New Zealand": "NZL", "Norway": "NOR", "Poland": "POL", "Portugal": "PRT",
    "Slovenia": "SVN", "Spain": "ESP", "Switzerland": "CHE",
    "United Arab Emirates": "ARE",
    "United Kingdom of Great Britain and Northern Ireland": "GBR",
    "United States of America": "USA",
}
# One rider (bib 78) has the literal text "NULL" as country code and name.
# RIDER.rider_country is NOT NULL with a FK, so use ISO's user-assigned
# range (XAA-XZZ) for an explicit "not specified" country.
PLACEHOLDER_CODE, PLACEHOLDER_NAME = "XXX", "Not specified"

pairs = pd.concat([
    riders_raw[["rider_country_code", "rider_country_name"]].set_axis(["src", "name"], axis=1),
    riders_raw[["team_country_code", "team_country_name"]].set_axis(["src", "name"], axis=1),
    results_raw[["start_country_code", "start_country_name"]].set_axis(["src", "name"], axis=1),
    results_raw[["finish_country_code", "finish_country_name"]].set_axis(["src", "name"], axis=1),
]).drop_duplicates()
assert pairs.groupby("src").name.nunique().max() == 1, "a source code has two names"

is_null = pairs.src.str.upper().eq("NULL")
pairs.loc[is_null, "name"] = PLACEHOLDER_NAME
unknown = set(pairs.loc[~is_null, "name"]) - set(ISO3)
assert not unknown, f"no ISO code for {unknown}"
pairs["country_code"] = pairs.name.map(ISO3).fillna(PLACEHOLDER_CODE)
code_of = dict(zip(pairs.src, pairs.country_code))

country_map = (pairs.rename(columns={"src": "source_code", "name": "country_name"})
               [["source_code", "country_code", "country_name"]]
               .sort_values("country_code"))
country = (country_map[["country_code", "country_name"]]
           .drop_duplicates().sort_values("country_code"))

# ---------------------------------------------------------------------------
# 2. Teams and riders (riders.csv). Team country is moved to TEAM
#    (removes the transitive dependency bib -> team -> team_country).
# ---------------------------------------------------------------------------
assert riders_raw.groupby("team").team_country_code.nunique().max() == 1
team = (riders_raw[["team", "team_country_code"]].drop_duplicates()
        .assign(team_country=lambda d: d.team_country_code.map(code_of))
        .rename(columns={"team": "team_name"})[["team_name", "team_country"]]
        .sort_values("team_name"))

rider = pd.DataFrame({
    "bib_number": riders_raw.bib.astype(int),
    "rider_name": riders_raw.rider_name.str.strip(),
    "dob": pd.to_datetime(riders_raw.dob, format="%Y-%m-%d").dt.strftime("%Y-%m-%d"),
    "rider_team": riders_raw.team,
    "rider_country": riders_raw.rider_country_code.map(code_of),
}).sort_values("bib_number")

# ---------------------------------------------------------------------------
# 3. Stages and locations (one row per day in individual_results.csv).
#    stage_id is not in the source: number the race days 1..21 by date
#    (rest days 15 and 21 July have no results, so they get no number).
# ---------------------------------------------------------------------------
stage_cols = ["day", "start_location", "start_country_code", "finish_location",
              "finish_country_code", "length", "type"]
stages_raw = results_raw[stage_cols].drop_duplicates()
assert stages_raw.day.is_unique, "a day has inconsistent stage attributes"
stages_raw = stages_raw.sort_values("day").reset_index(drop=True)
stages_raw["stage_id"] = stages_raw.index + 1
stage_of_day = dict(zip(stages_raw.day, stages_raw.stage_id))

stage = pd.DataFrame({
    "stage_id": stages_raw.stage_id,
    "date": stages_raw.day,
    "distance": stages_raw.length.astype(float),
    "type": stages_raw.type,
    "start_location": stages_raw.start_location,
    "finish_location": stages_raw.finish_location,
})

location = (pd.concat([
    stages_raw[["start_location", "start_country_code"]].set_axis(["location_name", "src"], axis=1),
    stages_raw[["finish_location", "finish_country_code"]].set_axis(["location_name", "src"], axis=1),
]).drop_duplicates())
assert location.location_name.is_unique, "a location has two countries"
location = (location.assign(location_country=lambda d: d.src.map(code_of))
            [["location_name", "location_country"]].sort_values("location_name"))

# ---------------------------------------------------------------------------
# 4. Results. Rider name and team in the source are redundant with RIDER;
#    check they agree, then drop them. Adjusted time is derived, not stored.
# ---------------------------------------------------------------------------
chk = results_raw.merge(riders_raw, left_on="rider", right_on="bib", how="left")
assert chk.bib.ne("").all() and chk.bib.notna().all(), "result for unknown rider"
assert (chk.name == chk.rider_name).all() and (chk.team_x == chk.team_y).all()

result = pd.DataFrame({
    "bib_number": results_raw.rider.astype(int),
    "stage_id": results_raw.day.map(stage_of_day),
    "finish_time": results_raw.time.astype(int),
    "rank": results_raw["rank"].astype(int),
    "time_bonus": results_raw.bonus.astype(int),
    "time_penalty": results_raw.penalty.astype(int),
}).sort_values(["stage_id", "rank", "bib_number"])

# ---------------------------------------------------------------------------
# 5. Exits. The name column is redundant with RIDER; check, then drop.
# ---------------------------------------------------------------------------
chk = exits_raw.merge(riders_raw, on="bib", how="left")
assert (chk.name == chk.rider_name).all(), "exit name differs from riders.csv"
exit_ = pd.DataFrame({
    "bib_number": exits_raw.bib.astype(int),
    "exit_stage": exits_raw.stage.astype(int),
    "reason": exits_raw.reason.str.strip(),
}).sort_values(["exit_stage", "bib_number"])

# ---------------------------------------------------------------------------
# 6. Validate every Task 2 constraint on the output.
# ---------------------------------------------------------------------------
def fk(child, col, parent, pcol):
    missing = set(child[col]) - set(parent[pcol])
    assert not missing, f"FK {col} -> {pcol}: {missing}"

tables = {"country": (country, ["country_code"]), "team": (team, ["team_name"]),
          "rider": (rider, ["bib_number"]), "location": (location, ["location_name"]),
          "stage": (stage, ["stage_id"]), "result": (result, ["bib_number", "stage_id"]),
          "exit": (exit_, ["bib_number"])}
for name, (df, pk) in tables.items():
    assert not df.duplicated(pk).any(), f"PK violated in {name}"
    assert df.notna().all().all() and (df.astype(str).apply(lambda s: s.str.strip()) != "").all().all(), \
        f"NULL/empty value in {name}"

assert country.country_code.str.fullmatch(r"[A-Z]{3}").all()
fk(team, "team_country", country, "country_code")
fk(rider, "rider_team", team, "team_name")
fk(rider, "rider_country", country, "country_code")
fk(location, "location_country", country, "country_code")
fk(stage, "start_location", location, "location_name")
fk(stage, "finish_location", location, "location_name")
fk(result, "bib_number", rider, "bib_number")
fk(result, "stage_id", stage, "stage_id")
fk(exit_, "bib_number", rider, "bib_number")
fk(exit_, "exit_stage", stage, "stage_id")

assert stage.type.isin(["flat", "hilly", "mountain", "individual time-trial"]).all()
assert (result[["finish_time", "time_bonus", "time_penalty"]] >= 0).all().all()
assert (result["rank"] >= 1).all()
assert set(team.team_name) <= set(rider.rider_team), "team without rider"           # trigger
assert set(location.location_name) == set(stage.start_location) | set(stage.finish_location)  # trigger
late = result.merge(exit_, on="bib_number")
assert (late.stage_id < late.exit_stage).all(), "result at/after exit stage"       # trigger

# Reconciliation with the source files
assert len(rider) == len(riders_raw) and len(result) == len(results_raw) and len(exit_) == len(exits_raw)
src_adj = (results_raw.time.astype(int) - results_raw.bonus.astype(int) + results_raw.penalty.astype(int)).sum()
assert src_adj == (result.finish_time - result.time_bonus + result.time_penalty).sum()

loops = stage[stage.start_location == stage.finish_location]
print(f"NOTE: {len(loops)} stages violate Task 2 CHECK start_location <> finish_location:",
      loops.stage_id.tolist())

# ---------------------------------------------------------------------------
# 7. Write
# ---------------------------------------------------------------------------
outputs = {"country.csv": country, "team.csv": team, "rider.csv": rider,
           "location.csv": location, "stage.csv": stage, "result.csv": result,
           "exit.csv": exit_, "country_code_map.csv": country_map}
for fname, df in outputs.items():
    df.to_csv(OUT / fname, index=False, encoding="utf-8", lineterminator="\n")
    print(f"{fname:22s} {len(df):5d} rows")
