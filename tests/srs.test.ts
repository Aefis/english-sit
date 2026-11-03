import { beforeEach, describe, expect, it } from 'vitest';
import { cardId, cardsForItem } from '../src/core/cards';
import { filterItems, NO_FILTERS } from '../src/core/filter';
import { levelVerdict, placementCard, presumeRest, sampleLevel } from '../src/core/placement';
import { buildQueue, dayKey, matchesFocus, NO_FOCUS, type QueueInput } from '../src/core/queue';
import type { Item, Level } from '../src/core/schema';
import {
  applyReview, createScheduler, DAY_MS, newCardState, previewDue, Rating, retrievability, seedCard, State,
  type CardState, type ReviewLog,
} from '../src/core/srs';
import { computeStats, computeStreak, itemProgress } from '../src/core/stats';

const NOW = new Date(2026, 10, 3, 12).getTime();
const scheduler = createScheduler(0.9, false);

function item(id: string, patch: Partial<Item> = {}): Item {
  return {
    id, english: id.replace(/-/g, ' '), french: `fr ${id}`, type: 'word', level: 'A2', frequency: 3, priority: 5,
    example_en: `Say ${id}.`, example_fr: `Dis ${id}.`, highlight: id, context: 'conversation', register: 'neutral',
    tags: ['t'], pos: 'noun', sense: null, situation_fr: null, also_accept: [], notes: null, variant: 'both',
    counterpart: null, family: null, forms: null, ipa: null, audio: null, status: 'draft',
    frequency_source: 'estimate', zipf: null, order: 1, batch: 'test', ...patch,
  };
}

const ref = (i: Item, n = 0) => cardsForItem(i)[n];
const mapOf = (...cards: CardState[]) => new Map(cards.map((c) => [c.id, c]));
const graduated = (i: Item, n = 0, now = NOW) => {
  let card = newCardState(ref(i, n), now);
  for (let k = 0; k < 2; k++) card = applyReview(scheduler, card, Rating.Good, now).card;
  return card;
};

let input: QueueInput;
beforeEach(() => {
  input = {
    items: [item('a', { order: 1 }), item('b', { order: 2 }), item('c', { order: 3 })],
    cards: new Map(),
    suspended: new Set(),
    now: NOW,
  };
});

describe('FSRS', () => {
  it('fait croître les intervalles quand les réponses sont bonnes', () => {
    let card = newCardState(ref(item('a')), NOW);
    let now = NOW;
    const intervals: number[] = [];
    for (let k = 0; k < 6; k++) {
      card = applyReview(scheduler, card, Rating.Good, now).card;
      intervals.push(card.due - now);
      now = card.due;
    }
    expect(card.state).toBe(State.Review);
    expect(intervals[5]).toBeGreaterThan(intervals[3]);
    expect(card.correct).toBe(6);
  });

  it('ordonne Again < Hard < Good < Easy', () => {
    const card = graduated(item('a'));
    const due = previewDue(scheduler, card, card.due);
    expect(due[Rating.Again]).toBeLessThan(due[Rating.Hard]);
    expect(due[Rating.Hard]).toBeLessThan(due[Rating.Good]);
    expect(due[Rating.Good]).toBeLessThan(due[Rating.Easy]);
  });

  it('compte un oubli et renvoie la carte en réapprentissage', () => {
    const card = graduated(item('a'));
    const { card: next, log } = applyReview(scheduler, card, Rating.Again, card.due);
    expect(next.state).toBe(State.Relearning);
    expect(next.lapses).toBe(1);
    expect(next.wrong).toBe(1);
    expect(next.stability).toBeLessThan(card.stability);
    expect(log.stateBefore).toBe(State.Review);
  });

  it('continue à planifier normalement une carte placée par le test initial', () => {
    const seeded = seedCard(newCardState(ref(item('a')), NOW), 'known', NOW);
    expect(seeded.due).toBe(NOW + 45 * DAY_MS);
    expect(retrievability(scheduler, seeded, NOW + 45 * DAY_MS)).toBeCloseTo(0.9, 1);
    const { card } = applyReview(scheduler, seeded, Rating.Good, seeded.due);
    expect(card.stability).toBeGreaterThan(45);
  });
});

