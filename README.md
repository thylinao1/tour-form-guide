# Tour de France 2025 Race Analyst

An interactive dashboard of the 2025 Tour de France, built by BT5110 Group 31 for Task 3 (develop and demo an OLAP dashboard). It lets you open any total to see what is inside it, compare the four jerseys, follow cumulative race times for riders and teams, and see how many riders and teams each country sent. The angle is a "form guide", the kind of sheet people read before making an educated bet: it shows what the settled 2025 results say about riders, teams and terrain. It is a summary of one past race. It is not a forecast, and it has no money, stakes or "place bet" button anywhere.

**Live page:** https://thylinao1.github.io/tour-form-guide/

Or download `index.html` and double-click it. It is one file and it works offline.

New here? The yellow **Help** button (top right) offers a one minute tour, a short video, a five step guide called "How to make an educated bet" and a glossary of cycling and betting words.

## What is on each tab

| Tab | The question it answers |
|---|---|
| Start here | What happened in this race, and where should I look first? Final podium, jersey winners, road book, bet notes from 2025, and the five step betting guide. |
| Overall winner | Who won overall, how did the lead change, and what if bonuses or penalties had not counted? Standings, the day that decided each rider's race, a replay, a 3D chart. |
| Stages | What happened on one stage, and what is inside the totals? One stage up close, a drill down by terrain then stage then rider, the time trials, the longest stage. |
| Terrain | Who is good on flat, hilly, mountain and time trial days? Sprinter or climber, mountain podiums, speed on each terrain. |
| Jerseys | How do the four jerseys compare? General (yellow), Points (green), Mountains (polka dot), Young Rider (white), side by side. |
| Form and risk | Who finishes near the front often, and who did not reach Paris? Top ten counts, form by week, riders who left the race. |
| Teams | How strong and how deep is each team? Team classification, which riders carried each team, top ten finishes by team and terrain, squad depth. |
| Head-to-head | Between two riders or two teams, who finished ahead more often, and by how much? |
| Nations | How many riders and teams came from each country, and how did each country do? A map, ranked bars, and results per country. |
| Function map | Where is each view? Cards for E1 to E15, a walk-through, the short SQL for each, and four ways to explore the race. |
| Bet builder | If I pick two riders (or two teams) and a type of day, what does 2025 say? A three step builder with the record, a "History says" share, fair odds and a checklist. |
| Method | Where do the numbers come from, and what do the words mean? Definitions, caveats and sources. |

## Where each demonstration prompt lives

The lecturer listed 15 demonstration prompts, E1 to E15. Every one is built. On the page, each panel carries a small yellow badge such as **E7**, and the Function map tab has a button that jumps to each panel.

| Code | Tab | Panel title | What to click |
|---|---|---|---|
| E1 | Overall winner | Final overall standings, then Biggest day against the top ten | Click any rider row. The chart shows the stage where that rider gained or lost the most time on the final top ten. Click a bar to open the stage. |
| E2 | Stages | Stage in focus | Pick a stage from the list. Read the top finishers and their adjusted times, then switch to the team view. |
| E3 | Teams | Team burden and contribution | Open a team to see which riders supplied its counted times, stage by stage. |
| E4 | Jerseys | Parallel classifications | Switch between "Official rule" and "Age at race start", then move the max age slider. |
| E5 | Terrain | Mountain contours | Read the podium counts and average gaps. Click a rider for the daily results behind them. |
| E6 | Terrain | Speed by terrain | Switch between riders and teams. A bar that grows on mountain stages marks a rider who gains when the road climbs. |
| E7 | Overall winner | Bonuses and penalties per rider, then What if bonuses or penalties did not count? | Read the ledger, then untick "Count bonuses", then "Count penalties", and watch the leader and top ten change. |
| E8 | Nations | Where the riders and teams come from | Switch the measure to Riders or Teams, then click a country on the map. Its riders and teams appear below. |
| E9 | Nations | National outcomes | Read best overall place, stage wins and podiums per country. Click a row to see its riders. |
| E10 | Overall winner | The fight for yellow, stage by stage (also Race replay and The race in 3D) | Pick riders or a team. Shaded bands are mountain stages and dashed yellow lines mark each change of leader. |
| E11 | Stages | Against the clock | Read the two time trials: date, distance, winner, speed and fastest riders. |
| E12 | Form and risk | Consistency near the front | Click a bar to list the stages, places and terrain behind a rider's top ten count. |
| E13 | Teams | Depth of squads | Switch the measure, then click a bar or use the team menu to see a team's full roster and countries. |
| E14 | Teams | Top-ten intensity by team | Click a cell of the team by terrain grid to list the stages and riders behind it. |
| E15 | Stages | The long day | The longest stage is first. Click a bar for another stage, or press "Open this stage". |

