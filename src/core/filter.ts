import { normalizeEnglish, normalizeFrench } from './normalize';
import { cardsForItem } from './cards';
import type { Item, ItemType, Level } from './schema';
import type { CardState } from './srs';
import { itemProgress, type ItemProgress } from './stats';

export type DifficultyBand = 'easy' | 'medium' | 'hard';

export interface Filters {
  query: string;
  level: Level | '';
  type: ItemType | '';
  frequency: number;
  priority: number;
  tag: string;
  progress: ItemProgress | '';
  difficulty: DifficultyBand | '';
  favoritesOnly: boolean;
}

export const NO_FILTERS: Filters = {
  query: '', level: '', type: '', frequency: 0, priority: 0, tag: '', progress: '', difficulty: '', favoritesOnly: false,
};

/** Difficulté FSRS (1 à 10) de la carte la plus difficile déjà vue. */
export function difficultyBand(item: Item, cards: Map<string, CardState>): DifficultyBand | null {
  const values = cardsForItem(item)
    .map((r) => cards.get(r.id)?.difficulty ?? 0)
    .filter((d) => d > 0);
  if (values.length === 0) return null;
  const d = Math.max(...values);
  if (d < 4.5) return 'easy';
  return d < 7 ? 'medium' : 'hard';
}

export function filterItems(
  items: Item[],
  f: Filters,
  cards: Map<string, CardState>,
  favorites: Set<string>,
): Item[] {
  const en = normalizeEnglish(f.query);
  const fr = normalizeFrench(f.query);
  return items.filter((i) => {
    if (f.level && i.level !== f.level) return false;
    if (f.type && i.type !== f.type) return false;
    if (f.frequency && i.frequency !== f.frequency) return false;
    if (f.priority && i.priority !== f.priority) return false;
    if (f.tag && !i.tags.includes(f.tag)) return false;
    if (f.favoritesOnly && !favorites.has(i.id)) return false;
    if (f.progress && itemProgress(i, cards) !== f.progress) return false;
    if (f.difficulty && difficultyBand(i, cards) !== f.difficulty) return false;
    if (!f.query.trim()) return true;
    return (
      normalizeEnglish(i.english).includes(en) ||
      normalizeFrench(i.french).includes(fr) ||
      (i.counterpart ?? '').toLowerCase().includes(en)
    );
  });
}
