"""Build data/geo_2025.json: two small GeoJSON maps for the dashboard (France with its neighbours
for the stage route, Europe for nations), the stage town coordinates, and badge positions for the
21 stage numbers. Map outlines: Natural Earth via world-atlas (ISC licence). Town coordinates:
data/stage_places.csv (OpenStreetMap Nominatim, © OpenStreetMap contributors).

Usage (from betting-dashboard/):
  curl -o /tmp/countries-50m.json https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json
  python tools/make_geo.py /tmp/countries-50m.json
"""
import csv, json, math, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
CLEAN = next(d for d in (HERE.parent / "data" / "cleaned", HERE.parent / "cleaned") if (d / "stage.csv").exists())
topo = json.load(open(sys.argv[1], encoding="utf-8"))
sx, sy = topo["transform"]["scale"]; tx, ty = topo["transform"]["translate"]
arcs = []
for arc in topo["arcs"]:
    x = y = 0; pts = []
    for dx, dy in arc:
        x += dx; y += dy; pts.append((x * sx + tx, y * sy + ty))
    arcs.append(pts)

def ring(idx):
    out = []
    for i in idx:
        p = arcs[i] if i >= 0 else arcs[~i][::-1]
        out.extend(p if not out else p[1:])
    return out

def polys(g):
    return [g["arcs"]] if g["type"] == "Polygon" else g["arcs"] if g["type"] == "MultiPolygon" else []

def clip(pts, x0, y0, x1, y1):
    """Sutherland-Hodgman clipping of a ring against a lon/lat rectangle."""
    def cut(pts, inside, inter):
        out = []
        for i, cur in enumerate(pts):
            prev = pts[i - 1]
            if inside(cur):
                if not inside(prev): out.append(inter(prev, cur))
                out.append(cur)
            elif inside(prev): out.append(inter(prev, cur))
        return out
    def ix(a, b, x): t = (x - a[0]) / (b[0] - a[0]); return (x, a[1] + t * (b[1] - a[1]))
    def iy(a, b, y): t = (y - a[1]) / (b[1] - a[1]); return (a[0] + t * (b[0] - a[0]), y)
    for inside, inter in ((lambda p: p[0] >= x0, lambda a, b: ix(a, b, x0)), (lambda p: p[0] <= x1, lambda a, b: ix(a, b, x1)),
                          (lambda p: p[1] >= y0, lambda a, b: iy(a, b, y0)), (lambda p: p[1] <= y1, lambda a, b: iy(a, b, y1))):
        if not pts: break
        pts = cut(pts, inside, inter)
    return pts

def make(box, tol, nd):
    x0, y0, x1, y1 = box; k = math.cos(math.radians((y0 + y1) / 2)); feats = []
    for g in topo["objects"]["countries"]["geometries"]:
        rings_out = []
        for poly in polys(g):
            rr = []
            for j, r in enumerate(poly):
                pts = clip(ring(r), x0, y0, x1, y1)
                if len(pts) < 4: continue
                kept = [pts[0]]
                for p in pts[1:]:
                    if math.hypot((p[0] - kept[-1][0]) * k, p[1] - kept[-1][1]) >= tol: kept.append(p)
                if len(kept) < 4: continue
                xs = [p[0] for p in kept]; ys = [p[1] for p in kept]
                if (max(xs) - min(xs)) * k + (max(ys) - min(ys)) < tol * 4: continue
                kept = [[round(p[0], nd), round(p[1], nd)] for p in kept]
                if kept[0] != kept[-1]: kept.append(kept[0])
                rr.append(kept)
            if rr: rings_out.append(rr)
        if rings_out:
            feats.append({"type": "Feature", "properties": {"name": g["properties"]["name"]},
                          "geometry": {"type": "MultiPolygon", "coordinates": rings_out}})
    return {"type": "FeatureCollection", "features": feats}

FR_BOX = (-5.4, 41.2, 9.8, 51.3)
EU_BOX = (-11.0, 35.5, 31.0, 62.5)
fr = make(FR_BOX, 0.025, 2)
eu = make(EU_BOX, 0.13, 1)

places = {r["place"]: [float(r["lon"]), float(r["lat"])] for r in csv.DictReader(open(HERE / "data" / "stage_places.csv", encoding="utf-8"))}
stages = list(csv.DictReader(open(CLEAN / "stage.csv", encoding="utf-8")))
# stage-number badges: start at the middle of each line, then push apart on a ~520 px wide map
k = math.cos(math.radians(46.5)); S = 520 / ((FR_BOX[2] - FR_BOX[0]) * k)
proj = lambda lon, lat: ((lon - FR_BOX[0]) * k * S, (FR_BOX[3] - lat) * S)
unproj = lambda x, y: (x / (k * S) + FR_BOX[0], FR_BOX[3] - y / S)
B = []
for s in stages:
    a, b = proj(*places[s["start_location"]]), proj(*places[s["finish_location"]])
    loop = math.hypot(a[0] - b[0], a[1] - b[1]) < 6
    ax, ay = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - (16 if loop else 0))
    B.append({"id": int(s["stage_id"]), "ax": ax, "ay": ay, "x": ax, "y": ay, "loop": loop})
for _ in range(120):
    for p in B:
        for q in B:
            if p is q: continue
            dx, dy = p["x"] - q["x"], p["y"] - q["y"]; d = math.hypot(dx, dy) or 0.01
            if d < 22: m = (22 - d) / 2; p["x"] += dx / d * m; p["y"] += dy / d * m
badges = {str(p["id"]): {"at": [round(v, 3) for v in unproj(p["x"], p["y"])], "anchor": [round(v, 3) for v in unproj(p["ax"], p["ay"])], "loop": p["loop"]} for p in B}

# nation codes used in the data -> map names (others are shown as tiles)
cname = {r["country_code"]: r["country_name"] for r in csv.DictReader(open(CLEAN / "country.csv", encoding="utf-8"))}
OVERRIDE = {"GBR": "United Kingdom", "NLD": "Netherlands", "CZE": "Czechia", "USA": "United States of America"}
eu_names = {f["properties"]["name"] for f in eu["features"]}
names = {}
for code, n in cname.items():
    m = OVERRIDE.get(code, n)
    if m in eu_names: names[code] = m

out = {"fr": fr, "eu": eu, "places": places, "badges": badges, "euNames": names,
       "source": "Natural Earth via world-atlas 2.0.2 (countries-50m); towns © OpenStreetMap contributors"}
(HERE / "data" / "geo_2025.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print("fr", len(fr["features"]), "countries; eu", len(eu["features"]), "countries;", round((HERE / "data" / "geo_2025.json").stat().st_size / 1024), "KB")
print("nations on the Europe map:", sorted(names))
