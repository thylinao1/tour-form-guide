// Build the dashboard into one self-contained file.
//   node build.mjs            -> index.html (opens by double-click, works offline)
//   node build.mjs out.html   -> same page written to another path
// Inputs: data/cleaned/*.csv (one per table), data/official/*.csv (published standings),
// data/weather, data/geo_2025.json, src/*, src/plugins/*, vendor/* (chart libraries, inlined).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLEAN = path.join(here, 'data', 'cleaned');
const DATA = path.join(here, 'data', 'official');
const SRC = path.join(here, 'src');
const VENDOR = path.join(here, 'vendor');

/** RFC 4180 CSV parser (quotes, doubled quotes, commas and newlines inside quotes). */
export function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [], cell = '', i = 0, q = false;
  while (i < text.length) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i += 2; continue; } q = false; i++; continue; }
      cell += c; i++; continue;
    }
    if (c === '"') { q = true; i++; continue; }
    if (c === ',') { row.push(cell); cell = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; continue; }
    cell += c; i++;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1 || r[0] !== '');
  return body.map((r) => Object.fromEntries(head.map((h, j) => [h, r[j] ?? ''])));
}
const read = (dir, f) => parseCSV(fs.readFileSync(path.join(dir, f), 'utf8'));
const int = (x) => { const n = Number(x); if (!Number.isInteger(n)) throw new Error(`not an integer: ${x}`); return n; };

/** Load the cleaned tables into the compact shape the engine expects. */
export function loadData() {
  const riders = read(CLEAN, 'rider.csv').map((r) => [int(r.bib_number), r.rider_name, r.dob, r.rider_team, r.rider_country]);
  const teams = read(CLEAN, 'team.csv').map((t) => [t.team_name, t.team_country]);
  const stages = read(CLEAN, 'stage.csv').map((s) => [int(s.stage_id), s.date, Number(s.distance), s.type, s.start_location, s.finish_location]);
  const results = read(CLEAN, 'result.csv').map((r) => [int(r.bib_number), int(r.stage_id), int(r.finish_time), int(r.rank), int(r.time_bonus), int(r.time_penalty)]);
  const exits = read(CLEAN, 'exit.csv').map((e) => [int(e.bib_number), int(e.exit_stage), e.reason]);
  const countries = read(CLEAN, 'country.csv').map((c) => [c.country_code, c.country_name]);
  const official = read(DATA, 'official_classifications_2025.csv').map((o) => ({
    c: o.classification, rank: int(o.rank), bib: o.bib_number ? int(o.bib_number) : null, name: o.name,
    team: o.team_name, value: o.value_text, num: Number(o.value_numeric), unit: o.unit, url: o.source_url,
  }));
  // full published points and mountains standings (top 10 = official file); [classification, rank, bib, points]
  const published = read(DATA, 'published_points_kom_2025.csv').map((p) => [p.classification, int(p.rank), int(p.bib_number), int(p.points)]);
  // map outlines and stage towns for the route and nation maps (presentation only)
  const geo = JSON.parse(fs.readFileSync(path.join(here, 'data', 'geo_2025.json'), 'utf8'));
  // 2025 race-day weather at each finish town (Open-Meteo archive); [stage, max temp C, rain mm, max wind km/h, wet, hot, windy]
  const weather = read(path.join(here, 'data', 'weather'), 'stage_weather_2025.csv').map((w) => [int(w.stage_id), Number(w.temp_max_c), Number(w.rain_mm), Number(w.wind_max_kmh), int(w.wet), int(w.hot), int(w.windy)]);
  // sanity checks against the documented shape of the cleaned data
  const expect = (cond, msg) => { if (!cond) throw new Error(`data check failed: ${msg}`); };
  expect(published.filter((p) => p[0] === 'points').length === 132 && published.filter((p) => p[0] === 'kom').length === 55, 'published points 132 / kom 55');
  for (const c of ['points', 'kom']) {
    const top = published.filter((p) => p[0] === c).slice(0, 10), off = official.filter((o) => o.c === c).sort((a, b) => a.rank - b.rank);
    expect(top.every((p, i) => p[1] === off[i].rank && p[2] === off[i].bib && p[3] === off[i].num), `published ${c} top 10 equals the official top 10`);
  }
  expect(stages.every((s) => geo.places[s[4]] && geo.places[s[5]]), 'every stage town has coordinates');
  expect(riders.length === 184, 'riders 184');
  expect(teams.length === 23, 'teams 23');
  expect(stages.length === 21, 'stages 21');
  expect(results.length === 3602, 'results 3602');
  expect(exits.length === 24, 'exits 24');
  expect(official.length === 50, 'official rows 50');
  const bibs = new Set(riders.map((r) => r[0]));
  expect(results.every((r) => bibs.has(r[0])), 'result bibs exist');
  expect(official.every((o) => o.bib == null || bibs.has(o.bib)), 'official bibs exist');
  expect(published.every((p) => bibs.has(p[2])), 'published bibs exist');
  expect(weather.length === 21, 'weather rows 21');
  return { riders, teams, stages, results, exits, countries, official, published, geo, weather };
}

