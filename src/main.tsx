import { render } from 'preact';
import { App } from './ui/App';
import { Store } from './core/store';
import type { Deck } from './core/schema';
import './ui/styles.css';

async function start() {
  const root = document.getElementById('app')!;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}deck.json`);
    if (!response.ok) throw new Error(`deck.json : HTTP ${response.status}`);
    const store = new Store();
    await store.load((await response.json()) as Deck);
    render(<App store={store} />, root);
  } catch (error) {
    root.textContent = `Impossible de charger l'application : ${String(error)}`;
  }
}

void start();
