import { useEffect, useState } from 'preact/hooks';
import type { Store } from '../core/store';
import { About } from './About';
import { Browse } from './Browse';
import { DICTS, I18n, loadLang, saveLang, type Lang } from './i18n';
import { Review } from './Review';
import { StatsView } from './StatsView';
import { useStore } from './shared';

const TABS = ['review', 'browse', 'stats', 'about'] as const;

type Tab = (typeof TABS)[number];

export function App({ store }: { store: Store }) {
  useStore(store);
  const [tab, setTab] = useState<Tab>('review');
  const [lang, setLang] = useState<Lang>(loadLang);
  const t = DICTS[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const switchLang = () => {
    const next: Lang = lang === 'en' ? 'fr' : 'en';
    setLang(next);
    saveLang(next);
  };

  return (
    <I18n.Provider value={{ lang, t }}>
      <nav class="tabs" aria-label={lang === 'en' ? 'Main navigation' : 'Navigation principale'}>
        {TABS.map((id) => (
          <button key={id} class={tab === id ? 'tab active' : 'tab'} aria-current={tab === id} onClick={() => setTab(id)}>
            {t.tabs[id]}
          </button>
        ))}
        <button class="tab lang" lang={lang === 'en' ? 'fr' : 'en'} aria-label={t.switchLangLabel} onClick={switchLang}>
          {t.switchLang}
        </button>
      </nav>
      <main>
        {tab === 'review' && <Review store={store} />}
        {tab === 'browse' && <Browse store={store} />}
        {tab === 'stats' && <StatsView store={store} />}
        {tab === 'about' && <About />}
      </main>
    </I18n.Provider>
  );
}