describe('file de révision', () => {
  it('présente les nouveautés selon leur ordre', () => {
    const { next, counts } = buildQueue(input);
    expect(next?.id).toBe(cardId('a', 'recognition'));
    expect(counts.fresh).toBe(3);
  });

  it('propose toutes les nouveautés sans limite', () => {
    const items = Array.from({ length: 300 }, (_, n) => item(`w${n}`));
    expect(buildQueue({ ...input, items }).counts.fresh).toBe(300);
  });

  it('place les cartes en cours, puis les révisions, avant les nouveautés', () => {
    const due = { ...graduated(input.items[1]), due: NOW - 1000 };
    expect(buildQueue({ ...input, cards: mapOf(due) }).next?.id).toBe(due.id);
    const learning = { ...applyReview(scheduler, newCardState(ref(input.items[2]), NOW), Rating.Again, NOW).card, due: NOW - 1 };
    expect(buildQueue({ ...input, cards: mapOf(due, learning) }).next?.id).toBe(learning.id);
  });

  it('bloque la production tant que la compréhension n\'est pas consolidée', () => {
    const items = [item('a')];
    const learning = applyReview(scheduler, newCardState(ref(items[0]), NOW), Rating.Good, NOW).card;
    const later = NOW + 2 * DAY_MS;
    expect(buildQueue({ ...input, items, cards: mapOf({ ...learning, due: later + 1e9 }), now: later }).next).toBeNull();
    const done = graduated(items[0]);
    const { next } = buildQueue({ ...input, items, cards: mapOf({ ...done, due: later + 1e9 }), now: later });
    expect(next?.kind).toBe('production');
  });

  it('propose la production le jour même, dès la compréhension consolidée', () => {
    const items = [item('a')];
    const done = { ...graduated(items[0]), due: NOW + 1e9 };
    expect(buildQueue({ ...input, items, cards: mapOf(done) }).next?.kind).toBe('production');
  });

  it('alterne les deux sens sans enchaîner une carte et sa carte inverse', () => {
    const items = Array.from({ length: 12 }, (_, n) => item(`w${n}`));
    const cards = new Map<string, CardState>();
    const seen: CardState[] = [];
    for (let n = 0; n < 16; n++) {
      const now = NOW + n * 1000;
      const { next } = buildQueue({ ...input, items, cards, now });
      seen.push(next!);
      const { card } = applyReview(scheduler, next!, Rating.Easy, now);
      cards.set(card.id, card);
    }
    expect(seen.filter((c) => c.kind === 'production').length).toBeGreaterThanOrEqual(6);
    for (let n = 1; n < seen.length; n++) expect(seen[n].itemId).not.toBe(seen[n - 1].itemId);
  });

  it('ignore les éléments suspendus', () => {
    expect(buildQueue({ ...input, suspended: new Set(['a']) }).next?.itemId).toBe('b');
  });

  it('avance une carte en cours quand il ne reste rien d\'autre', () => {
    const items = [item('a')];
    const soon = { ...applyReview(scheduler, newCardState(ref(items[0]), NOW), Rating.Again, NOW).card, due: NOW + 5 * 60_000 };
    expect(buildQueue({ ...input, items, cards: mapOf(soon) }).next?.id).toBe(soon.id);
    expect(buildQueue({ ...input, items, cards: mapOf({ ...soon, due: NOW + 3_600_000 }) }).next).toBeNull();
  });

  it('bascule la journée à 4 h', () => {
    expect(dayKey(new Date(2026, 10, 4, 3).getTime())).toBe('2026-11-03');
    expect(dayKey(new Date(2026, 10, 4, 5).getTime())).toBe('2026-11-04');
  });
});

describe('révision par catégorie et par niveau', () => {
  const verb = item('look-into', { type: 'phrasal_verb', level: 'B2', tags: ['pro'] });
  const word = item('busy', { type: 'word', level: 'A1', tags: ['daily_life'] });
  const proWord = item('deadline', { type: 'word', level: 'B2', tags: ['pro'] });
  const all = [word, verb, proWord];
  const ids = (focus: Parameters<typeof matchesFocus>[1]) => all.filter((i) => matchesFocus(i, focus)).map((i) => i.id);

  it('laisse tout passer sans sélection', () => {
    expect(ids(NO_FOCUS)).toHaveLength(3);
  });

  it('filtre par type, niveau, tag pro et combinaison', () => {
    expect(ids({ category: 'phrasal_verb', level: '' })).toEqual(['look-into']);
    expect(ids({ category: '', level: 'B2' })).toEqual(['look-into', 'deadline']);
    expect(ids({ category: 'pro', level: '' })).toEqual(['look-into', 'deadline']);
    expect(ids({ category: 'word', level: 'B2' })).toEqual(['deadline']);
    expect(ids({ category: 'idiom', level: 'A1' })).toEqual([]);
  });

  it('ne change pas la planification : une carte hors sélection reste due', () => {
    const due = { ...graduated(word), due: NOW - 1000 };
    const focused = all.filter((i) => matchesFocus(i, { category: 'pro', level: '' }));
    expect(buildQueue({ ...input, items: focused, cards: mapOf(due) }).next?.itemId).toBe('look-into');
    expect(buildQueue({ ...input, items: all, cards: mapOf(due) }).next?.id).toBe(due.id);
  });
});

