import { describe, expect, it } from 'vitest';
import { cardId } from '../src/core/cards';
import {
  answerCard, candidates, DEFAULT_CONFIG, followUpCard, parseConfig, parseGame, phase, startGame, startRetryRound,
  type GameConfig, type GameInput,
} from '../src/core/game';
import type { Item } from '../src/core/schema';
import { applyReview, createScheduler, newCardState, Rating, type CardState } from '../src/core/srs';
import { isKnownTag, THEMES } from '../src/core/themes';
import { loadBatches } from '../scripts/load';

const NOW = new Date(2026, 10, 9, 12).getTime();
const scheduler = createScheduler(0.9, false);

function item(id: string, patch: Partial<Item> = {}): Item {
  return {
    id, english: id, french: `fr ${id}`, type: 'word', level: 'A2', frequency: 3, priority: 5,
    example_en: `Say ${id}.`, example_fr: `Dis ${id}.`, highlight: id, context: 'conversation', register: 'neutral',
    tags: ['food'], pos: 'noun', sense: null, situation_fr: null, also_accept: [], notes: null, variant: 'both',
    counterpart: null, family: null, forms: null, ipa: null, audio: null, status: 'draft',
    frequency_source: 'estimate', zipf: null, order: 1, batch: 'test', ...patch,
  };
}

const rec = (id: string) => cardId(id, 'recognition');
const prod = (id: string) => cardId(id, 'production');
const input = (items: Item[], config: Partial<GameConfig> = {}, cards = new Map<string, CardState>()): GameInput => ({
  items, cards, suspended: new Set(), config: { ...DEFAULT_CONFIG, ...config }, now: NOW,
});

describe('thèmes', () => {
  it('range chaque tag de la base dans un thème', () => {
    const tags = new Set(loadBatches().flatMap((i) => i.tags));
    expect([...tags].filter((t) => !isKnownTag(t))).toEqual([]);
  });

  it('a des identifiants uniques', () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
  });
});

describe('sélection d\'une partie', () => {
  const items = [
    item('apple', { tags: ['food'], level: 'A1' }),
    item('train', { tags: ['transport'], level: 'A2' }),
    item('meeting', { tags: ['meetings', 'pro'], level: 'B1', type: 'chunk' }),
  ];
  const ids = (config: Partial<GameConfig>) => candidates(input(items, config)).map((id) => id.split('::')[0]);

  it('combine plusieurs thèmes et plusieurs niveaux', () => {
    expect(ids({ themes: ['nourriture', 'voyage'] })).toEqual(['apple', 'train']);
    expect(ids({ levels: ['A1', 'B1'] })).toEqual(['apple', 'meeting']);
    expect(ids({ themes: ['nourriture', 'voyage'], levels: ['A2'] })).toEqual(['train']);
    expect(ids({ types: ['chunk'] })).toEqual(['meeting']);
    expect(ids({})).toHaveLength(3);
  });

  it('respecte le sens choisi', () => {
    expect(candidates(input(items, { direction: 'fr-en', themes: ['nourriture'] }))).toEqual([prod('apple')]);
    expect(candidates(input(items, { direction: 'en-fr', themes: ['nourriture'] }))).toEqual([rec('apple')]);
  });

  it('limite la partie au nombre de cartes demandé', () => {
    expect(startGame(input(items, { size: 2 }))?.pending).toHaveLength(2);
    expect(startGame(input(items, { size: null }))?.pending).toHaveLength(3);
    expect(startGame(input(items, { levels: ['C1'] }))).toBeNull();
  });

  it('met les cartes dues avant les nouvelles', () => {
    const seen = applyReview(scheduler, newCardState({ id: rec('meeting'), itemId: 'meeting', kind: 'recognition' }, NOW - 9e9), Rating.Good, NOW - 9e9).card;
    const list = candidates(input(items, { direction: 'en-fr' }, new Map([[seen.id, seen]])));
    expect(list[0]).toBe(rec('meeting'));
  });
});

describe('déroulement d\'une partie', () => {
  const items = ['a', 'b', 'c'].map((id) => item(id));

  it('garde les cartes « À réviser » pour la fin', () => {
    let game = startGame(input(items, { direction: 'en-fr' }))!;
    game = answerCard(game, rec('a'), false);
    expect(game.pending).toEqual([rec('b'), rec('c')]);
    expect(game.retry).toEqual([rec('a')]);
    game = answerCard(answerCard(game, rec('b'), true), rec('c'), true);
    expect(phase(game)).toBe('break');
    game = startRetryRound(game);
    expect(game.pending).toEqual([rec('a')]);
    expect(phase(answerCard(game, rec('a'), true))).toBe('done');
    expect(game.total - game.missed.length).toBe(2);
  });

  it('ajoute plus loin le sens français → anglais d\'une carte connue', () => {
    expect(followUpCard(items[0], 'recognition', '')).toBe(prod('a'));
    expect(followUpCard(items[0], 'recognition', 'en-fr')).toBeNull();
    const game = answerCard(startGame(input(items))!, rec('a'), true, prod('a'));
    expect(game.pending).toEqual([rec('b'), rec('c'), prod('a')]);
    expect(game.total).toBe(4);
  });

  it('se relit après un rechargement et ignore les éléments disparus', () => {
    const game = startGame(input(items))!;
    const restored = parseGame(JSON.parse(JSON.stringify(game)), (id) => id !== 'b');
    expect(restored?.pending).toEqual([rec('a'), rec('c')]);
    expect(parseGame({ version: 2 }, () => true)).toBeNull();
    expect(parseGame(null, () => true)).toBeNull();
  });

  it('ignore les réglages inconnus', () => {
    expect(parseConfig({ themes: ['voyage', 'x'], levels: ['A1', 'Z9'], size: 7, direction: '?' }))
      .toEqual({ themes: ['voyage'], levels: ['A1'], types: [], direction: '', size: DEFAULT_CONFIG.size });
  });
});
