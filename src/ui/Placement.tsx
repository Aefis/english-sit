import { useState } from 'preact/hooks';
import {
  levelVerdict, placementCard, presumeRest, sampleLevel, type PlacementAnswer,
} from '../core/placement';
import { LEVELS, type Item, type Level } from '../core/schema';
import type { Store } from '../core/store';
import { Highlighted } from './shared';

const SAMPLE_SIZE = 10;

interface Run {
  level: Level;
  sample: Item[];
  answers: PlacementAnswer[];
}

const BUTTONS: [PlacementAnswer, string][] = [
  ['unknown', 'Je ne connais pas'],
  ['uncertain', 'Incertain'],
  ['known', 'Je connais'],
];

export function Placement({ store, onDone }: { store: Store; onDone: () => void }) {
  const [run, setRun] = useState<Run | null>(null);
  const [message, setMessage] = useState('');

  const startLevel = (level: Level) => {
    setMessage('');
    setRun({ level, sample: sampleLevel(store.items, level, SAMPLE_SIZE, store.cards), answers: [] });
  };

  if (!run) {
    return (
      <section class="panel">
        <h1>Test initial</h1>
        <p>
          Dix cartes par niveau, sans traduction. « Je connais » veut dire que tu comprends l'élément sans hésiter :
          sa carte de compréhension est espacée de plusieurs semaines, mais sa carte de production reste à apprendre.
        </p>
        <div class="level-grid">
          {LEVELS.map((level) => (
            <button key={level} class="secondary" onClick={() => startLevel(level)}>{level}</button>
          ))}
        </div>
      </section>
    );
  }

  const answer = async (value: PlacementAnswer) => {
    const card = placementCard(run.sample[run.answers.length], value, Date.now());
    if (card) await store.saveSeeds([card]);
    setRun({ ...run, answers: [...run.answers, value] });
  };

  const current = run.sample[run.answers.length];
  if (current) {
    return (
      <section class="panel card">
        <header class="card-head">
          <span class="kind">Niveau {run.level}</span>
          <span class="kind">{run.answers.length + 1} / {run.sample.length}</span>
        </header>
        <div class="prompt">
          <p class="headword">{current.english}</p>
          <p class="sentence"><Highlighted item={current} /></p>
        </div>
        <div class="actions three">
          {BUTTONS.map(([value, label]) => (
            <button key={value} class={value === 'known' ? 'primary' : 'secondary'} onClick={() => void answer(value)}>
              {label}
            </button>
          ))}
        </div>
      </section>
    );
  }

  const verdict = levelVerdict(run.answers);
  const nextLevel = LEVELS[LEVELS.indexOf(run.level) + 1];
  const presume = async () => {
    const seeds = presumeRest(store.items, run.level, store.cards, Date.now());
    await store.saveSeeds(seeds);
    setMessage(`${seeds.length} élément(s) présumés connus, contrôlés d'ici trois semaines.`);
  };

  return (
    <section class="panel">
      <h1>Niveau {run.level} : {Math.round(verdict.rate * 100)} % connus</h1>
      {run.sample.length === 0 && <p>Tous les éléments de ce niveau sont déjà placés.</p>}
      {verdict.action === 'stop' && run.sample.length > 0 && (
        <p>C'est ici que ton apprentissage commence : inutile de tester les niveaux suivants.</p>
      )}
      {message && <p>{message}</p>}
      <div class="actions">
        {verdict.action === 'presume' && !message && (
          <button class="secondary" onClick={() => void presume()}>Marquer le reste du niveau comme connu</button>
        )}
        {nextLevel && verdict.action !== 'stop' && (
          <button class="secondary" onClick={() => startLevel(nextLevel)}>Niveau {nextLevel}</button>
        )}
        <button class="primary" onClick={onDone}>Commencer à réviser</button>
      </div>
    </section>
  );
}
