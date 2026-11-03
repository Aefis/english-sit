/** Clés de comparaison : deux formulations équivalentes doivent donner la même clé. */

const CONTRACTIONS: [RegExp, string][] = [
  [/\bcan't\b/g, 'can not'],
  [/\bwon't\b/g, 'will not'],
  [/\b(\w+)n't\b/g, '$1 not'],
  [/\b(i)'m\b/g, '$1 am'],
  [/\b(\w+)'re\b/g, '$1 are'],
  [/\b(\w+)'ve\b/g, '$1 have'],
  [/\b(\w+)'ll\b/g, '$1 will'],
  [/\b(\w+)'d\b/g, '$1 would'],
  [/\b(it|that|what|there|here|he|she|who|let)'s\b/g, '$1 is'],
];

const PLACEHOLDERS = /\b(someone|somebody|something|sb|sth|one's|your|my)\b/g;

const UK_TO_US: Record<string, string> = {
  colour: 'color', favourite: 'favorite', centre: 'center', theatre: 'theater',
  organise: 'organize', realise: 'realize', recognise: 'recognize', apologise: 'apologize',
  analyse: 'analyze', travelling: 'traveling', behaviour: 'behavior', neighbour: 'neighbor',
  programme: 'program', licence: 'license', defence: 'defense', grey: 'gray',
};

export function normalizeEnglish(text: string): string {
  let s = text.toLowerCase().replace(/[’‘]/g, "'").replace(/…/g, ' ');
  for (const [re, to] of CONTRACTIONS) s = s.replace(re, to);
  s = s.replace(/[.,!?;:()"]/g, ' ').replace(PLACEHOLDERS, '*');
  s = s.replace(/\s+/g, ' ').trim().replace(/^(to|an?|the) /, '');
  return s.split(' ').map((w) => UK_TO_US[w] ?? w).join(' ');
}

export function normalizeFrench(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[.,!?;:()"…/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOPWORDS = new Set(
  'a an the to of in on at for with is am are was be it that this i you we not do does did have has had would will * and or but so'.split(' '),
);

export function contentTokens(key: string): string[] {
  return key.split(' ').filter((t) => t && !STOPWORDS.has(t));
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

/** Bases possibles d'une forme fléchie régulière (works, worked, working). */
export function inflectionStems(word: string): string[] {
  const stems: string[] = [];
  for (const suffix of ['ing', 'ed', 'es', 's']) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      const stem = word.slice(0, -suffix.length);
      stems.push(stem, `${stem}e`);
      if (stem.at(-1) === stem.at(-2)) stems.push(stem.slice(0, -1));
    }
  }
  return stems;
}

/** Radical grossier, pour comparer des expressions malgré leur flexion (look / looking). */
export function lightStem(token: string): string {
  return token.length > 4 ? token.replace(/(ing|ed|es|s)$/, '') : token;
}
