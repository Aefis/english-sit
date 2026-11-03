import { useState } from 'preact/hooks';
import { NO_FOCUS, type Focus } from '../core/queue';
import type { Store } from '../core/store';
import { Browse } from './Browse';
import { Review } from './Review';
import { SettingsView } from './SettingsView';
import { StatsView } from './StatsView';
import { useStore } from './shared';

const TABS = [
  ['review', 'Réviser'],
  ['browse', 'Explorer'],
  ['stats', 'Statistiques'],
  ['settings', 'Réglages'],
] as const;

type Tab = (typeof TABS)[number][0];

export function App({ store }: { store: Store }) {
  useStore(store);
  const [tab, setTab] = useState<Tab>('review');
  // Conservée entre onglets, mais pas au rechargement : une sélection oubliée masquerait des cartes dues.
  const [focus, setFocus] = useState<Focus>(NO_FOCUS);
  return (
    <>
      <nav class="tabs" aria-label="Navigation principale">
        {TABS.map(([id, label]) => (
          <button key={id} class={tab === id ? 'tab active' : 'tab'} aria-current={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      <main>
        {tab === 'review' && <Review store={store} focus={focus} onFocus={setFocus} />}
        {tab === 'browse' && <Browse store={store} />}
        {tab === 'stats' && <StatsView store={store} />}
        {tab === 'settings' && <SettingsView store={store} />}
      </main>
    </>
  );
}
