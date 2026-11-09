import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { clozeHint, spokenAnswer } from '../core/cards';
import {
  answerCard, candidates, DEFAULT_CONFIG, followUpCard, parseCardId, parseConfig, parseGame, phase, SIZES,
  startGame, startRetryRound, type Game, type GameConfig,
} from '../core/game';
import { LEVELS, TYPES, type Item } from '../core/schema';
import type { Store } from '../core/store';
import { LEECH_LAPSES, newCardState, Rating, type CardState, type Grade } from '../core/srs';
import { THEMES } from '../core/themes';
import { useI18n, type Dict } from './i18n';
import { Badges, Highlighted, ItemDetails, speak, useStore } from './shared';

/** Deux choix seulement : le calendrier reste caché. L'ordre donne les touches 1 et 2. */
const GRADES: { rating: Grade; label: (t: Dict) => string; className: string }[] = [
  { rating: Rating.Good, label: (t) => t.known, className: 'good' },
  { rating: Rating.Again, label: (t) => t.toReview, className: 'again' },
];

const DIRECTIONS: [GameConfig['direction'], (t: Dict) => string][] = [
  ['', (t) => t.both],
  ['en-fr', () => 'EN → FR'],
  ['fr-en', () => 'FR → EN'],
];

// La partie et les derniers réglages restent dans le navigateur, pour survivre à un rechargement.
const GAME_KEY = 'english-sit:game';
const CONFIG_KEY = 'english-sit:game-config';

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Stockage indisponible (navigation privée) : la partie marche, sans reprise après rechargement.
  }
}

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ComponentChildren }) {
  return <button type="button" class="chip" aria-pressed={on} onClick={onClick}>{children}</button>;
}

