import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { CardKind } from '../core/cards';
import type { ItemType, Register } from '../core/schema';

/** Langue de l'interface. Le contenu des cartes reste anglais/français dans les deux cas. */
export type Lang = 'en' | 'fr';
export const LANGS: Lang[] = ['en', 'fr'];

const s = (n: number) => (n > 1 ? 's' : '');

const en = {
  tabs: { review: 'Review', browse: 'Explore', stats: 'Stats', about: 'About' },
  switchLang: 'FR',
  switchLangLabel: 'Afficher le site en français',

  kinds: {
    recognition: 'English → French',
    production: 'French → English: say it out loud',
    context: 'Situation: what do you say?',
  } as Record<CardKind, string>,
  types: {
    word: 'Word', chunk: 'Expression', collocation: 'Collocation', phrasal_verb: 'Phrasal verb', idiom: 'Idiom',
    connector: 'Connector',
  } as Record<ItemType, string>,
  typesPlural: {
    word: 'Words', chunk: 'Expressions', collocation: 'Collocations', phrasal_verb: 'Phrasal verbs', idiom: 'Idioms',
    connector: 'Connectors',
  } as Record<ItemType, string>,
  registers: { formal: 'formal', neutral: 'neutral', informal: 'informal', slang: 'slang' } as Record<Register, string>,
  pro: 'Pro',

  known: 'I know it',
  toReview: 'Review again',
  flip: 'Flip the card',
  hint: 'Hint',
  answer: 'Answer',
  listen: 'Listen',
  leech: (n: number) => `Stubborn card: forgotten ${n} times. Consider suspending it in Explore.`,

  newGame: 'New game',
  setupHint: 'Pick what you want to review. If nothing is selected in a group, everything is included.',
  themes: 'Themes',
  levels: 'Levels',
  typesLegend: 'Types',
  direction: 'Direction',
  both: 'Both',
  size: 'Number of cards',
  all: 'All',
  start: (n: number) => `Start the game (${n} card${s(n)})`,
  noCards: 'No cards for this selection',
  bothNote: 'In “Both” mode, each English → French card you know adds its French → English version later in the game.',
  pileDone: 'Pile finished!',
  left: (n: number) => `You have ${n} card${s(n)} left to review.`,
  reviewThem: 'Review these cards',
  endGame: 'End the game',
  gameOver: 'Game over',
  summary: (total: number, first: number) =>
    `${total} card${s(total)} played, ${first} known on the first try.`,
  replay: 'Play again with the same settings',
  changeSettings: 'Change settings',
  progressLabel: 'Game progress',
  atEnd: (n: number) => `${n} to review at the end`,
  reviewing: (n: number) => `Review: ${n} card${s(n)} left`,
  stopAsk: 'Stop the game? Answers already given are kept.',
  stopYes: 'Yes, stop',
  stopNo: 'No',
  stop: 'Stop the game',

  details: {
    sense: 'Meaning', ipa: 'IPA', forms: 'Forms', variant: 'Variant', also: 'Also accepted', note: 'Note (FR)',
    family: 'Word family',
  },
  otherVariant: 'other variant',

  progress: { new: 'Never seen', learning: 'Learning', mastered: 'Mastered' },
  anyOption: 'All',
  search: 'Search (English or French)',
  level: 'Level',
  type: 'Type',
  frequency: 'Frequency',
  priority: 'Priority',
  theme: 'Theme',
  knowledge: 'Progress',
  difficulty: 'Difficulty',
  difficulties: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
  favourites: 'Favourites',
  results: (n: number, max: number) => `${n} item${s(n)}${n > max ? `, ${max} shown` : ''}`,
  itemInfo: (freq: number, corpus: string | null, priority: number, rank: number) =>
    `Frequency ${freq}/5 (${corpus ? `corpus, Zipf ${corpus}` : 'estimated'}) · Priority ${priority}/5 · Rank ${rank}`,
  addFavourite: 'Add to favourites',
  removeFavourite: 'Remove from favourites',
  suspend: 'Suspend',
  unsuspend: 'Reactivate',

  tiles: {
    active: 'Estimated active vocabulary', activeNote: 'can be produced now',
    passive: 'Estimated passive vocabulary', passiveNote: 'understood when reading now',
    mastered: 'Mastered', masteredNote: 'stability of 30 days or more',
    learning: 'Learning', unseen: 'Never seen', success: 'Success rate', successNote: 'last 30 days',
    today: 'Reviewed today', streak: 'Streak', days: (n: number) => `${n} d`,
  },
  barSummary: (m: number, l: number, t: number) => `${m} mastered, ${l} learning, out of ${t}`,
  byLevel: 'By level',
  byType: 'By category',
  businessEnglish: 'Business English',
  myProgress: 'My progress',
  progressHelp:
    'Your progress stays in this browser. Export it from time to time: it is your only backup, and the way to move it to another device. Importing replaces your current progress.',
  exportBtn: 'Export',
  importBtn: 'Import',
  restored: 'Backup restored.',
  invalidBackup: 'This file is not a valid backup.',
  importFailed: (msg: string) => `Import failed: ${msg}`,

  aboutTitle: 'About English SIT',
  aboutText:
    'Free flashcards to go from “I recognise this word” to “I use it when I speak”: words, expressions, collocations, phrasal verbs, idioms and connectors, from A1 to C1, with their French translation.',
  contactTitle: 'Contact',
  contactText: 'A question, an idea, or a mistake in a card? Write to me:',
  creditsTitle: 'Credits',
  creditsText: 'Word frequencies come from wordfreq (data under CC BY-SA 4.0). Full credits and licences:',
};

