import { describe, expect, it } from 'vitest';
import { indexableStaticPaths, renderSitemapIndex, renderUrlset, staticSitemapUrls } from '@/lib/seo/sitemap';
import { ROUTE_META, isEnglishOnly } from '@/lib/seo/routeMeta';

describe('static sitemap', () => {
  it('lists every titled route except the excluded ones, in every locale', () => {
    const paths = indexableStaticPaths();
    expect(paths).toContain('/');
    expect(paths).toContain('/stem-splitter');
    expect(paths).not.toContain('/business-information');
    const urls = staticSitemapUrls(paths);
    // Translated routes get one entry per locale; English-only ones get one.
    const translated = paths.filter((p) => !isEnglishOnly(p));
    const englishOnly = paths.filter(isEnglishOnly);
    expect(urls).toHaveLength(translated.length * 3 + englishOnly.length);
    expect(urls.map((u) => u.loc)).toContain('https://www.groovesheet.net/zh-CN/pricing');
    expect(urls.map((u) => u.loc)).toContain('https://www.groovesheet.net/zh-TW');
  });

  it('submits one URL, with no hreflang, for a page that is English at every locale', () => {
    // /zh-TW/sheet-music/drums renders the English hub inside a translated
    // header and footer. Advertising it as the zh-TW version would submit
    // three URLs for one document.
    const hub = staticSitemapUrls(['/sheet-music/drums']);
    expect(hub).toHaveLength(1);
    expect(hub[0].loc).toBe('https://www.groovesheet.net/sheet-music/drums');
    expect(hub[0].alternates).toEqual([]);

    const compare = staticSitemapUrls(['/compare/klangio']);
    expect(compare).toHaveLength(1);
    expect(compare[0].loc).toBe('https://www.groovesheet.net/compare/klangio');

    const xml = renderUrlset(hub);
    expect(xml).not.toContain('xhtml:link');
    expect(xml).not.toContain('/zh-TW/sheet-music');
  });

  it('gives every entry the full hreflang cluster including x-default', () => {
    const [home] = staticSitemapUrls(['/']);
    expect(home.loc).toBe('https://www.groovesheet.net');
    expect(home.alternates.map((a) => a.hreflang)).toEqual(['x-default', 'en', 'zh-CN', 'zh-TW']);
    expect(home.alternates.find((a) => a.hreflang === 'zh-TW')?.href).toBe('https://www.groovesheet.net/zh-TW');
  });

  it('never emits a path that generateMetadata would refuse', () => {
    for (const p of indexableStaticPaths()) expect(ROUTE_META[p]).toBeTruthy();
  });

  it('renders well-formed XML with escaped ampersands', () => {
    const xml = renderUrlset(staticSitemapUrls(['/pricing']));
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?><urlset')).toBe(true);
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml).toContain('<xhtml:link rel="alternate" hreflang="zh-CN" href="https://www.groovesheet.net/zh-CN/pricing"/>');
    expect((xml.match(/<url>/g) || []).length).toBe(3);
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it('indexes the three children', () => {
    const xml = renderSitemapIndex();
    expect(xml).toContain('<loc>https://www.groovesheet.net/sitemaps/pages.xml</loc>');
    expect(xml).toContain('<loc>https://www.groovesheet.net/sitemaps/library.xml</loc>');
    expect(xml).toContain('<loc>https://www.groovesheet.net/blog-sitemap.xml</loc>');
  });
});
