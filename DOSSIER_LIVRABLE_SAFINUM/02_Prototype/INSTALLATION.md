# Safinum Lingua — Installation du prototype (v0.3.0)

Extension de navigateur (Manifest V3) qui affiche un service financier numérique en **pidgin camerounais**, **fulfulde** ou **ewondo**, sans modifier le code du service.

Code source : https://github.com/TesMarcel/extantion-safinum

## Installation

Décompresser `safinum-lingua-extension-v0.3.0.zip` (ou utiliser directement le dossier `extension/`).

| Navigateur | Installation |
|---|---|
| Google Chrome | `chrome://extensions` → **Mode développeur** → **Charger l'extension non empaquetée** → dossier `extension/` |
| Microsoft Edge | `edge://extensions` → **Mode développeur** → **Charger l'extension décompressée** → dossier `extension/` |
| Brave | `brave://extensions` → **Mode développeur** → **Charger l'extension non empaquetée** → dossier `extension/` |
| Opera | `opera://extensions` → **Mode développeur** → **Charger l'extension non empaquetée** → dossier `extension/` |
| Mozilla Firefox | `about:debugging#/runtime/this-firefox` → **Charger un module complémentaire temporaire** → fichier `extension/manifest.json` |

Ouvrir ensuite https://safinum.cm/hackathon-test : le sélecteur 🌍 apparaît en bas à gauche. Choisir une langue ; « Original » rétablit le texte d'origine à l'identique.

## Utilisation

- **Lecture vocale :** survoler un texte traduit puis cliquer sur 🔊, ou **Alt+L** sur l'élément sélectionné (**Échap** pour arrêter).
- **Texte original :** il s'affiche au survol.
- **Message inédit :** les phrases connues sont traduites. Les mots du glossaire financier reçoivent leur traduction entre parenthèses. La mention « Non traduit » (ou un avertissement de sécurité) est ajoutée.
- **Traduction IA :** facultative et **désactivée par défaut**. Elle n'est pas utilisée pour l'épreuve.

## Voix locales

Seules les voix installées sur l'ordinateur sont utilisées : aucun texte n'est envoyé à un serveur.

- **Windows / macOS :** voix du système (ajouter Français et Anglais au besoin).
- **Linux :** `espeak-ng` + `speech-dispatcher`, et lancer Chrome/Edge/Brave avec `--enable-speech-dispatcher` (inutile pour Firefox).

## Ajouter ou corriger une traduction

Modifier `liste_mots_a_traduire.csv` (une colonne par langue), puis lancer `python3 extension/tools/build_dictionary.py` et recharger l'extension.
