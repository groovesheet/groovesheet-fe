/**
 * /sheet-music/:instrument — the hub for an instrument GrooveSheet transcribes
 * (drums, piano, bass). Stem-only parts live under /stems/:instrument instead,
 * so a URL never promises notation the product does not produce.
 */
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isLocale } from '@/lib/locales';
import { staticRouteMetadata } from '@/lib/seo/metadata';
import { hubBySlug, hubPath, hubsOfKind } from '@/lib/seo/instrumentHubs';
import InstrumentHubPage from '../../_components/InstrumentHubPage';

export const revalidate = 300;
export const dynamicParams = false;

interface HubParams {
  params: Promise<{ locale: string; instrument: string }>;
}

export function generateStaticParams(): { instrument: string }[] {
  return hubsOfKind('notation').map((h) => ({ instrument: h.slug }));
}

export async function generateMetadata({ params }: HubParams) {
  const { locale, instrument } = await params;
  const hub = hubBySlug('notation', instrument);
  if (!hub) return { title: 'Not found', robots: { index: false, follow: false } };
  return staticRouteMetadata(hubPath(hub), locale);
}

export default async function SheetMusicHub({ params }: HubParams) {
  const { locale, instrument } = await params;
  const hub = hubBySlug('notation', instrument);
  if (!hub || !isLocale(locale)) notFound();
  setRequestLocale(locale);
  return <InstrumentHubPage hub={hub} locale={locale} />;
}
