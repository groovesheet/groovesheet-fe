import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { pricingJsonLd } from '@/lib/seo/jsonld';

const ROOT = path.resolve(__dirname, '..', '..');
const SCANNED_DIRS = ['app', 'components', 'lib'];

function sourceFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      sourceFiles(full, acc);
    } else if (/\.[jt]sx?$/.test(entry.name) && !/\.test\.[jt]sx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Search Console flagged the pricing page's Product markup (2026-09-29) for
 * missing `review` and `aggregateRating`. GrooveSheet has no genuine customer
 * reviews to declare, and marking up invented ones is a structured-data spam
 * violation that risks a manual action. So the markup says what the page sells,
 * a service, and these checks keep a Product or a rating from creeping back.
 */
describe('pricing structured data', () => {
  const catalog = {
    plans: [
      { id: 'free', display_name: 'Free', price_monthly_usd: 0 },
      { id: 'pro', display_name: 'Pro', price_monthly_usd: 12, minutes_per_month: 60 },
    ],
    topups: [],
  };

  it('is a Service that still carries the USD offers', () => {
    const ld = pricingJsonLd(catalog);
    expect(ld['@type']).toBe('Service');
    const offers = ld.offers as Array<Record<string, unknown>>;
    expect(offers.map((o) => o.price)).toEqual(['0.00', '12.00']);
    expect(offers.every((o) => o.priceCurrency === 'USD')).toBe(true);
  });

  it('omits offers when the catalog is unavailable', () => {
    expect(pricingJsonLd(null)).not.toHaveProperty('offers');
  });

  it('declares no Product and no review or rating anywhere on the site', () => {
    for (const file of SCANNED_DIRS.flatMap((dir) => sourceFiles(path.join(ROOT, dir)))) {
      const src = fs.readFileSync(file, 'utf8');
      const rel = path.relative(ROOT, file);
      expect(src, rel).not.toMatch(/['"]@type['"]\s*:\s*['"]Product['"]/);
      expect(src, rel).not.toMatch(/['"]?\baggregateRating['"]?\s*:|['"]@type['"]\s*:\s*['"]Review['"]/);
    }
  });
});