describe('sens de révision', () => {
  const situated = item('a', { situation_fr: 'Tu...' });

  it('EN → FR ne propose que la compréhension', () => {
    const done = { ...graduated(situated), due: NOW + 1e9 };
    const { next, counts } = buildQueue({ ...input, items: [situated], cards: mapOf(done), direction: 'en-fr' });
    expect(next).toBeNull();
    expect(counts.fresh).toBe(0);
  });

  it('FR → EN propose tout de suite la production d\'un élément jamais vu', () => {
    const { next, counts } = buildQueue({ ...input, direction: 'fr-en' });
    expect(next?.id).toBe(cardId('a', 'production'));
    expect(counts.fresh).toBe(3);
  });

  it('FR → EN ignore les cartes de compréhension dues', () => {
    const due = { ...graduated(input.items[0]), due: NOW - 1000 };
    expect(buildQueue({ ...input, cards: mapOf(due), direction: 'fr-en' }).next?.kind).toBe('production');
  });

  it('FR → EN garde la carte de situation après la production', () => {
    const production = { ...graduated(situated, 1), due: NOW + 1e9 };
    const { next } = buildQueue({ ...input, items: [situated], cards: mapOf(production), direction: 'fr-en' });
    expect(next?.kind).toBe('context');
  });

  it('applique le sens à la révision libre', () => {
    const recognition = { ...graduated(input.items[0]), due: NOW + 1e9 };
    const items = [input.items[0]];
    const { next } = buildQueue({ ...input, items, cards: mapOf(recognition), direction: 'en-fr', free: true });
    expect(next?.kind).toBe('recognition');
  });
});

describe('révision libre', () => {
  const items = [item('a'), item('b')];
  const later = (i: Item, n: number, lastReview: number) => ({ ...graduated(i, n), due: NOW + 1e9, lastReview });
  const bothDone = (i: Item, lastReview: number) => [later(i, 0, lastReview), later(i, 1, lastReview - 1)];

  it('propose une carte non prévue seulement si on le demande', () => {
    const base = { ...input, items: [items[0]], cards: mapOf(...bothDone(items[0], NOW - 1000)) };
    expect(buildQueue(base).next).toBeNull();
    expect(buildQueue({ ...base, free: true }).next).not.toBeNull();
  });

  it('reprend la carte vue il y a le plus longtemps', () => {
    const cards = mapOf(...bothDone(items[0], NOW - 1000), ...bothDone(items[1], NOW - 9000));
    expect(buildQueue({ ...input, items, cards, free: true }).next?.itemId).toBe('b');
  });

  it('garde les cartes prévues en priorité', () => {
    const due = { ...graduated(items[0]), due: NOW - 1000 };
    const cards = mapOf(due, ...bothDone(items[1], NOW - 9000));
    expect(buildQueue({ ...input, items, cards, free: true }).next?.id).toBe(due.id);
  });

  it('ne propose rien sur une sélection vide', () => {
    expect(buildQueue({ ...input, items: [], free: true }).next).toBeNull();
  });
});

