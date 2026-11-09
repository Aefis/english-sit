import { cardsForItem, type CardKind, type CardRef } from './cards';
import { inDirection, isUnlocked, type Direction } from './queue';
import { LEVELS, TYPES, type Item, type ItemType, type Level } from './schema';
import { State, type CardState } from './srs';
import { THEMES, themesOf, type ThemeId } from './themes';

/** Réglages d'une partie. Une liste vide veut dire « tout ». */
export interface GameConfig {
  themes: ThemeId[];
  levels: Level[];
  types: ItemType[];
  direction: Direction;
  /** Nombre de cartes ; null pour toutes celles de la sélection. */
  size: number | null;
}

export const DEFAULT_CONFIG: GameConfig = { themes: [], levels: [], types: [], direction: '', size: 20 };
export const SIZES = [10, 20, 50, 100, null] as const;

/**
 * Partie en cours. `pending` est la pile à jouer ; les cartes « À réviser » vont dans `retry`
 * et ne reviennent qu'une fois `pending` vidée, au tour suivant.
 */
export interface Game {
  version: 1;
  config: GameConfig;
  pending: string[];
  retry: string[];
  round: number;
  /** Cartes différentes vues dans la partie. */
  total: number;
  /** Cartes marquées « À réviser » au moins une fois. */
  missed: string[];
}

export type Phase = 'play' | 'break' | 'done';

export function matchesConfig(item: Item, { themes, levels, types }: GameConfig): boolean {
  if (levels.length > 0 && !levels.includes(item.level)) return false;
  if (types.length > 0 && !types.includes(item.type)) return false;
  if (themes.length === 0) return true;
  const own = themesOf(item);
  return themes.some((t) => own.has(t));
}

export interface GameInput {
  items: Item[];
  cards: Map<string, CardState>;
  suspended: Set<string>;
  config: GameConfig;
  now: number;
}

/** Cartes de la sélection, dans l'ordre de jeu : dues, puis nouvelles, puis les moins récemment vues. */
export function candidates({ items, cards, suspended, config, now }: GameInput): string[] {
  const due: CardState[] = [];
  const fresh: string[] = [];
  const later: CardState[] = [];
  for (const item of items) {
    if (suspended.has(item.id) || !matchesConfig(item, config)) continue;
    for (const ref of cardsForItem(item)) {
      if (!inDirection(ref.kind, config.direction)) continue;
      const card = cards.get(ref.id);
      if (card && card.state !== State.New) (card.due <= now ? due : later).push(card);
      else if (isUnlocked(ref, cards, config.direction)) fresh.push(ref.id);
    }
  }
  due.sort((a, b) => a.due - b.due);
  later.sort((a, b) => (a.lastReview ?? 0) - (b.lastReview ?? 0));
  return [...due.map((c) => c.id), ...fresh, ...later.map((c) => c.id)];
}

export function startGame(input: GameInput): Game | null {
  const all = candidates(input);
  const pending = input.config.size === null ? all : all.slice(0, input.config.size);
  if (pending.length === 0) return null;
  return { version: 1, config: input.config, pending, retry: [], round: 1, total: pending.length, missed: [] };
}

export function phase(game: Game): Phase {
  if (game.pending.length > 0) return 'play';
  return game.retry.length > 0 ? 'break' : 'done';
}

/** Nombre de cartes ajoutées derrière la carte courante avant la carte suivante d'un même élément. */
const FOLLOW_GAP = 4;

/**
 * Retire la carte jouée. « À réviser » la renvoie à la fin de la partie. `follow` est la carte
 * débloquée par un « Je connais » (le sens français → anglais après la compréhension), ajoutée plus loin.
 */
export function answerCard(game: Game, id: string, known: boolean, follow: string | null = null): Game {
  const at = game.pending.indexOf(id);
  if (at < 0) return game;
  const pending = [...game.pending.slice(0, at), ...game.pending.slice(at + 1)];
  const next: Game = { ...game, pending, retry: [...game.retry], missed: [...game.missed] };
  if (!known) {
    if (!next.retry.includes(id)) next.retry.push(id);
    if (!next.missed.includes(id)) next.missed.push(id);
  } else if (follow && !pending.includes(follow) && !next.retry.includes(follow)) {
    pending.splice(Math.min(FOLLOW_GAP, pending.length), 0, follow);
    next.total += 1;
  }
  return next;
}

/** Tour suivant : les cartes à réviser deviennent la pile à jouer. */
export function startRetryRound(game: Game): Game {
  return { ...game, pending: game.retry, retry: [], round: game.round + 1 };
}

export function parseCardId(id: string): CardRef | null {
  const [itemId, kind] = id.split('::');
  if (!itemId || !['recognition', 'production', 'context'].includes(kind)) return null;
  return { id, itemId, kind: kind as CardKind };
}

/** Carte suivante d'un élément dans le sens choisi : compréhension → production → situation. */
export function followUpCard(item: Item, kind: CardKind, direction: Direction): string | null {
  const refs = cardsForItem(item);
  const at = refs.findIndex((r) => r.kind === kind);
  const next = refs[at + 1];
  return next && inDirection(next.kind, direction) ? next.id : null;
}

const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Relit une configuration enregistrée en ignorant les valeurs inconnues. */
export function parseConfig(raw: unknown): GameConfig {
  const c = (raw ?? {}) as Partial<Record<keyof GameConfig, unknown>>;
  const themeIds: string[] = THEMES.map((t) => t.id);
  const pick = <T extends string>(v: unknown, allowed: readonly string[]) =>
    (isStringList(v) ? v.filter((x) => allowed.includes(x)) : []) as T[];
  const direction = ['', 'en-fr', 'fr-en'].includes(c.direction as string) ? (c.direction as Direction) : '';
  const size = c.size === null || SIZES.includes(c.size as never) ? (c.size as number | null) : DEFAULT_CONFIG.size;
  return {
    themes: pick<ThemeId>(c.themes, themeIds),
    levels: pick<Level>(c.levels, LEVELS),
    types: pick<ItemType>(c.types, TYPES),
    direction,
    size,
  };
}

/** Relit une partie enregistrée. Les cartes d'éléments retirés de la base sont ignorées. */
export function parseGame(raw: unknown, exists: (itemId: string) => boolean): Game | null {
  const g = raw as Partial<Game> | null;
  if (!g || g.version !== 1 || !isStringList(g.pending) || !isStringList(g.retry) || !isStringList(g.missed)) return null;
  const keep = (ids: string[]) => ids.filter((id) => {
    const ref = parseCardId(id);
    return ref !== null && exists(ref.itemId);
  });
  const game: Game = {
    version: 1,
    config: parseConfig(g.config),
    pending: keep(g.pending),
    retry: keep(g.retry),
    round: typeof g.round === 'number' ? g.round : 1,
    total: typeof g.total === 'number' ? g.total : 0,
    missed: keep(g.missed),
  };
  return phase(game) === 'done' && game.total === 0 ? null : game;
}
