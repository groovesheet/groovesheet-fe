'use client';

import { useEffect, useState } from 'react';
import { fetchBillingPlans } from '@/lib/api';
import type { BillingCatalog } from '@/lib/types';

/**
 * Shared access to the public billing catalog (GET /billing/plans).
 *
 * The catalog is the single source of truth for prices, and it is quoted in
 * the currency the backend picked for this visitor: USD, or CNY when
 * Cloudflare geolocates them to mainland China. Every surface that shows a
 * price reads it from here so a visitor can never be shown two currencies for
 * the same plan.
 *
 * Deliberately client-side: the currency depends on the visitor's country, so
 * a server-rendered (cached) price would show one visitor's currency to all.
 *
 * The response is cached per page load and shared between callers, so the
 * pricing page's plan cards and its comparison table cost one request between
 * them rather than one each.
 */

let cached: Promise<BillingCatalog> | null = null;

function loadCatalog(): Promise<BillingCatalog> {
  if (!cached) {
    cached = fetchBillingPlans('/api').catch((err: unknown) => {
      // Let the next mount retry instead of caching the failure forever.
      cached = null;
      throw err;
    });
  }
  return cached;
}

export const CURRENCY_SYMBOLS: Record<string, string> = { usd: '$', cny: '¥' };

/**
 * Format an amount in `currency`: `$10`, `$7.5`, `¥68`, `¥107.3`.
 *
 * Trailing zeros are dropped. Yuan round to one decimal: the only fractional
 * yuan figure is a monthly-equivalent of an annual price (¥1288/12), where fen
 * are noise. Returns null for non-numbers so callers can fall back to their
 * static copy.
 */
export function formatMoney(value: number | string | null | undefined, currency: string = 'usd'): string | null {
  if (value == null || Number.isNaN(Number(value))) return null;
  const trimmed = parseFloat(Number(value).toFixed(currency === 'cny' ? 1 : 2));
  return `${CURRENCY_SYMBOLS[currency] || CURRENCY_SYMBOLS.usd}${trimmed}`;
}

export default function useBillingCatalog(): { catalog: BillingCatalog | null; loading: boolean; currency: string } {
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadCatalog()
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch((err: unknown) => {
        // Never block the page: callers fall back to their static copy.
        console.warn('Failed to load billing plans; using static fallback values.', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { catalog, loading, currency: catalog?.currency || 'usd' };
}
