import {
  CONTEXTS, LEVELS, POS, REGISTERS, STATUSES, TYPES, VARIANTS, type RawItem,
} from './schema';
import {
  contentTokens, inflectionStems, levenshtein, lightStem, normalizeEnglish, normalizeFrench,
} from './normalize';

export type Severity = 'error' | 'warning';
export interface Issue {
  severity: Severity;
  rule: string;
  ids: string[];
  message: string;
}

const MAX_EXAMPLE_WORDS = 14;
const REQUIRED = [
  'id', 'english', 'french', 'type', 'level', 'frequency', 'priority',
  'example_en', 'example_fr', 'highlight', 'context', 'register', 'tags',
] as const;
const ENUMS: [keyof RawItem, readonly string[]][] = [
  ['type', TYPES], ['level', LEVELS], ['context', CONTEXTS], ['register', REGISTERS],
  ['variant', VARIANTS], ['status', STATUSES], ['pos', POS],
];
const KNOWN_FIELDS = new Set<string>([
  ...REQUIRED, 'pos', 'sense', 'situation_fr', 'also_accept', 'notes', 'variant',
  'counterpart', 'family', 'forms', 'ipa', 'audio', 'status',
]);

export function validateItem(item: RawItem): Issue[] {
  const issues: Issue[] = [];
  const id = String(item.id ?? '?');
  const add = (severity: Severity, rule: string, message: string) =>
    issues.push({ severity, rule, ids: [id], message });

  for (const field of REQUIRED) {
    const value = item[field];
    if (value === undefined || value === null || value === '') add('error', 'required', `champ manquant : ${field}`);
  }
  if (issues.length) return issues;

  for (const key of Object.keys(item)) {
    if (!KNOWN_FIELDS.has(key)) add('error', 'unknown_field', `champ inconnu : ${key}`);
  }
  for (const [field, allowed] of ENUMS) {
    const value = item[field];
    if (value != null && !allowed.includes(value as string)) add('error', 'enum', `${field} invalide : ${value}`);
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(item.id)) add('error', 'id_format', 'id : slug minuscule attendu');
  for (const field of ['frequency', 'priority'] as const) {
    const n = item[field];
    if (!Number.isInteger(n) || n < 1 || n > 5) add('error', 'range', `${field} doit valoir 1 à 5`);
  }
  if (!Array.isArray(item.tags) || item.tags.length === 0) add('error', 'tags', 'au moins un tag');
  else if (item.tags.some((t) => !/^[a-z0-9_]+$/.test(t))) add('error', 'tags', 'tags en snake_case');

  if (!item.example_en.toLowerCase().includes(item.highlight.toLowerCase())) {
    add('error', 'highlight', `« ${item.highlight} » absent de example_en`);
  }
  if (item.example_en.split(/\s+/).length > MAX_EXAMPLE_WORDS) add('warning', 'example_length', 'exemple trop long');
  for (const field of ['example_en', 'example_fr'] as const) {
    if (!/^[\p{Lu}"]/u.test(item[field])) add('error', 'example_format', `${field} : majuscule initiale attendue`);
    if (!/[.!?]$/.test(item[field])) add('error', 'example_format', `${field} : ponctuation finale attendue`);
    if (/\.\.\.$/.test(item[field])) add('error', 'example_format', `${field} : phrase incomplète`);
    if (/[’…]/.test(item[field])) add('warning', 'typography', `${field} : apostrophes droites et ... attendus`);
  }
  // Les mots transparents (decision/décision) sont légitimes, pas une expression recopiée.
  if (item.type !== 'word' && normalizeFrench(item.french) === normalizeFrench(item.english)) {
    add('warning', 'translation', 'traduction identique à l\'anglais');
  }

  const words = item.english.trim().split(/\s+/).length;
  if (item.type === 'word') {
    if (!item.pos) add('error', 'word_pos', 'pos requis pour un mot');
    if (words > 1) add('error', 'word_single', 'un mot ne contient pas d\'espace');
  } else if (item.type !== 'connector' && words < 2) {
    add('error', 'multiword', `${item.type} : au moins deux mots`);
  }
  if (item.variant && item.variant !== 'both' && !item.counterpart) {
    add('error', 'variant', 'variant UK/US : counterpart requis');
  }
  return issues;
}

export interface AllowedPair {
  ids: [string, string];
  reason: string;
}

const pairKey = (a: string, b: string) => [a, b].sort().join('|');

export function findDuplicates(items: RawItem[], allow: AllowedPair[] = []): Issue[] {
  const issues: Issue[] = [];
  const allowed = new Set(allow.map((p) => pairKey(...p.ids)));
  const seen = new Set<string>();
  const add = (severity: Severity, rule: string, a: string, b: string, message: string) => {
    const k = `${rule}|${pairKey(a, b)}`;
    if (seen.has(k) || (severity === 'warning' && allowed.has(pairKey(a, b)))) return;
    seen.add(k);
    issues.push({ severity, rule, ids: [a, b], message });
  };

  const ids = new Set<string>();
  const byKey = new Map<string, RawItem[]>();
  const byFrench = new Map<string, RawItem[]>();
  const byExample = new Map<string, RawItem>();
  const byToken = new Map<string, RawItem[]>();
  const push = <K>(map: Map<K, RawItem[]>, key: K, item: RawItem) => {
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  };

  for (const item of items) {
    if (ids.has(item.id)) issues.push({ severity: 'error', rule: 'dup_id', ids: [item.id], message: 'id déjà utilisé' });
    ids.add(item.id);

    const keys = [item.english, item.counterpart].filter(Boolean).map((k) => normalizeEnglish(k as string));
    for (const key of keys) {
      for (const other of byKey.get(key) ?? []) {
        if (other.id === item.id) continue;
        if (!item.sense || !other.sense || item.sense === other.sense) {
          add('error', 'dup_english', item.id, other.id, `même forme (« ${key} ») sans sens distinct`);
        }
      }
      push(byKey, key, item);
    }

    const fr = normalizeFrench(item.french);
    for (const other of byFrench.get(fr) ?? []) {
      add('warning', 'same_french', item.id, other.id, `même traduction (« ${item.french} ») : production ambiguë`);
    }
    push(byFrench, fr, item);

    const example = item.example_en.toLowerCase();
    const twin = byExample.get(example);
    if (twin) add('warning', 'same_example', item.id, twin.id, 'même exemple');
    byExample.set(example, item);

    for (const token of new Set(contentTokens(normalizeEnglish(item.english)))) push(byToken, token, item);
  }

  // Quasi-doublons : on ne compare que les paires qui partagent un mot porteur de sens.
  for (const group of byToken.values()) {
    if (group.length > 200) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const [a, b] = [group[i], group[j]];
        const [ka, kb] = [normalizeEnglish(a.english), normalizeEnglish(b.english)];
        if (ka === kb) continue;
        const [ta, tb] = [new Set(contentTokens(ka).map(lightStem)), new Set(contentTokens(kb).map(lightStem))];
        const shared = [...ta].filter((t) => tb.has(t)).length;
        const jaccard = shared / (ta.size + tb.size - shared);
        const distance = levenshtein(ka, kb) / Math.max(ka.length, kb.length);
        const bothPhrases = ta.size > 1 && tb.size > 1;
        if ((bothPhrases && jaccard >= 0.75) || (ka.length > 6 && distance <= 0.15)) {
          add('warning', 'near_duplicate', a.id, b.id, `« ${a.english} » ≈ « ${b.english} »`);
        }
      }
    }
  }

  // Formes fléchies : works/worked/working ne sont pas des éléments distincts.
  const singleWords = new Map(items.filter((i) => i.type === 'word').map((i) => [i.english.toLowerCase(), i]));
  for (const [word, item] of singleWords) {
    for (const stem of inflectionStems(word)) {
      const base = singleWords.get(stem);
      if (base && base.id !== item.id) add('warning', 'inflection', item.id, base.id, `« ${word} » est une flexion de « ${stem} » ?`);
    }
  }
  return issues;
}
