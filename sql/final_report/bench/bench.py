"""Response time comparison: normalized schema against star schema (PostgreSQL).

For each database (one per scale) and each query pair this script
  1. checks that the two versions return the same rows,
  2. runs both versions in turn (normalized, star, normalized, star, ...) with
     EXPLAIN (ANALYZE, TIMING OFF, FORMAT JSON) and records the execution and planning time
     that the server reports,
  3. saves the plain EXPLAIN plan of each version.
Results go to bench/results.json and the plans to bench/plans, next to this file. Standard library only.
The script connects as the user postgres.

Usage: python3 sql/final_report/bench/bench.py <port> <db:label:runs:warmup> [<db:label:runs:warmup> ...]
The report used: tdf:k1:30:3 tdf_k10:k10:30:3 tdf_k100:k100:15:3 tdf_k1000:k1000:7:1
"""
import json
import statistics
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUERIES = ["q1", "q2", "q3", "q4", "q5", "q1t", "q2w"]


def psql(port, db, sql, tuples_only=True):
    cmd = ["psql", "-p", str(port), "-U", "postgres", "-d", db, "-X", "-q", "-v", "ON_ERROR_STOP=1"]
    if tuples_only:
        cmd += ["-A", "-t"]
    out = subprocess.run(cmd + ["-c", sql], capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip())
    return out.stdout


def load(name):
    return (ROOT / "queries" / f"{name}.sql").read_text().strip()


def timed(port, db, sql):
    raw = psql(port, db, f"EXPLAIN (ANALYZE, TIMING OFF, FORMAT JSON) {sql}")
    plan = json.loads(raw)[0]
    return plan["Execution Time"], plan["Planning Time"]


def plan_stats(node, acc=None):
    acc = acc if acc is not None else {"joins": 0, "scans": 0, "nodes": 0, "subplans": 0}
    kind = node["Node Type"]
    acc["nodes"] += 1
    if kind in ("Hash Join", "Nested Loop", "Merge Join"):
        acc["joins"] += 1
    if "Scan" in kind:
        acc["scans"] += 1
    if node.get("Parent Relationship") == "SubPlan":
        acc["subplans"] += 1
    for child in node.get("Plans", []):
        plan_stats(child, acc)
    return acc


def summary(values):
    ordered = sorted(values)
    q = statistics.quantiles(ordered, n=4) if len(ordered) >= 4 else [ordered[0], statistics.median(ordered), ordered[-1]]
    return {"median": statistics.median(ordered), "q1": q[0], "q3": q[2],
            "min": ordered[0], "max": ordered[-1], "runs": len(ordered)}


def main():
    port = sys.argv[1]
    out_path = ROOT / "bench" / "results.json"
    results = json.loads(out_path.read_text()) if out_path.exists() else {}
    for spec in sys.argv[2:]:
        db, label, runs, warmup = spec.split(":")
        runs, warmup = int(runs), int(warmup)
        entry = results.setdefault(label, {"db": db, "queries": {}})
        entry["runs"], entry["warmup"] = runs, warmup
        entry["rows"] = {t: int(psql(port, db, f"SELECT COUNT(*) FROM {t}").strip())
                         for t in ("result", "rider", "team", "stage", "fact_results")}
        for q in QUERIES:
            norm, star = load(f"{q}_norm"), load(f"{q}_star")
            rows_norm = psql(port, db, norm)
            rows_star = psql(port, db, star)
            same = rows_norm == rows_star
            n_rows = len(rows_norm.strip().splitlines())
            for sql in (norm, star):          # warm the cache for both versions
                for _ in range(warmup):
                    timed(port, db, sql)
            t = {"norm": {"exec": [], "plan": []}, "star": {"exec": [], "plan": []}}
            for _ in range(runs):
                for key, sql in (("norm", norm), ("star", star)):
                    e, p = timed(port, db, sql)
                    t[key]["exec"].append(e)
                    t[key]["plan"].append(p)
            rec = {"same_rows": same, "rows_returned": n_rows}
            for key, sql in (("norm", norm), ("star", star)):
                plan_json = json.loads(psql(port, db, f"EXPLAIN (FORMAT JSON) {sql}"))[0]["Plan"]
                plan_text = psql(port, db, f"EXPLAIN {sql}")
                (ROOT / "bench" / "plans").mkdir(exist_ok=True)
                (ROOT / "bench" / "plans" / f"{label}_{q}_{key}.txt").write_text(plan_text)
                rec[key] = {"exec_ms": summary(t[key]["exec"]), "plan_ms": summary(t[key]["plan"]),
                            "plan_stats": plan_stats(plan_json)}
            entry["queries"][q] = rec
            print(f"{label} {q}: same={same} rows={n_rows} "
                  f"norm={rec['norm']['exec_ms']['median']:.3f} ms "
                  f"star={rec['star']['exec_ms']['median']:.3f} ms", flush=True)
            out_path.write_text(json.dumps(results, indent=1))


if __name__ == "__main__":
    main()
