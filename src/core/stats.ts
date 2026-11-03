import type { FSRS } from 'ts-fsrs';
import { cardId, cardsForItem } from './cards';
import { LEVELS, TYPES, type Item, type ItemType, type Level } from './schema';
import { dayKey } from './queue';
import { DAY_MS, Rating, retrievability, State, type CardState, type ReviewLog } from './srs';

/** Un élément est maîtrisé si sa carte la plus exigeante tient au moins 30 jours. */
export const MASTERED_STABILITY_DAYS = 30;

export type ItemProgress = 'new' | 'learning' | 'mastered';

export function itemProgress(item: Item, cards: Map<string, CardState>): ItemProgress {
  const refs = cardsForItem(item);
  const started = refs.some((r) => {
    const c = cards.get(r.id);
    return c && c.state !== State.New;
  });
  if (!started) return 'new';
  const keyKind = refs.some((r) => r.kind === 'production') ? 'production' : 'recognition';
  const key = cards.get(cardId(item.id, keyKind));
  return key && key.state === State.Review && key.stability >= MASTERED_STABILITY_DAYS ? 'mastered' : 'learning';
}

export interface Bucket {
  total: number;
  mastered: number;
  learning: number;
}

export interface Stats {
  mastered: number;
  learning: number;
  unseen: number;
  total: number;
  successRate: number | null;
  reviewsToday: number;
  streak: number;
  activeVocabulary: number;
  passiveVocabulary: number;
  byLevel: Record<Level, Bucket>;
  byType: Record<ItemType, Bucket>;
  professional: Bucket;
}

const emptyBucket = (): Bucket => ({ total: 0, mastered: 0, learning: 0 });

export function computeStreak(logs: Pick<ReviewLog, 'ts'>[], now: number): number {
  const days = new Set(logs.map((l) => dayKey(l.ts)));
  let cursor = now;
  // Aujourd'hui peut être encore vide sans casser la série.
  if (!days.has(dayKey(cursor))) cursor -= DAY_MS;
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor -= DAY_MS;
  }
  return streak;
}

export function computeStats(
  items: Item[],
  cards: Map<string, CardState>,
  logs: ReviewLog[],
  scheduler: FSRS,
  now: number,
): Stats {
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, emptyBucket()])) as Record<Level, Bucket>;
  const byType = Object.fromEntries(TYPES.map((t) => [t, emptyBucket()])) as Record<ItemType, Bucket>;
  const professional = emptyBucket();
  let mastered = 0;
  let learning = 0;

  for (const item of items) {
    const progress = itemProgress(item, cards);
    const buckets = [byLevel[item.level], byType[item.type]];
    if (item.tags.includes('pro')) buckets.push(professional);
    for (const bucket of buckets) {
      bucket.total++;
      if (progress === 'mastered') bucket.mastered++;
      if (progress === 'learning') bucket.learning++;
    }
    if (progress === 'mastered') mastered++;
    if (progress === 'learning') learning++;
  }

  // Espérance du nombre d'éléments retrouvables maintenant, et non simple compteur.
  let activeVocabulary = 0;
  let passiveVocabulary = 0;
  for (const card of cards.values()) {
    if (card.state !== State.Review) continue;
    const r = retrievability(scheduler, card, now);
    if (card.kind === 'production') activeVocabulary += r;
    if (card.kind === 'recognition') passiveVocabulary += r;
  }

  const recent = logs.filter((l) => l.ts >= now - 30 * DAY_MS);
  const success = recent.filter((l) => l.rating !== Rating.Again).length;
  const today = dayKey(now);

  return {
    mastered,
    learning,
    unseen: items.length - mastered - learning,
    total: items.length,
    successRate: recent.length ? success / recent.length : null,
    reviewsToday: logs.filter((l) => dayKey(l.ts) === today).length,
    streak: computeStreak(logs, now),
    activeVocabulary: Math.round(activeVocabulary),
    passiveVocabulary: Math.round(passiveVocabulary),
    byLevel,
    byType,
    professional,
  };
}