export type Dict = typeof en;

const fr: Dict = {
  tabs: { review: 'Réviser', browse: 'Explorer', stats: 'Stats', about: 'À propos' },
  switchLang: 'EN',
  switchLangLabel: 'Show the site in English',

  kinds: {
    recognition: 'Anglais → français',
    production: 'Français → anglais : dis-le à voix haute',
    context: 'Situation : que dis-tu ?',
  },
  types: {
    word: 'Mot', chunk: 'Expression', collocation: 'Collocation', phrasal_verb: 'Phrasal verb', idiom: 'Idiome',
    connector: 'Connecteur',
  },
  typesPlural: {
    word: 'Mots', chunk: 'Expressions', collocation: 'Collocations', phrasal_verb: 'Phrasal verbs', idiom: 'Idiomes',
    connector: 'Connecteurs',
  },
  registers: { formal: 'soutenu', neutral: 'neutre', informal: 'familier', slang: 'argot' },
  pro: 'Pro',

  known: 'Je connais',
  toReview: 'À réviser',
  flip: 'Retourner la carte',
  hint: 'Indice',
  answer: 'Réponse',
  listen: 'Écouter',
  leech: (n) => `Carte récalcitrante : ${n} oublis. Pense à la suspendre dans Explorer.`,

  newGame: 'Nouvelle partie',
  setupHint: "Coche ce que tu veux réviser. Si rien n'est coché dans un groupe, tout est inclus.",
  themes: 'Thèmes',
  levels: 'Niveaux',
  typesLegend: 'Types',
  direction: 'Sens',
  both: 'Les deux',
  size: 'Nombre de cartes',
  all: 'Toutes',
  start: (n) => `Lancer la partie (${n} carte${s(n)})`,
  noCards: 'Aucune carte pour cette sélection',
  bothNote: 'En mode « Les deux », chaque carte anglais → français que tu connais ajoute sa version français → anglais plus loin dans la partie.',
  pileDone: 'Pile terminée !',
  left: (n) => `Il te reste ${n} carte${s(n)} à réviser.`,
  reviewThem: 'Revoir ces cartes',
  endGame: 'Terminer la partie',
  gameOver: 'Partie terminée',
  summary: (total, first) =>
    `${total} carte${s(total)} jouée${s(total)}, dont ${first} connue${s(first)} du premier coup.`,
  replay: 'Rejouer avec les mêmes réglages',
  changeSettings: 'Changer les réglages',
  progressLabel: 'Avancement de la partie',
  atEnd: (n) => `${n} à réviser à la fin`,
  reviewing: (n) => `Révision : ${n} carte${s(n)} restante${s(n)}`,
  stopAsk: 'Arrêter la partie ? Les réponses déjà données sont gardées.',
  stopYes: 'Oui, arrêter',
  stopNo: 'Non',
  stop: 'Arrêter la partie',

  details: {
    sense: 'Sens', ipa: 'API', forms: 'Formes', variant: 'Variante', also: 'Aussi possible', note: 'Note',
    family: 'Même famille',
  },
  otherVariant: 'autre variante',

  progress: { new: 'Jamais vu', learning: 'En apprentissage', mastered: 'Maîtrisé' },
  anyOption: 'Tous',
  search: 'Recherche (anglais ou français)',
  level: 'Niveau',
  type: 'Type',
  frequency: 'Fréquence',
  priority: 'Priorité',
  theme: 'Thème',
  knowledge: 'Connaissance',
  difficulty: 'Difficulté',
  difficulties: { easy: 'Facile', medium: 'Moyenne', hard: 'Difficile' },
  favourites: 'Favoris',
  results: (n, max) => `${n} élément${s(n)}${n > max ? `, ${max} affichés` : ''}`,
  itemInfo: (freq, corpus, priority, rank) =>
    `Fréquence ${freq}/5 (${corpus ? `corpus, Zipf ${corpus}` : 'estimée'}) · Priorité ${priority}/5 · Rang ${rank}`,
  addFavourite: 'Ajouter aux favoris',
  removeFavourite: 'Retirer des favoris',
  suspend: 'Suspendre',
  unsuspend: 'Réactiver',

  tiles: {
    active: 'Vocabulaire actif estimé', activeNote: 'retrouvable en production maintenant',
    passive: 'Vocabulaire passif estimé', passiveNote: 'compris à la lecture maintenant',
    mastered: 'Maîtrisés', masteredNote: 'stabilité de 30 jours ou plus',
    learning: 'En apprentissage', unseen: 'Jamais vus', success: 'Taux de réussite', successNote: '30 derniers jours',
    today: "Révisées aujourd'hui", streak: 'Série', days: (n) => `${n} j`,
  },
  barSummary: (m, l, t) => `${m} maîtrisés, ${l} en apprentissage, sur ${t}`,
  byLevel: 'Par niveau',
  byType: 'Par catégorie',
  businessEnglish: 'Anglais pro',
  myProgress: 'Ma progression',
  progressHelp:
    "Ta progression reste dans ce navigateur. Exporte-la de temps en temps : c'est ta seule copie de secours, et le moyen de la retrouver sur un autre appareil. Importer remplace la progression actuelle.",
  exportBtn: 'Exporter',
  importBtn: 'Importer',
  restored: 'Sauvegarde restaurée.',
  invalidBackup: "Ce fichier n'est pas une sauvegarde valide.",
  importFailed: (msg) => `Import impossible : ${msg}`,

  aboutTitle: 'À propos d’English SIT',
  aboutText:
    'Des flashcards gratuites pour passer de « je reconnais ce mot » à « je l’utilise en parlant » : mots, expressions, collocations, phrasal verbs, idiomes et connecteurs, de A1 à C1, avec leur traduction française.',
  contactTitle: 'Contact',
  contactText: 'Une question, une idée ou une erreur dans une carte ? Écris-moi :',
  creditsTitle: 'Crédits',
  creditsText: 'Les fréquences des mots viennent de wordfreq (données sous licence CC BY-SA 4.0). Crédits et licences complets :',
};

export const DICTS: Record<Lang, Dict> = { en, fr };

const LANG_KEY = 'english-sit:lang';

/** Anglais par défaut ; le choix est gardé dans le navigateur. */
export function loadLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'fr' ? 'fr' : 'en';
  } catch {
    return 'en';
  }
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // Stockage indisponible : le choix vaut pour cette visite seulement.
  }
}

export const I18n = createContext<{ lang: Lang; t: Dict }>({ lang: 'en', t: en });
export const useI18n = () => useContext(I18n);
