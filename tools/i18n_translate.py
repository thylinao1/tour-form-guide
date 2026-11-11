#!/usr/bin/env python3
"""Translate the interface text chunks with an OpenAI-compatible chat API (the NUS SoCLaaS gateway).

  python3 tools/i18n_translate.py [lang ...] [--merge]   langs: hi es zh ar (default: all)

Reads i18n/chunks/en-NN.json ({"index": "English"}), writes i18n/chunks/<lang>-NN.json with the same indexes,
then joins them into i18n/<lang>.json ({"English": "translation"}). A chunk is accepted only when every index
is present and every translation keeps the same number of "#" number slots; otherwise it is asked again.
Needs SOCLAAS_BASE_URL, SOCLAAS_API_KEY and SOCLAAS_GLM_MODEL in the environment."""
import glob, json, os, re, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CH = os.path.join(ROOT, 'i18n', 'chunks')
LANGS = {
    'hi': 'Hindi, written in Devanagari script, the everyday register used by Indian sports media',
    'es': 'Spanish, neutral international Spanish',
    'zh': 'Simplified Chinese (Mandarin, mainland usage)',
    'ar': 'Modern Standard Arabic',
}
RULES = """You translate the interface text of a web dashboard about the 2025 Tour de France (a cycling race) called "Race Analyst".
Translate every value of the JSON object from English into {lang}.

Rules:
1. Return ONLY one JSON object with exactly the same keys. No comments, no code fence.
2. "#" stands for a number. Keep every "#" (the same count), placed where the number belongs.
3. Do not translate: rider, team, town and country names, the product name "Race Analyst", codes such as E#, GC, OLAP, SQL, 3D, km, km/h, s.t., and symbols such as · → › ← + %.
4. Many values are fragments of a sentence (they may start in lower case or end without a full stop). Translate them so they still read well next to a name, a number or a link.
5. Keep leading and trailing punctuation such as ":" or "(" as in the original.
6. Use plain, short words. Never use an em dash or an en dash.
7. "Roll up", "Drill down", "Slice", "Dice" and "Pivot" are data analysis (OLAP) operations: translate them as such (Dice means filtering on several things at once, it is not a game die). "Form" means a rider's recent results. "Dark" and "Light" are colour themes of the page.
8. Cycling words: stage, time trial, yellow jersey (overall leader), green jersey (points), polka dot jersey (mountains), white jersey (best young rider), general classification, peloton, top ten finish.
{extra}"""
AR_EXTRA = """9. IMPORTANT for Arabic: this version must not contain gambling. Never use words for betting, bets, wagers, odds or bookmakers. Reword those ideas as neutral analysis: "bet" becomes "comparison" or "analysis", "Bet builder" becomes "Comparison builder", "fair odds" becomes "strength ratio", "before you bet" becomes "before you decide"."""

def ask(lang, chunk, attempt):
    body = {
        'model': os.environ['SOCLAAS_GLM_MODEL'], 'reasoning_effort': 'low', 'temperature': 0.2 + 0.2 * attempt, 'max_tokens': 16000,
        'messages': [{'role': 'system', 'content': RULES.format(lang=LANGS[lang], extra=AR_EXTRA if lang == 'ar' else '')},
                     {'role': 'user', 'content': json.dumps(chunk, ensure_ascii=False, indent=1)}],
    }
    req = urllib.request.Request(os.environ['SOCLAAS_BASE_URL'].rstrip('/') + '/chat/completions', data=json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + os.environ['SOCLAAS_API_KEY']})
    with urllib.request.urlopen(req, timeout=240) as r:
        text = json.load(r)['choices'][0]['message']['content']
    text = re.sub(r'^```(?:json)?|```$', '', text.strip(), flags=re.M).strip()
    return json.loads(text[text.index('{'): text.rindex('}') + 1])

