import type { Item } from './schema';

/**
 * Thèmes proposés pour configurer une partie. Chacun regroupe des tags des lots :
 * un élément appartient à tous les thèmes dont il porte au moins un tag.
 * Un test vérifie que chaque tag de la base est rangé dans un thème.
 */
export const THEMES = [
  { id: 'base', label: 'Vocabulaire de base', tags: ['basics', 'grammar', 'numbers', 'colours', 'people'] },
  {
    id: 'conversation',
    label: 'Conversation',
    tags: [
      'conversation', 'small_talk', 'communication', 'fn_react', 'fn_agree', 'fn_disagree', 'fn_suggest',
      'fn_request', 'fn_clarify', 'fn_rephrase', 'fn_hesitate', 'fn_interrupt', 'fn_start', 'fn_end',
      'fn_topic_change',
    ],
  },
  {
    id: 'opinion',
    label: 'Avis et argumentation',
    tags: ['fn_opinion', 'opinion', 'argument', 'fn_nuance', 'fn_compare', 'fn_explain', 'analysis', 'decision', 'risk'],
  },
  { id: 'raconter', label: 'Raconter et décrire', tags: ['fn_narrate', 'narration', 'description', 'personality'] },
  { id: 'relations', label: 'Émotions et relations', tags: ['feelings', 'relationships', 'family'] },
  { id: 'quotidien', label: 'Vie quotidienne et maison', tags: ['daily_routine', 'daily_life', 'housing', 'clothes', 'shopping'] },
  { id: 'nourriture', label: 'Nourriture', tags: ['food'] },
  { id: 'temps', label: 'Temps et dates', tags: ['time', 'calendar'] },
  { id: 'voyage', label: 'Voyages et transports', tags: ['travel', 'transport', 'directions', 'places', 'countries'] },
  { id: 'sante', label: 'Santé et sécurité', tags: ['health', 'body', 'safety'] },
  { id: 'loisirs', label: 'Loisirs', tags: ['leisure'] },
  { id: 'nature', label: 'Nature et météo', tags: ['nature', 'weather', 'animals'] },
  { id: 'argent', label: 'Argent, règles et démarches', tags: ['money', 'admin', 'rules'] },
  { id: 'technologie', label: 'Technologie et téléphone', tags: ['technology', 'it', 'phone'] },
  { id: 'societe', label: 'Société et actualité', tags: ['news', 'politics', 'media'] },
  { id: 'etudes', label: 'Études', tags: ['learning', 'education', 'academic', 'writing'] },
  { id: 'travail', label: 'Travail et carrière', tags: ['work', 'career', 'management'] },
  { id: 'reunions', label: 'Réunions, e-mails et présentations', tags: ['meetings', 'email', 'presentations', 'reporting'] },
  { id: 'business', label: 'Business et projets', tags: ['business', 'project'] },
  { id: 'pieges', label: 'Pièges : faux amis, UK/US', tags: ['false_friend', 'uk_us'] },
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
