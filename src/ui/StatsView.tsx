import { LEVELS, TYPES } from '../core/schema';
import type { Store } from '../core/store';
import { computeStats, type Bucket } from '../core/stats';
import { TYPE_LABELS, useStore } from './shared';

function Tile({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div class="tile">
      <span class="tile-label">{label}</span>
      <span class="tile-value">{value}</span>
      {note && <span class="tile-note">{note}</span>}
    </div>
  );
}

function ProgressRow({ label, bucket }: { label: string; bucket: Bucket }) {
  const pct = (n: number) => (bucket.total ? (n / bucket.total) * 100 : 0);
  const summary = `${bucket.mastered} maîtrisés, ${bucket.learning} en apprentissage, sur ${bucket.total}`;
  return (
    <div class="bar-row" title={summary}>
      <span class="bar-label">{label}</span>
      <div class="bar" role="img" aria-label={`${label} : ${summary}`}>
        {bucket.mastered > 0 && <span class="seg mastered" style={{ width: `${pct(bucket.mastered)}%` }} />}
        {bucket.learning > 0 && <span class="seg learning" style={{ width: `${pct(bucket.learning)}%` }} />}
      </div>
      <span class="bar-value">{bucket.mastered + bucket.learning} / {bucket.total}</span>
    </div>
  );
}

export function StatsView({ store }: { store: Store }) {
  useStore(store);
  const stats = computeStats(store.items, store.cards, store.logs, store.scheduler, Date.now());
  const rate = stats.successRate === null ? '–' : `${Math.round(stats.successRate * 100)} %`;

  return (
    <section>
      <div class="tiles">
        <Tile label="Vocabulaire actif estimé" value={stats.activeVocabulary} note="retrouvable en production maintenant" />
        <Tile label="Vocabulaire passif estimé" value={stats.passiveVocabulary} note="compris à la lecture maintenant" />
        <Tile label="Maîtrisés" value={stats.mastered} note="stabilité de 30 jours ou plus" />
        <Tile label="En apprentissage" value={stats.learning} />
        <Tile label="Jamais vus" value={stats.unseen} />
        <Tile label="Taux de réussite" value={rate} note="30 derniers jours" />
        <Tile label="Révisées aujourd'hui" value={stats.reviewsToday} />
        <Tile label="Série" value={`${stats.streak} j`} />
      </div>

      <div class="panel">
        <div class="legend" aria-hidden="true">
          <span><i class="swatch mastered" /> Maîtrisés</span>
          <span><i class="swatch learning" /> En apprentissage</span>
        </div>
        <h2>Par niveau</h2>
        {LEVELS.map((level) => <ProgressRow key={level} label={level} bucket={stats.byLevel[level]} />)}
        <h2>Par catégorie</h2>
        {TYPES.map((type) => <ProgressRow key={type} label={TYPE_LABELS[type]} bucket={stats.byType[type]} />)}
        <ProgressRow label="Anglais pro" bucket={stats.professional} />
      </div>
    </section>
  );
}
