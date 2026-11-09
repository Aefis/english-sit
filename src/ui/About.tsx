import { useI18n } from './i18n';

// Adresse assemblée à l'affichage, pour qu'elle n'apparaisse pas en clair dans le code publié.
const EMAIL = 'moc.liamg@aalairmat'.split('').reverse().join('');
const ATTRIBUTIONS_URL = 'https://github.com/Aefis/english-sit/blob/main/ATTRIBUTIONS.md';

export function About() {
  const { t } = useI18n();
  return (
    <section>
      <div class="panel about">
        <h1>{t.aboutTitle}</h1>
        <p>{t.aboutText}</p>

        <h2>{t.contactTitle}</h2>
        <p>
          {t.contactText} <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
        </p>

        <h2>{t.creditsTitle}</h2>
        <p class="small">
          {t.creditsText} <a href={ATTRIBUTIONS_URL} target="_blank" rel="noopener">ATTRIBUTIONS.md</a>
        </p>
      </div>
    </section>
  );
}
