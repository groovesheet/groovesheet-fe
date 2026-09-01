import {
  filtersFromParams,
  pageWindow,
  paramsFromFilters,
  readList,
  resolveSort,
} from './resultsParams';

describe('readList', () => {
  const params = (s) => new URLSearchParams(s);

  it('splits a comma-separated param', () => {
    expect(readList(params('format=sheet,midi'), 'format')).toEqual(['sheet', 'midi']);
  });

  it('drops empties and whitespace so ?format=, is not a filter', () => {
    expect(readList(params('format=sheet, ,,midi '), 'format')).toEqual(['sheet', 'midi']);
  });

  it('returns [] for a missing param', () => {
    expect(readList(params(''), 'format')).toEqual([]);
  });
});

describe('resolveSort', () => {
  it('defaults to relevance for a search and popular for a browse', () => {
    expect(resolveSort('', true)).toBe('relevance');
    expect(resolveSort('', false)).toBe('popular');
  });

  it('keeps a supported sort', () => {
    expect(resolveSort('downloads', false)).toBe('downloads');
  });

  it('falls back on an unknown sort rather than sending it to the API', () => {
    // The API 422s on an unknown sort; a stale bookmark should not hard-fail.
    expect(resolveSort('rating', true)).toBe('relevance');
    expect(resolveSort('easiest', false)).toBe('popular');
  });
});

describe('filters <-> params', () => {
  it('maps param keys to the labels the sidebar renders', () => {
    const filters = filtersFromParams({
      instrument: ['piano', 'drums'],
      format: ['sheet', 'stems'],
      length: ['under2'],
    });
    expect([...filters.instrument]).toEqual(['Piano', 'Drums']);
    expect([...filters.format]).toEqual(['Sheet Music', 'Stems']);
    expect([...filters.length]).toEqual(['Under 2 min']);
  });

  it('ignores retired param values instead of rendering an undefined pill', () => {
    const filters = filtersFromParams({ format: ['vinyl'], length: ['forever'] });
    expect(filters.format.size).toBe(0);
    expect(filters.length.size).toBe(0);
  });

  it('round-trips back to param strings', () => {
    const params = paramsFromFilters(
      filtersFromParams({ instrument: ['piano'], format: ['midi'], length: ['2to5'] })
    );
    expect(params).toEqual({ instrument: 'piano', format: 'midi', length: '2to5' });
  });

  it('returns null for an empty facet so the param is dropped, not blank', () => {
    expect(paramsFromFilters(filtersFromParams({}))).toEqual({
      instrument: null,
      format: null,
      length: null,
    });
  });
});

describe('pageWindow', () => {
  it('lists every page when they fit', () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('elides the middle for a long catalog', () => {
    expect(pageWindow(9, 400)).toEqual([1, null, 8, 9, 10, null, 400]);
  });

  it('always keeps the first and last page reachable', () => {
    for (const page of [1, 2, 50, 399, 400]) {
      const window = pageWindow(page, 400);
      expect(window[0]).toBe(1);
      expect(window[window.length - 1]).toBe(400);
      expect(window).toContain(page);
    }
  });

  it('never renders a gap next to the page it replaces', () => {
    // "1 … 2 3" would be a lie: nothing is elided between 1 and 2.
    expect(pageWindow(2, 400)).toEqual([1, 2, 3, null, 400]);
    expect(pageWindow(399, 400)).toEqual([1, null, 398, 399, 400]);
  });
});
