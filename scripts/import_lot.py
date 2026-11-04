"""Convertit un lot compact (.txt) en lot JSON dans data/batches/.

Usage : python scripts/import_lot.py data/sources/lot-002.txt batch-002-b1-essentiels
Nécessite : pip install wordfreq

Format : une section par type (@word, @chunk, @collocation, @phrasal_verb, @connector, @idiom),
puis une ligne par élément, champs séparés par « | » :

    english | french | niveau | fréquence | priorité | exemple EN | exemple FR | surlignage | contexte | registre | tags | extras

- fréquence : vide pour un mot, calculée d'après le corpus ;
- contexte : c, d, w, t, a, n (vide = c) ; registre : i, f, s (vide = neutre) ;
- extras : clé=valeur séparées par « ;; » (pos, sense, sit, also, notes, variant, counterpart, family, forms, id).
"""
import json
import re
import sys
from pathlib import Path

from wordfreq import zipf_frequency

CONTEXTS = {"": "conversation", "c": "conversation", "d": "daily_life", "w": "work",
            "t": "travel", "a": "academic", "n": "news"}
REGISTERS = {"": "neutral", "i": "informal", "f": "formal", "s": "slang"}
POS = {"n": "noun", "v": "verb", "adj": "adjective", "adv": "adverb", "prep": "preposition",
       "pron": "pronoun", "det": "determiner", "conj": "conjunction"}
TYPES = {"word", "chunk", "collocation", "phrasal_verb", "connector", "idiom"}
FIELDS = 12


def zipf_band(zipf):
    for band, floor in ((5, 5.5), (4, 4.8), (3, 4.2), (2, 3.6)):
        if zipf >= floor:
            return band
    return 1


def slug(text):
    text = text.lower().replace("'", "").replace("...", " ")
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def parse_line(line, item_type, number):
    parts = [p.strip() for p in line.split("|")]
    if len(parts) == FIELDS - 1:
        parts.append("")  # extras facultatifs
    if len(parts) != FIELDS:
        sys.exit(f"Ligne {number} : {len(parts)} champs au lieu de {FIELDS} : {line}")
    english, french, level, freq, prio, ex_en, ex_fr, highlight, context, register, tags, extras = parts
    if item_type == "word":
        frequency = zipf_band(zipf_frequency(english.lower(), "en"))
    else:
        frequency = int(freq)
    item = {
        "id": slug(english), "english": english, "french": french, "type": item_type, "level": level,
        "frequency": frequency, "priority": int(prio), "example_en": ex_en, "example_fr": ex_fr,
        "highlight": highlight or english, "context": CONTEXTS[context], "register": REGISTERS[register],
        "tags": [t.strip() for t in tags.split(",") if t.strip()],
    }
    for pair in filter(None, (e.strip() for e in extras.split(";;"))):
        key, value = (x.strip() for x in pair.split("=", 1))
        if key == "pos":
            item["pos"] = POS[value]
        elif key == "sit":
            item["situation_fr"] = value
        elif key == "also":
            item["also_accept"] = [v.strip() for v in value.split(",")]
        elif key in {"sense", "notes", "variant", "counterpart", "family", "forms", "id"}:
            item[key] = value
        else:
            sys.exit(f"Ligne {number} : extra inconnu {key}")
    return item


def main():
    source, name = sys.argv[1], sys.argv[2]
    items, item_type = [], None
    for number, line in enumerate(Path(source).read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("@"):
            item_type = line[1:]
            if item_type not in TYPES:
                sys.exit(f"Ligne {number} : type inconnu {item_type}")
            continue
        items.append(parse_line(line, item_type, number))
    body = ",\n".join(json.dumps(i, ensure_ascii=False) for i in items)
    Path(f"data/batches/{name}.json").write_text(f"[\n{body}\n]\n", encoding="utf-8")
    print(f"{name} : {len(items)} éléments")


if __name__ == "__main__":
    main()
