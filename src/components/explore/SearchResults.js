import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CaretDown, CaretLeft, CaretRight, Funnel, MagnifyingGlass, X } from '@phosphor-icons/react';
import Header from '../layout/Header';
import Footer from '../layout/Footer';
import Sidebar from './Sidebar';
import SongCard from './SongCard';
import ResultRow from './ResultRow';
import { SkeletonGrid, ExploreEmpty, ExploreError } from './ExploreStates';
import { RESULTS_PER_PAGE, SORT_OPTIONS, STEM_INSTRUMENTS } from './constants';
import {
  filtersFromParams,
  pageWindow,
  paramsFromFilters,
  readList,
  resolveSort,
} from './resultsParams';
import { searchLibraryTracks } from '../../utils/libraryApi';
import trackToCard from './trackToCard';
import { LocalizedLink, useLocalizedNavigate } from '../../i18n/locale';
import usePageMeta from '../../hooks/usePageMeta';
import './SearchResults.css';

const SEARCH_DEBOUNCE_MS = 350;

/** Format segmented control. `null` value = "All". */
const FORMAT_TABS = [
  { value: null, label: 'All' },
  { value: 'sheet', label: 'Sheet' },
  { value: 'midi', label: 'MIDI' },
  { value: 'stems', label: 'Stems' },
];

const CATEGORY_TITLES = {
  sheet: 'Popular sheet music',
  midi: 'Popular MIDI',
  stems: 'Popular stems',
};

