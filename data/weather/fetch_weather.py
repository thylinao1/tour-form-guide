"""
Race-day weather for the 21 stages of the 2025 Tour de France.

For each stage we ask Open-Meteo's free historical weather service
(https://open-meteo.com, no account needed) for the hourly weather at the
finish town on the race day, and keep the race hours 13:00-18:00 local time
(when the riders are racing towards the finish).

Output: stage_weather_2025.csv, one row per stage:
  stage_id, finish, lat, lon, temp_max_c, rain_mm, wind_max_kmh, gust_max_kmh,
  wet, hot, windy

The three yes/no columns use the same thresholds as the dashboard:
  wet   = at least 1 mm of rain during race hours
  hot   = at least 28 °C
  windy = wind of at least 20 km/h

Run from this folder:  python3 fetch_weather.py
(On a Mac, use /usr/bin/python3 if python.org Python reports a certificate error.)
"""
import csv
import json
import urllib.request

# Finish town, its coordinates (latitude, longitude) and the race date.
STAGES = [
    (1, "Lille Métropole", 50.637, 3.063, "2025-07-05"),
    (2, "Boulogne-Sur-Mer", 50.726, 1.614, "2025-07-06"),
    (3, "Dunkerque", 51.034, 2.377, "2025-07-07"),
    (4, "Rouen", 49.443, 1.099, "2025-07-08"),
    (5, "Caen", 49.183, -0.370, "2025-07-09"),
    (6, "Vire Normandie", 48.838, -0.889, "2025-07-10"),
    (7, "Mûr-De-Bretagne Guerlédan", 48.200, -3.000, "2025-07-11"),
    (8, "Laval Espace Mayenne", 48.073, -0.770, "2025-07-12"),
    (9, "Châteauroux", 46.810, 1.691, "2025-07-13"),
    (10, "Le Mont-Dore Puy De Sancy", 45.550, 2.810, "2025-07-14"),
    (11, "Toulouse", 43.605, 1.444, "2025-07-16"),
    (12, "Hautacam", 42.968, -0.008, "2025-07-17"),
    (13, "Peyragudes", 42.795, 0.452, "2025-07-18"),
    (14, "Luchon-Superbagnères", 42.757, 0.578, "2025-07-19"),
    (15, "Carcassonne", 43.213, 2.349, "2025-07-20"),
    (16, "Mont Ventoux", 44.174, 5.279, "2025-07-22"),
    (17, "Valence", 44.933, 4.892, "2025-07-23"),
    (18, "Courchevel Col De La Loze", 45.405, 6.597, "2025-07-24"),
    (19, "La Plagne", 45.507, 6.677, "2025-07-25"),
    (20, "Pontarlier", 46.904, 6.354, "2025-07-26"),
    (21, "Paris Champs-Élysées", 48.866, 2.313, "2025-07-27"),
]

RACE_HOURS = range(13, 19)  # 13:00 to 18:00 local time
WET_MM, HOT_C, WINDY_KMH = 1.0, 28.0, 20.0


def fetch_day(lat, lon, date):
    """Return the hourly weather of one day at one place."""
    url = (
        "https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}&longitude={lon}&start_date={date}&end_date={date}"
        "&hourly=temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m"
        "&timezone=Europe/Paris"
    )
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.load(response)["hourly"]


rows = []
for stage_id, finish, lat, lon, date in STAGES:
    hourly = fetch_day(lat, lon, date)
    # keep only the race hours
    keep = [i for i, t in enumerate(hourly["time"]) if int(t[11:13]) in RACE_HOURS]
    temp = round(max(hourly["temperature_2m"][i] for i in keep), 1)
    rain = round(sum(hourly["precipitation"][i] for i in keep), 1)
    wind = round(max(hourly["wind_speed_10m"][i] for i in keep), 1)
    gust = round(max(hourly["wind_gusts_10m"][i] for i in keep), 1)
    rows.append({
        "stage_id": stage_id, "finish": finish, "lat": lat, "lon": lon,
        "temp_max_c": temp, "rain_mm": rain, "wind_max_kmh": wind, "gust_max_kmh": gust,
        "wet": int(rain >= WET_MM), "hot": int(temp >= HOT_C), "windy": int(wind >= WINDY_KMH),
    })
    print(stage_id, finish, rows[-1]["temp_max_c"], "°C", rows[-1]["rain_mm"], "mm", rows[-1]["wind_max_kmh"], "km/h")

with open("stage_weather_2025.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)

print("wet stages:", sum(r["wet"] for r in rows),
      "| hot stages:", sum(r["hot"] for r in rows),
      "| windy stages:", sum(r["windy"] for r in rows))
