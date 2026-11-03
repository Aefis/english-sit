import { useState } from 'preact/hooks';
import { LEVELS, TYPES } from '../core/schema';
import type { Backup, Store } from '../core/store';
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

function MyProgress({ store }: { store: Store }) {
  const [message, setMessage] = useState('');

  const exportFile = () => {
    const blob = new Blob([JSON.stringify(store.exportBackup())], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `english-sit-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const importFile = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await store.importBackup(JSON.parse(await file.text()) as Backup);
      setMessage('Sauvegarde restaurée.');
    } catch (error) {
      setMessage(`Import impossible : ${error instanceof Error ? error.message : String(error)}`);
    }
    input.value = '';
  };

  return (
    <div class="panel settings">
      <h2>Ma progression</h2>
      <p class="muted small">
        Ta progression reste dans ce navigateur. Exporte-la de temps en temps : c'est ta seule copie de secours, et le
        moyen de la retrouver sur un autre appareil. Importer remplace la progression actuelle.
      </p>
      <div class="actions">
        <button class="secondary" onClick={exportFile}>Exporter</button>
        <label class="button secondary">
          Importer
          <input type="file" accept="application/json" hidden onChange={(e) => void importFile(e)} />
        </label>
      </div>
      {message && <p role="status">{message}</p>}
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

      <MyProgress store={store} />
    </section>
  );
}
