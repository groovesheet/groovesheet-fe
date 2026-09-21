/**
 * URL <-> UI translation for the results page (/explore/search).
 *
 * The query string is the single source of truth for what the page shows, so
 * a result set is linkable and the back button works. The sidebar speaks in
 * display labels ('Sheet Music', 'Piano'); the API speaks in short param keys
 * ('sheet', 'piano'). Everything that bridges the two lives here, apart from
 * the component, so it can be tested without rendering, and so the server page
 * and the client component parse a URL the same way.
 */

import {
  FORMAT_PARAM_BY_LABEL,
  FORMAT_LABEL_BY_PARAM,
  LENGTH_PARAM_BY_LABEL,
  LENGTH_LABEL_BY_PARAM,
  RESULTS_PER_PAGE,
  SORT_VALUES,
  capitalize,
} from '@/lib/exploreConstants';
import type { SearchLibraryParams } from '@/lib/libraryApi';

/** Headings for a single-format browse (?format=sheet and no query). */
export const CATEGORY_TITLES: Record<string, string> = {
  sheet: 'Popular sheet music',
  midi: 'Popular MIDI',
  stems: 'Popular stems',
};

// <title> for a single-format browse; the visible heading is CATEGORY_TITLES.
const METADATA_TITLES: Record<string, string> = {
  sheet: 'Popular Sheet Music Transcriptions',
  midi: 'Popular MIDI Files',
  stems: 'Popular Isolated Stems',
};

/** The single format a browse (no query) is narrowed to, if any. */
export function singleFormatOf(state: Pick<ResultsState, 'formats'>): string | null {
  return state.formats.length === 1 && CATEGORY_TITLES[state.formats[0]] ? state.formats[0] : null;
}

/**
 * The bare document title for a results state (the layout appends the brand).
 * Shared by generateMetadata and the client, which keeps it current as the
 * URL changes without a server round trip.
 */
export function resultsTitle(state: Pick<ResultsState, 'q' | 'formats' | 'page'>): string {
  if (state.q) return `Search: ${state.q}`;
  const format = singleFormatOf(state);
  const title = format ? METADATA_TITLES[format] : 'All Transcriptions';
  return state.page > 1 ? `${title}, Page ${state.page}` : title;
}

/** The part of URLSearchParams these helpers read, so a plain adapter works too. */
export interface ParamReader {
  get(key: string): string | null;
}

/** Sets of sidebar display labels, one per facet. */
export interface FilterSets {
  instrument: Set<string>;
  format: Set<string>;
  length: Set<string>;
}

export interface FilterParams {
  instrument: string | null;
  format: string | null;
  length: string | null;
}

/** Comma-separated URL param to an array of non-empty values. */
export function readList(params: ParamReader, key: string): string[] {
  return (params.get(key) || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Which sort to apply. An unknown value (a stale bookmark, a hand-edited URL)
 * falls back rather than being sent to the API, which would 422.
 */
export function resolveSort(rawSort: string, hasQuery: boolean): string {
  if (SORT_VALUES.includes(rawSort)) return rawSort;
  return hasQuery ? 'relevance' : 'popular';
}

/** URL params to the Sets of display labels the Sidebar renders. */
export function filtersFromParams({
  instrument = [],
  format = [],
  length = [],
}: {
  instrument?: string[];
  format?: string[];
  length?: string[];
}): FilterSets {
  return {
    instrument: new Set(instrument.map(capitalize)),
    format: new Set(format.map((p) => FORMAT_LABEL_BY_PARAM[p]).filter(Boolean)),
    length: new Set(length.map((p) => LENGTH_LABEL_BY_PARAM[p]).filter(Boolean)),
  };
}

/**
 * Sets of display labels to URL param strings. An empty facet becomes `null`
 * so the caller drops the param instead of writing `?format=`.
 */
export function paramsFromFilters(filters: FilterSets): FilterParams {
  const join = (values: (string | undefined)[]) => values.filter(Boolean).join(',') || null;
  return {
    instrument: join([...filters.instrument].map((l) => l.toLowerCase())),
    format: join([...filters.format].map((l) => FORMAT_PARAM_BY_LABEL[l])),
    length: join([...filters.length].map((l) => LENGTH_PARAM_BY_LABEL[l])),
  };
}

/**
 * Page numbers to render, with `null` marking an elided run.
 *
 * A 400-page catalog can't show every number, and "1 ... 7 8 9 ... 400" is the
 * shape people already know from every other paginated list.
 */
export function pageWindow(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | null)[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pages - 1, page + 1);
  if (from > 2) out.push(null);
  for (let p = from; p <= to; p += 1) out.push(p);
  if (to < pages - 1) out.push(null);
  out.push(pages);
  return out;
}

/** Everything the results page derives from its URL. */
export interface ResultsState {
  q: string;
  sort: string;
  view: 'grid' | 'list';
  page: number;
  formats: string[];
  instruments: string[];
  lengths: string[];
}

export function resultsStateFromParams(params: ParamReader): ResultsState {
  const q = params.get('q') || '';
  return {
    q,
    sort: resolveSort(params.get('sort') || '', Boolean(q)),
    view: params.get('view') === 'list' ? 'list' : 'grid',
    page: Math.max(1, parseInt(params.get('page') || '', 10) || 1),
    formats: readList(params, 'format'),
    instruments: readList(params, 'instrument'),
    lengths: readList(params, 'length'),
  };
}

/** The API request for a results state. `view` is layout only and not part of it. */
export function searchRequestFor(state: ResultsState): SearchLibraryParams {
  return {
    q: state.q,
    sort: state.sort,
    formats: state.formats,
    instruments: state.instruments,
    lengths: state.lengths,
    page: state.page,
    limit: RESULTS_PER_PAGE,
    facets: true,
  };
}

/**
 * Stable identity of a request, so the client can tell whether the data the
 * server rendered already answers the URL it is looking at.
 */
export function searchRequestKey(state: ResultsState): string {
  return JSON.stringify([state.q, state.sort, state.formats, state.instruments, state.lengths, state.page]);
}

/** Next.js searchParams (string | string[] | undefined values) as a ParamReader. */
export function readerFromRecord(record: Record<string, string | string[] | undefined>): ParamReader {
  return {
    get(key) {
      const value = record[key];
      if (Array.isArray(value)) return value[0] ?? null;
      return value ?? null;
    },
  };
}
