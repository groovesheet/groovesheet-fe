import React, { useEffect, useMemo, useState } from 'react';
import { Funnel } from '@phosphor-icons/react';
import Header from './layout/Header';
import Footer from './layout/Footer';
import Sidebar from './explore/Sidebar';
import ExploreHeader from './explore/ExploreHeader';
import Section from './explore/Section';
import { SONGS, ROWS, FILTERS } from '../mocks/exploreData';
import { useLocalizedNavigate } from '../i18n/locale';
import './Explore.css';

function matchesQuery(song, q) {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    song.title.toLowerCase().includes(needle) ||
    song.artist.toLowerCase().includes(needle) ||
    song.primary.toLowerCase().includes(needle) ||
    song.genre.toLowerCase().includes(needle)
  );
}

export const Explore = ({ onLoginClick }) => {
  const navigate = useLocalizedNavigate();
  const handleCardClick = (track) => navigate(`/explore/${track.id}`);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    difficulty: new Set(),
    instrument: new Set(),
    genre: new Set(),
    format: new Set(),
    length: new Set(),
  });
  const [activeChips, setActiveChips] = useState(new Set(['Piano']));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleChip = (c) =>
    setActiveChips((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  const songsById = useMemo(() => {
    const map = {};
    SONGS.forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, []);

  const resolve = (ids) =>
    ids
      .map((id) => songsById[id])
      .filter(Boolean)
      .filter((s) => matchesQuery(s, query));

  useEffect(() => {
    document.body.classList.toggle('modal-open', drawerOpen);
    return () => document.body.classList.remove('modal-open');
  }, [drawerOpen]);

  const formatSections = [
    {
      key: 'sheet',
      title: 'Popular sheet music',
      subtitle: 'Engraved, downloadable as PDF and MusicXML.',
      variant: 'sheet',
      songs: resolve(ROWS.sheet),
    },
    {
      key: 'midi',
      title: 'Popular MIDI',
      subtitle: 'Multi-track .mid files. Drop into your DAW.',
      variant: 'midi',
      songs: resolve(ROWS.midi),
    },
    {
      key: 'stems',
      title: 'Popular stems',
      subtitle: 'Isolated vocals, drums, bass, keys.',
      variant: 'stems',
      songs: resolve(ROWS.stems),
    },
  ];

  const discoverySections = [
    {
      key: 'trending',
      title: 'Trending now',
      subtitle: 'What working musicians are downloading this week.',
      songs: resolve(ROWS.trending),
    },
    {
      key: 'new',
      title: 'New this week',
      subtitle: 'Fresh transcriptions, less than 7 days old.',
      songs: resolve(ROWS.newWeek),
    },
    {
      key: 'learners',
      title: 'For learners',
      subtitle: 'Beginner-friendly picks across instruments.',
      songs: resolve(ROWS.learners),
      accent: true,
    },
  ];

  const classicalSongs = SONGS.filter((s) => s.genre === 'Classical').filter((s) =>
    matchesQuery(s, query),
  );
  const animeSongs = SONGS.filter((s) => s.genre === 'Anime/Game').filter((s) =>
    matchesQuery(s, query),
  );

  const sidebarNode = (close) => (
    <Sidebar
      filters={filters}
      setFilters={setFilters}
      popularChips={FILTERS.popular}
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

          {discoverySections.map((s) => (
            <Section
              key={s.key}
              title={s.title}
              subtitle={s.subtitle}
              songs={s.songs}
              accent={s.accent}
              onCardClick={handleCardClick}
            />
          ))}

          {classicalSongs.length > 0 && (
            <Section
              title="Best of classical"
              subtitle="Curated by our editorial team."
              songs={classicalSongs}
              onCardClick={handleCardClick}
            />
          )}
          {animeSongs.length > 0 && (
            <Section
              title="Best of anime & game"
              subtitle="Curated by our editorial team."
              songs={animeSongs}
              onCardClick={handleCardClick}
            />
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
};

export default Explore;
