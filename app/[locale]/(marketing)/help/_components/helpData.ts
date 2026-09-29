import { COMPANY } from '@/lib/company';
import { MAX_UPLOAD_MB } from '@/lib/constants';

export interface FaqCategory {
  id: string;
  label: string;
  items: { q: string; a: string }[];
}

export const CONTACT = {
  // From lib/company, which the legal pages read too: one number, so support
  // and the terms page can never again offer different ones.
  whatsappNumber: COMPANY.phone,
  whatsappHref: COMPANY.phoneHref,
  email: COMPANY.supportEmail,
};

/**
 * The FAQ's shape: categories and questions, in page order. The words live in
 * messages/{locale}.json under `help.faq.<category>`, so the page, its search
 * and its FAQPage markup are in the visitor's language.
 */
export const FAQ_LAYOUT: { id: string; items: string[] }[] = [
  { id: 'getting-started', items: ['signin', 'stems'] },
  { id: 'account', items: ['profile', 'connected', 'delete'] },
  { id: 'billing', items: ['minute', 'deducted', 'expire', 'failed', 'add', 'refund', 'plan'] },
  { id: 'uploads', items: ['size', 'formats', 'outputs'] },
  { id: 'quality', items: ['clean', 'live', 'meters', 'which'] },
  { id: 'publishing', items: ['publish', 'visibility', 'downloads', 'unpublish', 'creator'] },
];

/** A translator scoped to `help.faq` (getTranslations on the server). */
type FaqT = (key: string, values?: Record<string, string | number>) => string;

/** The FAQ in one locale. The upload limit is read from the enforced constant, never typed. */
export function faqData(t: FaqT): FaqCategory[] {
  return FAQ_LAYOUT.map(({ id, items }) => ({
    id,
    label: t(`${id}.label`),
    items: items.map((item) => ({
      q: t(`${id}.items.${item}.q`),
      a: t(`${id}.items.${item}.a`, { size: MAX_UPLOAD_MB }),
    })),
  }));
}
