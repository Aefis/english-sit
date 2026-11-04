import { describe, expect, it } from 'vitest';
import { clozeHint, cardsForItem, spokenAnswer } from '../src/core/cards';
import { normalizeEnglish } from '../src/core/normalize';
import { assignOrder, zipfToFrequency } from '../src/core/order';
import type { RawItem } from '../src/core/schema';
import { findDuplicates, validateItem } from '../src/core/validate';
import { loadAllowlist, loadBatches } from '../scripts/load';

const base: RawItem = {
  id: 'give-up', english: 'give up', french: 'abandonner', type: 'phrasal_verb', level: 'A2',
  frequency: 5, priority: 5, example_en: "Don't give up.", example_fr: "N'abandonne pas.",
  highlight: 'give up', context: 'conversation', register: 'neutral', tags: ['conversation'],
};
const rules = (item: RawItem) => validateItem(item).filter((i) => i.severity === 'error').map((i) => i.rule);
const dupRules = (items: RawItem[]) => findDuplicates(items).map((i) => i.rule);

describe('normalisation', () => {
  it('unifie casse, contractions, points de suspension, déterminants et marqueurs', () => {
    expect(normalizeEnglish("It's not a big deal.")).toBe(normalizeEnglish('it is NOT a big deal'));
    expect(normalizeEnglish('As far as I know...')).toBe('as far as i know');
    expect(normalizeEnglish('a big deal')).toBe('big deal');
    expect(normalizeEnglish('keep someone updated')).toBe(normalizeEnglish('keep somebody updated'));
    expect(normalizeEnglish('colour')).toBe('color');
  });
});

describe('validation', () => {
  it('accepte un élément correct', () => expect(rules(base)).toEqual([]));

  it.each([
    ['highlight absent', { highlight: 'carry on' }, 'highlight'],
    ['niveau inconnu', { level: 'C2' as never }, 'enum'],
    ['fréquence hors échelle', { frequency: 6 }, 'range'],
    ['champ inconnu', { foo: 1 } as never, 'unknown_field'],
    ['exemple sans ponctuation', { example_en: "Don't give up" }, 'example_format'],
    ['exemple incomplet', { example_en: "Don't give up..." }, 'example_format'],
    ['variante sans équivalent', { variant: 'UK' as const }, 'variant'],
    ['expression à un mot', { english: 'give' }, 'multiword'],
    ['id mal formé', { id: 'Give Up' }, 'id_format'],
  ])('rejette : %s', (_name, patch, rule) => {
    expect(rules({ ...base, ...patch })).toContain(rule);
  });

  it('signale un champ obligatoire manquant', () => {
    expect(rules({ ...base, french: '' })).toContain('required');
  });
});

