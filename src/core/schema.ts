/** Schéma de contenu : la source de vérité pour les lots, le validateur et l'app. */

export const TYPES = ['word', 'chunk', 'collocation', 'phrasal_verb', 'idiom', 'connector'] as const;
export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'B2+', 'C1'] as const;
export const REGISTERS = ['formal', 'neutral', 'informal', 'slang'] as const;
export const VARIANTS = ['both', 'UK', 'US'] as const;
export const CONTEXTS = ['conversation', 'daily_life', 'work', 'travel', 'academic', 'news'] as const;
export const POS = ['noun', 'verb', 'adjective', 'adverb', 'preposition', 'pronoun', 'determiner', 'conjunction'] as const;
export const STATUSES = ['draft', 'auto_checked', 'human_reviewed'] as const;
export const FREQUENCY_SOURCES = ['corpus', 'estimate'] as const;

export type ItemType = (typeof TYPES)[number];
export type Level = (typeof LEVELS)[number];
export type Register = (typeof REGISTERS)[number];
export type Variant = (typeof VARIANTS)[number];
export type Context = (typeof CONTEXTS)[number];
export type Pos = (typeof POS)[number];
export type Status = (typeof STATUSES)[number];
export type FrequencySource = (typeof FREQUENCY_SOURCES)[number];

/** Élément tel qu'écrit dans data/batches/*.json (les champs optionnels ont un défaut). */
export interface RawItem {
  id: string;
  english: string;
  french: string;
  type: ItemType;
  level: Level;
  frequency: number;
  priority: number;
  example_en: string;
  example_fr: string;
  /** Sous-chaîne exacte de example_en : surlignage et texte à trous. */
  highlight: string;
  context: Context;
  register: Register;
  tags: string[];
  pos?: Pos | null;
  sense?: string | null;
  situation_fr?: string | null;
  also_accept?: string[];
  notes?: string | null;
  variant?: Variant;
  counterpart?: string | null;
  family?: string | null;
  forms?: string | null;
  ipa?: string | null;
  audio?: string | null;
  status?: Status;
}

/** Élément complet tel que livré à l'app dans deck.json. */
export interface Item extends Required<RawItem> {
  frequency_source: FrequencySource;
  zipf: number | null;
  /** Rang d'apprentissage calculé au build (1 = à apprendre en premier). */
  order: number;
  batch: string;
}

export interface Deck {
  version: string;
  items: Item[];
}

export function withDefaults(raw: RawItem): Omit<Item, 'frequency_source' | 'zipf' | 'order' | 'batch'> {
  return {
    pos: null,
    sense: null,
    situation_fr: null,
    also_accept: [],
    notes: null,
    variant: 'both',
    counterpart: null,
    family: null,
    forms: null,
    ipa: null,
    audio: null,
    status: 'draft',
    ...raw,
  };
}
