# Conception : English SIT

Réponse aux points 1 à 8 du §29 du cahier des charges. Le prototype de 100 éléments (point 9) est dans le dépôt. La génération massive (point 10) attend ta validation.

## 1. Analyse du cahier des charges

Le cahier des charges est solide sur l'essentiel : il décrit un système d'apprentissage de l'anglais actif, pas une liste de mots. Trois idées structurent la conception :

1. **L'unité d'apprentissage est le sens, pas la forme.** `deal`, `deal with`, `a big deal` et `It's not a big deal` sont quatre éléments distincts.
2. **L'unité de révision est la carte, pas l'élément.** Un même élément se révise en compréhension, en production et en situation, et ces mémoires évoluent à des vitesses différentes.
3. **Le contenu et la progression sont séparés.** La base peut être corrigée et enrichie pendant des années sans perdre ta progression, à condition que les identifiants soient stables.

## 2. Architecture

```
data/batches/*.json ──> validation ──> public/deck.json ──> application ──> IndexedDB
   (contenu écrit)      + doublons      (contenu livré)     (Preact, FSRS)  (ta progression)
                        + fréquences
```

| Couche | Choix | Raison |
|---|---|---|
| Application | Vite, TypeScript, Preact | Légère (53 Ko compressés) et sans serveur. |
| Répétition espacée | `ts-fsrs` 5.4 (FSRS-6, MIT) | Implémentation de référence. La version 6.0 exige Node 24. |
| Progression | IndexedDB via Dexie, avec export/import JSON | Fonctionne hors ligne, sans compte. |
| Contenu | Lots JSON versionnables, compilés au build | Chaque lot se relit et se valide séparément. |
| Fréquences | `wordfreq` (script Python hors application) | Seuls des nombres sont conservés. |

Toute la logique est dans `src/core/` en fonctions pures testées. L'interface, dans `src/ui/`, ne contient pas de règle métier.

**Mesures à 10 000 éléments et 20 000 cartes** (données synthétiques, Node) : file de révision 15 ms, statistiques 55 ms, recherche 52 ms, détection des doublons 1,6 s au build. Le fichier `deck.json` devrait peser environ 6 Mo non compressé, par extrapolation des 62 Ko actuels. Une base de données serveur n'est donc pas nécessaire.

## 3. Schéma de données

Le schéma de référence est `src/core/schema.ts`. Il reprend tes champs du §11 et ajoute ceux qui manquaient.

### Élément

| Champ | Requis | Rôle |
|---|---|---|
| `id` | oui | Slug stable, jamais réutilisé (`deal-with`). Remplace l'entier du §11. |
| `english`, `french` | oui | Forme enseignée et sens naturel. |
| `type` | oui | Forme linguistique : `word`, `chunk`, `collocation`, `phrasal_verb`, `idiom`, `connector`. |
| `level` | oui | A1, A2, B1, B2, B2+, C1. |
| `frequency` | oui | 1 à 5. Recalculée d'après le corpus pour les mots simples. |
| `priority` | oui | 1 à 5, utilité pédagogique. |
| `example_en`, `example_fr` | oui | Exemple court et naturel. |
| `highlight` | oui | **Nouveau.** Partie de l'exemple qui porte l'élément (`ended up`). Sert au surlignage et aux indices, et prouve que l'exemple contient bien l'élément. |
| `context`, `register`, `tags` | oui | Le domaine professionnel est le tag `pro`, pas un type. |
| `pos` | mots | **Nouveau.** Nature grammaticale. |
| `sense` | si homonymes | **Nouveau.** Distingue deux entrées de même forme. |
| `situation_fr` | non | **Nouveau.** Consigne de la carte contextuelle (§13). |
| `also_accept` | non | **Nouveau.** Autres réponses justes en production. |
| `variant`, `counterpart` | non | UK/US/both, et l'équivalent : `lift` ↔ `elevator` dans une seule entrée. |
| `family` | non | **Nouveau.** Clé de famille lexicale. |
| `forms` | non | **Nouveau.** Formes irrégulières (`lend, lent, lent`), sans créer d'entrée. |
| `notes`, `ipa`, `audio` | non | `ipa` et `audio` sont prévus mais vides. |
| `status` | non | **Nouveau.** `draft`, `auto_checked`, `human_reviewed`. |

