import { useState } from 'preact/hooks';
import { LEVELS, TYPES } from '../core/schema';
import { INVALID_BACKUP, type Backup, type Store } from '../core/store';
import { computeStats, type Bucket } from '../core/stats';
import { useI18n } from './i18n';
import { useStore } from './shared';

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
  const { t } = useI18n();
  const pct = (n: number) => (bucket.total ? (n / bucket.total) * 100 : 0);
  const summary = t.barSummary(bucket.mastered, bucket.learning, bucket.total);
  return (
    <div class="bar-row" title={summary}>
      <span class="bar-label">{label}</span>
      <div class="bar" role="img" aria-label={`${label}: ${summary}`}>
        {bucket.mastered > 0 && <span class="seg mastered" style={{ width: `${pct(bucket.mastered)}%` }} />}
        {bucket.learning > 0 && <span class="seg learning" style={{ width: `${pct(bucket.learning)}%` }} />}
      </div>
      <span class="bar-value">{bucket.mastered + bucket.learning} / {bucket.total}</span>
    </div>
  );
}

function MyProgress({ store }: { store: Store }) {
  const { t } = useI18n();
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
      setMessage(t.restored);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setMessage(t.importFailed(text === INVALID_BACKUP ? t.invalidBackup : text));
    }
    input.value = '';
  };

  return (
    <div class="panel settings">
      <h2>{t.myProgress}</h2>
      <p class="muted small">{t.progressHelp}</p>
      <div class="actions">
        <button class="secondary" onClick={exportFile}>{t.exportBtn}</button>
        <label class="button secondary">
          {t.importBtn}
          <input type="file" accept="application/json" hidden onChange={(e) => void importFile(e)} />
        </label>
      </div>
      {message && <p role="status">{message}</p>}
    </div>
  );
}

export function StatsView({ store }: { store: Store }) {
  useStore(store);
  const { lang, t } = useI18n();
  const stats = computeStats(store.items, store.cards, store.logs, store.scheduler, Date.now());
  const rate = stats.successRate === null ? '–' : `${Math.round(stats.successRate * 100)}${lang === 'fr' ? ' ' : ''}%`;
  const tl = t.tiles;

  return (
    <section>
      <div class="tiles">
        <Tile label={tl.active} value={stats.activeVocabulary} note={tl.activeNote} />
        <Tile label={tl.passive} value={stats.passiveVocabulary} note={tl.passiveNote} />
        <Tile label={tl.mastered} value={stats.mastered} note={tl.masteredNote} />
        <Tile label={tl.learning} value={stats.learning} />
        <Tile label={tl.unseen} value={stats.unseen} />
        <Tile label={tl.success} value={rate} note={tl.successNote} />
        <Tile label={tl.today} value={stats.reviewsToday} />
        <Tile label={tl.streak} value={tl.days(stats.streak)} />
      </div>

      <div class="panel">
        <div class="legend" aria-hidden="true">
          <span><i class="swatch mastered" /> {tl.mastered}</span>
          <span><i class="swatch learning" /> {tl.learning}</span>
        </div>
        <h2>{t.byLevel}</h2>
        {LEVELS.map((level) => <ProgressRow key={level} label={level} bucket={stats.byLevel[level]} />)}
        <h2>{t.byType}</h2>
        {TYPES.map((type) => <ProgressRow key={type} label={t.types[type]} bucket={stats.byType[type]} />)}
        <ProgressRow label={t.businessEnglish} bucket={stats.professional} />
      </div>

      <MyProgress store={store} />
    </section>
  );
}
