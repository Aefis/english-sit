# English SIT

Flashcards pour passer de « je reconnais ce mot » à « je l'utilise en parlant ». Plus de 8 500 éléments, de A1 à C1, publiés par lots contrôlés.

**Site : <https://aefis.github.io/english-sit/>**

La conception complète est dans [docs/CONCEPTION.md](docs/CONCEPTION.md).

## Démarrer

```bash
npm install
npm run dev
```

Raccourcis en révision : `Espace` ou un clic retourne la carte, `H` affiche l'indice, `1` répond « Je connais », `2` répond « À réviser », `S` lit la réponse.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Assemble la base et lance l'application |
| `npm test` | Lance les tests |
| `npm run validate` | Contrôle les lots et liste erreurs et alertes |
| `npm run report` | Affiche les distributions de la base |
| `npm run build` | Produit la version statique dans `dist/` |
| `python scripts/frequency.py` | Recalcule les fréquences (nécessite `pip install wordfreq`) |

## Ajouter un lot

1. Écris `data/sources/lot-NNN.txt`, puis lance `python scripts/import_lot.py data/sources/lot-NNN.txt batch-NNN-theme`. Le format est décrit dans ce script.
2. Lance `python scripts/frequency.py`, puis `npm run validate`.
3. Corrige les erreurs. Pour une alerte légitime, ajoute la paire à `data/dedupe-allow.json` avec sa raison.
4. Lance `npm run report` pour vérifier les distributions.

Ne change jamais l'`id` d'un élément publié : la progression y est rattachée.

## Sources

Fréquences : [wordfreq](https://github.com/rspeer/wordfreq) (données CC BY-SA 4.0). Traductions et exemples sont originaux. Le détail des crédits et des licences est dans [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