describe('doublons', () => {
  const other = (patch: Partial<RawItem>): RawItem => ({
    ...base, id: 'other', english: 'carry on', french: 'continuer', example_en: 'Carry on.', highlight: 'Carry on', ...patch,
  });

  it('détecte id, casse et ponctuation identiques', () => {
    expect(dupRules([base, other({ id: 'give-up' })])).toContain('dup_id');
    expect(dupRules([base, other({ english: 'Give up!' })])).toContain('dup_english');
  });

  it('accepte deux sens distincts de la même forme', () => {
    const items = [other({ id: 'a', english: 'lift', sense: 'ascenseur' }), other({ id: 'b', english: 'lift', sense: 'soulever', french: 'soulever', example_en: 'Lift it.' })];
    expect(dupRules(items)).not.toContain('dup_english');
  });

  it('détecte une variante UK/US saisie deux fois', () => {
    const lift = other({ id: 'lift', english: 'lift', variant: 'UK', counterpart: 'elevator' });
    expect(dupRules([lift, other({ id: 'elevator', english: 'elevator', french: 'ascenseur US', example_en: 'Take it.' })])).toContain('dup_english');
  });

  it('signale traductions, exemples et quasi-doublons sans bloquer', () => {
    expect(dupRules([base, other({ french: 'abandonner' })])).toContain('same_french');
    expect(dupRules([base, other({ example_en: "Don't give up." })])).toContain('same_example');
    expect(dupRules([other({ id: 'a', english: 'get rid of something' }), other({ id: 'b', english: 'get rid of', french: 'x', example_en: 'X.' })])).toContain('near_duplicate');
    expect(dupRules([other({ id: 'a', english: 'look forward to' }), other({ id: 'b', english: 'looking forward to', french: 'x', example_en: 'X.' })])).toContain('near_duplicate');
  });

  it('signale les formes fléchies', () => {
    const word = (id: string): RawItem => other({ id, english: id, type: 'word', pos: 'verb', french: id, example_en: `${id}.` });
    expect(dupRules([word('work'), word('working')])).toContain('inflection');
    expect(dupRules([word('decide'), word('decision')])).not.toContain('inflection');
  });

  it('respecte la liste blanche pour les alertes', () => {
    const a = other({ id: 'a', french: 'pareil' });
    const b = other({ id: 'b', english: 'go on', french: 'pareil', example_en: 'Go on.' });
    expect(findDuplicates([a, b], [{ ids: ['b', 'a'], reason: 'test' }])).toEqual([]);
  });
});

describe('ordre et cartes', () => {
  it('fait passer un élément essentiel avant un élément secondaire de niveau inférieur', () => {
    const ordered = assignOrder([
      { id: 'minor-a2', level: 'A2' as const, frequency: 2, priority: 2 },
      { id: 'key-b1', level: 'B1' as const, frequency: 5, priority: 5 },
    ]);
    expect(ordered.map((i) => i.id)).toEqual(['key-b1', 'minor-a2']);
  });

  it('ne range pas par ordre alphabétique à score égal, et reste stable', () => {
    const items = ['a-1', 'a-2', 'a-3', 'a-4', 'b-1', 'b-2', 'b-3', 'b-4'].map((id) => ({ id, level: 'A1' as const, frequency: 5, priority: 5 }));
    const ids = assignOrder(items).map((i) => i.id);
    expect(ids).not.toEqual(items.map((i) => i.id));
    expect(assignOrder([...items].reverse()).map((i) => i.id)).toEqual(ids);
  });

  it('convertit Zipf en bandes', () => {
    expect([6, 5, 4.5, 4, 3].map(zipfToFrequency)).toEqual([5, 4, 3, 2, 1]);
  });

  it('génère les deux sens pour tous, et le contexte si une situation existe', () => {
    const kinds = (situation_fr: string | null) => cardsForItem({ id: 'x', situation_fr }).map((c) => c.kind);
    expect(kinds(null)).toEqual(['recognition', 'production']);
    expect(kinds('Tu...')).toEqual(['recognition', 'production', 'context']);
  });

  it('masque la cible dans l\'indice', () => {
    expect(clozeHint('I was about to leave.', 'was about to')).toBe('I w__ a____ t_ leave.');
  });

  it('remplace une expression ouverte par sa phrase complète', () => {
    expect(spokenAnswer({ english: 'I was about to...', example_en: 'I was about to call you.' })).toBe('I was about to call you.');
    expect(spokenAnswer({ english: 'That works for me.', example_en: 'Tuesday? That works for me.' })).toBe('That works for me.');
  });
});

describe('lots réels', () => {
  const items = loadBatches();

  it('ne contient aucune erreur', () => {
    const errors = [
      ...items.flatMap(({ batch: _batch, ...item }) => validateItem(item)),
      ...findDuplicates(items, loadAllowlist()),
    ].filter((i) => i.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('couvre les six niveaux et les six types', () => {
    expect(new Set(items.map((i) => i.level)).size).toBe(6);
    expect(new Set(items.map((i) => i.type)).size).toBe(6);
  });
});
