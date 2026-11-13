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

# Libellé affiché, code de langue HTML et description pour la traduction IA.
# Une langue absente d'ici fonctionne quand même (libellé = nom de colonne).
KNOWN = {
    "pidgin": ("Pidgin", "wes", "pidgin camerounais (Kamtok)"),
    "fulfulde": ("Fulfulde", "ff", "fulfulde (variante de l'Adamaoua, Cameroun)"),
    "ewondo": ("Ewondo", "ewo", "ewondo (beti, région de Yaoundé, Cameroun)"),
    "duala": ("Duala", "dua", "duala (Douala, Cameroun)"),
    "basaa": ("Basaa", "bas", "basaa (Cameroun)"),
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
        label, html, desc = KNOWN.get(c, (c.replace("_", " ").title(), "", c.replace("_", " ")))
        languages.append({"code": c, "label": label, "htmlLang": html, "description": desc})

    entries: dict[str, dict] = {}
    glossary: list[dict] = []
    conflicts = 0
    for r in rows[1:]:
        rid = r[col["id"]]
        if rid.startswith(("X", "D")):  # protégés / dates : jamais traduits
            continue
        tr = {c: r[col[c]] for c in lang_cols if r[col[c]].strip() not in EMPTY}
        if rid.startswith("V"):
            glossary.append({"fr": r[col["francais"]], "en": r[col["anglais"]], **tr})
            continue
        value = {"id": rid, **tr}
        for src in (r[col["francais"]], r[col["anglais"]]):
            key = norm(src)
            old = entries.get(key)
            if old and {k: v for k, v in old.items() if k != "id"} != tr:
                print(f"CONFLIT {key!r}: {old['id']} vs {rid}", file=sys.stderr)
                conflicts += 1
                continue
            entries.setdefault(key, value)

    payload = {"languages": languages, "entries": entries, "glossary": glossary}
    OUT_PATH.write_text(
        "// Fichier généré par tools/build_dictionary.py — ne pas modifier à la main.\n"
        "globalThis.SAFINUM_DICT = "
        + json.dumps(payload, ensure_ascii=False, indent=1)
        + ";\n",
        encoding="utf-8",
    )
    names = ", ".join(l["label"] for l in languages)
    print(f"Langues : {names} — {len(entries)} entrées, {len(glossary)} termes de glossaire")
    return 1 if conflicts else 0


if __name__ == "__main__":
    sys.exit(main())
