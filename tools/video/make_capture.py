#!/usr/bin/env python3
"""Turn the storyboard into one Playwright capture script per scene.

  python3 tools/video/make_capture.py <durations.json> <frames_dir> <out_dir> [base_url]

storyboard.json holds the scenes: id, say (narration), caption lines and timed steps (at = fraction of the scene, 0 to 1).
durations.json maps scene id to the length of its narration audio in seconds.
Each generated file is a function (page) => {...} that plays the scene in the real dashboard
and saves numbered JPEG frames at a fixed rate, so the video shows the real interface.
"""
import json, os, sys

FPS = 10
HERE = os.path.dirname(os.path.abspath(__file__))

HELPERS = r"""
const pad = (n) => String(n).padStart(5, '0');
async function setup(page) {
  await page.evaluate(() => {
    if (document.getElementById('vcursor')) return;
    const st = document.createElement('style');
    st.textContent = `
      #vcursor{position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(255,210,10,.55);border:2px solid #15191e;z-index:2147483646;pointer-events:none;transition:transform .55s cubic-bezier(.2,.8,.2,1);transform:translate(640px,360px)}
      #vcursor.tap{animation:vtap .45s ease-out}
      @keyframes vtap{0%{box-shadow:0 0 0 0 rgba(255,210,10,.9)}100%{box-shadow:0 0 0 26px rgba(255,210,10,0)}}
      #vcaption{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);max-width:980px;padding:12px 22px;border-radius:12px;background:rgba(21,25,30,.93);color:#fff;font:600 24px/1.3 Barlow,system-ui,sans-serif;text-align:center;z-index:2147483647;pointer-events:none;box-shadow:0 10px 30px rgba(0,0,0,.35);transition:opacity .25s}
      #vcaption b{color:#ffd20a}
      #vcaption:empty{opacity:0}
      .vspot{outline:4px solid #ffd20a !important;outline-offset:4px;border-radius:10px;transition:outline-color .3s}
      html{scroll-behavior:smooth}`;
    document.head.appendChild(st);
    const c = document.createElement('div'); c.id = 'vcursor'; document.body.appendChild(c);
    const cap = document.createElement('div'); cap.id = 'vcaption'; document.body.appendChild(cap);
  });
}
async function step(page, s) {
  if (s.do === 'caption') { await page.evaluate((t) => { document.getElementById('vcaption').textContent = t; }, s.text || ''); return; }
  if (s.do === 'go') { await page.evaluate((v) => { location.hash = v; }, s.view); return; }
  if (s.do === 'top') { await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); return; }
  if (s.do === 'scrollBy') { await page.evaluate((y) => window.scrollBy({ top: y, behavior: 'smooth' }), s.y); return; }
  if (s.do === 'eval') { await page.evaluate(s.js); return; }
  if (s.do === 'key') { await page.keyboard.press(s.key); return; }
  const box = await page.evaluate(({ sel, nth, text }) => {
    let els = [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null || e.getClientRects().length);
    if (text) els = els.filter((e) => e.textContent.trim().toLowerCase().includes(text.toLowerCase()));
    const el = els[nth || 0];
    if (!el) return null;
    return new Promise((res) => {
      const r0 = el.getBoundingClientRect();
      const vh = window.innerHeight;
      if (r0.top < 90 || r0.bottom > vh - 120) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => { const r = el.getBoundingClientRect(); res({ x: r.left + Math.min(r.width / 2, 260), y: r.top + Math.min(r.height / 2, 60) }); }, 480);
    });
  }, { sel: s.sel, nth: s.nth, text: s.text });
  if (!box) { MISSING.push(s.sel + (s.text ? ' ~ ' + s.text : '')); return; }
  if (s.do === 'spot') {
    await page.evaluate(({ sel, nth, text }) => {
      document.querySelectorAll('.vspot').forEach((e) => e.classList.remove('vspot'));
      let els = [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null || e.getClientRects().length);
      if (text) els = els.filter((e) => e.textContent.trim().toLowerCase().includes(text.toLowerCase()));
      if (els[nth || 0]) els[nth || 0].classList.add('vspot');
    }, { sel: s.sel, nth: s.nth, text: s.text });
    await page.evaluate(({ x, y }) => { document.getElementById('vcursor').style.transform = `translate(${x}px,${y}px)`; }, box);
    return;
  }
  if (s.do === 'unspot') { await page.evaluate(() => document.querySelectorAll('.vspot').forEach((e) => e.classList.remove('vspot'))); return; }
  await page.evaluate(({ x, y }) => { document.getElementById('vcursor').style.transform = `translate(${x}px,${y}px)`; }, box);
  if (s.do === 'move') return;
  PENDING.push({ at: Date.now() + 600, x: box.x, y: box.y, kind: s.do, value: s.value });
}
async function flush(page) {
  for (let i = PENDING.length - 1; i >= 0; i--) {
    const p = PENDING[i];
    if (Date.now() < p.at) continue;
    PENDING.splice(i, 1);
    await page.evaluate(() => { const c = document.getElementById('vcursor'); c.classList.remove('tap'); void c.offsetWidth; c.classList.add('tap'); });
    await page.mouse.click(p.x, p.y);
    if (p.kind === 'type' && p.value) await page.keyboard.type(p.value, { delay: 70 });
  }
}
"""

def main():
    durations = json.load(open(sys.argv[1]))
    frames_dir, out_dir = sys.argv[2], sys.argv[3]
    base = sys.argv[4] if len(sys.argv) > 4 else None
    board = json.load(open(os.path.join(HERE, 'storyboard.json')))
    os.makedirs(out_dir, exist_ok=True)
    for i, sc in enumerate(board['scenes']):
        dur = float(durations[sc['id']]) + float(sc.get('pad', 0.6))
        frames = int(round(dur * FPS))
        sc = dict(sc, steps=[dict(st, at=round(st['at'] * (dur - 0.4), 2)) for st in sc['steps']])  # step times are fractions of the scene
        js = f"""async (page) => {{
const MISSING = [], PENDING = [];
{HELPERS}
const scene = {json.dumps(sc)};
{f"await page.goto({json.dumps(base)}); await page.waitForTimeout(1200);" if (base and i == 0) else ""}
await setup(page);
const steps = scene.steps.slice().sort((a, b) => a.at - b.at);
let si = 0; const t0 = Date.now();
for (let i = 0; i < {frames}; i++) {{
  const t = i / {FPS};
  while (si < steps.length && steps[si].at <= t) {{ await step(page, steps[si++]); }}
  await flush(page);
  await page.screenshot({{ path: {json.dumps(frames_dir)} + '/' + scene.id + '/f' + pad(i) + '.jpg', type: 'jpeg', quality: 90 }});
  const wait = t0 + (i + 1) * {1000 // FPS} - Date.now();
  if (wait > 0) await page.waitForTimeout(wait);
}}
return {{ scene: scene.id, frames: {frames}, seconds: (Date.now() - t0) / 1000, missing: MISSING }};
}}
"""
        open(os.path.join(out_dir, f"{i:02d}_{sc['id']}.js"), 'w').write(js)
        print(f"{i:02d} {sc['id']}: {dur:.1f}s, {frames} frames")

if __name__ == '__main__':
    main()
