import { useState } from 'preact/hooks';
import type { Store } from '../core/store';
import { Browse } from './Browse';
import { Placement } from './Placement';
import { Review } from './Review';
import { SettingsView } from './SettingsView';
import { StatsView } from './StatsView';
import { useStore } from './shared';

const TABS = [
  ['review', 'Réviser'],
  ['placement', 'Test initial'],
  ['browse', 'Explorer'],
  ['stats', 'Statistiques'],
  ['settings', 'Réglages'],
] as const;

type Tab = (typeof TABS)[number][0];

export function App({ store }: { store: Store }) {
  useStore(store);
  const [tab, setTab] = useState<Tab>('review');
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
        {tab === 'review' && <Review store={store} />}
        {tab === 'placement' && <Placement store={store} onDone={() => setTab('review')} />}
        {tab === 'browse' && <Browse store={store} />}
        {tab === 'stats' && <StatsView store={store} />}
        {tab === 'settings' && <SettingsView store={store} />}
      </main>
    </>
  );
}
