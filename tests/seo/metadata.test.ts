import { describe, expect, it } from 'vitest';
import { alternatesFor, generatedOgImage, pageMetadata, staticRouteMetadata } from '@/lib/seo/metadata';
import { breadcrumbJsonLd, faqJsonLd } from '@/lib/seo/jsonld';

describe('pageMetadata', () => {
  it('sets a self-referencing canonical, hreflang cluster and og:locale per locale', () => {
    const meta = pageMetadata({ title: 'Pricing', path: '/pricing', locale: 'zh-CN' });
    expect(meta.alternates?.canonical).toBe('/zh-CN/pricing');
    expect(meta.alternates?.languages).toEqual({
      'x-default': '/pricing',
      en: '/pricing',
      'zh-CN': '/zh-CN/pricing',
      'zh-TW': '/zh-TW/pricing',
    });
    const og = meta.openGraph as Record<string, unknown>;
    expect(og.locale).toBe('zh_CN');
    expect(og.alternateLocale).toEqual(['en_US', 'zh_TW']);
    expect(og.url).toBe('/zh-CN/pricing');
  });

  it('marks noindex pages and keeps them out of the canonical cluster semantics', () => {
    const meta = pageMetadata({ title: 'Billing', path: '/account/billing', locale: 'en', noindex: true });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it('gives static routes a generated card but keeps the designed home preview', () => {
    const pricing = staticRouteMetadata('/pricing', 'en');
    const images = (pricing.openGraph as { images: { url: string; width?: number }[] }).images;
    expect(images[0].url.startsWith('https://www.groovesheet.net/og?title=')).toBe(true);
    expect(images[0].width).toBe(1200);
    const home = staticRouteMetadata('/', 'en');
    const homeImages = (home.openGraph as { images: { url: string }[] }).images;
    expect(homeImages[0].url).toBe('https://www.groovesheet.net/images/Preview.png');
  });

  it('throws for a route that is not in the table', () => {
    expect(() => staticRouteMetadata('/nope', 'en')).toThrow();
  });
});

describe('generatedOgImage', () => {
  it('encodes title and subtitle as query parameters on an absolute URL', () => {
    const img = generatedOgImage('Stems & MIDI', 'a "quote"');
    const url = new URL(img.url);
    expect(url.origin + url.pathname).toBe('https://www.groovesheet.net/og');
    expect(url.searchParams.get('title')).toBe('Stems & MIDI');
    expect(url.searchParams.get('subtitle')).toBe('a "quote"');
  });
});

describe('alternatesFor', () => {
  it('falls back to English for an unknown locale', () => {
    expect(alternatesFor('/about', 'fr').canonical).toBe('/about');
  });
});

describe('JSON-LD builders', () => {
  it('builds a localized breadcrumb trail', () => {
    const ld = breadcrumbJsonLd('zh-TW', [
      { name: 'GrooveSheet', path: '/' },
      { name: 'Explore', path: '/explore' },
      { name: 'Song', path: '/explore/abc' },
    ]) as { itemListElement: { position: number; item: string }[] };
    // The trail is localized to the URL the visitor is on, home included.
    expect(ld.itemListElement.map((e) => e.item)).toEqual([
      'https://www.groovesheet.net/zh-TW',
      'https://www.groovesheet.net/zh-TW/explore',
      'https://www.groovesheet.net/zh-TW/explore/abc',
    ]);
    expect(ld.itemListElement.map((e) => e.position)).toEqual([1, 2, 3]);
  });

  it('builds FAQPage entities one-to-one with the visible list', () => {
    const ld = faqJsonLd([{ question: 'Q?', answer: 'A.' }]) as { mainEntity: unknown[] };
    expect(ld.mainEntity).toHaveLength(1);
    expect(ld.mainEntity[0]).toMatchObject({ '@type': 'Question', name: 'Q?' });
  });
});
