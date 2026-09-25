import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

// Catch-all for paths no route claims, so an unknown URL renders the
// localized 404 (app/[locale]/not-found.tsx) inside the locale layout, with
// Header and Footer, instead of the bare global one.

interface CatchAllProps {
  params: Promise<{ locale: string; rest: string[] }>;
}

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

export default async function CatchAllPage({ params }: CatchAllProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  notFound();
}
