# Attributions

Ce fichier liste les données et bibliothèques tierces utilisées par English SIT, avec leur licence.

## Données de fréquence : wordfreq

Les fréquences des mots viennent de [wordfreq](https://github.com/rspeer/wordfreq) 3.1.1, de Robyn Speer.

> Robyn Speer. (2022). rspeer/wordfreq: v3.0 (v3.0.2). Zenodo. <https://doi.org/10.5281/zenodo.7199437>

- **Licence :** le code de wordfreq est sous licence Apache 2.0, et ses données sous [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- **Fichiers concernés :** `data/generated/zipf.json`, ainsi que les champs `zipf` et `frequency` calculés à partir de ces données dans `data/batches/` et dans `deck.json`, le fichier publié avec le site.
- **Modifications :** seuls les scores des mots de la base sont conservés, et ils sont convertis en bandes de fréquence de 1 à 5.
- **Licence de ces données dérivées :** elles sont redistribuées sous la même licence, CC BY-SA 4.0.

### Sources reprises par wordfreq

wordfreq demande de créditer les données sur lesquelles il repose :

- **SUBTLEX** (SUBTLEX-US, SUBTLEX-UK et autres), de Marc Brysbaert et al. Ces listes sont librement disponibles sur <http://crr.ugent.be/programs-data/subtitle-frequencies>.
- **OpenSubtitles**, via [OPUS OpenSubtitles 2018](http://opus.nlpl.eu/OpenSubtitles.php). Les données viennent du projet [OpenSubtitles](http://www.opensubtitles.org/).
- **Google Books Ngrams** : <http://books.google.com/ngrams>.
- **Leeds Internet Corpus**, du Centre for Translation Studies de l'université de Leeds : <http://corpus.leeds.ac.uk/list.html>.
- **Wikipédia** : <http://www.wikipedia.org>.
- **ParaCrawl** : <https://paracrawl.eu>.

## Bibliothèques incluses dans le site

| Bibliothèque | Version | Licence |
|---|---|---|
| [Preact](https://github.com/preactjs/preact) | 11.1.1 | MIT |
| [Dexie](https://github.com/dexie/Dexie.js) | 4.4.7 | Apache 2.0 |
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | 5.4.2 | MIT |

## Contenu du projet

Les éléments de la base (sélection, traductions, exemples et niveaux) ont été rédigés pour ce projet. Ils ne sont pas copiés de listes protégées comme Oxford 3000 ou English Vocabulary Profile.

Aucune licence ouverte n'a été choisie à ce jour pour ce contenu et pour le code du projet.