More detail, with the matching SQL, is in [docs/FUNCTION_MAP.md](docs/FUNCTION_MAP.md).

## How the Task 3 requirements a to e are met

| Requirement | How |
|---|---|
| a. Drill down by stage, rider or team | Stages tab: terrain, then stage, then the top riders. Overall winner tab: rider, then their key stage. Teams tab: team, then rider, then stage. Nations tab: country, then riders. Click any rider name anywhere for a full profile. |
| b. Compare General, Points, Mountains and Young Rider | Jerseys tab: the top 10 of all four standings side by side, plus each rider's place in all of them (panels "Official final classifications" and "Parallel classifications"). |
| c. Cumulative race times by rider, team and classification | Overall winner tab: total time for every rider after every stage. Teams tab: team classification and running team time. Jerseys tab: young rider and mountains standings. Head-to-head tab: the running gap between two riders or two teams. |
| d. Teams per country and riders per country | Nations tab: a map and ranked bars for riders and teams per country. France is first with 38 riders and 5 teams. |
| e. Clear, intuitive, good looking design | One colour and icon per terrain, jersey colours for standings, a plain sentence at the top of every tab, a Help button with tour, video and glossary, light and dark themes, a phone layout, keyboard focus rings, and animation that switches off if the visitor asks for reduced motion. Interactive charts include a 3D bar chart and a bar chart race. |

## Repository layout

| Folder or file | What is in it |
|---|---|
| `index.html` | The built dashboard. One file, works offline. Made by `build.mjs`. |
| `build.mjs` | Reads the data and the source files and writes the single `index.html`. |
| `src/` | `engine.js` (pure calculations), `app.js` (the interface and the ten core tabs), `styles.css` (design tokens and components), `body.html` (page skeleton). |
| `src/plugins/` | Extra features, joined into the page in file name order: `05-sql.js` (short SQL for each prompt), `10-functions.*` (Function map tab), `20-coverage.*` (E13 and E15), `30-guide.*` (Help, tour, glossary, video), `40-showcase.*` (podium, race replay, 3D chart, motion), `50-bet.*` (Bet builder tab), `60-theme.*` (light and dark switch). |
| `data/` | `cleaned/` (one CSV per table, see its README), `official/` (official classifications, published points and mountains standings, sources note), `source/` (the three original course files), `weather/` (race-day weather), `geo_2025.json` (map outlines). |
| `sql/` | The Task 2 schema, the load script, the star schema, one query per prompt, and the Task 4 comparison. See `sql/README.md`. |
| `tests/` | Node tests, a SQL check script and the expected values from an independent reference. |
| `tools/` | `clean_data.py`, `make_geo.py`, `smoke.sh` (headless browser check) and `video/` (scripts that build the tutorial video). |
| `vendor/` | ECharts, ECharts GL and the embedded fonts, so nothing loads from the internet. |
| `docs/` | `DEMO_SCRIPT.md`, `FUNCTION_MAP.md`, `DATA_AND_METHODS.md` and the ER diagram. |

## Rebuild and test

You need Node 20 or newer. Nothing else is installed or downloaded.

```sh
node build.mjs                 # writes index.html
node build.mjs out.html        # writes the same page somewhere else
```

Tests (plain Node, no dependencies):

```sh
node tests/engine.test.mjs     # calculations against the independent reference (27 checks)
node tests/functions.test.mjs  # Function map
node tests/coverage.test.mjs   # E13 and E15
node tests/guide.test.mjs      # guide, tour, glossary
node tests/showcase.test.mjs   # podium, replay and 3D data
node tests/bet.test.mjs        # Bet builder
tests/sql_check.sh             # SQL layer, needs DuckDB (brew install duckdb)
```

