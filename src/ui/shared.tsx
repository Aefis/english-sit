import { useEffect, useState } from 'preact/hooks';
import { splitHighlight } from '../core/cards';
import type { Item } from '../core/schema';
import type { Store } from '../core/store';
import { useI18n } from './i18n';

/** Redessine le composant à chaque changement du store. */
export function useStore(store: Store): number {
  const [revision, setRevision] = useState(store.revision);
  useEffect(() => store.subscribe(() => setRevision(store.revision)), [store]);
  return revision;
}

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
  const { t } = useI18n();
  const d = t.details;
  const family = item.family
    ? store.items.filter((i) => i.family === item.family && i.id !== item.id).map((i) => i.english)
    : [];
  const variantLabel = item.variant === 'both' ? null : `${item.variant} · ${t.otherVariant}: ${item.counterpart}`;
  return (
    <dl class="details">
      {item.sense && <Detail label={d.sense}>{item.sense}</Detail>}
      {item.ipa && <Detail label={d.ipa}>{item.ipa}</Detail>}
      {item.forms && <Detail label={d.forms}>{item.forms}</Detail>}
      {variantLabel && <Detail label={d.variant}>{variantLabel}</Detail>}
      {item.also_accept.length > 0 && <Detail label={d.also}>{item.also_accept.join(' · ')}</Detail>}
      {item.notes && <Detail label={d.note}>{item.notes}</Detail>}
      {family.length > 0 && <Detail label={d.family}>{family.join(' · ')}</Detail>}
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
  const { t } = useI18n();
  return (
    <div class="badges">
      <span class="badge">{item.level}</span>
      <span class="badge">{t.types[item.type]}</span>
      {item.register !== 'neutral' && <span class="badge">{t.registers[item.register]}</span>}
      {item.tags.includes('pro') && <span class="badge">{t.pro}</span>}
    </div>
  );
}
