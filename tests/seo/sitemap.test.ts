import { describe, expect, it } from 'vitest';
import { indexableStaticPaths, renderSitemapIndex, renderUrlset, staticSitemapUrls } from '@/lib/seo/sitemap';
import { ROUTE_META } from '@/lib/seo/routeMeta';

describe('static sitemap', () => {
  it('lists every titled route except the excluded ones, in every locale', () => {
    const paths = indexableStaticPaths();
    expect(paths).toContain('/');
    expect(paths).toContain('/stem-splitter');
    expect(paths).not.toContain('/business-information');
    const urls = staticSitemapUrls(paths);
    expect(urls).toHaveLength(paths.length * 3);
    expect(urls.map((u) => u.loc)).toContain('https://www.groovesheet.net/zh-CN/pricing');
    expect(urls.map((u) => u.loc)).toContain('https://www.groovesheet.net/zh-TW');
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
