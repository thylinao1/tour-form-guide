#!/usr/bin/env python3
"""Collect the English interface text for translation.

  python3 tools/i18n_extract.py            (after tools/smoke.sh has rendered every tab into .smoke/)

Sources: the rendered tabs in .smoke/*.html (text and title, aria-label, placeholder attributes; chart drawings
are skipped) and the fixed sentences in src/*.js. Numbers become "#", the same way the page looks strings up, so
"Stage 4" and "Stage 12" are one entry. Text made only of rider, team, town or country names is left out.
Writes i18n/strings.json (a list) and i18n/chunks/en-NN.json ({"index": "text"}, 110 entries each)."""
import csv, glob, json, os, re, sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NUM = re.compile(r'\d+(?:[.,]\d+)*')
CHUNK = 110
# everyday words that also appear inside team, town or country names: never treated as a name
GENERIC = set('team teams red bull bike lease quick step education tech premier hotels united states the of and a an in on at to by for mont col la le de du des el al not specified great new saint south north west east united kingdom republic time trial stage mountain flat hilly start finish loop'.split())

def norm(s):
    return NUM.sub('#', re.sub(r'\s+', ' ', s).strip())

def name_tokens():
    toks = set()
    def add(s):
        toks.update(t.lower() for t in re.findall(r"[^\W\d_]+", s))
    for f, cols in [('rider.csv', ['rider_name', 'rider_team']), ('team.csv', ['team_name']), ('country.csv', ['country_name', 'country_code']),
                    ('stage.csv', ['start_location', 'finish_location'])]:
        for row in csv.DictReader(open(os.path.join(ROOT, 'data', 'cleaned', f), encoding='utf-8-sig')):
            for c in cols: add(row[c])
    app = open(os.path.join(ROOT, 'src', 'app.js'), encoding='utf8').read()
    for block in re.findall(r"(?:TEAM_SHORT|SHORT_COUNTRY) = \{(.*?)\};", app, re.S):
        for s in re.findall(r"'([^']+)'", block): add(s)
    return toks - GENERIC

class Text(HTMLParser):
    SKIP = {'script', 'style', 'svg', 'noscript', 'pre', 'code', 'option'}
    def __init__(self):
        super().__init__(convert_charrefs=True); self.depth = 0; self.out = []
    def handle_starttag(self, tag, attrs):
        if self.depth or tag in self.SKIP:
            if tag not in ('br', 'img', 'input', 'meta', 'link', 'hr', 'path', 'circle', 'rect', 'line', 'image', 'use', 'polyline', 'polygon', 'ellipse', 'stop'): self.depth += 1
            return
        for k, v in attrs:
            if k in ('title', 'aria-label', 'placeholder') and v: self.out.append(('attr', v))
    def handle_startendtag(self, tag, attrs):
        if not self.depth:
            for k, v in attrs:
                if k in ('title', 'aria-label', 'placeholder') and v: self.out.append(('attr', v))
    def handle_endtag(self, tag):
        if self.depth: self.depth -= 1
    def handle_data(self, data):
        if not self.depth and data.strip(): self.out.append(('text', data))

def source_sentences():
    out = []
    for f in sorted(glob.glob(os.path.join(ROOT, 'src', '*.js')) + glob.glob(os.path.join(ROOT, 'src', 'plugins', '*.js'))):
        if f.endswith('05-sql.js') or f.endswith('engine.js'): continue
        code = open(f, encoding='utf8').read()
        for m in re.finditer(r"'((?:[^'\\\n]|\\.){12,})'", code):
            s = m.group(1).replace("\\'", "'")
            if re.match(r"^[A-Z“][^<>{}=;$\\]*$", s) and len(s.split()) >= 3: out.append(s)
    return out

def main():
    names = name_tokens()
    found = {}
    dropped = []
    def take(raw, where, kind='text'):
        s = norm(raw)
        words = re.findall(r"[^\W\d_]{2,}", s)
        if not words or len(s) > 600: return
        n = sum(w.lower() in names for w in words)
        # only names; or a screen reader label about one rider or team; or mostly names
        if n == len(words) or (kind == 'attr' and n) or n * 2 >= len(words):
            dropped.append(s); return
        if re.fullmatch(r"[A-Z]?#?[A-Za-z]?", s): return
        found.setdefault(s, where)
    for f in sorted(glob.glob(os.path.join(ROOT, '.smoke', '*.html'))):
        p = Text(); p.feed(open(f, encoding='utf8', errors='replace').read())
        for kind, s in p.out: take(s, os.path.basename(f), kind)
    for s in source_sentences(): take(s, 'source')
    strings = sorted(found)
    os.makedirs(os.path.join(ROOT, 'i18n', 'chunks'), exist_ok=True)
    for old in glob.glob(os.path.join(ROOT, 'i18n', 'chunks', 'en-*.json')): os.remove(old)
    json.dump(strings, open(os.path.join(ROOT, 'i18n', 'strings.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=0)
    for i in range(0, len(strings), CHUNK):
        part = {str(j): strings[j] for j in range(i, min(i + CHUNK, len(strings)))}
        json.dump(part, open(os.path.join(ROOT, 'i18n', 'chunks', f'en-{i // CHUNK + 1:02d}.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    by = {}
    for s, w in found.items(): by[w] = by.get(w, 0) + 1
    print(len(strings), 'strings,', sum(len(s.split()) for s in strings), 'words,', (len(strings) + CHUNK - 1) // CHUNK, 'chunks')
    print(sorted(by.items(), key=lambda x: -x[1]))
    if '-v' in sys.argv: print('dropped', len(set(dropped)), sorted(set(dropped), key=len)[:60])

if __name__ == '__main__':
    main()
