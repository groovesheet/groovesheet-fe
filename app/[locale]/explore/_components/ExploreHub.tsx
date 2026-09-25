'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Funnel } from '@phosphor-icons/react';
import Header from '@/components/chrome/Header';
import Footer from '@/components/chrome/Footer';
import { useRouter } from '@/lib/navigation';
import { buildLocalePath } from '@/lib/locales';
import { useLocale } from '@/lib/i18n';
import {
  STEM_INSTRUMENTS,
  FORMAT_FILTER_MAP,
  FORMAT_PARAM_BY_LABEL,
  lengthBucket,
} from '@/lib/exploreConstants';
import { fetchLibraryTracks } from '@/lib/libraryApi';
import Sidebar from './Sidebar';
import ExploreHeader from './ExploreHeader';
import Section from './Section';
import { SkeletonSection, ExploreEmpty, ExploreError } from './ExploreStates';
import trackToCard, { type SongCardModel } from './trackToCard';
import type { FilterSets } from './resultsParams';
import type { CardVariant } from './thumbs/resolveThumb';
import './Explore.css';

const PAGE_LIMIT = 60;
const SEARCH_DEBOUNCE_MS = 300;

interface ExploreHubProps {
  /** First page of the catalog, fetched by the server so it is in the HTML. */
  initialTracks: SongCardModel[];
  initialNextCursor: string | null;
  /** Set when the server could not reach the library; the browser can retry. */
  initialError: string | null;
}

/** The catalog the hub is showing, and the (trimmed) query it answers. */
interface HubResults {
  q: string;
  tracks: SongCardModel[];
  nextCursor: string | null;
  error: string | null;
}

const emptyFilters = (): FilterSets => ({ instrument: new Set(), format: new Set(), length: new Set() });

function searchHref(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `/explore/search${qs ? `?${qs}` : ''}`;
}

