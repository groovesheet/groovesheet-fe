import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Funnel } from '@phosphor-icons/react';
import Header from './layout/Header';
import Footer from './layout/Footer';
import Sidebar from './explore/Sidebar';
import ExploreHeader from './explore/ExploreHeader';
import Section from './explore/Section';
import { SkeletonSection, ExploreEmpty, ExploreError } from './explore/ExploreStates';
import { STEM_INSTRUMENTS, capitalize } from './explore/constants';
import { fetchLibraryTracks } from '../utils/libraryApi';
import { useLocalizedNavigate } from '../i18n/locale';
import './Explore.css';

const PAGE_LIMIT = 60;
const SEARCH_DEBOUNCE_MS = 300;

/** Map a backend library track (GET /api/library/tracks) to the card model. */
function trackToCard(track) {
  const stems = (track.thumb_data && track.thumb_data.stems) || {};
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    length: track.duration_sec,
    coverUrl: track.cover_url || null,
    formats: track.formats || [],
    thumbData: track.thumb_data || null,
    // Capitalized for display + chip matching ('drums' → 'Drums').
    parts: Object.keys(stems).map(capitalize),
    popularity: track.popularity ?? 0,
    publishedAt: track.published_at || null,
  };
}

export const Explore = ({ onLoginClick }) => {
  const navigate = useLocalizedNavigate();
  const handleCardClick = (track) => navigate(`/explore/${track.id}`);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeChips, setActiveChips] = useState(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
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
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error('Failed to load library tracks:', err);
      setTracks([]);
      setError(err.message || 'Failed to load the library.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTracks(debouncedQuery);
  }, [debouncedQuery, loadTracks]);

  useEffect(() => {
    document.body.classList.toggle('modal-open', drawerOpen);
    return () => document.body.classList.remove('modal-open');
  }, [drawerOpen]);

  // Client-side instrument filter on the parts derived from thumb_data.stems.
  const visibleTracks = useMemo(() => {
    if (activeChips.size === 0) return tracks;
    return tracks.filter((t) => t.parts.some((p) => activeChips.has(p)));
  }, [tracks, activeChips]);

  const { formatSections, newSection } = useMemo(() => {
    const byPopularity = [...visibleTracks].sort((a, b) => b.popularity - a.popularity);
    const byNewest = [...visibleTracks].sort(
      (a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0),
    );
    // Sheet/MIDI sections only contain tracks that actually ship that format;
    // Section renders nothing when a list is empty.
    return {
      formatSections: [
        {
          key: 'stems',
          title: 'Popular stems',
          subtitle: 'Isolated vocals, drums, bass, keys.',
          variant: 'stems',
          songs: byPopularity.filter((t) => t.formats.includes('stem')),
        },
        {
          key: 'sheet',
          title: 'Popular sheet music',
          subtitle: 'Engraved, downloadable as PDF and MusicXML.',
          variant: 'sheet',
          songs: byPopularity.filter((t) => t.formats.includes('musicxml')),
        },
        {
          key: 'midi',
          title: 'Popular MIDI',
          subtitle: 'Multi-track .mid files. Drop into your DAW.',
          variant: 'midi',
          songs: byPopularity.filter((t) => t.formats.includes('midi')),
        },
      ],
      newSection: {
        key: 'new',
        title: 'New this week',
        subtitle: 'Fresh transcriptions, hot off the press.',
        songs: byNewest,
        accent: true,
      },
    };
  }, [visibleTracks]);

  const isEmpty = !loading && !error && visibleTracks.length === 0;

  const sidebarNode = (close) => (
    <Sidebar
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

          <ExploreHeader query={query} onQueryChange={setQuery} />

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
              }}
            />
          )}

          {!loading && !error && !isEmpty && (
            <>
              {formatSections.map((s) => (
                <Section
                  key={s.key}
                  title={s.title}
                  subtitle={s.subtitle}
                  variant={s.variant}
                  songs={s.songs}
                  onCardClick={handleCardClick}
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

              <Section
                key={newSection.key}
                title={newSection.title}
                subtitle={newSection.subtitle}
                songs={newSection.songs}
                accent={newSection.accent}
                onCardClick={handleCardClick}
              />
            </>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
};

export default Explore;
