import type { Item } from './schema';

/**
 * Thèmes proposés pour configurer une partie. Chacun regroupe des tags des lots :
 * un élément appartient à tous les thèmes dont il porte au moins un tag.
 * Un test vérifie que chaque tag de la base est rangé dans un thème.
 */
export const THEMES = [
  { id: 'base', label: 'Vocabulaire de base', en: 'Core vocabulary', tags: ['basics', 'grammar', 'numbers', 'colours', 'people'] },
  {
    id: 'conversation',
    label: 'Conversation', en: 'Conversation',
    tags: [
      'conversation', 'small_talk', 'communication', 'fn_react', 'fn_agree', 'fn_disagree', 'fn_suggest',
      'fn_request', 'fn_clarify', 'fn_rephrase', 'fn_hesitate', 'fn_interrupt', 'fn_start', 'fn_end',
      'fn_topic_change',
    ],
  },
  {
    id: 'opinion',
    label: 'Avis et argumentation', en: 'Opinions and arguments',
    tags: ['fn_opinion', 'opinion', 'argument', 'fn_nuance', 'fn_compare', 'fn_explain', 'analysis', 'decision', 'risk'],
  },
  { id: 'raconter', label: 'Raconter et décrire', en: 'Telling and describing', tags: ['fn_narrate', 'narration', 'description', 'personality'] },
  { id: 'relations', label: 'Émotions et relations', en: 'Feelings and relationships', tags: ['feelings', 'relationships', 'family'] },
  { id: 'quotidien', label: 'Vie quotidienne et maison', en: 'Daily life and home', tags: ['daily_routine', 'daily_life', 'housing', 'clothes', 'shopping'] },
  { id: 'nourriture', label: 'Nourriture', en: 'Food', tags: ['food'] },
  { id: 'temps', label: 'Temps et dates', en: 'Time and dates', tags: ['time', 'calendar'] },
  { id: 'voyage', label: 'Voyages et transports', en: 'Travel and transport', tags: ['travel', 'transport', 'directions', 'places', 'countries'] },
  { id: 'sante', label: 'Santé et sécurité', en: 'Health and safety', tags: ['health', 'body', 'safety'] },
  { id: 'loisirs', label: 'Loisirs', en: 'Leisure', tags: ['leisure'] },
  { id: 'nature', label: 'Nature et météo', en: 'Nature and weather', tags: ['nature', 'weather', 'animals'] },
  { id: 'argent', label: 'Argent, règles et démarches', en: 'Money, rules and paperwork', tags: ['money', 'admin', 'rules'] },
  { id: 'technologie', label: 'Technologie et téléphone', en: 'Technology and phone', tags: ['technology', 'it', 'phone'] },
  { id: 'societe', label: 'Société et actualité', en: 'Society and news', tags: ['news', 'politics', 'media'] },
  { id: 'etudes', label: 'Études', en: 'Studies', tags: ['learning', 'education', 'academic', 'writing'] },
  { id: 'travail', label: 'Travail et carrière', en: 'Work and career', tags: ['work', 'career', 'management'] },
  { id: 'reunions', label: 'Réunions, e-mails et présentations', en: 'Meetings, emails and presentations', tags: ['meetings', 'email', 'presentations', 'reporting'] },
  { id: 'business', label: 'Business et projets', en: 'Business and projects', tags: ['business', 'project'] },
  { id: 'pieges', label: 'Pièges : faux amis, UK/US', en: 'Traps: false friends, UK/US', tags: ['false_friend', 'uk_us'] },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

/** Tags transversaux, qui ne forment pas un thème à eux seuls. */
export const CROSS_TAGS = ['pro', 'phrasal_verb'];

const TAG_TO_THEMES = new Map<string, ThemeId[]>();
for (const theme of THEMES) {
  for (const tag of theme.tags) TAG_TO_THEMES.set(tag, [...(TAG_TO_THEMES.get(tag) ?? []), theme.id]);
}

export function themesOf(item: Pick<Item, 'tags'>): Set<ThemeId> {
  return new Set(item.tags.flatMap((tag) => TAG_TO_THEMES.get(tag) ?? []));
}

export const isKnownTag = (tag: string) => TAG_TO_THEMES.has(tag) || CROSS_TAGS.includes(tag);
