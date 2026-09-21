import { getT } from '@/lib/i18n-server';
import type { Locale } from '@/lib/locales';
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

  return <FaqAccordion title={t('faq.title')} sections={sections} />;
}