Browser check (needs Google Chrome installed in the usual macOS location). It builds the page, opens one tab in headless Chrome, clicks what you list, and prints `SMOKE OK` or the script errors:

```sh
tools/smoke.sh teams all "#cov-team-sel"
tools/smoke.sh outright none ""
```

The first word is the tab, the second is which plugins to include (`all`, `none`, or a comma list of file names without the extension), the third is a list of CSS selectors to click, separated by `|`. The saved page is in `.smoke/<tab>.html`.

Handy web page switches for recordings: add `?welcome=0` to hide the first-visit welcome, or `?tour=1` to start the guided tour straight away.

## Languages and colour blind colours

The header has a language menu: English, Hindi, Spanish, French, Chinese, Arabic and Hebrew. The page is written in English; the plugin `src/plugins/70-i18n.js` swaps the text on screen for the chosen language, and anything without a translation (rider, team and town names, and a few sentences built around a name) stays as it is. Numbers are looked up as `#`, so "Stage 4" and "Stage 12" share one entry. Arabic and Hebrew are shown right to left. Arabic also has **no betting content**: the Bet builder tab and the betting panels are hidden, and the wording is neutral analysis. `?lang=es` in the address opens a language directly.

The translations are in `i18n/*.json`. They were made by machine (`tools/i18n_extract.py` collects the text, then language models translate it in blocks) and checked by tests for completeness, number slots and script, but not yet read by native speakers.

The **Colour blind** button swaps the data colours for the Okabe-Ito set. `tests/colorblind.test.mjs` simulates red-blind and green-blind vision to check the colours stay apart.

## Data sources and credits

- **Race results:** BT5110 course CSVs (riders, individual results, exits), cleaned by Group 31 into one CSV per table of our Task 2 schema. See `data/cleaned/README.md` for every cleaning step.
- **Official final classifications:** the top 10 of the General, Points, Mountains, Young Rider and Team standings after stage 21, each checked against at least two sources. Full details and links are in `data/official/official_sources.md`.
- **Published points and mountains standings:** the full lists (132 and 55 riders) were collected from CyclingDB. Their top 10 lists match the official ones exactly.
- **Race-day weather:** Open-Meteo historical weather (open-meteo.com), used for the wet, hot and windy filters in the Bet builder.
- **Maps:** country outlines from Natural Earth (public domain, via world-atlas). Stage town positions are from OpenStreetMap, © OpenStreetMap contributors. The terrain image in the enlarged route map is NASA Blue Marble shaded relief (public domain), saved as `data/relief_france.jpg` from the NASA GIBS map service.
- **Charts:** Apache ECharts 5.6.0 (Apache License 2.0) and ECharts GL 2.0.9 (BSD 3-Clause), copied into `vendor/`.
- **Tutorial video:** `assets/tutorial.mp4` (about 2 minutes) is a recording of this dashboard, made by the scripts in `tools/video/`. The voice is computer generated with the open Kokoro speech model (Apache License 2.0), run on the NUS School of Computing compute cluster. Open it from Help, then Watch the video.
- **Fonts:** Barlow and Barlow Condensed (SIL Open Font License 1.1), embedded in the page.
- **Fonts:** Barlow and Barlow Condensed (SIL Open Font License 1.1), embedded in `vendor/fonts.css`.
- **Team:** BT5110 Group 31.

## Honest limits

- It covers **one race**. Seven flat, six hilly and six mountain stages and two time trials is a small sample, so treat every rate as a signal and not a probability.
- Everything is a **summary of settled 2025 results**. It is **not a forecast and not betting advice**. Past results do not guarantee future ones.
- The "History says" share in the Bet builder is a simple count smoothed towards 50 percent. It is not a bookmaker's price.
- Stage 21 was timed for the overall at 50.3 km before the finish because of rain, so total times in our data are 3,717 seconds longer than the official ones. Every gap is the same.
- The data has no intermediate sprint or climb points, so the green and polka dot jerseys use published standings.
- One rider (Aleksandr Vlasov) has no nationality in the course data and is listed as "Not specified".

## Acknowledgement of AI use

Large language models (Claude, from Anthropic) assisted with code and drafting for this project. The authors reviewed the output and take responsibility for the work.
