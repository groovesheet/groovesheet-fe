'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CaretDown, CaretLeft, CaretRight, Funnel, MagnifyingGlass, X } from '@phosphor-icons/react';
import Header from '@/components/chrome/Header';
import Footer from '@/components/chrome/Footer';
import { Link } from '@/lib/navigation';
import { SORT_OPTIONS, STEM_INSTRUMENTS } from '@/lib/exploreConstants';
import { searchLibraryTracks } from '@/lib/libraryApi';
import type { JsonObject } from '@/lib/types';
import Sidebar from './Sidebar';
import SongCard from './SongCard';
import ResultRow from './ResultRow';
import { SkeletonGrid, ExploreEmpty, ExploreError } from './ExploreStates';
import {
  CATEGORY_TITLES,
  filtersFromParams,
  pageWindow,
  paramsFromFilters,
  resultsStateFromParams,
  resultsTitle,
  searchRequestFor,
  searchRequestKey,
  type FilterSets,
} from './resultsParams';
import trackToCard, { type SongCardModel } from './trackToCard';
import type { CardVariant } from './thumbs/resolveThumb';
import './Explore.css';
import './SearchResults.css';

const SEARCH_DEBOUNCE_MS = 350;

/** Format segmented control. `null` value = "All". */
const FORMAT_TABS: { value: string | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'sheet', label: 'Sheet' },
  { value: 'midi', label: 'MIDI' },
  { value: 'stems', label: 'Stems' },
];

const CARD_VARIANTS: Record<string, CardVariant> = { sheet: 'sheet', midi: 'midi', stems: 'stems' };

/** One page of results, already mapped to the card model. */
export interface ResultsData {
  tracks: SongCardModel[];
  total: number | null;
  pages: number;
  facets: JsonObject | null;
}

/** What the server rendered, and for which request (see searchRequestKey). */
export interface InitialResults {
  key: string;
  data: ResultsData | null;
  error: string | null;
}

interface LoadedResults extends InitialResults {
  /** Retry counter the result belongs to; bumping it refetches the same URL. */
  attempt: number;
}

type ParamPatch = Record<string, string | number | null | undefined>;

