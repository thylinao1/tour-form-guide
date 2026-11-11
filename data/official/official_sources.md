# Official final classifications, Tour de France 2025 (after stage 21, 27 July 2025)

File: `official_classifications_2025.csv` has 50 rows, the top 10 of each of gc, points, kom, young and team.
Builder: `../../tools/build_official_csv.py`. Checks: `../../tools/verify_official_csv.py` and `../../tools/crosscheck_rte.py`. Raw downloads: `../downloads/<site>/`.

## Jersey winners
| Classification | Winner | Value |
|---|---|---|
| General (yellow) | Tadej Pogacar (bib 1, UAE TEAM EMIRATES XRG) | 76h 00' 32" |
| Points (green) | Jonathan Milan (bib 81, LIDL-TREK) | 372 pts |
| Mountains (polka-dot) | Tadej Pogacar (bib 1) | 119 pts |
| Young (white) | Florian Lipowitz (bib 72, RED BULL - BORA - HANSGROHE) | 76h 11' 32" |
| Team | TEAM VISMA - LEASE A BIKE (team.csv: `TEAM VISMA \| LEASE A BIKE`) | 232h 01' 32" |

## Sources (each classification was checked against at least 2 of them)
| Classification | Primary (`source_url` in the CSV) | Corroborating sources |
|---|---|---|
| gc | letour.fr official rankings, Wayback snapshot 2025-07-31: https://web.archive.org/web/20250731013054/https://www.letour.fr/en/rankings/stage-21 (all 160 riders) | RTE https://www.rte.ie/sport/results/cycling/tour-de-france/895458/ ; en.wikipedia (raw) ; fr.wikipedia (raw) ; NBC https://www.nbcsports.com/cycling/news/2025-tour-de-france-standings ; cyclingstage https://www.cyclingstage.com/tadej-pogacar/stage-21-results-tdf-2025/ ; Cyclingnews https://www.cyclingnews.com/news/the-current-gc-standings-at-the-tour-de-france-2025/ (gaps only) |
| points | en.wikipedia https://en.wikipedia.org/w/index.php?title=2025_Tour_de_France&action=raw (table cites Tissot Timing + PCS) | RTE .../895458/sprint/ ; cyclingstage https://www.cyclingstage.com/tour-de-france-2025-points/stage-21-green-jersey-tdf-2025/ ; fr.wikipedia ; NBC (top 5) |
| kom | en.wikipedia (raw) | RTE .../895458/mountain/ ; cyclingstage https://www.cyclingstage.com/tour-de-france-2025-kom/stage-21-polka-dot-tdf-2025/ ; fr.wikipedia ; NBC (top 5) |
| young | en.wikipedia (raw) | RTE .../895458/youth/ ; fr.wikipedia ; NBC (top 5) ; recomputed from the cleaned data (see below) |
| team | en.wikipedia (raw) | RTE .../895458/teams/ ; fr.wikipedia (winner total differs, see disagreements) ; recomputed from the cleaned data |
| rules | 2025 race regulations PDF `TDF25_REGLEMENT.pdf` (French + English), copy at https://cyclismerevue.be/wp-content/uploads/2025/07/TDF25_REGLEMENT.pdf | fr.wikipedia section "Barème des classements" ; cyclingstage per-stage points breakdowns (stages 11-21) ; Cyclingnews stage-21 report https://www.cyclingnews.com/races/tour-de-france-2025/stage-21/results/ |

Full-table checks. All 160 rows of the official letour.fr GC match `rider.csv` and `result.csv` on bib, surname, team, rank and gap, with 0 mismatches. A programmatic check of the CSV against RTE found 0 differences across all 50 rows. Official time bonuses also equal the cleaned data's `time_bonus` sums: Pogacar 52 s, Vingegaard 34 s, Lipowitz 4 s, Onley 4 s.

## Rules (2025)
1. **Points at stage finishes** (Regulations art. 24b). The scale depends on the stage's art. 22 coefficient, not on its profile name:
   - coefficients 1 and 2 ("no particular difficulty"): 50-30-20-18-16-14-12-10-8-7-6-5-4-3-2
   - coefficient 3 ("rolling"): 30-25-22-19-17-15-13-11-9-7-6-5-4-3-2
   - coefficients 4 and 5 ("very difficult"), and coefficient 6 (ITT): 20-17-15-13-11-10-9-8-7-6-5-4-3-2-1
   - **intermediate sprints**: 20-17-15-13-11-10-9-8-7-6-5-4-3-2-1 to the first 15 riders.
   - Ties on points are broken by stage wins, then intermediate-sprint wins, then GC. A rider must finish the Tour to be classified.
   - The coefficient for each stage comes from the regulations' "Table showing coefficients for the stages". The marks are drawn as graphics, so they were read from the PDF's filled-square positions:
     - coefficient 1 = stages 1, 3, 8, 9, 17, 21
     - coefficient 2 = stages 2, 4, 7, 11, 15
     - coefficient 3 = stages 6, 16, 20
     - coefficient 4 = stages 10, 12, 14
     - coefficient 5 = stages 18, 19
     - coefficient 6 = stages 5, 13
   - So the finish scale is 50 on stages 1, 2, 3, 4, 7, 8, 9, 11, 15, 17, 21; 30 on stages 6, 16, 20; 20 on stages 5, 10, 12, 13, 14, 18, 19.
   - **This differs from `stage.csv` `type` on 5 stages.** Stages 2, 4, 7 and 15 are `hilly` in the data but used the 50-point scale. Stage 16 (Mont Ventoux) is `mountain` in the data but used the 30-point scale.
   - Confirmed for stages 11-21 by cyclingstage's finish breakdowns (for example, the winner got 50 on stage 15 and 30 on stage 16).
   - Also confirmed by the totals. With the official mapping, Vingegaard's finish points from the data = 182 = his official total. Pogacar's = 287, plus his 7 intermediate-sprint points from cyclingstage = 294 = his official total. The type-based mapping gives 176 and 236.
   - Mountains scale (art. 24c): HC 20-15-12-10-8-6-4-2; cat 1 10-8-6-4-2-1; cat 2 5-3-2-1; cat 3 2-1; cat 4 1. Points were doubled on the Col de la Loze (stage 18).
