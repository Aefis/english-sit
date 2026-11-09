import Dexie, { type Table } from 'dexie';
import type { FSRS } from 'ts-fsrs';
import {
  buildQueue, matchesFocus, NO_FOCUS, type Focus, type QueueResult,
} from './queue';
import type { Deck, Item } from './schema';
import { applyReview, createScheduler, type CardState, type Grade, type ReviewLog } from './srs';

export interface Settings {
  retention: number;
  accent: 'en-GB' | 'en-US';
}

interface ItemPrefs {
  itemId: string;
  favorite: boolean;
  suspended: boolean;
}

interface Meta {
  key: string;
  value: unknown;
}

export interface Backup {
  format: 'english-sit-backup';
  version: 1;
  exportedAt: number;
  cards: CardState[];
  reviews: ReviewLog[];
  prefs: ItemPrefs[];
  settings: Settings;
}

const DEFAULTS: Settings = { retention: 0.9, accent: 'en-GB' };

class Database extends Dexie {
  cards!: Table<CardState, string>;
  reviews!: Table<ReviewLog, number>;
  prefs!: Table<ItemPrefs, string>;
  meta!: Table<Meta, string>;

  constructor() {
    super('english-sit');
    this.version(1).stores({
      cards: 'id, itemId, kind, state, due',
      reviews: '++id, ts, cardId, itemId',
      prefs: 'itemId',
      meta: 'key',
    });
  }
}

/** Le contenu (deck.json) reste séparé de la progression (IndexedDB), liée par des id stables. */
/** Code d'erreur traduit par l'interface. */
export const INVALID_BACKUP = 'invalid-backup';

export class Store {
  private db = new Database();
  private listeners = new Set<() => void>();
  items: Item[] = [];
  byId = new Map<string, Item>();
  cards = new Map<string, CardState>();
  logs: ReviewLog[] = [];
  prefs = new Map<string, ItemPrefs>();
  settings: Settings = DEFAULTS;
  scheduler: FSRS = createScheduler();
  revision = 0;

  async load(deck: Deck): Promise<void> {
    this.items = deck.items;
    this.byId = new Map(deck.items.map((i) => [i.id, i]));
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    const [cards, logs, prefs, settings] = await Promise.all([
      this.db.cards.toArray(),
      this.db.reviews.orderBy('ts').toArray(),
      this.db.prefs.toArray(),
      this.db.meta.get('settings'),
    ]);
    this.cards = new Map(cards.map((c) => [c.id, c]));
    this.logs = logs;
    this.prefs = new Map(prefs.map((p) => [p.itemId, p]));
    this.settings = { ...DEFAULTS, ...(settings?.value as Partial<Settings> | undefined) };
    this.scheduler = createScheduler(this.settings.retention);
    this.changed();
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };

  private changed() {
    this.revision++;
    for (const fn of this.listeners) fn();
  }

  get favorites(): Set<string> {
    return new Set([...this.prefs.values()].filter((p) => p.favorite).map((p) => p.itemId));
  }

  get suspended(): Set<string> {
    return new Set([...this.prefs.values()].filter((p) => p.suspended).map((p) => p.itemId));
  }

  queue(focus: Focus = NO_FOCUS, free = false, now = Date.now()): QueueResult {
    return buildQueue({
      items: this.items.filter((item) => matchesFocus(item, focus)),
      cards: this.cards,
      suspended: this.suspended,
      now,
      direction: focus.direction,
      free,
    });
  }

  async review(card: CardState, rating: Grade, elapsedMs: number): Promise<void> {
    const { card: next, log } = applyReview(this.scheduler, card, rating, Date.now(), elapsedMs);
    await this.db.transaction('rw', this.db.cards, this.db.reviews, async () => {
      await this.db.cards.put(next);
      log.id = await this.db.reviews.add(log);
    });
    this.cards.set(next.id, next);
    this.logs.push(log);
    this.changed();
  }

  async saveSeeds(cards: CardState[]): Promise<void> {
    await this.db.cards.bulkPut(cards);
    for (const c of cards) this.cards.set(c.id, c);
    this.changed();
  }

  async togglePref(itemId: string, key: 'favorite' | 'suspended'): Promise<void> {
    const current = this.prefs.get(itemId) ?? { itemId, favorite: false, suspended: false };
    const next = { ...current, [key]: !current[key] };
    await this.db.prefs.put(next);
    this.prefs.set(itemId, next);
    this.changed();
  }

  exportBackup(): Backup {
    return {
      format: 'english-sit-backup',
      version: 1,
      exportedAt: Date.now(),
      cards: [...this.cards.values()],
      reviews: this.logs,
      prefs: [...this.prefs.values()],
      settings: this.settings,
    };
  }

  async importBackup(backup: Backup): Promise<void> {
    if (backup.format !== 'english-sit-backup' || backup.version !== 1) {
      throw new Error(INVALID_BACKUP);
    }
    await this.db.transaction('rw', [this.db.cards, this.db.reviews, this.db.prefs, this.db.meta], async () => {
      await Promise.all([this.db.cards.clear(), this.db.reviews.clear(), this.db.prefs.clear()]);
      await this.db.cards.bulkPut(backup.cards);
      await this.db.reviews.bulkPut(backup.reviews);
      await this.db.prefs.bulkPut(backup.prefs);
      await this.db.meta.put({ key: 'settings', value: backup.settings });
    });
    await this.refresh();
  }
}
