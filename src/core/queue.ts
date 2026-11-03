import { cardsForItem, type CardRef } from './cards';
import type { Item, ItemType, Level } from './schema';
import { newCardState, State, type CardState, type ReviewLog } from './srs';

/** Sélection de révision. « pro » est un tag transversal, pas un type. */
export interface Focus {
  category: ItemType | 'pro' | '';
  level: Level | '';
}

export const NO_FOCUS: Focus = { category: '', level: '' };

export function matchesFocus(item: Item, { category, level }: Focus): boolean {
  if (level && item.level !== level) return false;
  if (category === 'pro') return item.tags.includes('pro');
  return !category || item.type === category;
}

export interface QueueSettings {
  newPerDay: number;
  maxReviewsPerDay: number;
}

export const DEFAULT_SETTINGS: QueueSettings = { newPerDay: 20, maxReviewsPerDay: 200 };

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
  logsToday: ReviewLog[];
  suspended: Set<string>;
  settings: QueueSettings;
  now: number;
}

export interface QueueResult {
  next: CardState | null;
  counts: { learning: number; review: number; fresh: number };
}

/** Une carte de production/contexte se débloque quand la précédente est consolidée. */
function isUnlocked(ref: CardRef, cards: Map<string, CardState>, refs: CardRef[]): boolean {
  if (ref.kind === 'recognition') return true;
  const previous = ref.kind === 'production' ? 'recognition' : 'production';
  const parent = refs.find((r) => r.kind === previous);
  if (!parent) return true;
  return cards.get(parent.id)?.state === State.Review;
}

const isLearning = (c: CardState) => c.state === State.Learning || c.state === State.Relearning;

export function buildQueue({ items, cards, logsToday, suspended, settings, now }: QueueInput): QueueResult {
  const introducedToday = logsToday.filter((l) => l.stateBefore === State.New).length;
  const reviewedToday = logsToday.filter((l) => l.stateBefore === State.Review).length;
  const touchedToday = new Set(logsToday.map((l) => l.itemId));
  const newBudget = Math.max(0, settings.newPerDay - introducedToday);
  const reviewBudget = Math.max(0, settings.maxReviewsPerDay - reviewedToday);

  const learningNow: CardState[] = [];
  const learningSoon: CardState[] = [];
  const due: CardState[] = [];
  const unlocked: CardState[] = [];
  const fresh: CardState[] = [];

  for (const item of items) {
    if (suspended.has(item.id)) continue;
    const refs = cardsForItem(item);
    for (const ref of refs) {
      const card = cards.get(ref.id);
      if (card && isLearning(card)) {
        (card.due <= now ? learningNow : learningSoon).push(card);
      } else if (card && card.state === State.Review) {
        // Une seule carte d'un même élément par jour : l'autre direction serait un simple écho.
        if (card.due <= now && !touchedToday.has(item.id)) due.push(card);
      } else if (isUnlocked(ref, cards, refs) && !touchedToday.has(item.id)) {
        const state = card ?? newCardState(ref, now);
        (ref.kind === 'recognition' ? fresh : unlocked).push(state);
      }
    }
  }

  learningNow.sort((a, b) => a.due - b.due);
  learningSoon.sort((a, b) => a.due - b.due);
  due.sort((a, b) => a.due - b.due);

  // Alterne cartes débloquées et nouveaux éléments : le passif ne prend pas le pas sur l'actif.
  const newQueue: CardState[] = [];
  for (let i = 0; newQueue.length < newBudget && (i < unlocked.length || i < fresh.length); i++) {
    if (i < unlocked.length) newQueue.push(unlocked[i]);
    if (i < fresh.length && newQueue.length < newBudget) newQueue.push(fresh[i]);
  }

  const reviews = due.slice(0, reviewBudget);
  const counts = {
    learning: learningNow.length + learningSoon.length,
    review: reviews.length,
    fresh: newQueue.length,
  };
  const soon = learningSoon.find((c) => c.due <= now + LEARN_AHEAD_MS) ?? null;
  return { next: learningNow[0] ?? reviews[0] ?? newQueue[0] ?? soon, counts };
}
