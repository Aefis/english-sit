/** Distribution globale : niveaux, types, registres, cartes générées, champs facultatifs. */
import { cardsForItem } from '../src/core/cards';
import { withDefaults } from '../src/core/schema';
import { loadBatches } from './load';

const items = loadBatches().map(({ batch: _batch, ...raw }) => withDefaults(raw));
const tally = (values: (string | number)[]) => {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
  return Object.fromEntries([...counts].sort());
};

const cards = items.flatMap((i) => cardsForItem(i));
console.log({
  total: items.length,
  type: tally(items.map((i) => i.type)),
  level: tally(items.map((i) => i.level)),
  register: tally(items.map((i) => i.register)),
  context: tally(items.map((i) => i.context)),
  frequency: tally(items.map((i) => i.frequency)),
  priority: tally(items.map((i) => i.priority)),
  pro: items.filter((i) => i.tags.includes('pro')).length,
  families: tally(items.filter((i) => i.family).map((i) => i.family as string)),
  cards: tally(cards.map((c) => c.kind)),
});
