import { useEffect, useRef, useState } from 'preact/hooks';
import { clozeHint, spokenAnswer, type CardKind } from '../core/cards';
import type { Item } from '../core/schema';
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

export function Review({ store }: { store: Store }) {
  useStore(store);
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const { next, counts } = store.queue();
  const item = next ? store.byId.get(next.itemId) : undefined;

  return (
    <section class="review">
      <p class="counts" aria-label="Cartes restantes">
        <span>{counts.fresh} nouvelles</span>
        <span>{counts.learning} en cours</span>
        <span>{counts.review} à réviser</span>
      </p>
      {next && item ? (
        <Flashcard key={`${next.id}:${next.reps}`} store={store} card={next} item={item} />
      ) : (
        <div class="panel done">
          <h1>C'est tout pour aujourd'hui</h1>
          <p>
            {counts.learning > 0
              ? `${counts.learning} carte(s) en cours reviendront plus tard dans la journée.`
              : 'Reviens demain : tes prochaines cartes seront prêtes.'}
          </p>
        </div>
      )}
    </section>
  );
}

function Flashcard({ store, card, item }: { store: Store; card: CardState; item: Item }) {
  const [revealed, setRevealed] = useState(false);
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (!revealed && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault();
        setRevealed(true);
      } else if (!revealed && event.key === 'h' && !isRecognition) {
        setHint(true);
      } else if (revealed && event.key === 's') {
        listen();
      } else if (revealed && ['1', '2', '3', '4'].includes(event.key)) {
        void grade(Number(event.key) as Grade);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const preview = revealed ? previewDue(store.scheduler, card, Date.now()) : null;

  return (
    <article class="panel card">
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
        {hint && !revealed && <p class="hint">{clozeHint(item.example_en, item.highlight)}</p>}
      </div>

      {revealed ? (
        <div class="answer">
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
          <button class="link" onClick={listen}>Écouter</button>
          <ItemDetails item={item} store={store} />
          {card.lapses >= LEECH_LAPSES && (
            <p class="leech">Carte récalcitrante : {card.lapses} oublis. Pense à la suspendre dans Explorer.</p>
          )}
          <div class="grades">
            {GRADES.map(({ rating, label, className }, index) => (
              <button key={rating} class={`grade ${className}`} disabled={busy} onClick={() => void grade(rating)}>
                <span>{label}</span>
                <small>{formatDelay(preview![rating] - Date.now())}</small>
                <kbd>{index + 1}</kbd>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div class="actions">
          {!isRecognition && !hint && <button class="secondary" onClick={() => setHint(true)}>Indice</button>}
          <button class="primary" onClick={() => setRevealed(true)}>Voir la réponse</button>
        </div>
      )}
    </article>
  );
}
