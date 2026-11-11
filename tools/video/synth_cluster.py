"""Runs on the NUS SoC cluster: synthesise the tutorial narration with the Kokoro speech model.
Reads narration.json: {"voice": "...", "speed": 1.0, "scenes": [{"id": "...", "say": "..."}]}.
Writes out/<id>.wav (24 kHz) and out/durations.json."""
import json, os
import numpy as np, soundfile as sf
from kokoro import KPipeline

spec = json.load(open("narration.json"))
os.makedirs("out", exist_ok=True)
pipe = KPipeline(lang_code="a")
durations = {}
for sc in spec["scenes"]:
    sid = sc["id"]
    parts = [a for _, _, a in pipe(sc["say"], voice=spec.get("voice", "af_heart"), speed=spec.get("speed", 1.0))]
    audio = np.concatenate([np.asarray(p) for p in parts])
    sf.write("out/" + sid + ".wav", audio, 24000)
    durations[sid] = round(len(audio) / 24000, 3)
    print(sid, durations[sid], flush=True)
json.dump(durations, open("out/durations.json", "w"), indent=1)
print("TOTAL", round(sum(durations.values()), 1))
