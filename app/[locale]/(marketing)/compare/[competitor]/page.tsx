/**
 * /compare/:competitor. One page per tool in lib/seo/competitors.ts, which
 * also feeds routeMeta, so a comparison cannot exist without a title and a
 * sitemap entry.
 */
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isLocale } from '@/lib/locales';
import { staticRouteMetadata } from '@/lib/seo/metadata';
import { COMPETITORS, comparePath, competitorBySlug } from '@/lib/seo/competitors';
import ComparePage from '../_components/ComparePage';

export const revalidate = 3600;
export const dynamicParams = false;

interface CompareParams {
  params: Promise<{ locale: string; competitor: string }>;
}

export function generateStaticParams(): { competitor: string }[] {
  return COMPETITORS.map((c) => ({ competitor: c.slug }));
}

export async function generateMetadata({ params }: CompareParams) {
  const { locale, competitor } = await params;
  const entry = competitorBySlug(competitor);
  if (!entry) return { title: 'Not found', robots: { index: false, follow: false } };
  return staticRouteMetadata(comparePath(entry), locale);
}

export default async function Compare({ params }: CompareParams) {
  const { locale, competitor } = await params;
  const entry = competitorBySlug(competitor);
  if (!entry || !isLocale(locale)) notFound();
  setRequestLocale(locale);
  return <ComparePage competitor={entry} locale={locale} />;
}
