import { LEVELS, type Level } from './schema';

interface Rankable {
  id: string;
  level: Level;
  frequency: number;
  priority: number;
}

/**
 * Score bas = appris tôt. Le niveau ne donne qu'une base : un élément essentiel
 * et très fréquent peut passer devant le niveau inférieur (priorité à l'utilité).
 */
export function learningScore(item: Rankable): number {
  return LEVELS.indexOf(item.level) - (item.priority - 3) * 0.6 - (item.frequency - 3) * 0.4;
}

export function assignOrder<T extends Rankable>(items: T[]): (T & { order: number })[] {
  return [...items]
    .sort((a, b) => learningScore(a) - learningScore(b) || a.id.localeCompare(b.id))
    .map((item, index) => ({ ...item, order: index + 1 }));
}

/** Bandes de fréquence à partir de l'échelle Zipf de wordfreq. */
export function zipfToFrequency(zipf: number): number {
  if (zipf >= 5.5) return 5;
  if (zipf >= 4.8) return 4;
  if (zipf >= 4.2) return 3;
  if (zipf >= 3.6) return 2;
  return 1;
}