export default function ExploreHub({ initialTracks, initialNextCursor, initialError }: ExploreHubProps) {
  const router = useRouter();
  const locale = useLocale();

  // Submitting a search leaves the hub for the paginated results page. The hub
  // only ever holds the first page of the catalog, so filtering in place here
  // silently hides matching tracks further down.
  const goToResults = (params: Record<string, string>) => router.push(searchHref(params));

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<HubResults>({
    q: '',
    tracks: initialTracks,
    nextCursor: initialNextCursor,
    error: initialError,
  });
  // The query being fetched right now, or null when idle.
  const [loadingQ, setLoadingQ] = useState<string | null>(null);
  const [activeChips, setActiveChips] = useState<Set<string>>(() => new Set());
  const [filters, setFilters] = useState<FilterSets>(emptyFilters);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestSeq = useRef(0);

  const toggleChip = (c: string) =>
    setActiveChips((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  const loadTracks = useCallback(async (q: string) => {
    const seq = ++requestSeq.current;
    setLoadingQ(q);
    try {
      const data = await fetchLibraryTracks({ q, limit: PAGE_LIMIT });
      if (seq !== requestSeq.current) return; // stale response, a newer search won
      setResults({ q, tracks: (data.tracks || []).map(trackToCard), nextCursor: data.next_cursor || null, error: null });
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error('Failed to load library tracks:', err);
      setResults({
        q,
        tracks: [],
        nextCursor: null,
        error: (err instanceof Error && err.message) || 'Failed to load the library.',
      });
    } finally {
      if (seq === requestSeq.current) setLoadingQ(null);
    }
  }, []);

  // Debounce the search input so each keystroke doesn't hit the server. The
  // server already rendered the empty query, so nothing is fetched on load.
  useEffect(() => {
    const q = query.trim();
    if (q === results.q || q === loadingQ) return undefined;
    const t = setTimeout(() => loadTracks(q), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, results.q, loadingQ, loadTracks]);

  // Cursor pagination: append the next page. The catalog used to silently cap
  // at the first 60 tracks because next_cursor was discarded.
  const loadMore = useCallback(async () => {
    if (!results.nextCursor || loadingMore) return;
    const seq = requestSeq.current;
    const q = results.q;
    setLoadingMore(true);
    try {
      const data = await fetchLibraryTracks({ q, cursor: results.nextCursor, limit: PAGE_LIMIT });
      if (seq !== requestSeq.current) return; // a new search reset the list
      setResults((prev) => {
        const seen = new Set(prev.tracks.map((t) => t.id));
        return {
          ...prev,
          tracks: [...prev.tracks, ...(data.tracks || []).map(trackToCard).filter((t) => !seen.has(t.id))],
          nextCursor: data.next_cursor || null,
        };
      });
    } catch (err) {
      console.error('Failed to load more tracks:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [results.nextCursor, results.q, loadingMore]);

  useEffect(() => {
    document.body.classList.toggle('modal-open', drawerOpen);
    return () => document.body.classList.remove('modal-open');
  }, [drawerOpen]);

  const { tracks, error } = results;
  const loading = loadingQ !== null;

  // Client-side filtering: AND across groups, OR within a group. The
  // instrument chips and the Instrument checkbox group act as one OR-group on
  // the parts derived from thumb_data.stems.
  const visibleTracks = useMemo(() => {
    const instrumentSet = new Set([...activeChips, ...filters.instrument]);
    const wantedFormats = [...filters.format].map((label) => FORMAT_FILTER_MAP[label]);
    return tracks.filter((t) => {
      if (instrumentSet.size > 0 && !t.parts.some((p) => instrumentSet.has(p))) return false;
      if (wantedFormats.length > 0 && !wantedFormats.some((f) => t.formats.includes(f))) return false;
      if (filters.length.size > 0 && !filters.length.has(lengthBucket(t.length))) return false;
      return true;
    });
  }, [tracks, activeChips, filters]);

  const { formatSections, discoverySections } = useMemo(() => {
    const byPopularity = [...visibleTracks].sort((a, b) => b.popularity - a.popularity);
    const byNewest = [...visibleTracks].sort(
      (a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()
    );
    // Trending uses only real backend engagement signals.
    const byTrending = [...visibleTracks].sort(
      (a, b) => b.popularity - a.popularity || b.plays - a.plays || b.downloads - a.downloads
    );
    // Sheet/MIDI sections only contain tracks that actually ship that format;
    // Section renders nothing when a list is empty.
    const formatRails: {
      key: string;
      eyebrow: string;
      title: string;
      subtitle: string;
      variant: CardVariant;
      filterLabel: string;
      songs: SongCardModel[];
    }[] = [
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
    ];
    return {
      formatSections: formatRails,
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

  const sidebarNode = (close: (() => void) | null) => (
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
            action={buildLocalePath(locale, '/explore/search')}
          />

          {loading && (
            <>
              <SkeletonSection />
              <SkeletonSection />
            </>
          )}

          {!loading && error && <ExploreError message={error} onRetry={() => loadTracks(results.q)} />}

          {isEmpty && (
            <ExploreEmpty
              query={results.q || (activeChips.size > 0 ? [...activeChips].join(', ') : '')}
              onClear={() => {
                setQuery('');
                setActiveChips(new Set());
                setFilters(emptyFilters());
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
                  viewAllHref={searchHref({ format: FORMAT_PARAM_BY_LABEL[s.filterLabel], sort: 'popular' })}
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
                  viewAllHref={searchHref({ sort: s.sort })}
                />
              ))}

              {/* Search results are rank-ordered while the cursor paginates by
                  publish date, so Load More would skip/repeat rows mid-search;
                  only offer it for the browse (no-query) view. */}
              {results.nextCursor && !results.q && (
                <div className="explore-load-more">
                  <button
                    type="button"
                    className="explore-load-more-btn"
                    onClick={loadMore}
                    disabled={loadingMore}
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
}
