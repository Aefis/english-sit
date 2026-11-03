/** Assemble les lots dans public/deck.json. Refuse de construire si une erreur subsiste. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { assignOrder, zipfToFrequency } from '../src/core/order';
import { withDefaults, type Deck } from '../src/core/schema';
import { findDuplicates, validateItem } from '../src/core/validate';
import { loadAllowlist, loadBatches, loadZipf } from './load';

const loaded = loadBatches();
const zipf = loadZipf();

const errors = [
  ...loaded.flatMap(({ batch: _batch, ...item }) => validateItem(item)),
  ...findDuplicates(loaded, loadAllowlist()),
].filter((i) => i.severity === 'error');
if (errors.length) {
  for (const e of errors) console.error(`[${e.rule}] ${e.ids.join(' / ')} : ${e.message}`);
  process.exit(1);
}

const enriched = loaded.map(({ batch, ...raw }) => {
  const item = withDefaults(raw);
  const z = item.type === 'word' ? zipf[item.english.toLowerCase()] ?? null : null;
  return {
    ...item,
    batch,
    zipf: z,
    frequency: z === null ? item.frequency : zipfToFrequency(z),
    frequency_source: z === null ? ('estimate' as const) : ('corpus' as const),
  };
});

const items = assignOrder(enriched);
const version = createHash('sha256').update(JSON.stringify(items)).digest('hex').slice(0, 12);
const deck: Deck = { version, items };
mkdirSync('public', { recursive: true });
writeFileSync('public/deck.json', JSON.stringify(deck));
console.log(`deck.json : ${items.length} éléments, version ${version}`);
