import { useState } from 'preact/hooks';
import type { Backup, Settings, Store } from '../core/store';
import { useStore } from './shared';

export function SettingsView({ store }: { store: Store }) {
  useStore(store);
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const s = store.settings;
  const number = (key: keyof Settings) => (e: Event) => {
    const value = Number((e.target as HTMLInputElement).value);
    if (Number.isFinite(value) && value >= 0) void store.saveSettings({ [key]: value });
  };

  const exportFile = () => {
    const blob = new Blob([JSON.stringify(store.exportBackup())], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `english-sit-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const importFile = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      await store.importBackup(JSON.parse(await file.text()) as Backup);
      setMessage('Sauvegarde restaurée.');
    } catch (error) {
      setMessage(`Import impossible : ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <section class="panel settings">
      <h1>Réglages</h1>
      <label>
        <span>Nouvelles cartes par jour</span>
        <input type="number" min="0" max="200" value={s.newPerDay} onChange={number('newPerDay')} />
      </label>
      <label>
        <span>Révisions maximum par jour</span>
        <input type="number" min="0" max="2000" value={s.maxReviewsPerDay} onChange={number('maxReviewsPerDay')} />
      </label>
      <label>
        <span>Rétention visée</span>
        <select value={s.retention} onChange={number('retention')}>
          <option value="0.85">85 % (moins de révisions)</option>
          <option value="0.9">90 % (recommandé)</option>
          <option value="0.95">95 % (beaucoup plus de révisions)</option>
        </select>
      </label>
      <label>
        <span>Accent de la synthèse vocale</span>
        <select value={s.accent} onChange={(e) => void store.saveSettings({ accent: (e.target as HTMLSelectElement).value as Settings['accent'] })}>
          <option value="en-GB">Britannique</option>
          <option value="en-US">Américain</option>
        </select>
      </label>

      <h2>Sauvegarde</h2>
      <p>Ta progression reste dans ce navigateur. Exporte-la régulièrement : vider les données du site l'efface.</p>
      <div class="actions">
        <button class="secondary" onClick={exportFile}>Exporter</button>
        <label class="button secondary">
          Importer
          <input type="file" accept="application/json" hidden onChange={(e) => void importFile(e)} />
        </label>
        {confirming ? (
          <button class="danger" onClick={() => { void store.reset(); setConfirming(false); setMessage('Progression effacée.'); }}>
            Confirmer l'effacement
          </button>
        ) : (
          <button class="secondary" onClick={() => setConfirming(true)}>Tout effacer</button>
        )}
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
