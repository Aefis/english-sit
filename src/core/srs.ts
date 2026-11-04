import { createEmptyCard, fsrs, Rating, State, type Card, type FSRS } from 'ts-fsrs';
import type { CardKind, CardRef } from './cards';

export type Grade = Rating.Again | Rating.Hard | Rating.Good | Rating.Easy;
export type Seed = 'known' | 'uncertain' | 'presumed';
export { Rating, State };

/** État persistant d'une carte. Les dates sont en millisecondes pour IndexedDB. */
export interface CardState {
  id: string;
  itemId: string;
  kind: CardKind;
  state: State;
  due: number;
  lastReview: number | null;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  correct: number;
  wrong: number;
  seed: Seed | null;
}

export interface ReviewLog {
  id?: number;
  cardId: string;
  itemId: string;
  kind: CardKind;
  ts: number;
  rating: Grade;
  stateBefore: State;
  stabilityBefore: number;
  stabilityAfter: number;
  difficultyAfter: number;
  elapsedMs: number;
}

export const DAY_MS = 86_400_000;
export const LEECH_LAPSES = 8;

export function createScheduler(requestRetention = 0.9, enableFuzz = true): FSRS {
  return fsrs({
    request_retention: requestRetention,
    maximum_interval: 365 * 3,
    enable_fuzz: enableFuzz,
    enable_short_term: true,
    // Une seule étape : « Je connais » sort la carte de la session, « À réviser » la ramène vite.
    learning_steps: ['1m'],
    relearning_steps: ['1m'],
  });
}

export function newCardState(ref: CardRef, now: number): CardState {
  return {
    ...ref,
    state: State.New,
    due: now,
    lastReview: null,
    stability: 0,
    difficulty: 0,
    scheduledDays: 0,
    learningSteps: 0,
    reps: 0,
    lapses: 0,
    correct: 0,
    wrong: 0,
    seed: null,
  };
}

function toFsrs(c: CardState): Card {
  return {
    ...createEmptyCard(new Date(c.due)),
    due: new Date(c.due),
    stability: c.stability,
    difficulty: c.difficulty,
    scheduled_days: c.scheduledDays,
    // Les cartes enregistrées avec l'ancienne seconde étape reviennent à l'unique étape actuelle.
    learning_steps: 0,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.lastReview === null ? undefined : new Date(c.lastReview),
  };
}

function fromFsrs(prev: CardState, card: Card): CardState {
  return {
    ...prev,
    state: card.state,
    due: card.due.getTime(),
    lastReview: card.last_review?.getTime() ?? null,
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
  };
}

export function applyReview(
  scheduler: FSRS,
  prev: CardState,
  rating: Grade,
  now: number,
  elapsedMs = 0,
): { card: CardState; log: ReviewLog } {
  const result = scheduler.next(toFsrs(prev), new Date(now), rating);
  const card = fromFsrs(prev, result.card);
  card.correct = prev.correct + (rating === Rating.Again ? 0 : 1);
  card.wrong = prev.wrong + (rating === Rating.Again ? 1 : 0);
  return {
    card,
    log: {
      cardId: prev.id,
      itemId: prev.itemId,
      kind: prev.kind,
      ts: now,
      rating,
      stateBefore: prev.state,
      stabilityBefore: prev.stability,
      stabilityAfter: card.stability,
      difficultyAfter: card.difficulty,
      elapsedMs,
    },
  };
}

const SEEDS: Record<Seed, { stability: number; difficulty: number }> = {
  known: { stability: 45, difficulty: 4 },
  presumed: { stability: 21, difficulty: 5 },
  uncertain: { stability: 4, difficulty: 6.5 },
};

/**
 * Test initial : place directement une carte de compréhension en révision.
 * « Je connais » ne prouve que le passif, la production reste à apprendre.
 */
export function seedCard(prev: CardState, seed: Seed, now: number): CardState {
  const { stability, difficulty } = SEEDS[seed];
  return {
    ...prev,
    state: State.Review,
    stability,
    difficulty,
    scheduledDays: stability,
    due: now + stability * DAY_MS,
    lastReview: now,
    reps: 1,
    seed,
  };
}

/** Probabilité de rappel estimée à l'instant `now`. */
export function retrievability(scheduler: FSRS, c: CardState, now: number): number {
  if (c.state === State.New || c.lastReview === null || c.stability <= 0) return 0;
  return scheduler.get_retrievability(toFsrs(c), new Date(now), false);
}
