import { cardsForItem, type CardKind, type CardRef } from './cards';
import type { Item, ItemType, Level } from './schema';
import { newCardState, State, type CardState } from './srs';

/** Sélection de révision. « pro » est un tag transversal, pas un type. */
export interface Focus {
  category: ItemType | 'pro' | '';
  level: Level | '';
  direction: Direction;
}

/** Sens de révision : '' mélange les deux. */
export type Direction = '' | 'en-fr' | 'fr-en';

export const NO_FOCUS: Focus = { category: '', level: '', direction: '' };

export function matchesFocus(item: Item, { category, level }: Pick<Focus, 'category' | 'level'>): boolean {
  if (level && item.level !== level) return false;
  if (category === 'pro') return item.tags.includes('pro');
  return !category || item.type === category;
}

const LEARN_AHEAD_MS = 20 * 60_000;
const ROLLOVER_HOUR = 4;

/** La journée d'étude bascule à 4 h : une session à 1 h du matin compte pour la veille. */
export function dayKey(ts: number): string {
  const d = new Date(ts - ROLLOVER_HOUR * 3_600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface QueueInput {
  items: Item[];
  cards: Map<string, CardState>;
  suspended: Set<string>;
  now: number;
  direction?: Direction;
  /** Révision libre : ignore le calendrier une fois les cartes prévues terminées. */
  free?: boolean;
}

export interface QueueResult {
  next: CardState | null;
  counts: { learning: number; review: number; fresh: number };
}

export function inDirection(kind: CardKind, direction: Direction): boolean {
  if (direction === 'en-fr') return kind === 'recognition';
  return direction === '' || kind !== 'recognition';
}

/**
 * Sans sens imposé, la production attend que la compréhension soit consolidée, pour ne pas
 * interroger sur un élément jamais vu. Choisir FR → EN lève ce blocage.
 */
export function isUnlocked(ref: CardRef, cards: Map<string, CardState>, direction: Direction): boolean {
  if (ref.kind === 'recognition' || (ref.kind === 'production' && direction)) return true;
  const parent = ref.kind === 'production' ? 'recognition' : 'production';
  return cards.get(ref.id.replace(ref.kind, parent))?.state === State.Review;
}

const isLearning = (c: CardState) => c.state === State.Learning || c.state === State.Relearning;

export function buildQueue({ items, cards, suspended, now, direction = '', free = false }: QueueInput): QueueResult {
  const learningNow: CardState[] = [];
  const learningSoon: CardState[] = [];
  const due: CardState[] = [];
  const notDue: CardState[] = [];
  const unlocked: CardState[] = [];
  const fresh: CardState[] = [];

  for (const item of items) {
    if (suspended.has(item.id)) continue;
    for (const ref of cardsForItem(item)) {
      if (!inDirection(ref.kind, direction)) continue;
      const card = cards.get(ref.id);
      if (card && isLearning(card)) {
        (card.due <= now ? learningNow : learningSoon).push(card);
      } else if (card && card.state === State.Review) {
        (card.due <= now ? due : notDue).push(card);
      } else if (isUnlocked(ref, cards, direction)) {
        const state = card ?? newCardState(ref, now);
        (ref.kind === 'recognition' ? fresh : unlocked).push(state);
      }
    }
  }

  learningNow.sort((a, b) => a.due - b.due);
  learningSoon.sort((a, b) => a.due - b.due);
  due.sort((a, b) => a.due - b.due);

  // La file est recalculée après chaque carte : l'alternance dépend donc du nombre de cartes commencées.
  const preferUnlocked = fresh.length === 0 || cards.size % 2 === 1;
  // Jamais la carte inverse juste après : sa réponse vient d'être affichée.
  const last = [...cards.values()].reduce<CardState | null>(
    (latest, c) => ((c.lastReview ?? 0) > (latest?.lastReview ?? 0) ? c : latest),
    null,
  );
  const spaced = unlocked.find((c) => c.itemId !== last?.itemId);
  const nextNew = (preferUnlocked ? spaced : fresh[0]) ?? fresh[0] ?? spaced ?? unlocked[0] ?? null;

  const counts = {
    learning: learningNow.length + learningSoon.length,
    review: due.length,
    fresh: fresh.length + unlocked.length,
  };
  const soon = learningSoon.find((c) => c.due <= now + LEARN_AHEAD_MS) ?? null;
  const planned = learningNow[0] ?? due[0] ?? nextNew ?? soon;
  if (planned || !free) return { next: planned, counts };

  // Carte vue il y a le plus longtemps : on tourne sur toute la sélection sans répéter la dernière.
  const oldest = [...notDue, ...learningSoon].sort((a, b) => (a.lastReview ?? 0) - (b.lastReview ?? 0));
  return { next: oldest[0] ?? null, counts };
}
