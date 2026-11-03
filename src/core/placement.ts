import { cardId } from './cards';
import type { Item, Level } from './schema';
import { newCardState, seedCard, type CardState, type Seed } from './srs';

export type PlacementAnswer = 'known' | 'uncertain' | 'unknown';

/** Seuils d'extrapolation à partir d'un échantillon de niveau. */
export const PRESUME_KNOWN_RATE = 0.9;
export const STOP_RATE = 0.5;

const untested = (cards: Map<string, CardState>, level: Level) => (i: Item) =>
  i.level === level && !cards.has(cardId(i.id, 'recognition'));

/** Échantillon réparti sur tout le niveau, pas seulement sur ses premiers éléments. */
export function sampleLevel(items: Item[], level: Level, size: number, cards: Map<string, CardState>): Item[] {
  const pool = items.filter(untested(cards, level)).sort((a, b) => a.order - b.order);
  if (pool.length <= size) return pool;
  const step = pool.length / size;
  return Array.from({ length: size }, (_, i) => pool[Math.floor(i * step)]);
}

function seeded(item: Item, kind: Seed, now: number): CardState {
  const ref = { id: cardId(item.id, 'recognition'), itemId: item.id, kind: 'recognition' as const };
  return seedCard(newCardState(ref, now), kind, now);
}

/** « Je ne connais pas » ne crée rien : l'élément entre dans le cycle normal. */
export function placementCard(item: Item, answer: PlacementAnswer, now: number): CardState | null {
  return answer === 'unknown' ? null : seeded(item, answer, now);
}

export interface LevelVerdict {
  rate: number;
  action: 'presume' | 'continue' | 'stop';
}

export function levelVerdict(answers: PlacementAnswer[]): LevelVerdict {
  const rate = answers.length ? answers.filter((a) => a === 'known').length / answers.length : 0;
  if (rate >= PRESUME_KNOWN_RATE) return { rate, action: 'presume' };
  return { rate, action: rate < STOP_RATE ? 'stop' : 'continue' };
}

/** Marque le reste d'un niveau comme présumé connu ; ces cartes reviennent vite en contrôle. */
export function presumeRest(items: Item[], level: Level, cards: Map<string, CardState>, now: number): CardState[] {
  return items.filter(untested(cards, level)).map((i) => seeded(i, 'presumed', now));
}