// Make inline <script> content safe: "</script" must not appear literally, and the
// JS line separators U+2028/U+2029 are written as escapes. (BS = one backslash.)
const BS = String.fromCharCode(92), LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
const escScript = (s) => s.replace(/<\/(script)/gi, '<' + BS + '/$1').split(LS).join(BS + 'u2028').split(PS).join(BS + 'u2029');

/** Plugins: every src/plugins/*.js and *.css, in name order. PLUGINS=none or PLUGINS=a,b limits the set. */
function pluginFiles(ext) {
  const dir = path.join(SRC, 'plugins');
  const want = process.env.PLUGINS || 'all';
  if (want === 'none' || !fs.existsSync(dir)) return [];
  const pick = want === 'all' ? null : new Set(want.split(',').map((x) => x.trim()));
  return fs.readdirSync(dir).filter((f) => f.endsWith(ext)).sort()
    .filter((f) => !pick || pick.has(f.replace(/\.(js|css)$/, '')))
    .map((f) => ({ name: f, text: fs.readFileSync(path.join(dir, f), 'utf8') }));
}

// Test hook, used by tools/smoke.sh only: with ?smoke in the URL the page records script errors,
// clicks the selectors given in ?click=a|b|c one after another, then writes the errors into <pre id="__smoke">.
const SMOKE = `(function(){var q=new URLSearchParams(location.search);if(!q.has('smoke'))return;var errs=[];
window.addEventListener('error',function(e){errs.push(String(e.message)+' @'+(e.filename||'').split('/').pop()+':'+e.lineno);});
window.addEventListener('unhandledrejection',function(e){errs.push('rejection: '+String(e.reason));});
var ce=console.error;console.error=function(){errs.push('console.error: '+[].slice.call(arguments).join(' '));ce.apply(console,arguments);};
function done(){var p=document.createElement('pre');p.id='__smoke';p.hidden=true;p.textContent=errs.length?errs.join('\\n'):'NO_ERRORS';document.body.appendChild(p);}
window.addEventListener('load',function(){var cs=(q.get('click')||'').split('|').filter(Boolean),i=0;
(function next(){if(i>=cs.length){setTimeout(done,700);return;}var el=null;try{el=document.querySelector(cs[i]);}catch(x){errs.push('bad selector: '+cs[i]);}
if(el)el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));else errs.push('click target not found: '+cs[i]);i++;setTimeout(next,450);})();});})();`;

/** Satellite terrain image behind the enlarged route map: NASA Blue Marble shaded relief (public domain),
    one WMS image in plain longitude and latitude. bbox = [lonMin, latMin, lonMax, latMax]. */
