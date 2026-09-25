import { getT } from '@/lib/i18n-server';
import type { Locale } from '@/lib/locales';
import { faqJsonLd } from '@/lib/seo/jsonld';
import JsonLd from '@/app/[locale]/explore/_components/JsonLd';
import FaqAccordion, { type FaqSection } from './FaqAccordion';

const SECTIONS_DEF = [
  { key: 'overview', items: ['signup', 'split'] },
  {
    key: 'packs',
    items: ['expiration', 'minutesMean', 'deducted', 'remaining', 'jobFails', 'addMinutes'],
  },
  { key: 'features', items: ['quality', 'live', 'meters', 'format'] },
];

/** The shared FAQ band of the landing and tool pages, translated on the server. */
export default async function HomeFaq({ locale }: { locale: Locale }) {
  const t = await getT(locale);

  const sections: FaqSection[] = SECTIONS_DEF.map(({ key, items }) => ({
    title: t(`faq.sections.${key}.title`),
    items: items.map((id) => ({
      id: `${key}-${id}`,
      question: t(`faq.sections.${key}.questions.${id}.q`),
      answer:
        t(`faq.sections.${key}.questions.${id}.a`) ||
        'This is the answer to the question. Add real content here.',
    })),
  }));

  // FAQPage markup built from the same translated list the band renders, so
  // the structured data never claims an answer the visitor cannot see. This
  // is the JSON-LD the SEO plan promised for /stem-splitter and /midi-converter.
  const faqEntries = sections.flatMap((s) => s.items.map((i) => ({ question: i.question, answer: i.answer })));

  return (
    <>
      <JsonLd data={faqJsonLd(faqEntries)} />
      <FaqAccordion title={t('faq.title')} sections={sections} />
    </>
  );
}
