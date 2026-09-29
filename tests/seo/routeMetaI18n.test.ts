import { describe, expect, it } from 'vitest';
import { ROUTE_META, isEnglishOnly, metaForPath } from '@/lib/seo/routeMeta';
import { LOCALIZED_ROUTE_META } from '@/lib/seo/routeMetaI18n';
import { staticRouteMetadata } from '@/lib/seo/metadata';

/**
 * Every static route is either translated or declared English-only. There is
 * no third state, because the third state is what the site had until
 * September 2026: /zh-CN/help served as the Chinese version of /help, with an
 * English title, an English FAQ and a self-canonical, so Google saw three
 * copies of one English page.
 */
const CJK = /[一-鿿]/;

describe('localized route titles', () => {
  const translated = Object.keys(ROUTE_META).filter((p) => !isEnglishOnly(p));

  it.each(['zh-CN', 'zh-TW'] as const)('%s titles every translated route', (locale) => {
    const missing = translated.filter((p) => !LOCALIZED_ROUTE_META[locale]?.[p]);
    expect(missing).toEqual([]);
  });

  it.each(['zh-CN', 'zh-TW'] as const)('%s titles are Chinese', (locale) => {
    for (const [path, meta] of Object.entries(LOCALIZED_ROUTE_META[locale] || {})) {
      expect(CJK.test(meta.title), `${path} title`).toBe(true);
      expect(CJK.test(meta.description || ''), `${path} description`).toBe(true);
    }
  });

  // A Chinese title on a page whose body is English would be the same lie the
  // other way round.
  it('gives no Chinese title to an English-only route', () => {
    for (const locale of ['zh-CN', 'zh-TW'] as const) {
      const offenders = Object.keys(LOCALIZED_ROUTE_META[locale] || {}).filter(isEnglishOnly);
      expect(offenders).toEqual([]);
    }
  });

  it('keeps legal and developer pages English-only', () => {
    for (const path of ['/terms', '/privacy-policy', '/refund-policy', '/business-information', '/developers']) {
      expect(isEnglishOnly(path), path).toBe(true);
    }
  });

  it('serves the localized title and falls back to English', () => {
    expect(metaForPath('/zh-CN/help', 'zh-CN')?.title).toBe('帮助与支持');
    expect(metaForPath('/help', 'en')?.title).toBe('Help & Support');
    expect(metaForPath('/zh-TW/terms', 'zh-TW')?.title).toBe('Terms & Conditions');
    const home = staticRouteMetadata('/', 'zh-TW');
    expect(String((home.title as { absolute?: string })?.absolute ?? home.title)).toContain('扒譜');
  });
});
