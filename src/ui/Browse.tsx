import { useMemo, useState } from 'preact/hooks';
import { filterItems, NO_FILTERS, type Filters } from '../core/filter';
import { LEVELS, TYPES, type Item } from '../core/schema';
import type { Store } from '../core/store';
import { itemProgress } from '../core/stats';
import { useI18n } from './i18n';
import { Badges, Highlighted, ItemDetails, speak, useStore } from './shared';

const MAX_ROWS = 200;

interface SelectProps {
  label: string;
  value: string | number;
  options: [string | number, string][];
  onChange: (value: string) => void;
}

function Select({ label, value, options, onChange }: SelectProps) {
  const { t } = useI18n();
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange((e.target as HTMLSelectElement).value)}>
        <option value="">{t.anyOption}</option>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </label>
  );
}

const scale: [number, string][] = [5, 4, 3, 2, 1].map((n) => [n, String(n)]);

export function Browse({ store }: { store: Store }) {
  const revision = useStore(store);
  const { t } = useI18n();
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
          <span>{t.search}</span>
          <input type="search" value={filters.query} onInput={(e) => set({ query: (e.target as HTMLInputElement).value })} />
        </label>
        <Select label={t.level} value={filters.level} options={LEVELS.map((l) => [l, l])} onChange={(v) => set({ level: v as Filters['level'] })} />
        <Select label={t.type} value={filters.type} options={TYPES.map((ty) => [ty, t.types[ty]])} onChange={(v) => set({ type: v as Filters['type'] })} />
        <Select label={t.frequency} value={filters.frequency || ''} options={scale} onChange={(v) => set({ frequency: Number(v) })} />
        <Select label={t.priority} value={filters.priority || ''} options={scale} onChange={(v) => set({ priority: Number(v) })} />
        <Select label={t.theme} value={filters.tag} options={tags.map((tag) => [tag, tag])} onChange={(v) => set({ tag: v })} />
        <Select label={t.knowledge} value={filters.progress} options={Object.entries(t.progress)} onChange={(v) => set({ progress: v as Filters['progress'] })} />
        <Select
          label={t.difficulty}
          value={filters.difficulty}
          options={Object.entries(t.difficulties)}
          onChange={(v) => set({ difficulty: v as Filters['difficulty'] })}
        />
        <label class="check">
          <input type="checkbox" checked={filters.favoritesOnly} onChange={(e) => set({ favoritesOnly: (e.target as HTMLInputElement).checked })} />
          <span>{t.favourites}</span>
        </label>
      </div>

      <p class="result-count">{t.results(results.length, MAX_ROWS)}</p>
      <ul class="rows">
        {results.slice(0, MAX_ROWS).map((item) => (
          <Row key={item.id} item={item} store={store} open={open === item.id} onToggle={() => setOpen(open === item.id ? null : item.id)} />
        ))}
      </ul>
    </section>
  );
}

function Row({ item, store, open, onToggle }: { item: Item; store: Store; open: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  const prefs = store.prefs.get(item.id);
  return (
    <li class="row">
      <button class="row-main" aria-expanded={open} onClick={onToggle}>
        <strong>{item.english}</strong>
        <span class="muted">{item.french}</span>
        <span class="progress-label">{t.progress[itemProgress(item, store.cards)]}</span>
      </button>
      {open && (
        <div class="row-detail">
          <Badges item={item} />
          <p class="sentence"><Highlighted item={item} /></p>
          <p class="sentence muted">{item.example_fr}</p>
          <ItemDetails item={item} store={store} />
          <p class="muted small">
            {t.itemInfo(item.frequency, item.frequency_source === 'corpus' ? String(item.zipf) : null, item.priority, item.order)}
          </p>
          <div class="actions">
            <button class="link" onClick={() => speak(item, item.example_en, store.settings.accent)}>{t.listen}</button>
            <button class="link" onClick={() => void store.togglePref(item.id, 'favorite')}>
              {prefs?.favorite ? t.removeFavourite : t.addFavourite}
            </button>
            <button class="link" onClick={() => void store.togglePref(item.id, 'suspended')}>
              {prefs?.suspended ? t.unsuspend : t.suspend}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
