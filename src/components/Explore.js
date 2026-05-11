import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MagnifyingGlass } from '@phosphor-icons/react';
import Header from './layout/Header';
import Footer from './layout/Footer';
import TrackCard from './TrackCard';
import './Explore.css';

// Fixture catalog. Replaced by GET /library/tracks once the backend lands.
// Cover URLs are real Spotify CDN URLs from the social pipeline's existing runs
// so the layout iterates against real album art.
const FIXTURE_TRACKS = [
  {
    id: 'fixture-1',
    spotify_id: '3ZffCQKLFLUvYM59XKLbVm',
    title: 'Wake Me Up When September Ends',
    artist: 'Green Day',
    year: 2004,
    cover_url:
      'https://i.scdn.co/image/ab67616d0000b273dc30583ba717007b00cceb25',
  },
  {
    id: 'fixture-2',
    spotify_id: '5TpPSTItCwtZ8Sltr3vdzm',
    title: 'Last Night on Earth',
    artist: 'Green Day',
    year: 2009,
    cover_url:
      'https://i.scdn.co/image/ab67616d0000b273c2ced39899b0d67cd5a724fa',
  },
  {
    id: 'fixture-3',
    spotify_id: '5qqabIl2vWzo9ApSC317sa',
    title: 'Wonderwall (Remastered)',
    artist: 'Oasis',
    year: 1995,
    cover_url:
      'https://i.scdn.co/image/ab67616d0000b27395ed03898e8a9e904baa45e6',
  },
  {
    id: 'fixture-4',
    spotify_id: '0lvhEsN1zkMzfp2M1o17yy',
    title: 'Holiday',
    artist: 'Green Day',
    year: 2024,
    cover_url:
      'https://i.scdn.co/image/ab67616d0000b273e7e7a06f7f85b02bcd72ab95',
  },
  {
    id: 'fixture-5',
    spotify_id: '70LcF31zb1H0PyJoS1Sx1r',
    title: 'Creep',
    artist: 'Radiohead',
    year: 1993,
    cover_url:
      'https://i.scdn.co/image/ab67616d0000b273de3c04b5fc750b68899b20a9',
  },
];

export const Explore = ({ onLoginClick }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTracks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return FIXTURE_TRACKS;
    return FIXTURE_TRACKS.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const handleBack = () => {
    navigate('/');
  };

  const handleTrackClick = (track) => {
    // Detail view comes after backend lands. For now, log so we know clicks work.
    // eslint-disable-next-line no-console
    console.log('track clicked', track);
  };

  return (
    <div className="explore-page">
      <Header onLoginClick={onLoginClick} />

      <div className="explore-container">
        <div className="explore-content">
          <button className="back-button" onClick={handleBack}>
            <ArrowLeft size={35} weight="regular" />
            <span>Back</span>
          </button>

          <div className="explore-main">
            <div className="explore-header">
              <div className="explore-title-section">
                <h1 className="explore-title">Explore the Library</h1>
              </div>
              <div className="explore-info">
                <p>
                  Browse stems separated from a daily-curated playlist. Sign in
                  to download lossless FLAC.
                </p>
              </div>
            </div>

            <div className="explore-sections">
              <div className="search-bar">
                <MagnifyingGlass size={32} weight="regular" />
                <input
                  type="text"
                  placeholder="Search by song or artist"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {filteredTracks.length === 0 ? (
                <div className="explore-section">
                  <p className="explore-empty">
                    No tracks match "{searchQuery}".
                  </p>
                </div>
              ) : (
                <div className="explore-section">
                  <div className="tracks-grid">
                    {filteredTracks.map((track) => (
                      <TrackCard
                        key={track.id}
                        title={track.title}
                        artist={track.artist}
                        year={track.year}
                        coverUrl={track.cover_url}
                        onClick={() => handleTrackClick(track)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Explore;