2. **Young rider:** riders **born on or after 1 January 2000**. The French text of art. 24d says "nés depuis le 1er janvier 2000". The leader is the best-placed eligible rider in the GC.
   - Check: filtering the cleaned-data GC on `dob >= 2000-01-01` reproduces the official young top 10 exactly, in order and to the second.
   - Johannessen (born 1999-08-23, 6th in GC) and Arensman (1999-12-04, 12th) are correctly absent.
3. **Team classification** (art. 24e): the sum of each team's 3 best individual times on every stage. A team reduced to fewer than 3 riders is eliminated.
   - Ties within a stage are broken by the sum of the three riders' placings, then by the best rider's placing. Ties overall are broken by team stage wins, then 2nd places, and so on.
   - **Time bonuses and penalties are excluded.** The rule says "individual times", while art. 24a and 26 apply bonuses and penalties to the individual GC. Art. 26 adds a separate 30 s team penalty when a rider's offence benefits his team.
   - Evidence: summing the 3 lowest raw `finish_time` per team per stage over stages 1-21 reproduces the official top 10 exactly (232h01'32", +24'26", +1h24'47", ..., +3h43'35"). Using adjusted times gives +24'30", +1h25'43", and so on, which do not match.
4. **Stage-21 neutralisation.** It rained in Paris, so GC times were taken at the 4th passage of the Champs-Élysées finish line. The last 50.3 km, including the three Montmartre climbs, did not count for the GC (Cyclingnews stage-21 report; cyclingstage report; en.wikipedia).
   - Official final GC time of the winner: **Pogacar 76h 00' 32" = 273,632 s** (letour.fr archive, RTE, NBC, en/fr Wikipedia).
   - In the cleaned data, Pogacar has 73h54'59" after stage 20. So his official stage-21 GC time is 2h05'33" (7,533 s), while `result.csv` holds 3h07'30" (11,250 s, the stage winner's time). That explains the dataset total of 77h02'29" (+1h01'57"). Every GC gap is unchanged.
   - Time bonuses (art. 25): 10/6/4 s for the first three on every road stage, none in the ITTs (stages 5 and 13).
   - The team classification evidently did **not** use the 2h05'33" base for stage 21. The official team totals are reproduced only with the full-stage times in `result.csv`. This is an inference from the numbers; no source says it outright.

## Disagreements found
- **Team winner total.** fr.wikipedia gives Visma 232h03'32". en.wikipedia, RTE and the recomputation from the cleaned data give **232h01'32"**, and all three agree on every gap. 232h01'32" is used; the fr.wikipedia figure is likely a typo.
- **Cyclingnews final GC table** lists Pogacar at 73:54:59. That is his total after stage 20, without the stage-21 time. Its gaps match. 76h00'32" is used.
- **cyclingstage KOM summary page** shows Pogacar on 117. That is the stage-20 standing; their stage-21 page and all other sources say **119**, the extra 2 points coming from 2 of the 3 Montmartre cat-4 climbs.
- **Regulations, English vs French.** The English art. 24d says "born after 1 January 1999"; the French says "depuis le 1er janvier 2000". The French version and the published standings both support 1 January 2000.
- **fr.wikipedia rules text** says GC also included 8/5/2 s for "points bonus" sprints. The 2025 regulations (art. 25) only give finish bonuses, and the official bonus totals equal the finish bonuses in the data. That wording is outdated.
- **Ties, kept in published order:** points ranks 4-5 are both on 182 (Vingegaard ahead of Turgis); KOM ranks 5-6 are both on 51 (O'Connor ahead of Valentin Paret-Peintre). The value is the same on both rows; the rank follows the official tie-break.

## Source limitations
- letour.fr's live rankings pages now show the **2026** race, so they were not used. For 2025, only the archived GC table could be read. Wayback captures of the 2025 points, KOM, young and team tables return 404 or redirect to 2026 captures.
- ProCyclingStats and FirstCycling return 403 (bot protection), and Tissot Timing timed out. None of the three was used.
- Team names in sources use sponsor spellings or 2026 names. RTE, for example, uses "Decathlon CMA CGM Team" and "Netcompany INEOS". All are mapped to the exact `team.csv` names.

## Full published points and mountains standings (published_points_kom_2025.csv)

`official_classifications_2025.csv` holds only the top 10 of each classification. `published_points_kom_2025.csv` holds the complete 2025 final points (132 riders) and mountains (55 riders) standings, as collected by our teammate Jay from CyclingDB for his dashboard (`jay.html`, 2025 edition data; source links in the file). Checks:

- The top 10 of both lists is identical (rank, rider and points) to `official_classifications_2025.csv` (letour.fr / Wikipedia).
- Ranks run 1..n with no gaps or ties, and every bib exists in `data/cleaned/rider.csv`.
- For all 132 riders, published points ≥ the finish-line points we calculate from the race data. The difference is what they earned at intermediate sprints, which the race data does not record.