export const SearchResults = ({ onLoginClick }) => {
  const navigate = useLocalizedNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlQuery = searchParams.get('q') || '';
  const sort = resolveSort(searchParams.get('sort') || '', Boolean(urlQuery));
  const view = searchParams.get('view') === 'list' ? 'list' : 'grid';
  const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1);
  const formatParams = readList(searchParams, 'format');
  const instrumentParams = readList(searchParams, 'instrument');
  const lengthParams = readList(searchParams, 'length');

  const [draft, setDraft] = useState(urlQuery);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const requestSeq = useRef(0);

  const singleFormat = formatParams.length === 1 ? formatParams[0] : null;
  const heading = urlQuery
    ? null
    : (singleFormat && CATEGORY_TITLES[singleFormat]) || 'All transcriptions';

  usePageMeta(
    urlQuery ? `Search: ${urlQuery}` : heading,
    urlQuery
      ? `Transcriptions matching “${urlQuery}” — sheet music, MIDI, and isolated stems.`
      : 'Browse every AI transcription in the GrooveSheet library — sheet music, MIDI, and stems.'
  );

  /**
   * Merge into the query string. Passing `null` drops a param, and any change
   * other than the page itself resets to page 1 — otherwise narrowing a filter
   * while on page 9 lands you on an empty page.
   */
  const setParams = useCallback(
    (patch, { replace = false } = {}) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(patch).forEach(([key, value]) => {
            if (value === null || value === '' || value === undefined) next.delete(key);
            else next.set(key, String(value));
          });
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace }
      );
    },
    [setSearchParams]
  );

  // Debounce the search box into the URL so each keystroke isn't a history
  // entry or a request. `replace` keeps the back button pointing at the page
  // the user arrived from rather than at every prefix they typed.
  useEffect(() => {
    if (draft.trim() === urlQuery) return undefined;
    const t = setTimeout(
      () => setParams({ q: draft.trim() || null }, { replace: true }),
      SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(t);
  }, [draft, urlQuery, setParams]);

  // Back/forward, or a link that carries its own `q`, must win over the box.
  useEffect(() => setDraft(urlQuery), [urlQuery]);

  useEffect(() => {
    document.body.classList.toggle('modal-open', drawerOpen);
    return () => document.body.classList.remove('modal-open');
  }, [drawerOpen]);

  const formatKey = formatParams.join(',');
  const instrumentKey = instrumentParams.join(',');
  const lengthKey = lengthParams.join(',');

  useEffect(() => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    searchLibraryTracks({
      q: urlQuery,
      sort,
      formats: formatKey ? formatKey.split(',') : [],
      instruments: instrumentKey ? instrumentKey.split(',') : [],
      lengths: lengthKey ? lengthKey.split(',') : [],
      page,
      limit: RESULTS_PER_PAGE,
      facets: true,
    })
      .then((body) => {
        if (seq !== requestSeq.current) return; // stale — a newer query won
        setData({ ...body, tracks: (body.tracks || []).map(trackToCard) });
      })
      .catch((err) => {
        if (seq !== requestSeq.current) return;
        console.error('Failed to load search results:', err);
        setData(null);
        setError(err.message || 'Failed to load results.');
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false);
      });
  }, [urlQuery, sort, formatKey, instrumentKey, lengthKey, page]);

  // Arriving from the hub: React Router keeps the previous page's scroll, which
  // lands you halfway down the results. Jump, don't animate — there is nothing
  // on screen yet to animate away from.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Paging is a new result set at the same place on the page; scroll back up so
  // page 2 doesn't start mid-grid.
  const firstPageRender = useRef(true);
  useEffect(() => {
    if (firstPageRender.current) {
      firstPageRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  const tracks = useMemo(() => (data && data.tracks) || [], [data]);
  // `total`/`pages` only exist in the API's offset mode; fall back to what
  // is on screen rather than claiming zero results while showing some.
  const total = data && data.total != null ? data.total : tracks.length;
  const pages = (data && data.pages) || 1;

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
    (updater) => {
      const next = typeof updater === 'function' ? updater(filters) : updater;
      setParams(paramsFromFilters(next));
    },
    [filters, setParams]
  );

  const toggleInstrument = useCallback(
    (label) => {
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
  const pills = [
    ...[...filters.format].map((label) => ({ group: 'format', label })),
    ...[...filters.instrument].map((label) => ({ group: 'instrument', label })),
    ...[...filters.length].map((label) => ({ group: 'length', label })),
  ];

  const removePill = ({ group, label }) => {
    const next = { ...filters, [group]: new Set(filters[group]) };
    next[group].delete(label);
    setFilters(next);
  };

  const clearFilters = () =>
    setParams({ format: null, instrument: null, length: null });

  const clearAll = () => {
    setDraft('');
    setParams({ q: null, format: null, instrument: null, length: null });
  };

  // Related searches from the artists actually on this page — real catalog
  // data, not a hardcoded list that may match nothing.
  const relatedArtists = useMemo(() => {
    const seen = new Set();
    const needle = urlQuery.trim().toLowerCase();
    return tracks
      .map((t) => t.artist)
      .filter((a) => {
        if (!a || a.toLowerCase() === needle) return false;
        const key = a.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6);
  }, [tracks, urlQuery]);

  const sortOptions = SORT_OPTIONS.filter((o) => !o.searchOnly || urlQuery);

  const sidebarNode = (close) => (
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

  return (
    <div className="explore-page results-page">
      <div className="dot-grid" />
      <Header onLoginClick={onLoginClick} />
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
            <LocalizedLink to="/explore">Explore</LocalizedLink>
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
                    <b>{total.toLocaleString()}</b>{' '}
                    {total === 1 ? 'transcription' : 'transcriptions'}
                    {urlQuery ? ' matched' : pills.length > 0 ? ' match these filters' : ' in the library'}
                    {pages > 1 ? ` — page ${page} of ${pages}` : ''}.
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
                      <button
                        type="button"
                        onClick={() => removePill(pill)}
                        aria-label={`Remove ${pill.label} filter`}
                      >
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
                  <select
                    value={sort}
                    onChange={(e) => setParams({ sort: e.target.value })}
                    aria-label="Sort results"
                  >
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
                {['grid', 'list'].map((v) => (
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

          {!loading && error && (
            <ExploreError message={error} onRetry={() => setParams({ page })} />
          )}

          {!loading && !error && tracks.length === 0 && (
            <ExploreEmpty
              query={urlQuery || pills.map((p) => p.label).join(', ')}
              onClear={clearAll}
            />
          )}

          {!loading && !error && tracks.length > 0 && (
            <>
              {view === 'grid' ? (
                <div className="rs-grid">
                  {tracks.map((t) => (
                    <SongCard
                      key={t.id}
                      song={t}
                      variant={singleFormat === 'sheet' ? 'sheet' : singleFormat === 'midi' ? 'midi' : singleFormat === 'stems' ? 'stems' : undefined}
                      onClick={() => navigate(`/explore/${t.id}`)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rs-list">
                  {tracks.map((t) => (
                    <ResultRow key={t.id} song={t} onClick={() => navigate(`/explore/${t.id}`)} />
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
};

export default SearchResults;
