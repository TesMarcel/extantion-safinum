# Extension Safinum — SAFINUM Innovate Challenge 2026

Extension de navigateur qui rend les services financiers numériques compréhensibles dans les langues nationales du Cameroun (**pidgin**, **fulfulde** et **ewondo**), sans modifier le code source du service ciblé.

## Contenu du dépôt

| Fichier / dossier | Description |
|---|---|
| `PRESELECTION EPREUVE SAFINUM INNOVATE CHALLENGE Fr.pdf` | Énoncé officiel de l'épreuve de présélection |
| `liste_mots_a_traduire.csv` | Tous les textes de l'environnement de test, en FR / EN / pidgin / fulfulde / ewondo, avec niveau de fiabilité |
| `extension/` | Extension Chrome « Safinum Lingua » (Manifest V3) : dictionnaire généré depuis le CSV, protection des valeurs financières, traduction IA facultative des messages inédits |
| `extantion/` | Captures d'écran des 5 étapes de l'environnement de test |
| `logo safinum.png`, `logo safinum blanc.png` | Logos de l'événement |

## L'épreuve en bref

Prototype fonctionnel qui doit :
1. traduire les textes, instructions et messages de l'interface ;
2. accompagner un parcours (solde, frais, transfert) ;
3. **préserver exactement** montants, frais, bénéficiaires, conditions et alertes de sécurité ;
4. fonctionner sans modifier le code du service cible ;
5. traduire un **message inédit** injecté par le jury pendant la démo.

Livrables : description, prototype, vidéo ≤ 3 min, note technique (architecture, intégration, dépendances, limites), langues prises en charge + méthode de validation linguistique.

## Environnement de test : https://safinum.cm/hackathon-test

Application Vue.js « Safinum Pay », bascule FR/EN, 5 étapes :

| Étape | Contenu |
|---|---|
| 1. Solde | 250 000 FCFA, compte `CM 001 2345 6789 01`, 4 transactions récentes |
| 2. Frais | Compte Safinum (gratuit), Mobile Money (1,5 %, min 100, max 2 500), Autre banque (2 %, min 200, max 5 000) |
| 3. Bénéficiaire | Jean-Paul Mbarga, +237 6 99 12 34 56, motif, note, case « J'ai vérifié… » |
| 4. Récapitulatif | Montant, frais, total, bénéficiaire, téléphone, référence `SAF-2026-XXXXXX` |
| 5. Reçu | « Transfert effectué », mêmes valeurs |

Codes d'erreur : `AMOUNT_001`, `AMOUNT_002`, `BENEFICIARY_001`, `SECURITY_001`, `SECURITY_002`, `NETWORK_001`, `CONFIRM_001`.

### Comment le jury vérifie (panneau caché `?jury=1`)

- **Injection de contenu inédit** : encadré « Message important » ajouté après chargement (texte en FR ou EN).
- **Déclenchement d'erreurs / alertes** à la demande.
- **Couverture de traduction** : capture des textes visibles sans extension, puis % de textes modifiés avec l'extension.
- **Intégrité** : relit le `textContent` des éléments de valeur (solde, frais, total, montant, bénéficiaire, téléphone, référence) et la `value` des champs. Normalisation : suppression de « FCFA », espaces, virgules, points, apostrophes, puis minuscules. Le moindre écart → **« Compromis »**.

### Contraintes pour l'extension

- Ne rien ajouter ni modifier dans les éléments qui affichent une valeur (`25 000 FCFA` reste `25 000 FCFA`).
- Ne jamais toucher au contenu des champs de saisie (ex. « Paiement de services »).
- Traduire le texte affiché des `<option>`, jamais leur `value`.
- `MutationObserver` obligatoire : Vue réécrit les textes à chaque étape / changement de langue.
- Gérer le français **et** l'anglais comme langues sources.
- Ne pas collecter, stocker ou transmettre les données affichées : masquer montants, noms, numéros et références avant tout appel à un service externe.

### Barème du site (100 pts)

| Critère | Points |
|---|---|
| Fonctionnement du prototype | 25 |
| Fidélité des traductions | 20 |
| Sécurité et intégrité financière | 20 |
| Intégration aux services existants | 15 |
| Accessibilité et expérience utilisateur | 10 |
| Innovation et pertinence | 10 |

Qualité linguistique vérifiée à part. Défauts majeurs : contresens sur une action (envoyer / confirmer / annuler), montant modifié, alerte affaiblie, traduction d'un nom / numéro / référence, texte tronqué bloquant.

## Traductions

Les traductions pidgin, fulfulde et ewondo de `liste_mots_a_traduire.csv` sont des **brouillons** (fiabilité H / M / B indiquée par ligne). Elles doivent être validées par des locuteurs natifs avant la démonstration, en priorité les alertes de sécurité (A02–A09) et le bouton « Confirmer le transfert » (R11).

Langues prévues ensuite (une colonne à ajouter au CSV, remplie par un locuteur natif) : bamiléké, basaa, duala, bafia, kanuri, arabe choa, maka, bekwil, masa, toupouri, mafa.

## Installer l'extension (Chrome)

1. `chrome://extensions` → activer le **Mode développeur**.
2. **Charger l'extension non empaquetée** → choisir le dossier `extension/`.
3. Ouvrir https://safinum.cm/hackathon-test : le sélecteur 🌍 apparaît en bas à gauche.

Après une modification du CSV : `python3 extension/tools/build_dictionary.py`, puis recharger l'extension. Chaque colonne de langue du CSV devient une langue de l'extension.
