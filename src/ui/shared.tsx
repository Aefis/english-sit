import { useEffect, useState } from 'preact/hooks';
import { splitHighlight } from '../core/cards';
import type { Item, ItemType } from '../core/schema';
import type { Store } from '../core/store';

/** Redessine le composant à chaque changement du store. */
export function useStore(store: Store): number {
  const [revision, setRevision] = useState(store.revision);
  useEffect(() => store.subscribe(() => setRevision(store.revision)), [store]);
  return revision;
}

export const TYPE_LABELS: Record<ItemType, string> = {
  word: 'Mot',
  chunk: 'Expression',
  collocation: 'Collocation',
  phrasal_verb: 'Phrasal verb',
  idiom: 'Idiome',
  connector: 'Connecteur',
};

export function speak(item: Pick<Item, 'audio' | 'variant'>, text: string, accent: string) {
  if (item.audio) {
    void new Audio(item.audio).play();
    return;
  }
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = item.variant === 'US' ? 'en-US' : item.variant === 'UK' ? 'en-GB' : accent;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

export function Highlighted({ item }: { item: Pick<Item, 'example_en' | 'highlight'> }) {
  const [before, target, after] = splitHighlight(item.example_en, item.highlight);
  return (
    <>
      {before}
      <mark>{target}</mark>
      {after}
    </>
  );
}

export function ItemDetails({ item, store }: { item: Item; store: Store }) {
  const family = item.family
    ? store.items.filter((i) => i.family === item.family && i.id !== item.id).map((i) => i.english)
    : [];
  const variantLabel = item.variant === 'both' ? null : `${item.variant} · autre variante : ${item.counterpart}`;
  return (
    <dl class="details">
      {item.sense && <Detail label="Sens">{item.sense}</Detail>}
      {item.ipa && <Detail label="API">{item.ipa}</Detail>}
      {item.forms && <Detail label="Formes">{item.forms}</Detail>}
      {variantLabel && <Detail label="Variante">{variantLabel}</Detail>}
      {item.also_accept.length > 0 && <Detail label="Aussi possible">{item.also_accept.join(' · ')}</Detail>}
      {item.notes && <Detail label="Note">{item.notes}</Detail>}
      {family.length > 0 && <Detail label="Même famille">{family.join(' · ')}</Detail>}
    </dl>
  );
}

function Detail({ label, children }: { label: string; children: preact.ComponentChildren }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function Badges({ item }: { item: Item }) {
  return (
    <div class="badges">
      <span class="badge">{item.level}</span>
      <span class="badge">{TYPE_LABELS[item.type]}</span>
      {item.register !== 'neutral' && <span class="badge">{item.register}</span>}
      {item.tags.includes('pro') && <span class="badge">Pro</span>}
    </div>
  );
}