function reliefImage() {
  const file = path.join(here, 'data', 'relief_france.jpg');
  const meta = { bbox: [-5.4, 41.9, 8.6, 51.6], w: 1600, h: 1618 };
  if (!fs.existsSync(file)) return Object.assign(meta, { src: '' });
  return Object.assign(meta, { src: `data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}` });
}

/** Translations of the interface text, one file per language in i18n/ ({"English": "translation"}).
    Made by tools/i18n_extract.py and tools/i18n_translate.py. A missing file just leaves that language out. */
function dictionaries() {
  const MIN_ENTRIES = 800;
  const out = {};
  for (const lang of ['hi', 'es', 'fr', 'zh', 'ar', 'he']) {
    const file = path.join(here, 'i18n', `${lang}.json`);
    if (!fs.existsSync(file)) continue;
    const dict = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Object.keys(dict).length >= MIN_ENTRIES) out[lang] = dict; // a half-made language is not offered
  }
  return out;
}

export function build(outFile) {
  const data = loadData();
  const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');
  const body = fs.readFileSync(path.join(SRC, 'body.html'), 'utf8');
  const engine = fs.readFileSync(path.join(SRC, 'engine.js'), 'utf8');
  const app = fs.readFileSync(path.join(SRC, 'app.js'), 'utf8');
  const echarts = fs.readFileSync(path.join(VENDOR, 'echarts.min.js'), 'utf8');
  const gl = fs.readFileSync(path.join(VENDOR, 'echarts-gl.min.js'), 'utf8');
  const pcss = pluginFiles('.css'), pjs = pluginFiles('.js');
  const head = [
    '<title>Tour de France 2025 Race Analyst</title>',
    `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#ffd20a"/><circle cx="10" cy="20" r="5.5" fill="none" stroke="#15191e" stroke-width="2.2"/><circle cx="22" cy="20" r="5.5" fill="none" stroke="#15191e" stroke-width="2.2"/><path d="M10 20l5-9h6l1 9M15 11l4 9" fill="none" stroke="#15191e" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg>')}">`,
    '<meta name="description" content="Interactive OLAP dashboard of the Tour de France 2025: overall race, stages, jerseys, teams, nations and rider match-ups.">',
    `<style>\n${fs.readFileSync(path.join(VENDOR, 'fonts.css'), 'utf8')}\n</style>`,
    `<style>\n${css}\n${pcss.map((p) => `/* plugin ${p.name} */\n${p.text}`).join('\n')}\n</style>`,
  ].join('\n');
  const scripts = [
    `<script>${escScript(SMOKE)}</script>`,
    `<script>/* ECharts 5.6.0, Apache-2.0 */\n${escScript(echarts)}\n</script>`,
    `<script>/* ECharts GL 2.0.9, BSD-3-Clause */\n${escScript(gl)}\n</script>`,
    `<script>window.TDF_DATA = ${escScript(JSON.stringify(data))};</script>`,
    `<script>window.TDF_RELIEF = ${JSON.stringify(reliefImage())};</script>`,
    `<script>window.TDF_I18N = ${escScript(JSON.stringify(dictionaries()))};</script>`,
    `<script>\n${escScript(engine)}\n</script>`,
    `<script>\n${escScript(app)}\n</script>`,
    ...pjs.map((p) => `<script>/* plugin ${p.name} */\n${escScript(p.text)}\n</script>`),
  ].join('\n');
  const full = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n${scripts}\n</body>\n</html>\n`;
  const out = outFile || path.join(here, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, full);
  return { out, bytes: Buffer.byteLength(full), dataBytes: Buffer.byteLength(JSON.stringify(data)), plugins: pjs.map((p) => p.name) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = build(process.argv[2]);
  console.log(`built ${path.relative(process.cwd(), r.out)} (${(r.bytes / 1024).toFixed(0)} KB, data ${(r.dataBytes / 1024).toFixed(0)} KB), plugins: ${r.plugins.join(', ') || 'none'}`);
}
