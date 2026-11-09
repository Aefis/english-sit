import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { clozeHint, spokenAnswer, type CardKind } from '../core/cards';
import {
  answerCard, candidates, DEFAULT_CONFIG, followUpCard, parseCardId, parseConfig, parseGame, phase, SIZES,
  startGame, startRetryRound, type Game, type GameConfig,
} from '../core/game';
import { LEVELS, type Item, type ItemType } from '../core/schema';
import type { Store } from '../core/store';
import { LEECH_LAPSES, newCardState, Rating, type CardState, type Grade } from '../core/srs';
import { THEMES } from '../core/themes';
import { Badges, Highlighted, ItemDetails, speak, useStore } from './shared';

const KIND_LABELS: Record<CardKind, string> = {
  recognition: 'Anglais → français',
  production: 'Français → anglais : dis-le à voix haute',
  context: 'Situation : que dis-tu ?',
};

/** Deux choix seulement : le calendrier reste caché. L'ordre donne les touches 1 et 2. */
const GRADES: { rating: Grade; label: string; className: string }[] = [
  { rating: Rating.Good, label: 'Je connais', className: 'good' },
  { rating: Rating.Again, label: 'À réviser', className: 'again' },
];

const TYPE_LABELS: [ItemType, string][] = [
  ['word', 'Mots'],
  ['chunk', 'Expressions'],
  ['collocation', 'Collocations'],
  ['phrasal_verb', 'Phrasal verbs'],
  ['idiom', 'Idiomes'],
  ['connector', 'Connecteurs'],
];

const DIRECTIONS: [GameConfig['direction'], string][] = [['', 'Les deux'], ['en-fr', 'EN → FR'], ['fr-en', 'FR → EN']];

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
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ComponentChildren }) {
  return <button type="button" class="chip" aria-pressed={on} onClick={onClick}>{children}</button>;
}

function Setup({ store, config, onChange, onStart }: {
  store: Store;
  config: GameConfig;
  onChange: (config: GameConfig) => void;
  onStart: () => void;
}) {
  const available = useMemo(
    () => candidates({ items: store.items, cards: store.cards, suspended: store.suspended, config, now: Date.now() }).length,
    [store.revision, config],
  );
  const count = config.size === null ? available : Math.min(config.size, available);
  const set = (patch: Partial<GameConfig>) => onChange({ ...config, ...patch });

  return (
    <div class="panel setup">
      <h1>Nouvelle partie</h1>
      <p class="muted small">Coche ce que tu veux réviser. Si rien n'est coché dans un groupe, tout est inclus.</p>

      <fieldset>
        <legend>Thèmes</legend>
        <div class="chips">
          {THEMES.map((t) => (
            <Chip key={t.id} on={config.themes.includes(t.id)} onClick={() => set({ themes: toggle(config.themes, t.id) })}>
              {t.label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Niveaux</legend>
        <div class="chips">
          {LEVELS.map((level) => (
            <Chip key={level} on={config.levels.includes(level)} onClick={() => set({ levels: toggle(config.levels, level) })}>
              {level}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Types</legend>
        <div class="chips">
          {TYPE_LABELS.map(([type, label]) => (
            <Chip key={type} on={config.types.includes(type)} onClick={() => set({ types: toggle(config.types, type) })}>
              {label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Sens</legend>
        <div class="chips">
          {DIRECTIONS.map(([direction, label]) => (
            <Chip key={direction} on={config.direction === direction} onClick={() => set({ direction })}>{label}</Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Nombre de cartes</legend>
        <div class="chips">
          {SIZES.map((size) => (
            <Chip key={String(size)} on={config.size === size} onClick={() => set({ size })}>{size ?? 'Toutes'}</Chip>
          ))}
        </div>
      </fieldset>

      <div class="actions setup-start">
        <button class="primary" disabled={count === 0} onClick={onStart}>
          {count === 0 ? 'Aucune carte pour cette sélection' : `Lancer la partie (${plural(count, 'carte')})`}
        </button>
      </div>
      {config.direction === '' && count > 0 && (
        <p class="muted small setup-note">
          En mode « Les deux », chaque carte anglais → français que tu connais ajoute sa version français → anglais plus loin dans la partie.
        </p>
      )}
    </div>
  );
}

export function Review({ store }: { store: Store }) {
  useStore(store);
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
          <h1>Pile terminée !</h1>
          <p>Il te reste {plural(game.retry.length, 'carte')} à réviser.</p>
          <div class="actions">
            <button class="primary" onClick={() => saveGame(startRetryRound(game))}>Revoir ces cartes</button>
            <button class="secondary" onClick={() => saveGame({ ...game, retry: [] })}>Terminer la partie</button>
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
          <h1>Partie terminée</h1>
          <p>{plural(game.total, 'carte')} jouée{game.total > 1 ? 's' : ''}, dont {firstTry} connue{firstTry > 1 ? 's' : ''} du premier coup.</p>
          <div class="actions">
            <button class="primary" onClick={() => start(game.config)}>Rejouer avec les mêmes réglages</button>
            <button class="secondary" onClick={() => saveGame(null)}>Changer les réglages</button>
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
        <p class="counts" aria-label="Avancement de la partie">
          {game.round === 1 ? (
            <>
              <span>{played} / {game.total}</span>
              <span>{game.retry.length} à réviser à la fin</span>
            </>
          ) : (
            <span>Révision : {plural(game.pending.length, 'carte')} restante{game.pending.length > 1 ? 's' : ''}</span>
          )}
        </p>
        {stopping ? (
          <p class="stop-confirm">
            Arrêter la partie ? Les réponses déjà données sont gardées.
            <button class="link" onClick={() => saveGame(null)}>Oui, arrêter</button>
            <button class="link" onClick={() => setStopping(false)}>Non</button>
          </p>
        ) : (
          <button class="link stop" onClick={() => setStopping(true)}>Arrêter la partie</button>
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
              <span class="kind">{KIND_LABELS[card.kind]}</span>
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
                <button class="secondary" onClick={withoutFlip(() => setHint(true))}>Indice</button>
              </div>
            )}
          </div>

          <div class="face face-back panel" aria-hidden={!flipped} inert={!flipped}>
            <header class="card-head">
              <span class="kind">Réponse</span>
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
                <button class="link" onClick={withoutFlip(listen)}>Écouter</button>
              </div>
            </div>
            <ItemDetails item={item} store={store} />
            {card.lapses >= LEECH_LAPSES && (
              <p class="leech">Carte récalcitrante : {card.lapses} oublis. Pense à la suspendre dans Explorer.</p>
            )}
          </div>
        </div>
      </div>

      <div class="actions flip-actions">
        <button class="secondary" onClick={flip}>Retourner la carte</button>
      </div>

      <div class="grades">
        {GRADES.map(({ rating, label, className }, index) => (
          <button key={rating} class={`grade ${className}`} disabled={busy} onClick={() => void grade(rating)}>
            <span>{label}</span>
            <kbd>{index + 1}</kbd>
          </button>
        ))}
      </div>
    </article>
  );
}
