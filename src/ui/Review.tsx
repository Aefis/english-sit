import { useEffect, useRef, useState } from 'preact/hooks';
import { clozeHint, spokenAnswer, type CardKind } from '../core/cards';
import { matchesFocus, NO_FOCUS, type Focus } from '../core/queue';
import { LEVELS, type Item } from '../core/schema';
import type { Store } from '../core/store';
import { LEECH_LAPSES, Rating, type CardState, type Grade } from '../core/srs';
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
      <label>
        <span>Sens</span>
        <select value={focus.direction} onChange={(e) => pick({ direction: value(e) as Focus['direction'] })(e)}>
          <option value="">Les deux</option>
          <option value="en-fr">EN → FR</option>
          <option value="fr-en">FR → EN</option>
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
  const focused = focus.category !== '' || focus.level !== '' || focus.direction !== '';
  const empty = !store.items.some((item) => matchesFocus(item, focus));
  const moreElsewhere = focused && store.queue().next !== null;
  const canContinue = store.queue(focus, true).next !== null;

  let title = "C'est tout pour aujourd'hui";
  let detail = learning > 0
    ? `${learning} carte(s) à réviser reviendront dans quelques minutes.`
    : 'Tes prochaines cartes seront prêtes demain.';
  if (empty) {
    title = 'Aucun élément pour cette sélection';
    detail = 'Essaie une autre catégorie ou un autre niveau.';
  } else if (focused) {
    title = 'Plus de cartes prévues pour cette sélection';
    detail = moreElsewhere
      ? "Il reste des cartes prévues aujourd'hui en dehors de cette sélection."
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
        <span>{counts.learning + counts.review} à réviser</span>
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
        // Un bouton de la carte qui a le focus garde son action native.
        if ((event.target as Element).closest('.flashcard button, .focus-bar select, .done button')) return;
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