Calculés au build : `order` (rang d'apprentissage), `zipf`, `frequency_source` (`corpus` ou `estimate`), `batch`.

### Carte (générée, jamais écrite à la main)

| Type | Recto | Verso | Créée si |
|---|---|---|---|
| `recognition` | Anglais + exemple | Français | Toujours |
| `production` | Exemple français, indice à la demande (`I w__ a____ t_ leave.`) | Anglais | Toujours |
| `context` | Situation en français | Anglais | `situation_fr` renseigné |

### Progression, par carte

`state`, `due`, `lastReview`, `stability`, `difficulty`, `reps`, `lapses`, `correct`, `wrong`, `seed`. Chaque révision est aussi journalisée, ce qui permettra d'optimiser FSRS sur tes propres données.

## 4. Familles lexicales et doublons

**Familles.** `decide`, `decision`, `decisive` et `indecisive` restent des éléments séparés, reliés par `family: "decide"` et affichés ensemble au verso. La règle de découpe est la suivante :

- **Dérivation** (`decide` → `decision`) : un élément, car l'usage est différent.
- **Flexion** (`work` → `worked`) : pas d'élément. Les formes irrégulières vont dans `forms`.
- **Sens distinct** : un élément par sens fréquent, avec `sense`.

**Doublons.** Chaque texte est réduit à une clé normalisée : casse, contractions, `...`, articles et `to` initiaux, `someone`/`something`, orthographe UK/US.

| Niveau | Détection | Effet |
|---|---|---|
| Erreur | Même `id` ; même clé sans `sense` distinct ; `counterpart` déjà présent comme entrée | Bloque le build |
| Alerte | Quasi-doublon (radicaux communs ou distance d'édition) ; forme fléchie ; même exemple | À trancher |
| Alerte | Même traduction | Pas un doublon, mais la carte de production serait ambiguë |

Une alerte acceptée va dans `data/dedupe-allow.json` avec sa raison, pour ne pas être rediscutée à chaque lot. Par exemple, `It's not a big deal` et `a big deal` sont proches mais de sens opposés.

Le chevauchement entre chunk et phrasal verb se règle par une seule entrée taguée. Dans le prototype, `end up` couvre `I ended up...`, et `It turns out that...` couvre `turn out`.

## 5. Sélection et classement des 10 000 éléments

**Mots.** Le vivier vient de listes ouvertes, jamais d'un dictionnaire propriétaire :

| Source | Usage | Licence |
|---|---|---|
| [wordfreq](https://github.com/rspeer/wordfreq) | Fréquence par mot, instantané arrêté vers 2021 | Code libre ; données CC BY-SA 4.0 |
| [NGSL](https://www.newgeneralservicelist.com/new-general-service-list) et sa [liste orale](https://www.newgeneralservicelist.com/ngsl-spoken) | Noyau de 2 809 mots, oral | CC BY-SA 4.0 (à revérifier sur la page de téléchargement de la v1.2) |
| [CEFR-J](https://github.com/openlanguageprofiles/olp-en-cefrj) | Indication de niveau | Gratuit, y compris en commercial, avec citation (v1.5) |

Oxford 3000 et English Vocabulary Profile restent exclus : ce sont des listes protégées. Les traductions, définitions et exemples sont tous originaux.

**Expressions.** Aucune source ouverte ne classe bien les chunks : `wordfreq` ne fait que combiner les fréquences de mots isolés. Leur fréquence est donc une **estimation, signalée comme telle** par `frequency_source`. Leur sélection suit une grille des fonctions de communication (§9 : reformuler, nuancer, interrompre...) pour garantir que chaque fonction est couverte, au lieu de chercher un classement illusoire.

**Rang d'apprentissage.** `score = niveau − 0,6 × (priorité − 3) − 0,4 × (fréquence − 3)`. Un élément B1 essentiel passe ainsi devant un A2 secondaire, comme le demande le §3.

**Production par lots de 200 environ.** Chaque lot correspond à un type, une tranche de niveau et un thème. Il passe la validation automatique, puis le contrôle par rapport au corpus, puis une relecture indépendante, et enfin un échantillon relu par toi. Un lot qui n'est pas validé n'entre pas dans la base.

## 6. Répétition espacée

- **Algorithme.** FSRS-6, rétention visée de 90 %, réglable. Étapes d'apprentissage de 1 et 10 minutes, journée qui bascule à 4 h.
- **Sens de révision.** Menu Les deux, EN → FR ou FR → EN. En mode Les deux, la production attend que la compréhension soit consolidée, et le contexte que la production le soit. FR → EN lève le premier blocage.
- **Ordre de la file.** Cartes en cours, puis révisions dues, puis nouveautés. Les nouveautés alternent productions débloquées et nouveaux éléments.
- **Révision ciblée.** Une sélection par catégorie et par niveau restreint la file sans changer la planification. La sélection s'efface au rechargement pour ne pas masquer durablement des cartes dues.
- **Aucune limite quotidienne.** Nouvelles cartes et révisions ne sont pas plafonnées, à ta demande. Une fois les cartes prévues terminées, « Continuer quand même » reprend les cartes vues il y a le plus longtemps. Une révision anticipée rapporte moins, mais FSRS en tient compte.
- **Cartes récalcitrantes.** Signalées à partir de 8 oublis, avec suspension possible.
- **Test initial (retiré de l'interface à ta demande, logique conservée dans `src/core/placement.ts`).** Dix cartes par niveau. « Je connais » espace la compréhension de 45 jours, « Incertain » de 4 jours, et l'inconnu reste dans le cycle normal. Au-dessus de 90 % de connus, le reste du niveau peut être présumé connu (contrôle à 21 jours). Sous 50 %, le test s'arrête.

**Point clé : « Je connais » ne prouve que le passif.** Un élément connu saute la compréhension mais sa carte de production reste à apprendre. C'est le cœur de ton objectif.

**Maîtrisé** signifie : la carte de production tient au moins 30 jours. **Vocabulaire actif estimé** signifie : somme des probabilités de rappel des cartes de production, soit le nombre d'éléments que tu retrouverais maintenant, pas un simple compteur.

## 7. Faiblesses du cahier des charges

**Importantes**

1. **La charge de travail n'est pas chiffrée, et c'est le plus gros risque.** 10 000 éléments donnent environ 20 000 cartes (2,09 par élément dans le prototype). Simulation FSRS sur 2 ans, avec 90 % de réussite, sans test initial :

   | Nouvelles cartes/jour | Durée pour 20 000 cartes | Cartes/jour à 6 mois | à 12 mois | à 24 mois |
   |---|---|---|---|---|
   | 10 | 5,5 ans | 74 | 98 | 120 |
   | 20 | 2,7 ans | 152 | 194 | 241 |
   | 30 | 1,8 an | 219 | 294 | 367 |

   Le modèle est simple, mais l'ordre de grandeur compte : 20 par jour représente environ 25 à 30 minutes quotidiennes à 8 secondes par carte. Le test initial réduit ce volume d'autant que tu connais déjà.

2. **Les flashcards n'entraînent pas la fluidité orale.** Elles entraînent le rappel, qui est nécessaire mais pas suffisant. Le prototype invite à répondre à voix haute et lit les réponses. Il faudra plus tard un mode chronométré et de vraies conversations.

3. **La production mot à mot est ambiguë.** « gérer » peut donner `manage`, `handle` ou `deal with`. D'où les phrases au recto, l'indice, `also_accept` et l'alerte sur les traductions identiques.

4. **Le §11 place le suivi sur l'élément** alors qu'il faut le suivre par carte, et il lui manque `highlight`, `sense`, `family`, `pos`, `variant`, `situation_fr` et un rang d'apprentissage.

5. **Un `id` numérique est fragile.** Une réinsertion ou un tri peut déplacer ta progression sur le mauvais élément.

**Moyennes**

6. **La catégorie « anglais professionnel » n'est pas de même nature que les autres.** C'est un domaine et non une forme : `follow up` est à la fois phrasal verb et pro. Dans le prototype, 31 éléments portent le tag `pro`, tous types confondus.
7. **Les fréquences d'expressions n'existent pas vraiment** (voir §5 ci-dessus). Le champ reste utile si son origine est explicite.
8. **6 000 mots contre 800 collocations contredit ta priorité** « expressions > mots isolés ».
9. **La progression locale peut se perdre.** Vider les données du navigateur l'efface. L'export existe, mais il est manuel.
10. **Personne ne relit 10 000 entrées générées.** Un modèle peut produire une erreur plausible que le validateur ne voit pas. Il faut un contrôle par échantillon et le champ `status`.

## 8. Améliorations proposées

| Proposition | État |
|---|---|
| Suivi par carte, déblocage progressif, choix du sens de révision | Fait |
| `highlight`, indice, `also_accept`, identifiants stables | Fait |
| Synthèse vocale du navigateur, et `audio` prioritaire s'il existe | Fait |
| Export et import de la progression | Fait |
| **Rééquilibrer les quotas** : mots 5 300, chunks 2 200, collocations 1 300, phrasal verbs 600, connecteurs 350, idiomes 250, avec au moins 500 tags `pro` transversaux | À valider |
| **Plafonner `priority: 5`** à environ 25 % de la base : l'échantillon en compte 56 %, trop pour que ce champ départage quoi que ce soit | À appliquer aux lots suivants |
| Installation sur téléphone (PWA) et synchronisation | Selon ton usage |
| Mode oral chronométré, optimisation FSRS sur ton historique après environ 1 000 révisions | Plus tard |

## 9. Limites connues du prototype

- `ipa` est vide : mieux vaut une source fiable qu'une transcription approximative. La synthèse vocale dépend des voix installées sur l'appareil, et elle n'a pas été écoutée pendant les tests automatisés.
- Pas d'annulation de la dernière note.
- Tous les éléments sont en `status: draft`, car ils n'ont pas encore de relecture humaine.
- Le français de l'échantillon utilise le masculin à la première personne (« Je suis prêt »).
