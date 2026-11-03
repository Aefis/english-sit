import { useMemo, useState } from 'preact/hooks';
import { filterItems, NO_FILTERS, type Filters } from '../core/filter';
import { LEVELS, TYPES, type Item } from '../core/schema';
import type { Store } from '../core/store';
import { itemProgress } from '../core/stats';
import { Badges, Highlighted, ItemDetails, speak, TYPE_LABELS, useStore } from './shared';

const MAX_ROWS = 200;
const PROGRESS_LABELS = { new: 'Jamais vu', learning: 'En apprentissage', mastered: 'Maîtrisé' };

interface SelectProps {
  label: string;
  value: string | number;
  options: [string | number, string][];
  onChange: (value: string) => void;
}

function Select({ label, value, options, onChange }: SelectProps) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange((e.target as HTMLSelectElement).value)}>
        <option value="">Tous</option>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </label>
  );
}

const scale: [number, string][] = [5, 4, 3, 2, 1].map((n) => [n, String(n)]);

export function Browse({ store }: { store: Store }) {
  const revision = useStore(store);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [open, setOpen] = useState<string | null>(null);
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });

  const tags = useMemo(() => [...new Set(store.items.flatMap((i) => i.tags))].sort(), [store.items]);
  const results = useMemo(
    () => filterItems(store.items, filters, store.cards, store.favorites),
    [filters, revision],
  );

  return (
    <section>
      <div class="panel filters">
        <label class="search">
          <span>Recherche (anglais ou français)</span>
          <input type="search" value={filters.query} onInput={(e) => set({ query: (e.target as HTMLInputElement).value })} />
        </label>
        <Select label="Niveau" value={filters.level} options={LEVELS.map((l) => [l, l])} onChange={(v) => set({ level: v as Filters['level'] })} />
        <Select label="Type" value={filters.type} options={TYPES.map((t) => [t, TYPE_LABELS[t]])} onChange={(v) => set({ type: v as Filters['type'] })} />
        <Select label="Fréquence" value={filters.frequency || ''} options={scale} onChange={(v) => set({ frequency: Number(v) })} />
        <Select label="Priorité" value={filters.priority || ''} options={scale} onChange={(v) => set({ priority: Number(v) })} />
        <Select label="Thème" value={filters.tag} options={tags.map((t) => [t, t])} onChange={(v) => set({ tag: v })} />
        <Select label="Connaissance" value={filters.progress} options={Object.entries(PROGRESS_LABELS)} onChange={(v) => set({ progress: v as Filters['progress'] })} />
        <Select
          label="Difficulté"
          value={filters.difficulty}
          options={[['easy', 'Facile'], ['medium', 'Moyenne'], ['hard', 'Difficile']]}
          onChange={(v) => set({ difficulty: v as Filters['difficulty'] })}
        />
        <label class="check">
          <input type="checkbox" checked={filters.favoritesOnly} onChange={(e) => set({ favoritesOnly: (e.target as HTMLInputElement).checked })} />
          <span>Favoris</span>
        </label>
      </div>

      <p class="result-count">{results.length} élément(s){results.length > MAX_ROWS ? `, ${MAX_ROWS} affichés` : ''}</p>
      <ul class="rows">
        {results.slice(0, MAX_ROWS).map((item) => (
          <Row key={item.id} item={item} store={store} open={open === item.id} onToggle={() => setOpen(open === item.id ? null : item.id)} />
        ))}
      </ul>
    </section>
  );
}

function Row({ item, store, open, onToggle }: { item: Item; store: Store; open: boolean; onToggle: () => void }) {
  const prefs = store.prefs.get(item.id);
  return (
    <li class="row">
      <button class="row-main" aria-expanded={open} onClick={onToggle}>
        <strong>{item.english}</strong>
        <span class="muted">{item.french}</span>
        <span class="progress-label">{PROGRESS_LABELS[itemProgress(item, store.cards)]}</span>
      </button>
      {open && (
        <div class="row-detail">
          <Badges item={item} />
          <p class="sentence"><Highlighted item={item} /></p>
          <p class="sentence muted">{item.example_fr}</p>
          <ItemDetails item={item} store={store} />
          <p class="muted small">
            Fréquence {item.frequency}/5 ({item.frequency_source === 'corpus' ? `corpus, Zipf ${item.zipf}` : 'estimée'}) · Priorité {item.priority}/5 · Rang {item.order}
          </p>
          <div class="actions">
            <button class="link" onClick={() => speak(item, item.example_en, store.settings.accent)}>Écouter</button>
            <button class="link" onClick={() => void store.togglePref(item.id, 'favorite')}>
              {prefs?.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            </button>
            <button class="link" onClick={() => void store.togglePref(item.id, 'suspended')}>
              {prefs?.suspended ? 'Réactiver' : 'Suspendre'}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
