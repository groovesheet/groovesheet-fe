/**
 * Metadata for the internal demo, recording and status pages. Each gets its
 * own title (constitution 6) and all stay out of the index: they are tools
 * and recording frames, not landing pages.
 */
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo/metadata';

export interface DemoRouteProps {
  params: Promise<{ locale: string }>;
}

export async function demoMetadata(
  { params }: DemoRouteProps,
  path: string,
  title: string,
  description: string
): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({ title, description, path, locale, noindex: true });
}