def problems(chunk, out):
    bad = [k for k in chunk if not isinstance(out.get(k), str) or not out[k].strip()]
    bad += [k for k in chunk if k not in bad and out[k].count('#') != chunk[k].count('#')]
    bad += [k for k in chunk if k not in bad and re.search('[–—]', out[k])]
    return bad

def do_chunk(job):
    lang, path = job
    dest = os.path.join(CH, os.path.basename(path).replace('en-', lang + '-'))
    chunk = json.load(open(path, encoding='utf8'))
    done = json.load(open(dest, encoding='utf8')) if os.path.exists(dest) else {}
    todo = {k: v for k, v in chunk.items() if k in problems(chunk, done)}
    for attempt in range(4):
        if not todo: break
        try:
            got = ask(lang, todo, attempt)
        except Exception as e:  # network or JSON trouble: wait and ask again
            print(f'{lang} {os.path.basename(path)} attempt {attempt}: {type(e).__name__} {str(e)[:120]}', flush=True); time.sleep(4 + 4 * attempt); continue
        done.update({k: v.replace('—', ', ').replace('–', ' to ') for k, v in got.items() if k in todo and isinstance(v, str)})
        todo = {k: v for k, v in chunk.items() if k in problems(chunk, done)}
    json.dump(done, open(dest, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print(f'{lang} {os.path.basename(path)}: {len(chunk) - len(todo)}/{len(chunk)} ok', flush=True)
    return lang, len(todo)

def numbered(lang):
    """Texts with two or more numbers, translated with numbered slots ({1}, {2}) so a language can reorder them.
    Files i18n/chunks/multi-en-N.json and multi-<lang>-N.json, with matching keys."""
    out = {}
    for p in sorted(glob.glob(os.path.join(CH, 'multi-en-*.json'))):
        d = p.replace('multi-en-', f'multi-{lang}-')
        if not os.path.exists(d): continue
        src, tr = json.load(open(p, encoding='utf8')), json.load(open(d, encoding='utf8'))
        for k, en in src.items():
            v = tr.get(k)
            if isinstance(v, str) and sorted(re.findall(r'\{\d+\}', v)) == sorted(re.findall(r'\{\d+\}', en)) and not re.search('[\u2013\u2014]', v):
                out[re.sub(r'\{\d+\}', '#', en)] = v.strip()  # the lookup key is the English with # slots
    return out

def main():
    langs = [a for a in sys.argv[1:] if a in LANGS] or list(LANGS)
    only = [a for a in sys.argv[1:] if a.isdigit()]
    paths = [p for p in sorted(glob.glob(os.path.join(CH, 'en-*.json'))) if not only or p[-7:-5] in [o.zfill(2) for o in only]]
    left = []
    if '--merge' not in sys.argv:  # --merge: only join the chunk files that exist, ask the API nothing
        with ThreadPoolExecutor(max_workers=6) as pool:
            left = list(pool.map(do_chunk, [(l, p) for l in langs for p in paths]))
    for lang in langs:
        table = {}
        for p in sorted(glob.glob(os.path.join(CH, 'en-*.json'))):
            src = json.load(open(p, encoding='utf8')); d = os.path.join(CH, os.path.basename(p).replace('en-', lang + '-'))
            tr = json.load(open(d, encoding='utf8')) if os.path.exists(d) else {}
            bad = set(problems(src, tr))
            table.update({src[k]: tr[k].strip() for k in src if k not in bad})
        table.update(numbered(lang))
        extra = os.path.join(ROOT, 'i18n', 'extra.json')  # hand-added entries: {lang: {English: translation}}
        if os.path.exists(extra): table.update(json.load(open(extra, encoding='utf8')).get(lang, {}))
        json.dump(table, open(os.path.join(ROOT, 'i18n', lang + '.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=0, sort_keys=True)
        total = sum(len(json.load(open(p, encoding='utf8'))) for p in glob.glob(os.path.join(CH, 'en-*.json')))
        print(f'{lang}: {len(table)} of {total} translations', flush=True)

if __name__ == '__main__':
    main()
