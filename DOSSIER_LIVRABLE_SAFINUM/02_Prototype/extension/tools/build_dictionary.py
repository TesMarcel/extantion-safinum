"""Génère extension/dictionary.js à partir de liste_mots_a_traduire.csv.

Chaque colonne de langue du CSV (entre « anglais » et « remarque », hors
« fiabilite_* ») devient automatiquement une langue de l'extension.

Usage : python3 extension/tools/build_dictionary.py
"""
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = ROOT / "liste_mots_a_traduire.csv"
OUT_PATH = ROOT / "extension" / "dictionary.js"

AUDIO_DIR = ROOT / "extension" / "audio"
ITEMS_PATH = ROOT / "extension" / "recorder_items.js"
AUDIO_EXT = {".mp3", ".ogg", ".webm", ".wav", ".m4a"}

# Libellé affiché, code de langue HTML, description pour la traduction IA et
# langue de la voix de synthèse de secours (aucune voix n'existe pour ces langues :
# on prend la plus proche, en attendant les enregistrements de locuteurs natifs).
# Une langue absente d'ici fonctionne quand même (libellé = nom de colonne).
KNOWN = {
    "pidgin": ("Pidgin", "wes", "pidgin camerounais (Kamtok)", "en"),
    "fulfulde": ("Fulfulde", "ff", "fulfulde (variante de l'Adamaoua, Cameroun)", "fr"),
    "ewondo": ("Ewondo", "ewo", "ewondo (beti, région de Yaoundé, Cameroun)", "fr"),
    "duala": ("Duala", "dua", "duala (Douala, Cameroun)", "fr"),
    "basaa": ("Basaa", "bas", "basaa (Cameroun)", "fr"),
}
EMPTY = {"", "A VALIDER", "NE PAS TRADUIRE"}


def norm(s: str) -> str:
    """Doit rester identique à norm() dans content.js."""
    s = unicodedata.normalize("NFC", s)
    s = s.replace("’", "'").replace("‘", "'")
    s = re.sub(r"[\s  ]+", " ", s).strip()
    return s.lower()


def main() -> int:
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as f:
        rows = [r for r in csv.reader(f, delimiter=";") if r and not r[0].startswith("#")]

    header = rows[0]
    col = {name: i for i, name in enumerate(header)}
    start, end = col["anglais"] + 1, col["remarque"]
    lang_cols = [c for c in header[start:end] if not c.startswith("fiabilite_")]
    languages = []
    for c in lang_cols:
        label, html, desc, tts = KNOWN.get(c, (c.replace("_", " ").title(), "", c.replace("_", " "), "fr"))
        languages.append({"code": c, "label": label, "htmlLang": html, "description": desc, "ttsLang": tts})

    entries: dict[str, dict] = {}
    glossary: list[dict] = []
    ui: dict[str, dict] = {}  # textes propres à l'extension (U…)
    items: list[dict] = []  # pour l'outil d'enregistrement
    conflicts = 0
    for r in rows[1:]:
        rid = r[col["id"]]
        if rid.startswith(("X", "D")):  # protégés / dates : jamais traduits
            continue
        tr = {c: r[col[c]] for c in lang_cols if r[col[c]].strip() not in EMPTY}
        if rid.startswith("U"):
            ui[rid] = {"fr": r[col["francais"]], "en": r[col["anglais"]], **tr}
            items.append({"id": rid, "fr": r[col["francais"]], **tr})
            continue
        if rid.startswith("V"):
            glossary.append({"fr": r[col["francais"]], "en": r[col["anglais"]], **tr})
            continue
        items.append({"id": rid, "fr": r[col["francais"]], **tr})
        value = {"id": rid, **tr}
        for src in (r[col["francais"]], r[col["anglais"]]):
            key = norm(src)
            old = entries.get(key)
            if old and {k: v for k, v in old.items() if k != "id"} != tr:
                print(f"CONFLIT {key!r}: {old['id']} vs {rid}", file=sys.stderr)
                conflicts += 1
                continue
            entries.setdefault(key, value)

    # Enregistrements : extension/audio/<langue>/<id>.<ext>
    audio: dict[str, dict] = {}
    for c in lang_cols:
        d = AUDIO_DIR / c
        if d.is_dir():
            files = {f.stem: f.name for f in sorted(d.iterdir()) if f.suffix.lower() in AUDIO_EXT}
            if files:
                audio[c] = files

    payload = {"languages": languages, "entries": entries, "glossary": glossary, "ui": ui, "audio": audio}
    OUT_PATH.write_text(
        "// Fichier généré par tools/build_dictionary.py — ne pas modifier à la main.\n"
        "globalThis.SAFINUM_DICT = "
        + json.dumps(payload, ensure_ascii=False, indent=1)
        + ";\n",
        encoding="utf-8",
    )
    ITEMS_PATH.write_text(
        "// Fichier généré par tools/build_dictionary.py — ne pas modifier à la main.\n"
        "globalThis.SAFINUM_ITEMS = " + json.dumps(items, ensure_ascii=False, indent=1) + ";\n",
        encoding="utf-8",
    )
    names = ", ".join(l["label"] for l in languages)
    print(f"Langues : {names} — {len(entries)} entrées, {len(glossary)} termes de glossaire, {len(ui)} textes d'extension")
    for l in languages:
        print(f"  {l['label']} : {len(audio.get(l['code'], {}))} enregistrement(s)")
    return 1 if conflicts else 0


if __name__ == "__main__":
    sys.exit(main())