/** The /explore/search page body. The URL is the state; see resultsParams. */
export default function SearchResults({ initial }: { initial: InitialResults }) {
  const searchParams = useSearchParams();
  const urlState = resultsStateFromParams(searchParams);
  const { q: urlQuery, sort, view, page } = urlState;
  const requestKey = searchRequestKey(urlState);

  const [draft, setDraft] = useState(urlQuery);
  // Back/forward, or a link that carries its own `q`, must win over the box.
  // Adjusted while rendering (React's pattern for state derived from props)
  // rather than in an effect, so the box never shows a stale query.
  const [draftSource, setDraftSource] = useState(urlQuery);
  if (draftSource !== urlQuery) {
    setDraftSource(urlQuery);
    setDraft(urlQuery);
  }

  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<LoadedResults>({ ...initial, attempt: 0 });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const latestRequest = useRef(requestKey);

  const loading = result.key !== requestKey || result.attempt !== attempt;
  const data = result.data;
  const error = loading ? null : result.error;

  useEffect(() => {
    latestRequest.current = requestKey;
  }, [requestKey]);

  // Fetch whatever the URL asks for, unless the server already answered it.
  // Client-side changes go through history.pushState (below), so they never
  // re-render the server page: the browser queries the API directly, as the
  // CRA page did.
  useEffect(() => {
    if (!loading) return undefined;
    let cancelled = false;
    const state = resultsStateFromParams(new URLSearchParams(window.location.search));
    const key = searchRequestKey(state);
    searchLibraryTracks(searchRequestFor(state))
      .then((body) => {
        if (cancelled || key !== latestRequest.current) return; // stale, a newer query won
        setResult({
          key,
          attempt,
          error: null,
          data: {
            tracks: (body.tracks || []).map(trackToCard),
            total: typeof body.total === 'number' ? body.total : null,
            pages: body.pages || 1,
            facets: body.facets || null,
          },
        });
      })
      .catch((err: unknown) => {
        if (cancelled || key !== latestRequest.current) return;
        console.error('Failed to load search results:', err);
        setResult({
          key,
          attempt,
          data: null,
          error: (err instanceof Error && err.message) || 'Failed to load results.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [loading, requestKey, attempt]);

  /**
   * Merge into the query string. Passing `null` drops a param, and any change
   * other than the page itself resets to page 1; otherwise narrowing a filter
   * while on page 9 lands you on an empty page.
   *
   * Native history calls are integrated with the Next router (useSearchParams
   * follows them) and, unlike router.push, do not ask the server to re-render
   * this dynamic page for every keystroke.
   */
  const setParams = useCallback((patch: ParamPatch, { replace = false }: { replace?: boolean } = {}) => {
    const next = new URLSearchParams(window.location.search);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === '' || value === undefined) next.delete(key);
      else next.set(key, String(value));
    });
    if (!('page' in patch)) next.delete('page');
    const qs = next.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    if (replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
  }, []);

  // Debounce the search box into the URL so each keystroke isn't a history
  // entry or a request. `replace` keeps the back button pointing at the page
  // the user arrived from rather than at every prefix they typed.
  useEffect(() => {
    if (draft.trim() === urlQuery) return undefined;
    const t = setTimeout(() => setParams({ q: draft.trim() || null }, { replace: true }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [draft, urlQuery, setParams]);

  // The server set the title for the URL it rendered; later changes happen
  // through history.pushState, so the tab title is kept in step here.
  const documentTitle = `${resultsTitle(urlState)} | GrooveSheet`;
  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  useEffect(() => {
    document.body.classList.toggle('modal-open', drawerOpen);
    return () => document.body.classList.remove('modal-open');
  }, [drawerOpen]);

  // Paging is a new result set at the same place on the page; scroll back up so
  // page 2 doesn't start mid-grid.
  const shownPage = useRef(page);
  useEffect(() => {
    if (shownPage.current === page) return;
    shownPage.current = page;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  const tracks = useMemo(() => (data && data.tracks) || [], [data]);
  // `total`/`pages` only exist in the API's offset mode; fall back to what
  // is on screen rather than claiming zero results while showing some.
  const total = data && data.total != null ? data.total : tracks.length;
  const pages = (data && data.pages) || 1;

  const formatKey = urlState.formats.join(',');
  const instrumentKey = urlState.instruments.join(',');
  const lengthKey = urlState.lengths.join(',');
  const singleFormat = urlState.formats.length === 1 ? urlState.formats[0] : null;
  const heading = urlQuery ? null : (singleFormat && CATEGORY_TITLES[singleFormat]) || 'All transcriptions';

  // The sidebar works in display labels; the URL works in param keys.
  const filters = useMemo(
    () =>
      filtersFromParams({
        instrument: instrumentKey ? instrumentKey.split(',') : [],
        format: formatKey ? formatKey.split(',') : [],
        length: lengthKey ? lengthKey.split(',') : [],
      }),
    [instrumentKey, formatKey, lengthKey]
  );

  const setFilters = useCallback(
    (updater: FilterSets | ((prev: FilterSets) => FilterSets)) => {
      const next = typeof updater === 'function' ? updater(filters) : updater;
      setParams({ ...paramsFromFilters(next) });
    },
    [filters, setParams]
  );

  const toggleInstrument = useCallback(
    (label: string) => {
      const next = new Set(filters.instrument);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      setParams({ ...paramsFromFilters({ ...filters, instrument: next }) });
    },
    [filters, setParams]
  );

  // One flat list of everything currently narrowing the results, so a filter
  // set from the sidebar, a chip, or a "View all" link is removable from the
  // same place.
  const pills: { group: keyof FilterSets; label: string }[] = [
    ...[...filters.format].map((label) => ({ group: 'format' as const, label })),
    ...[...filters.instrument].map((label) => ({ group: 'instrument' as const, label })),
    ...[...filters.length].map((label) => ({ group: 'length' as const, label })),
  ];

  const removePill = ({ group, label }: { group: keyof FilterSets; label: string }) => {
    const next = { ...filters, [group]: new Set(filters[group]) };
    next[group].delete(label);
    setFilters(next);
  };

  const clearFilters = () => setParams({ format: null, instrument: null, length: null });

  const clearAll = () => {
    setDraft('');
    setParams({ q: null, format: null, instrument: null, length: null });
  };

  // Related searches from the artists actually on this page: real catalog
  // data, not a hardcoded list that may match nothing.
  const relatedArtists = useMemo(() => {
    const seen = new Set<string>();
    const needle = urlQuery.trim().toLowerCase();
    return tracks
      .map((t) => t.artist)
      .filter((a): a is string => {
        if (!a || a.toLowerCase() === needle) return false;
        const key = a.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6);
  }, [tracks, urlQuery]);

  const sortOptions = SORT_OPTIONS.filter((o) => !o.searchOnly || urlQuery);

  const sidebarNode = (close: (() => void) | null) => (
    <Sidebar
      query={draft}
      onQueryChange={setDraft}
      facetCounts={(data && data.facets) || null}
      filters={filters}
      setFilters={setFilters}
      popularChips={STEM_INSTRUMENTS}
      activeChips={filters.instrument}
      toggleChip={toggleInstrument}
      onClose={close}
    />
  );

  const cardVariant = singleFormat ? CARD_VARIANTS[singleFormat] : undefined;

  return (
    <div className="explore-page results-page">
      <div className="dot-grid" />
      <Header />
      <div className="explore-nav-divider" />

      <div className="explore-layout">
        <div className="explore-sidebar-col">{sidebarNode(null)}</div>

        {drawerOpen && (
          <>
            <div className="explore-sidebar-backdrop" onClick={() => setDrawerOpen(false)} />
            <div className="explore-sidebar-drawer">{sidebarNode(() => setDrawerOpen(false))}</div>
          </>
        )}

        <main className="explore-main">
          <nav className="rs-crumbs" aria-label="Breadcrumb">
            <Link href="/explore">Explore</Link>
            <span aria-hidden="true">/</span>
            <span className="rs-crumb-current">{urlQuery ? 'Search' : 'Browse'}</span>
          </nav>

          <div className="rs-titleblock">
            <div className="rs-titles">
              <h1 className="rs-title">
                {urlQuery ? (
                  <>
                    Results for <em>&ldquo;{urlQuery}&rdquo;</em>
                  </>
                ) : (
                  heading
                )}
              </h1>
              <p className="rs-sub">
                {loading && !data ? (
                  'Searching the library…'
                ) : (
                  <>
                    {/* Fixed locale: the server and the browser must agree on the digits. */}
                    <b>{total.toLocaleString('en-US')}</b> {total === 1 ? 'transcription' : 'transcriptions'}
                    {urlQuery ? ' matched' : pills.length > 0 ? ' match these filters' : ' in the library'}
                    {pages > 1 ? `, page ${page} of ${pages}` : ''}.
                  </>
                )}
              </p>
            </div>
            <div className="rs-titleblock-actions">
              <button
                type="button"
                className="explore-mobile-filters rs-filters-btn"
                onClick={() => setDrawerOpen(true)}
              >
                <Funnel size={18} weight="regular" />
                <span>Filters</span>
              </button>
              <div className="rs-segmented" role="group" aria-label="Format">
                {FORMAT_TABS.map((tab) => (
                  <button
                    key={tab.label}
                    type="button"
                    className={`rs-seg${singleFormat === tab.value ? ' rs-seg-active' : ''}`}
                    aria-pressed={singleFormat === tab.value}
                    onClick={() => setParams({ format: tab.value })}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <form
            className="rs-search"
            onSubmit={(e) => {
              e.preventDefault();
              setParams({ q: draft.trim() || null });
            }}
          >
            <span className="rs-search-icon">
              <MagnifyingGlass size={18} weight="regular" />
            </span>
            <input
              className="rs-search-input"
              name="q"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Search titles, artists, instruments…"
              aria-label="Search the library"
            />
            <button type="submit" className="rs-search-btn">
              Search
            </button>
          </form>

          <div className="rs-toolbar">
            <div className="rs-pills">
              {pills.length === 0 ? (
                <span className="rs-nopills">No filters applied</span>
              ) : (
                <>
                  {pills.map((pill) => (
                    <span key={`${pill.group}:${pill.label}`} className="rs-pill">
                      {pill.label}
                      <button type="button" onClick={() => removePill(pill)} aria-label={`Remove ${pill.label} filter`}>
                        <X size={13} weight="bold" />
                      </button>
                    </span>
                  ))}
                  <button type="button" className="rs-clear" onClick={clearFilters}>
                    Clear all
                  </button>
                </>
              )}
            </div>

            <div className="rs-controls">
              <label className="rs-sort">
                <span className="rs-sort-label">Sort</span>
                <span className="rs-select-shell">
                  <select value={sort} onChange={(e) => setParams({ sort: e.target.value })} aria-label="Sort results">
                    {sortOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <CaretDown size={14} weight="bold" />
                </span>
              </label>

              <div className="rs-viewtoggle" role="group" aria-label="Layout">
                {(['grid', 'list'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`rs-view${view === v ? ' rs-view-active' : ''}`}
                    aria-pressed={view === v}
                    onClick={() => setParams({ view: v === 'grid' ? null : v, page })}
                  >
                    {v === 'grid' ? 'Grid' : 'List'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading && <SkeletonGrid />}

          {!loading && error && <ExploreError message={error} onRetry={() => setAttempt((n) => n + 1)} />}

          {!loading && !error && tracks.length === 0 && (
            <ExploreEmpty query={urlQuery || pills.map((p) => p.label).join(', ')} onClear={clearAll} />
          )}

          {!loading && !error && tracks.length > 0 && (
            <>
              {view === 'grid' ? (
                <div className="rs-grid">
                  {tracks.map((t) => (
                    <SongCard key={t.id} song={t} variant={cardVariant} href={`/explore/${t.id}`} />
                  ))}
                </div>
              ) : (
                <div className="rs-list">
                  {tracks.map((t) => (
                    <ResultRow key={t.id} song={t} />
                  ))}
                </div>
              )}

              {pages > 1 && (
                <nav className="rs-pagination" aria-label="Pagination">
                  <button
                    type="button"
                    className="rs-page-arrow"
                    disabled={page === 1}
                    onClick={() => setParams({ page: page - 1 })}
                    aria-label="Previous page"
                  >
                    <CaretLeft size={16} weight="bold" />
                  </button>
                  {pageWindow(page, pages).map((p, i) =>
                    p === null ? (
                      <span key={`gap-${i}`} className="rs-page-gap">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        className={`rs-page${p === page ? ' rs-page-active' : ''}`}
                        aria-current={p === page ? 'page' : undefined}
                        onClick={() => setParams({ page: p })}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    className="rs-page-arrow"
                    disabled={page === pages}
                    onClick={() => setParams({ page: page + 1 })}
                    aria-label="Next page"
                  >
                    <CaretRight size={16} weight="bold" />
                  </button>
                </nav>
              )}

              {relatedArtists.length > 0 && (
                <div className="rs-related">
                  <div className="rs-related-label">Related searches</div>
                  <div className="rs-related-chips">
                    {relatedArtists.map((artist) => (
                      <button
                        key={artist}
                        type="button"
                        className="rs-related-chip"
                        onClick={() => {
                          setDraft(artist);
                          setParams({ q: artist });
                        }}
                      >
                        {artist}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}
