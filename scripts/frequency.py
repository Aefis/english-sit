"""Calcule la fréquence corpus (échelle Zipf, wordfreq) des mots simples des lots.

Usage : python scripts/frequency.py   (nécessite : pip install wordfreq)
Seuls des nombres sont conservés. Les expressions restent estimées, car wordfreq
ne fait que combiner les fréquences des mots isolés.
"""
import json
from pathlib import Path

from wordfreq import zipf_frequency

words = set()
for path in sorted(Path("data/batches").glob("*.json")):
    for item in json.loads(path.read_text(encoding="utf-8")):
        if item["type"] == "word":
            words.add(item["english"].lower())

out = {w: zipf_frequency(w, "en") for w in sorted(words)}
Path("data/generated/zipf.json").write_text(json.dumps(out, indent=0), encoding="utf-8")
print(f"{len(out)} mots")
