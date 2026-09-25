/**
 * generateMetadata helpers. Every route returns one of these so each URL gets
 * its own <title>, description, canonical and hreflang set in the server HTML.
 *
 *   export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
 *     const { locale } = await params;
 *     return staticRouteMetadata('/pricing', locale);
 *   }
 *
 * For data-driven pages (song, creator), call pageMetadata() with the record's
 * own title, description and image.
 *
 * Titles are bare ("Pricing: Pay Only..."): the root layout's title template
 * appends " | GrooveSheet". Pass `absoluteTitle` to opt out.
 */
import type { Metadata } from 'next';
import { buildLocalePath, isLocale, DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@/lib/locales';
import { metaForPath } from '@/lib/seo/routeMeta';

export const SITE_URL = 'https://www.groovesheet.net';
export const SITE_NAME = 'GrooveSheet';
export const DEFAULT_TITLE = 'Audio to Sheet Music, Stems & MIDI | GrooveSheet';
export const DEFAULT_DESCRIPTION =
  'Turn any song into sheet music. AI transcription for drums, piano and bass, plus stem separation and audio-to-MIDI. Export PDF, MusicXML and MIDI.';
export const DEFAULT_OG_IMAGE = {
  url: `${SITE_URL}/images/Preview.png`,
  width: 1200,
  height: 630,
};

/** og:locale per site locale (Open Graph wants territory-qualified tags). */
export const OG_LOCALES: Record<Locale, string> = {
  en: 'en_US',
  'zh-CN': 'zh_CN',
  'zh-TW': 'zh_TW',
};

/**
 * A 1200x630 card rendered by app/og/route.tsx from the page's own title, so
 * a shared /pricing or /stem-splitter link unfurls as that page instead of
 * every marketing URL showing the same static preview. Absolute, because
 * some scrapers (LinkedIn, iMessage) ignore metadataBase for images.
 */
export function generatedOgImage(title: string, subtitle?: string): { url: string; width: number; height: number } {
  const params = new URLSearchParams({ title });
  if (subtitle) params.set('subtitle', subtitle);
  return { url: `${SITE_URL}/og?${params.toString()}`, width: 1200, height: 630 };
}

function asLocale(locale: string): Locale {
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

/**
 * Canonical plus one hreflang per locale, all as paths (the root layout sets
 * metadataBase). `path` is the unprefixed English path, e.g. '/pricing'.
 * The canonical is the locale's own URL without any query string, which is
 * what collapses the hundreds of utm-tagged /explore links onto one document.
 */
export function alternatesFor(path: string, locale: string): { canonical: string; languages: Record<string, string> } {
  const languages: Record<string, string> = { 'x-default': path };
  for (const l of SUPPORTED_LOCALES) languages[l] = buildLocalePath(l, path);
  return {
    canonical: buildLocalePath(asLocale(locale), path),
    languages,
  };
}

export interface PageMetadataInput {
  /** Bare title; the layout template appends " | GrooveSheet". */
  title: string;
  description?: string;
  /** Unprefixed English path of this page, e.g. '/explore/abc'. */
  path: string;
  locale: string;
  /** Absolute image URL for og:image / twitter:image. Defaults to the site preview. */
  image?: string | null;
  /** Image dimensions, when known; scrapers render faster with them. */
  imageSize?: { width: number; height: number };
  /** Use the title as-is, without the site suffix. */
  absoluteTitle?: boolean;
  /** Keep the page out of the index (account, internal and demo pages). */
  noindex?: boolean;
  /** og:type, 'website' unless the page is a single work (e.g. 'music.song'). */
  ogType?: 'website' | 'article' | 'music.song' | 'profile';
}

export function pageMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  locale,
  image,
  imageSize,
  absoluteTitle = false,
  noindex = false,
  ogType = 'website',
}: PageMetadataInput): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  const alternates = alternatesFor(path, locale);
  const images = image ? [{ url: image, ...(imageSize ?? {}) }] : [DEFAULT_OG_IMAGE];
  const ogLocale = OG_LOCALES[asLocale(locale)];
  const alternateLocale = SUPPORTED_LOCALES.map((l) => OG_LOCALES[l]).filter((l) => l !== ogLocale);
  // Next's metadata merge is shallow: a page's openGraph replaces the layout's
  // wholesale, so every field is restated here rather than inherited.
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates,
    openGraph: {
      type: ogType,
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      url: alternates.canonical,
      locale: ogLocale,
      alternateLocale,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: images.map((i) => i.url),
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

/**
 * Metadata for a route listed in lib/seo/routeMeta.ts. Throws at build time
 * for an unknown path, so a typo cannot silently ship the default title.
 */
export function staticRouteMetadata(path: string, locale: string, extra: Partial<PageMetadataInput> = {}): Metadata {
  const meta = metaForPath(path);
  if (!meta) throw new Error(`staticRouteMetadata: no entry for ${path} in lib/seo/routeMeta.ts`);
  // The home page's own title is the site title; the template would double the brand.
  const absoluteTitle = path === '/';
  // The home page keeps the designed preview; every other static route gets a
  // card with its own title, so tool and pricing links stop unfurling alike.
  const og = absoluteTitle ? null : generatedOgImage(meta.title, meta.description);
  const metadata = pageMetadata({
    title: absoluteTitle ? DEFAULT_TITLE : meta.title,
    description: meta.description,
    path,
    locale,
    absoluteTitle,
    ...(og ? { image: og.url, imageSize: { width: og.width, height: og.height } } : {}),
    ...extra,
  });
  if (path === '/') {
    // Markdown twin of the home page (public/index.md), for agents and
    // language models that would rather read prose than run the bundle. Only
    // the home page has one, so only the home page advertises it.
    metadata.alternates = { ...metadata.alternates, types: { 'text/markdown': '/index.md' } };
  }
  return metadata;
}
