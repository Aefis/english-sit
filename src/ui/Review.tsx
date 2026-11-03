import { useEffect, useRef, useState } from 'preact/hooks';
import { clozeHint, spokenAnswer, type CardKind } from '../core/cards';
import { matchesFocus, NO_FOCUS, type Focus } from '../core/queue';
import { LEVELS, type Item } from '../core/schema';
import type { Store } from '../core/store';
import { LEECH_LAPSES, previewDue, Rating, type CardState, type Grade } from '../core/srs';
import { Badges, Highlighted, ItemDetails, speak, useStore } from './shared';

const KIND_LABELS: Record<CardKind, string> = {
  recognition: 'Compréhension',
  production: 'Production : dis-le à voix haute',
  context: 'Situation : que dis-tu ?',
};

const GRADES: { rating: Grade; label: string; className: string }[] = [
  { rating: Rating.Again, label: 'Again', className: 'again' },
  { rating: Rating.Hard, label: 'Hard', className: 'hard' },
  { rating: Rating.Good, label: 'Good', className: 'good' },
  { rating: Rating.Easy, label: 'Easy', className: 'easy' },
];

const CATEGORIES: [Focus['category'], string][] = [
  ['', 'Toutes'],
  ['word', 'Mots'],
  ['chunk', 'Expressions'],
  ['collocation', 'Collocations'],
  ['phrasal_verb', 'Phrasal verbs'],
  ['idiom', 'Idiomes'],
  ['connector', 'Connecteurs'],
  ['pro', 'Anglais pro'],
];

function formatDelay(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} j`;
  const months = Math.round(days / 30.4);
  return months < 12 ? `${months} mois` : `${(days / 365).toFixed(1)} an(s)`;
}

function FocusBar({ focus, onFocus }: { focus: Focus; onFocus: (focus: Focus) => void }) {
  // Rendre le focus à la page pour qu'Espace retourne la carte juste après le choix.
  const pick = (patch: Partial<Focus>) => (event: Event) => {
    (event.target as HTMLSelectElement).blur();
    onFocus({ ...focus, ...patch });
  };
  const value = (event: Event) => (event.target as HTMLSelectElement).value;
  return (
    <div class="focus-bar">
      <label>
        <span>Catégorie</span>
        <select
          value={focus.category}
          onChange={(e) => pick({ category: value(e) as Focus['category'] })(e)}
        >
          {CATEGORIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <label>
        <span>Niveau</span>
        <select value={focus.level} onChange={(e) => pick({ level: value(e) as Focus['level'] })(e)}>
          <option value="">Tous</option>
          {LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
        </select>
      </label>
    </div>
  );
}

function DoneMessage({ store, focus, onFocus, onContinue, learning }: {
  store: Store;
  focus: Focus;
  onFocus: (focus: Focus) => void;
  onContinue: () => void;
  learning: number;
}) {
  const focused = focus.category !== '' || focus.level !== '';
  const empty = !store.items.some((item) => matchesFocus(item, focus));
  const moreElsewhere = focused && store.queue().next !== null;
  const canContinue = store.queue(focus, true).next !== null;

  let title = "C'est tout pour aujourd'hui";
  let detail = learning > 0
    ? `${learning} carte(s) en cours reviendront plus tard dans la journée.`
    : 'Tes prochaines cartes seront prêtes demain.';
  if (empty) {
    title = 'Aucun élément pour cette sélection';
    detail = 'Essaie une autre catégorie ou un autre niveau.';
  } else if (focused) {
    title = 'Plus de cartes prévues pour cette sélection';
    detail = moreElsewhere
      ? "Il reste des cartes prévues aujourd'hui dans d'autres catégories."
      : "Tu as aussi fini toutes les autres cartes prévues aujourd'hui.";
  }

  return (
    <div class="panel done">
      <h1>{title}</h1>
      <p>{detail}</p>
      <div class="actions">
        {moreElsewhere && <button class="primary" onClick={() => onFocus(NO_FOCUS)}>Tout réviser</button>}
        {canContinue && (
          <button class={moreElsewhere ? 'secondary' : 'primary'} onClick={onContinue}>Continuer quand même</button>
        )}
      </div>
    </div>
  );
}

export function Review({ store, focus, onFocus }: { store: Store; focus: Focus; onFocus: (focus: Focus) => void }) {
  useStore(store);
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const [free, setFree] = useState(false);
  const { next, counts } = store.queue(focus, free);
  const item = next ? store.byId.get(next.itemId) : undefined;

  return (
    <section class="review">
      <FocusBar focus={focus} onFocus={onFocus} />
      {free && (
        <p class="free-note">
          Révision libre : ces cartes n'étaient pas prévues aujourd'hui.
          <button class="link" onClick={() => setFree(false)}>Arrêter</button>
        </p>
      )}
      <p class="counts" aria-label="Cartes restantes">
        <span>{counts.fresh} nouvelles</span>
        <span>{counts.learning} en cours</span>
        <span>{counts.review} à réviser</span>
      </p>
      {next && item ? (
        <Flashcard key={`${next.id}:${next.reps}`} store={store} card={next} item={item} />
      ) : (
        <DoneMessage store={store} focus={focus} onFocus={onFocus} onContinue={() => setFree(true)} learning={counts.learning} />
      )}
    </section>
  );
}

function Flashcard({ store, card, item }: { store: Store; card: CardState; item: Item }) {
  const [flipped, setFlipped] = useState(false);
  // Une fois la réponse vue, on peut retourner la carte à volonté avant de noter.
  const [seen, setSeen] = useState(false);
  const [hint, setHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const shownAt = useRef(Date.now());
  const accent = store.settings.accent;
  const isRecognition = card.kind === 'recognition';
  const listen = () => speak(item, isRecognition ? item.example_en : spokenAnswer(item), accent);

  const grade = async (rating: Grade) => {
    if (busy) return;
    setBusy(true);
    await store.review(card, rating, Date.now() - shownAt.current);
  };

  const flip = () => {
    setFlipped(!flipped);
    setSeen(true);
  };

  /** Les boutons posés sur la carte ne doivent pas la retourner. */
  const withoutFlip = (action: () => void) => (event: Event) => {
    event.stopPropagation();
    action();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (event.key === ' ' || event.key === 'Enter') {
        // Un bouton de la carte qui a le focus garde son action native.
        if ((event.target as Element).closest('.flashcard button, .focus-bar select, .done button')) return;
        event.preventDefault();
        flip();
      } else if (!flipped && event.key === 'h' && !isRecognition) {
        setHint(true);
      } else if (flipped && event.key === 's') {
        listen();
      } else if (seen && ['1', '2', '3', '4'].includes(event.key)) {
        void grade(Number(event.key) as Grade);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const preview = seen ? previewDue(store.scheduler, card, Date.now()) : null;

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
        <button class={seen ? 'secondary' : 'primary'} onClick={flip}>Retourner la carte</button>
      </div>

      {preview && (
        <div class="grades">
          {GRADES.map(({ rating, label, className }, index) => (
            <button key={rating} class={`grade ${className}`} disabled={busy} onClick={() => void grade(rating)}>
              <span>{label}</span>
              <small>{formatDelay(preview[rating] - Date.now())}</small>
              <kbd>{index + 1}</kbd>
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
