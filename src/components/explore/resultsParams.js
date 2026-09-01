/**
 * URL <-> UI translation for the results page (/explore/search).
 *
 * The query string is the single source of truth for what the page shows, so
 * a result set is linkable and the back button works. The sidebar speaks in
 * display labels ('Sheet Music', 'Piano'); the API speaks in short param keys
 * ('sheet', 'piano'). Everything that bridges the two lives here, apart from
 * the component, so it can be tested without rendering.
 */

import {
  FORMAT_PARAM_BY_LABEL,
  FORMAT_LABEL_BY_PARAM,
  LENGTH_PARAM_BY_LABEL,
  LENGTH_LABEL_BY_PARAM,
  SORT_VALUES,
  capitalize,
} from './constants';

/** Comma-separated URL param → array of non-empty values. */
export function readList(params, key) {
  return (params.get(key) || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Which sort to apply. An unknown value (a stale bookmark, a hand-edited URL)
 * falls back rather than being sent to the API, which would 422.
 */
export function resolveSort(rawSort, hasQuery) {
  if (SORT_VALUES.includes(rawSort)) return rawSort;
  return hasQuery ? 'relevance' : 'popular';
}

/** URL params → the Sets of display labels the Sidebar renders. */
export function filtersFromParams({ instrument = [], format = [], length = [] }) {
  return {
    instrument: new Set(instrument.map(capitalize)),
    format: new Set(format.map((p) => FORMAT_LABEL_BY_PARAM[p]).filter(Boolean)),
    length: new Set(length.map((p) => LENGTH_LABEL_BY_PARAM[p]).filter(Boolean)),
  };
}

/**
 * Sets of display labels → URL param strings. An empty facet becomes `null`
 * so the caller drops the param instead of writing `?format=`.
 */
export function paramsFromFilters(filters) {
  const join = (values) => values.filter(Boolean).join(',') || null;
  return {
    instrument: join([...filters.instrument].map((l) => l.toLowerCase())),
    format: join([...filters.format].map((l) => FORMAT_PARAM_BY_LABEL[l])),
    length: join([...filters.length].map((l) => LENGTH_PARAM_BY_LABEL[l])),
  };
}

/**
 * Page numbers to render, with `null` marking an elided run.
 *
 * A 400-page catalog can't show every number, and "1 … 7 8 9 … 400" is the
 * shape people already know from every other paginated list.
 */
export function pageWindow(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pages - 1, page + 1);
  if (from > 2) out.push(null);
  for (let p = from; p <= to; p += 1) out.push(p);
  if (to < pages - 1) out.push(null);
  out.push(pages);
  return out;
}