describe('test initial', () => {
  const items: Item[] = Array.from({ length: 30 }, (_, n) => item(`w${n}`, { order: n + 1, level: 'A2' as Level }));

  it('échantillonne tout le niveau', () => {
    const sample = sampleLevel(items, 'A2', 10, new Map());
    expect(sample).toHaveLength(10);
    expect(sample.at(-1)!.order).toBeGreaterThan(25);
  });

  it('espace les connus, garde les inconnus dans le cycle normal', () => {
    const known = placementCard(items[0], 'known', NOW)!;
    const uncertain = placementCard(items[0], 'uncertain', NOW)!;
    expect(known.due).toBeGreaterThan(uncertain.due);
    expect(known.kind).toBe('recognition');
    expect(placementCard(items[0], 'unknown', NOW)).toBeNull();
  });

  it('ouvre la production d\'un élément connu sans la créer', () => {
    const known = placementCard(items[0], 'known', NOW)!;
    const { next } = buildQueue({ ...input, items: [items[0]], cards: mapOf(known) });
    expect(next?.kind).toBe('production');
  });

  it('décide selon le taux de réussite', () => {
    expect(levelVerdict(Array(10).fill('known')).action).toBe('presume');
    expect(levelVerdict(['known', 'known', 'unknown']).action).toBe('continue');
    expect(levelVerdict(['known', 'unknown', 'unknown']).action).toBe('stop');
  });

  it('présume uniquement les éléments non testés', () => {
    const tested = placementCard(items[0], 'unknown' === 'unknown' ? 'uncertain' : 'known', NOW)!;
    const rest = presumeRest(items, 'A2', mapOf(tested), NOW);
    expect(rest).toHaveLength(29);
    expect(rest[0].seed).toBe('presumed');
  });
});

describe('statistiques', () => {
  it('distingue jamais vu, en apprentissage et maîtrisé', () => {
    const i = item('a');
    expect(itemProgress(i, new Map())).toBe('new');
    const known = seedCard(newCardState(ref(i, 0), NOW), 'known', NOW);
    expect(itemProgress(i, mapOf(known))).toBe('learning');
    const production = seedCard(newCardState(ref(i, 1), NOW), 'known', NOW);
    expect(itemProgress(i, mapOf(known, production))).toBe('mastered');
  });

  it('calcule la série, y compris si aujourd\'hui est encore vide', () => {
    const days = [0, 1, 2, 4].map((d) => ({ ts: NOW - d * DAY_MS }));
    expect(computeStreak(days, NOW)).toBe(3);
    expect(computeStreak(days, NOW + DAY_MS)).toBe(3);
    expect(computeStreak(days, NOW + 2 * DAY_MS)).toBe(0);
  });

  it('estime le vocabulaire actif à partir de la seule production', () => {
    const items = [item('a')];
    const recognition = seedCard(newCardState(ref(items[0], 0), NOW), 'known', NOW);
    const passiveOnly = computeStats(items, mapOf(recognition), [], scheduler, NOW);
    expect(passiveOnly.activeVocabulary).toBe(0);
    expect(passiveOnly.passiveVocabulary).toBe(1);
    const production = seedCard(newCardState(ref(items[0], 1), NOW), 'known', NOW);
    expect(computeStats(items, mapOf(recognition, production), [], scheduler, NOW).activeVocabulary).toBe(1);
  });

  it('calcule le taux de réussite sur 30 jours', () => {
    const log = (rating: Rating, age: number) => ({ rating, ts: NOW - age * DAY_MS, itemId: 'a' }) as ReviewLog;
    const stats = computeStats([], new Map(), [log(Rating.Good, 1), log(Rating.Again, 2), log(Rating.Again, 40)], scheduler, NOW);
    expect(stats.successRate).toBe(0.5);
  });
});

describe('filtres', () => {
  const items = [item('deal-with', { french: 'gérer', level: 'B1', type: 'phrasal_verb', tags: ['pro'] }), item('lift', { counterpart: 'elevator', french: 'ascenseur' })];
  const run = (patch: Partial<typeof NO_FILTERS>, favorites = new Set<string>()) =>
    filterItems(items, { ...NO_FILTERS, ...patch }, new Map(), favorites).map((i) => i.id);

  it('cherche dans l\'anglais, le français (sans accents) et la variante', () => {
    expect(run({ query: 'deal' })).toEqual(['deal-with']);
    expect(run({ query: 'gerer' })).toEqual(['deal-with']);
    expect(run({ query: 'elevator' })).toEqual(['lift']);
  });

  it('combine les filtres', () => {
    expect(run({ level: 'B1', tag: 'pro' })).toEqual(['deal-with']);
    expect(run({ type: 'word', level: 'B1' })).toEqual([]);
    expect(run({ progress: 'new' })).toHaveLength(2);
    expect(run({ favoritesOnly: true }, new Set(['lift']))).toEqual(['lift']);
  });
});
