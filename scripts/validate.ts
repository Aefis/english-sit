/** Contrôle automatique des lots. Code de sortie 1 s'il reste une erreur. */
import { findDuplicates, validateItem, type Issue } from '../src/core/validate';
import { loadAllowlist, loadBatches, loadZipf } from './load';
import { zipfToFrequency } from '../src/core/order';
import { LEVELS } from '../src/core/schema';

const items = loadBatches();
const zipf = loadZipf();
// batch n'est pas un champ de contenu : il est ajouté au chargement.
const issues: Issue[] = items.flatMap(({ batch: _batch, ...item }) => validateItem(item));
issues.push(...findDuplicates(items, loadAllowlist()));

// Le niveau annoncé doit rester compatible avec la fréquence réelle du mot.
for (const item of items) {
  if (item.type !== 'word') continue;
  const z = zipf[item.english.toLowerCase()];
  if (z === undefined) {
    issues.push({ severity: 'warning', rule: 'zipf_missing', ids: [item.id], message: 'pas de fréquence corpus' });
    continue;
  }
  if (LEVELS.indexOf(item.level) <= 1 && z < 3.4) {
    issues.push({ severity: 'warning', rule: 'level_vs_corpus', ids: [item.id], message: `niveau ${item.level} mais Zipf ${z}` });
  }
  if (Math.abs(zipfToFrequency(z) - item.frequency) >= 2) {
    issues.push({ severity: 'warning', rule: 'frequency_vs_corpus', ids: [item.id], message: `fréquence ${item.frequency} écrite, ${zipfToFrequency(z)} d'après le corpus (Zipf ${z})` });
  }
}

const errors = issues.filter((i) => i.severity === 'error');
const warnings = issues.filter((i) => i.severity === 'warning');
for (const i of [...errors, ...warnings]) {
  console.log(`${i.severity === 'error' ? 'ERREUR ' : 'alerte '} [${i.rule}] ${i.ids.join(' / ')} : ${i.message}`);
}
console.log(`\n${items.length} éléments, ${errors.length} erreur(s), ${warnings.length} alerte(s).`);
process.exit(errors.length ? 1 : 0);
