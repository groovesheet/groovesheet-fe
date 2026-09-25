/**
 * /stems/:instrument — the hub for a part the separator emits but no
 * transcriber reads (vocals, guitar). These pages promise isolated audio and
 * say plainly that there is no notation, which keeps the URL honest; the
 * transcribed instruments live under /sheet-music/:instrument.
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
  return hubsOfKind('stems').map((h) => ({ instrument: h.slug }));
}

export async function generateMetadata({ params }: HubParams) {
  const { locale, instrument } = await params;
  const hub = hubBySlug('stems', instrument);
  if (!hub) return { title: 'Not found', robots: { index: false, follow: false } };
  return staticRouteMetadata(hubPath(hub), locale);
}

export default async function StemsHub({ params }: HubParams) {
  const { locale, instrument } = await params;
  const hub = hubBySlug('stems', instrument);
  if (!hub || !isLocale(locale)) notFound();
  setRequestLocale(locale);
  return <InstrumentHubPage hub={hub} locale={locale} />;
}
