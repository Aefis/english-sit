import type { Item } from './schema';

export const CARD_KINDS = ['recognition', 'production', 'context'] as const;
export type CardKind = (typeof CARD_KINDS)[number];

export interface CardRef {
  id: string;
  itemId: string;
  kind: CardKind;
}

export const cardId = (itemId: string, kind: CardKind) => `${itemId}::${kind}`;

/** Priorité minimale pour mériter une carte de production. */
export const PRODUCTION_MIN_PRIORITY = 3;

export function cardsForItem(item: Pick<Item, 'id' | 'priority' | 'situation_fr'>): CardRef[] {
  const kinds: CardKind[] = ['recognition'];
  if (item.priority >= PRODUCTION_MIN_PRIORITY) kinds.push('production');
  if (item.situation_fr) kinds.push('context');
  return kinds.map((kind) => ({ id: cardId(item.id, kind), itemId: item.id, kind }));
}

/** Découpe example_en autour de highlight pour le surlignage. */
export function splitHighlight(example: string, highlight: string): [string, string, string] {
  const at = example.toLowerCase().indexOf(highlight.toLowerCase());
  if (at < 0) return [example, '', ''];
  return [example.slice(0, at), example.slice(at, at + highlight.length), example.slice(at + highlight.length)];
}

/** Indice de production : « I w__ a____ to leave. » */
export function clozeHint(example: string, highlight: string): string {
  const [before, target, after] = splitHighlight(example, highlight);
  const masked = target.replace(/[A-Za-z]+/g, (w) => w[0] + '_'.repeat(w.length - 1));
  return before + masked + after;
}

/** Réponse à afficher : un chunk ouvert (« I was about to... ») a besoin de sa phrase complète. */
export function spokenAnswer(item: Pick<Item, 'english' | 'example_en'>): string {
  return item.english.endsWith('...') ? item.example_en : item.english;
}
