import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Funnel } from '@phosphor-icons/react';
import Header from './layout/Header';
import Footer from './layout/Footer';
import Sidebar from './explore/Sidebar';
import ExploreHeader from './explore/ExploreHeader';
import Section from './explore/Section';
import { SkeletonSection, ExploreEmpty, ExploreError } from './explore/ExploreStates';
import {
  STEM_INSTRUMENTS,
  FORMAT_FILTER_MAP,
  FORMAT_PARAM_BY_LABEL,
  lengthBucket,
  songPath,
} from './explore/constants';
import trackToCard from './explore/trackToCard';
import { fetchLibraryTracks } from '../utils/libraryApi';
import { useLocalizedNavigate } from '../i18n/locale';
import usePageMeta from '../hooks/usePageMeta';
import './Explore.css';

const PAGE_LIMIT = 60;
const SEARCH_DEBOUNCE_MS = 300;

export const Explore = ({ onLoginClick }) => {
  const navigate = useLocalizedNavigate();
  // The rail a card sits in decides which viewer tab opens — a MIDI card must
  // not land on the sheet music just because the track also has a score.
  const handleCardClick = (track, variant) => navigate(songPath(track.id, variant));

  // Submitting a search, or asking for everything in a section, leaves the hub
  // for the paginated results page. The hub only ever holds the first page of
  // the catalog, so filtering in place here silently hides matching tracks
  // further down.
  const goToResults = (params) =>
    navigate(`/explore/search?${new URLSearchParams(params).toString()}`);

  usePageMeta(
    'Explore',
    'Browse AI transcriptions — sheet music, MIDI files, and isolated stems from the GrooveSheet community.'
  );

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeChips, setActiveChips] = useState(new Set());
  const [filters, setFilters] = useState({
    instrument: new Set(),
    format: new Set(),
    length: new Set(),
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestSeq = useRef(0);

  const toggleChip = (c) =>
    setActiveChips((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  // Debounce the search input so each keystroke doesn't hit the server.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const loadTracks = useCallback(async (q) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLibraryTracks({ q, limit: PAGE_LIMIT });
      if (seq !== requestSeq.current) return; // stale response — a newer search won
      setTracks((data.tracks || []).map(trackToCard));
      setNextCursor(data.next_cursor || null);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error('Failed to load library tracks:', err);
      setTracks([]);
      setNextCursor(null);
      setError(err.message || 'Failed to load the library.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  // Cursor pagination: append the next page. The catalog used to silently cap
  // at the first 60 tracks because next_cursor was discarded.
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const seq = requestSeq.current;
    setLoadingMore(true);
    try {
      const data = await fetchLibraryTracks({ q: debouncedQuery, cursor: nextCursor, limit: PAGE_LIMIT });
      if (seq !== requestSeq.current) return; // a new search reset the list
      setTracks((prev) => {
        const seen = new Set(prev.map((t) => t.id));
        return [...prev, ...(data.tracks || []).map(trackToCard).filter((t) => !seen.has(t.id))];
      });
      setNextCursor(data.next_cursor || null);
    } catch (err) {
      console.error('Failed to load more tracks:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, debouncedQuery]);

  useEffect(() => {
    loadTracks(debouncedQuery);
  }, [debouncedQuery, loadTracks]);

  useEffect(() => {
    document.body.classList.toggle('modal-open', drawerOpen);
    return () => document.body.classList.remove('modal-open');
  }, [drawerOpen]);

  // Client-side filtering: AND across groups, OR within a group. The
  // instrument chips and the Instrument checkbox group act as one OR-group on
  // the parts derived from thumb_data.stems.
  const visibleTracks = useMemo(() => {
    const instrumentSet = new Set([...activeChips, ...filters.instrument]);
    const wantedFormats = [...filters.format].map((label) => FORMAT_FILTER_MAP[label]);
    return tracks.filter((t) => {
      if (instrumentSet.size > 0 && !t.parts.some((p) => instrumentSet.has(p))) return false;
      if (wantedFormats.length > 0 && !wantedFormats.some((f) => t.formats.includes(f))) {
        return false;
      }
      if (filters.length.size > 0 && !filters.length.has(lengthBucket(t.length))) return false;
      return true;
    });
  }, [tracks, activeChips, filters]);

  const { formatSections, discoverySections } = useMemo(() => {
    const byPopularity = [...visibleTracks].sort((a, b) => b.popularity - a.popularity);
    const byNewest = [...visibleTracks].sort(
      (a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0),
    );
    // Trending uses only real backend engagement signals.
    const byTrending = [...visibleTracks].sort(
      (a, b) =>
        b.popularity - a.popularity ||
        b.plays - a.plays ||
        b.downloads - a.downloads,
    );
    // Sheet/MIDI sections only contain tracks that actually ship that format;
    // Section renders nothing when a list is empty.
    return {
      formatSections: [
        {
          key: 'sheet',
          eyebrow: '01 · Sheet music',
          title: 'Popular sheet music',
          subtitle: 'Engraved, downloadable as PDF and MusicXML.',
          variant: 'sheet',
          filterLabel: 'Sheet Music',
          songs: byPopularity.filter((t) => t.formats.includes('musicxml')),
        },
        {
          key: 'midi',
          eyebrow: '02 · MIDI',
          title: 'Popular MIDI',
          subtitle: 'Multi-track .mid files. Drop into your DAW.',
          variant: 'midi',
          filterLabel: 'MIDI',
          songs: byPopularity.filter((t) => t.formats.includes('midi')),
        },
        {
          key: 'stems',
          eyebrow: '03 · Stems',
          title: 'Popular stems',
          subtitle: 'Isolated vocals, drums, bass, keys.',
          variant: 'stems',
          filterLabel: 'Stems',
          songs: byPopularity.filter((t) => t.formats.includes('stem')),
        },
      ],
      discoverySections: [
        {
          key: 'trending',
          title: 'Trending now',
          subtitle: 'What working musicians are downloading this week.',
          sort: 'downloads',
          songs: byTrending,
        },
        {
          key: 'new',
          title: 'New this week',
          subtitle: 'Fresh transcriptions, hot off the press.',
          sort: 'newest',
          songs: byNewest,
        },
      ],
    };
  }, [visibleTracks]);

  const isEmpty = !loading && !error && visibleTracks.length === 0;

  const sidebarNode = (close) => (
    <Sidebar
      query={query}
      onQueryChange={setQuery}
      tracks={tracks}
      filters={filters}
      setFilters={setFilters}
      popularChips={STEM_INSTRUMENTS}
      activeChips={activeChips}
      toggleChip={toggleChip}
      onClose={close}
    />
  );

  return (
    <div className="explore-page">
      <div className="dot-grid" />
      <Header onLoginClick={onLoginClick} />
      <div className="explore-nav-divider" />

      <div className="explore-layout">
        <div className="explore-sidebar-col">{sidebarNode(null)}</div>

        {drawerOpen && (
          <>
            <div
              className="explore-sidebar-backdrop"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="explore-sidebar-drawer">
              {sidebarNode(() => setDrawerOpen(false))}
            </div>
          </>
        )}

        <main className="explore-main">
          <button
            type="button"
            className="explore-mobile-filters"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open filters"
          >
            <Funnel size={18} weight="regular" />
            <span>Filters</span>
          </button>

          <ExploreHeader
            query={query}
            onQueryChange={setQuery}
            onSubmit={(q) => goToResults(q.trim() ? { q: q.trim() } : {})}
          />

          {loading && (
            <>
              <SkeletonSection />
              <SkeletonSection />
            </>
          )}

          {!loading && error && (
            <ExploreError message={error} onRetry={() => loadTracks(debouncedQuery)} />
          )}

          {isEmpty && (
            <ExploreEmpty
              query={debouncedQuery || (activeChips.size > 0 ? [...activeChips].join(', ') : '')}
              onClear={() => {
                setQuery('');
                setActiveChips(new Set());
                setFilters({
                  instrument: new Set(),
                  format: new Set(),
                  length: new Set(),
                });
              }}
            />
          )}

          {!loading && !error && !isEmpty && (
            <>
              {formatSections.map((s) => (
                <Section
                  key={s.key}
                  eyebrow={s.eyebrow}
                  title={s.title}
                  subtitle={s.subtitle}
                  variant={s.variant}
                  songs={s.songs}
                  onCardClick={handleCardClick}
                  onViewAll={() =>
                    goToResults({
                      format: FORMAT_PARAM_BY_LABEL[s.filterLabel],
                      sort: 'popular',
                    })
                  }
                />
              ))}

              <div className="explore-divider">
                <span className="explore-divider-label">Keep digging</span>
                <div className="explore-divider-lines">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="explore-divider-line" style={{ top: i * 3 }} />
                  ))}
                </div>
              </div>

              {discoverySections.map((s) => (
                <Section
                  key={s.key}
                  title={s.title}
                  subtitle={s.subtitle}
                  songs={s.songs}
                  accent={s.accent}
                  onCardClick={handleCardClick}
                  onViewAll={() => goToResults({ sort: s.sort })}
                />
              ))}

              {/* Search results are rank-ordered while the cursor paginates by
                  publish date, so Load More would skip/repeat rows mid-search —
                  only offer it for the browse (no-query) view. */}
              {nextCursor && !debouncedQuery && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 32px' }}>
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    style={{
                      padding: '12px 28px',
                      borderRadius: 8,
                      border: '1px solid var(--color-border)',
                      background: 'transparent',
                      color: 'var(--color-text)',
                      fontFamily: 'var(--font-family-sans)',
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: loadingMore ? 'wait' : 'pointer',
                      opacity: loadingMore ? 0.6 : 1,
                    }}
                  >
                    {loadingMore ? 'Loading…' : 'Load More'}
                  </button>
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

export default Explore;
