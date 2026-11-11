"""Independent pandas reference for the dashboard metrics that the main ground-truth
set (tests/expected/*.csv) does not cover. Written separately from src/engine.js so the
two implementations check each other.

Run:  python -P tests/extra_truth.py      (writes tests/expected/extra_*.csv)
"""
from pathlib import Path
import pandas as pd

HERE = Path(__file__).resolve().parent
# team repo: ../../data/cleaned ; local Task 3 folder: ../../cleaned
CLEAN = next(d for d in (HERE.parent.parent / "data" / "cleaned", HERE.parent.parent / "cleaned") if (d / "result.csv").exists())
OUT = HERE / "expected"

rider = pd.read_csv(CLEAN / "rider.csv")
stage = pd.read_csv(CLEAN / "stage.csv")
res = pd.read_csv(CLEAN / "result.csv")
stage["code"] = stage["type"].replace({"individual time-trial": "itt"})
res = res.merge(stage[["stage_id", "distance", "code"]], on="stage_id")
res["adj"] = res.finish_time - res.time_bonus + res.time_penalty
N_STAGES = stage.stage_id.max()

# ---------------- counterfactual GC (E7) ----------------
def gc(bonus=True, penalty=True):
    r = res.copy()
    r["v"] = r.finish_time - (r.time_bonus if bonus else 0) + (r.time_penalty if penalty else 0)
    g = r.groupby("bib_number").agg(n=("stage_id", "count"), total=("v", "sum"), sum_ranks=("rank", "sum"))
    last = r[r.stage_id == N_STAGES].set_index("bib_number")["rank"].rename("last_rank")
    g = g[g.n == N_STAGES].join(last).reset_index()
    g = g.sort_values(["total", "sum_ranks", "last_rank", "bib_number"]).reset_index(drop=True)
    g["position"] = g.index + 1
    g["gap"] = g.total - g.total.iloc[0]
    return g

rows = []
for name, b, p in [("actual", True, True), ("no_bonus", False, True), ("no_penalty", True, False), ("neither", False, False)]:
    g = gc(b, p).head(20)
    for _, x in g.iterrows():
        rows.append({"scenario": name, "position": int(x.position), "bib": int(x.bib_number), "total_s": int(x.total), "gap_s": int(x.gap)})
pd.DataFrame(rows).to_csv(OUT / "extra_counterfactual.csv", index=False)

# ---------------- pivotal day (E1) ----------------
final = gc()
top10 = final.head(10).bib_number.tolist()
bench = res[res.bib_number.isin(top10)].groupby("stage_id")["adj"].median().rename("median")
rows = []
for bib in final.head(20).bib_number:
    d = res[res.bib_number == bib].join(bench, on="stage_id")
    d["delta"] = d.adj - d["median"]
    d["absd"] = d.delta.abs()
    best = d.sort_values(["absd", "stage_id"], ascending=[False, True]).iloc[0]
    rows.append({"bib": int(bib), "pivotal_stage": int(best.stage_id), "delta_s": float(best.delta)})
pd.DataFrame(rows).to_csv(OUT / "extra_pivotal.csv", index=False)

# ---------------- points with the official 2025 finish scale ----------------
S50 = [50, 30, 20, 18, 16, 14, 12, 10, 8, 7, 6, 5, 4, 3, 2]
S30 = [30, 25, 22, 19, 17, 15, 13, 11, 9, 7, 6, 5, 4, 3, 2]
S20 = [20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
top_by_stage = {**{s: 50 for s in [1, 2, 3, 4, 7, 8, 9, 11, 15, 17, 21]}, **{s: 30 for s in [6, 16, 20]},
                **{s: 20 for s in [5, 10, 12, 13, 14, 18, 19]}}
scale = {50: S50, 30: S30, 20: S20}
res["pts_off"] = [scale[top_by_stage[s]][r - 1] if r <= 15 else 0 for s, r in zip(res.stage_id, res["rank"])]
pts = res.groupby("bib_number")["pts_off"].sum().rename("points_official_scale").reset_index().rename(columns={"bib_number": "bib"})
pts.to_csv(OUT / "extra_points_official_scale.csv", index=False)

# ---------------- speed profile (E6) ----------------
def speed(df):
    return df.distance.sum() * 3600 / df.finish_time.sum()

fin_bibs = final.bib_number.tolist()
groups = {"all": None, "flat": ["flat"], "hilly": ["hilly"], "mountain": ["mountain"], "itt": ["itt"], "flathilly": ["flat", "hilly"]}
med = {}
for g, codes in groups.items():
    vals = []
    for b in fin_bibs:
        d = res[res.bib_number == b]
        if codes: d = d[d.code.isin(codes)]
        vals.append(speed(d))
    med[g] = pd.Series(vals).median()
rows = []
for b in final.head(30).bib_number.tolist() + [81, 24, 21, 106, 17, 41]:
    d0 = res[res.bib_number == b]
    row = {"bib": int(b)}
    for g, codes in groups.items():
        d = d0 if not codes else d0[d0.code.isin(codes)]
        v = speed(d) if len(d) else None
        row[f"speed_{g}"] = v
        row[f"index_{g}"] = v / med[g] if v else None
    row["mountain_shift"] = (row["index_mountain"] - row["index_flathilly"]) if row["index_mountain"] and row["index_flathilly"] else None
    rows.append(row)
pd.DataFrame(rows).drop_duplicates("bib").to_csv(OUT / "extra_speed.csv", index=False)
pd.DataFrame([{"group": g, "median_speed": v} for g, v in med.items()]).to_csv(OUT / "extra_speed_medians.csv", index=False)

# ---------------- team contribution (E3): stages each rider counted in the team's best 3 ----------------
r2 = res.merge(rider[["bib_number", "rider_team"]], on="bib_number")
r2 = r2.sort_values(["stage_id", "rider_team", "finish_time", "bib_number"])
r2["k"] = r2.groupby(["stage_id", "rider_team"]).cumcount()
cnt = r2[r2.k < 3].groupby(["rider_team", "bib_number"]).agg(stages_counted=("stage_id", "count"), seconds_counted=("finish_time", "sum")).reset_index()
cnt.rename(columns={"rider_team": "team", "bib_number": "bib"}).to_csv(OUT / "extra_team_contribution.csv", index=False)

# ---------------- top-10 by team x terrain (E14) ----------------
t10 = r2[r2["rank"] <= 10].groupby(["rider_team", "code"]).size().rename("top10s").reset_index()
t10.rename(columns={"rider_team": "team"}).to_csv(OUT / "extra_team_top10_terrain.csv", index=False)

print("wrote extra_counterfactual, extra_pivotal, extra_points_official_scale, extra_speed(+medians), extra_team_contribution, extra_team_top10_terrain")
print("check: Vingegaard official-scale finish points =", int(pts.loc[pts.bib == 11, "points_official_scale"].iloc[0]), "(official green total 182)")
print("check: Pogacar official-scale finish points =", int(pts.loc[pts.bib == 1, "points_official_scale"].iloc[0]), "(official 294 incl. 7 sprint pts)")
print("check: pivotal", rows and pd.read_csv(OUT / "extra_pivotal.csv").head(4).to_dict("records"))