function Setup({ store, config, onChange, onStart }: {
  store: Store;
  config: GameConfig;
  onChange: (config: GameConfig) => void;
  onStart: () => void;
}) {
  const { lang, t } = useI18n();
  const available = useMemo(
    () => candidates({ items: store.items, cards: store.cards, suspended: store.suspended, config, now: Date.now() }).length,
    [store.revision, config],
  );
  const count = config.size === null ? available : Math.min(config.size, available);
  const set = (patch: Partial<GameConfig>) => onChange({ ...config, ...patch });

  return (
    <div class="panel setup">
      <h1>{t.newGame}</h1>
      <p class="muted small">{t.setupHint}</p>

      <fieldset>
        <legend>{t.themes}</legend>
        <div class="chips">
          {THEMES.map((theme) => (
            <Chip key={theme.id} on={config.themes.includes(theme.id)} onClick={() => set({ themes: toggle(config.themes, theme.id) })}>
              {lang === 'en' ? theme.en : theme.label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>{t.levels}</legend>
        <div class="chips">
          {LEVELS.map((level) => (
            <Chip key={level} on={config.levels.includes(level)} onClick={() => set({ levels: toggle(config.levels, level) })}>
              {level}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>{t.typesLegend}</legend>
        <div class="chips">
          {TYPES.map((type) => (
            <Chip key={type} on={config.types.includes(type)} onClick={() => set({ types: toggle(config.types, type) })}>
              {t.typesPlural[type]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>{t.direction}</legend>
        <div class="chips">
          {DIRECTIONS.map(([direction, label]) => (
            <Chip key={direction} on={config.direction === direction} onClick={() => set({ direction })}>{label(t)}</Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>{t.size}</legend>
        <div class="chips">
          {SIZES.map((size) => (
            <Chip key={String(size)} on={config.size === size} onClick={() => set({ size })}>{size ?? t.all}</Chip>
          ))}
        </div>
      </fieldset>

      <div class="actions setup-start">
        <button class="primary" disabled={count === 0} onClick={onStart}>
          {count === 0 ? t.noCards : t.start(count)}
        </button>
      </div>
      {config.direction === '' && count > 0 && (
        <p class="muted small setup-note">{t.bothNote}</p>
      )}
    </div>
  );
}

export function Review({ store }: { store: Store }) {
  useStore(store);
  const { t } = useI18n();
  const [config, setConfig] = useState<GameConfig>(() => parseConfig(readJson(CONFIG_KEY) ?? DEFAULT_CONFIG));
  const [game, setGame] = useState<Game | null>(() => parseGame(readJson(GAME_KEY), (id) => store.byId.has(id)));
  const [stopping, setStopping] = useState(false);

  const saveGame = (next: Game | null) => {
    setGame(next);
    writeJson(GAME_KEY, next);
  };
  const changeConfig = (next: GameConfig) => {
    setConfig(next);
    writeJson(CONFIG_KEY, next);
  };
  const start = (from: GameConfig) => {
    setStopping(false);
    saveGame(startGame({ items: store.items, cards: store.cards, suspended: store.suspended, config: from, now: Date.now() }));
  };

  if (!game) {
    return (
      <section class="review">
        <Setup store={store} config={config} onChange={changeConfig} onStart={() => start(config)} />
      </section>
    );
  }

  const current = phase(game);
  if (current === 'break') {
    return (
      <section class="review">
        <div class="panel done">
          <h1>{t.pileDone}</h1>
          <p>{t.left(game.retry.length)}</p>
          <div class="actions">
            <button class="primary" onClick={() => saveGame(startRetryRound(game))}>{t.reviewThem}</button>
            <button class="secondary" onClick={() => saveGame({ ...game, retry: [] })}>{t.endGame}</button>
          </div>
        </div>
      </section>
    );
  }
  if (current === 'done') {
    const firstTry = game.total - game.missed.length;
    return (
      <section class="review">
        <div class="panel done">
          <h1>{t.gameOver}</h1>
          <p>{t.summary(game.total, firstTry)}</p>
          <div class="actions">
            <button class="primary" onClick={() => start(game.config)}>{t.replay}</button>
            <button class="secondary" onClick={() => saveGame(null)}>{t.changeSettings}</button>
          </div>
        </div>
      </section>
    );
  }

  const id = game.pending[0];
  const ref = parseCardId(id)!;
  const item = store.byId.get(ref.itemId)!;
  const card = store.cards.get(id) ?? newCardState(ref, Date.now());

  const answer = async (rating: Grade, elapsedMs: number) => {
    const known = rating === Rating.Good;
    const followId = known ? followUpCard(item, card.kind, game.config.direction) : null;
    // Seule une carte jamais vue s'ajoute : les autres reviendront à leur date.
    const follow = followId && !store.cards.has(followId) ? followId : null;
    saveGame(answerCard(game, id, known, follow));
    await store.review(card, rating, elapsedMs);
  };

  const played = game.total - game.pending.length;
  return (
    <section class="review">
      <div class="game-bar">
        <p class="counts" aria-label={t.progressLabel}>
          {game.round === 1 ? (
            <>
              <span>{played} / {game.total}</span>
              <span>{t.atEnd(game.retry.length)}</span>
            </>
          ) : (
            <span>{t.reviewing(game.pending.length)}</span>
          )}
        </p>
        {stopping ? (
          <p class="stop-confirm">
            {t.stopAsk}
            <button class="link" onClick={() => saveGame(null)}>{t.stopYes}</button>
            <button class="link" onClick={() => setStopping(false)}>{t.stopNo}</button>
          </p>
        ) : (
          <button class="link stop" onClick={() => setStopping(true)}>{t.stop}</button>
        )}
      </div>
      <Flashcard key={`${id}:${game.round}:${game.pending.length}`} store={store} card={card} item={item} onAnswer={answer} />
    </section>
  );
}

function Flashcard({ store, card, item, onAnswer }: {
  store: Store;
  card: CardState;
  item: Item;
  onAnswer: (rating: Grade, elapsedMs: number) => Promise<void>;
}) {
  const { t } = useI18n();
  const [flipped, setFlipped] = useState(false);
  const [hint, setHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const shownAt = useRef(Date.now());
  const accent = store.settings.accent;
  const isRecognition = card.kind === 'recognition';
  const listen = () => speak(item, isRecognition ? item.example_en : spokenAnswer(item), accent);

  const grade = async (rating: Grade) => {
    if (busy) return;
    setBusy(true);
    await onAnswer(rating, Date.now() - shownAt.current);
  };

  const flip = () => setFlipped(!flipped);

  /** Les boutons posés sur la carte ne doivent pas la retourner. */
  const withoutFlip = (action: () => void) => (event: Event) => {
    event.stopPropagation();
    action();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (event.key === ' ' || event.key === 'Enter') {
        // Un bouton qui a le focus garde son action native.
        if ((event.target as Element).closest('.flashcard button, .game-bar button')) return;
        event.preventDefault();
        flip();
      } else if (!flipped && event.key === 'h' && !isRecognition) {
        setHint(true);
      } else if (flipped && event.key === 's') {
        listen();
      } else if (event.key === '1' || event.key === '2') {
        void grade(GRADES[Number(event.key) - 1].rating);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <article class="flashcard">
      <div class={flipped ? 'flip flipped' : 'flip'} onClick={flip}>
        <div class="flip-inner">
          <div class="face panel" aria-hidden={flipped} inert={flipped}>
            <header class="card-head">
              <span class="kind">{t.kinds[card.kind]}</span>
              <Badges item={item} />
            </header>
            <div class="prompt">
              {card.kind === 'recognition' && (
                <>
                  <p class="headword">{item.english}</p>
                  <p class="sentence"><Highlighted item={item} /></p>
                </>
              )}
              {card.kind === 'production' && <p class="sentence large">{item.example_fr}</p>}
              {card.kind === 'context' && <p class="sentence large">{item.situation_fr}</p>}
              {hint && <p class="hint">{clozeHint(item.example_en, item.highlight)}</p>}
            </div>
            {!isRecognition && !hint && (
              <div class="actions">
                <button class="secondary" onClick={withoutFlip(() => setHint(true))}>{t.hint}</button>
              </div>
            )}
          </div>

          <div class="face face-back panel" aria-hidden={!flipped} inert={!flipped}>
            <header class="card-head">
              <span class="kind">{t.answer}</span>
              <Badges item={item} />
            </header>
            <div class="prompt">
              {isRecognition ? (
                <>
                  <p class="headword">{item.french}</p>
                  <p class="sentence muted">{item.example_fr}</p>
                </>
              ) : (
                <>
                  <p class="headword">{spokenAnswer(item)}</p>
                  <p class="sentence"><Highlighted item={item} /></p>
                  <p class="sentence muted">{item.french}</p>
                </>
              )}
              <div class="actions">
                <button class="link" onClick={withoutFlip(listen)}>{t.listen}</button>
              </div>
            </div>
            <ItemDetails item={item} store={store} />
            {card.lapses >= LEECH_LAPSES && (
              <p class="leech">{t.leech(card.lapses)}</p>
            )}
          </div>
        </div>
      </div>

      <div class="actions flip-actions">
        <button class="secondary" onClick={flip}>{t.flip}</button>
      </div>

      <div class="grades">
        {GRADES.map(({ rating, label, className }, index) => (
          <button key={rating} class={`grade ${className}`} disabled={busy} onClick={() => void grade(rating)}>
            <span>{label(t)}</span>
            <kbd>{index + 1}</kbd>
          </button>
        ))}
      </div>
    </article>
  );
}
