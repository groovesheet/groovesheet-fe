import { describe, expect, it } from 'vitest';
import { COMPETITORS, comparePath, comparePaths, competitorBySlug } from '@/lib/seo/competitors';
import { ROUTE_META } from '@/lib/seo/routeMeta';
import { indexableStaticPaths } from '@/lib/seo/sitemap';
import { staticRouteMetadata } from '@/lib/seo/metadata';

/**
 * A page that names another company is the easiest place on the site to be
 * wrong, so these are mostly honesty checks rather than routing checks.
 */
describe('comparison pages', () => {
  it('sources and dates every competitor', () => {
    for (const c of COMPETITORS) {
      expect(c.source).toMatch(/^https:\/\//);
      expect(new URL(c.source).hostname).toContain(c.site.replace(/^www\./, '').split('.')[0]);
      expect(c.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(c.checked))).toBe(false);
      // The date has to be in the description too, since that is what shows
      // in the SERP snippet, where a stale price does the most damage.
      expect(c.description).toMatch(/\d{1,2} \w+ \d{4}/);
    }
  });

  it('never lets a comparison be one-sided', () => {
    for (const c of COMPETITORS) {
      expect(c.wins.length).toBeGreaterThanOrEqual(3);
      expect(c.ours.length).toBeGreaterThanOrEqual(3);
      expect(c.theirFit.length).toBeGreaterThan(80);
      expect(c.ourFit.length).toBeGreaterThan(80);
    }
  });

  it('uses null, not a "no", for anything the vendor did not publish', () => {
    for (const c of COMPETITORS) {
      for (const row of c.rows) {
        // A competitor cell must be real text or an explicit unknown. "No" as
        // a claim about another product needs a source, and null is how the
        // page says "their pages did not say".
        expect(row.theirs === null || row.theirs.trim().length > 0).toBe(true);
        if (typeof row.theirs === 'string') {
          expect(row.theirs.trim().toLowerCase()).not.toBe('no');
        }
      }
      // At least one unknown per page, otherwise the rule is not being used
      // and someone has been filling gaps in from memory.
      expect(c.rows.some((r) => r.theirs === null)).toBe(true);
    }
  });

  it('keeps titles within the SERP budget and slugs unique', () => {
    for (const c of COMPETITORS) {
      expect(c.title.length).toBeLessThanOrEqual(46);
      expect(c.description.length).toBeLessThanOrEqual(175);
      expect(c.faq.length).toBeGreaterThanOrEqual(3);
    }
    expect(new Set(COMPETITORS.map((c) => c.slug)).size).toBe(COMPETITORS.length);
  });

  it('registers the index and every comparison in the route table and sitemap', () => {
    const indexable = indexableStaticPaths();
    for (const path of comparePaths()) {
      expect(ROUTE_META[path]).toBeTruthy();
      expect(indexable).toContain(path);
      expect(() => staticRouteMetadata(path, 'en')).not.toThrow();
    }
    expect(comparePaths()[0]).toBe('/compare');
  });

  it('resolves a competitor by slug', () => {
    expect(competitorBySlug('klangio')?.name).toBe('Klangio');
    expect(competitorBySlug('nope')).toBeUndefined();
    expect(comparePath({ slug: 'klangio' })).toBe('/compare/klangio');
  });
});
