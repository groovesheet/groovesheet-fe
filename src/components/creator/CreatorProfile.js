import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  CalendarBlank,
  Globe,
  YoutubeLogo,
  InstagramLogo,
  MagnifyingGlass,
  CaretDown,
  Check,
  MusicNotes,
  ArrowRight,
  PencilSimple,
  ShareNetwork,
} from '@phosphor-icons/react';
import Header from '../layout/Header';
import Footer from '../layout/Footer';
import SongCard from '../explore/SongCard';
import { SkeletonPanel } from '../ui/SkeletonPanel';
import { fmtCount } from '../explore/constants';
import {
  fetchCreatorProfile,
  normalizeHandle,
  followCreator,
  unfollowCreator,
} from '../../utils/creatorApi';
import { useUser, useAuth } from '../../auth';
import { useLocalizedNavigate, LocalizedLink } from '../../i18n/locale';
import usePageMeta from '../../hooks/usePageMeta';
import './CreatorProfile.css';

const SORTS = [
  { key: 'newest', label: 'Newest' },
  { key: 'plays', label: 'Most played' },
  { key: 'downloads', label: 'Most downloaded' },
];

const INSTRUMENT_CHIPS = [
  ['all', 'All'],
  ['drums', 'Drums'],
  ['piano', 'Piano'],
  ['bass', 'Bass'],
  ['vocals', 'Vocals'],
];

function CreatorProfile({ onLoginClick }) {
  const { username } = useParams();
  const navigate = useLocalizedNavigate();
  const { user } = useUser();
  const { getToken } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  usePageMeta(
    profile ? (profile.display_name || `@${profile.username}`) : null,
    profile?.bio || (profile ? `Transcriptions published by ${profile.display_name || profile.username} on GrooveSheet.` : null),
    // A creator link should unfurl as that creator, not the site logo.
    profile?.avatar_url || undefined
  );

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [instrument, setInstrument] = useState('all');
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [followBusy, setFollowBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    // Pass the token (when signed in) so the owner sees unlisted songs +
    // a real is_following flag.
    fetchCreatorProfile(username, user ? getToken : null)
      .then((data) => {
        if (!active) return;
        if (!data) {
          setNotFound(true);
          setProfile(null);
        } else {
          setProfile(data);
          setFollowing(!!data.is_following);
          setFollowers((data.stats && data.stats.followers) || 0);
        }
      })
      .catch(() => active && setNotFound(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [username, user, getToken]);

  const handleFollowToggle = async () => {
    if (!user) {
      if (onLoginClick) onLoginClick();
      return;
    }
    if (followBusy) return;
    const next = !following;
    // Optimistic flip.
    setFollowing(next);
    setFollowers((c) => Math.max(0, c + (next ? 1 : -1)));
    setFollowBusy(true);
    try {
      const res = next
        ? await followCreator(profile.username, getToken)
        : await unfollowCreator(profile.username, getToken);
      if (res && typeof res.followers === 'number') {
        setFollowing(!!res.is_following);
        setFollowers(res.followers);
      }
    } catch (_) {
      // Revert on failure.
      setFollowing(!next);
      setFollowers((c) => Math.max(0, c + (next ? -1 : 1)));
    } finally {
      setFollowBusy(false);
    }
  };

  // Ownership comes from the API (matched against the auth token) — deriving
  // it client-side from the email local-part breaks the moment a user picks a
  // username that differs from their email.
  const isOwner = !!profile?.is_owner;

  // The server already visibility-filters songs per caller (owner also gets
  // unlisted; visitors get public only) — render what it returns.
  const listed = useMemo(() => (profile ? profile.songs : []), [profile]);

  // Prefer server-computed stats; recompute only as a fallback.
  const totals = useMemo(() => {
    const s = profile?.stats;
    if (s && typeof s.published_count === 'number') {
      return { published: s.published_count, plays: s.total_plays || 0, downloads: s.total_downloads || 0 };
    }
    const plays = listed.reduce((a, x) => a + (x.plays || 0), 0);
    const downloads = listed.reduce((a, x) => a + (x.downloads || 0), 0);
    return { published: listed.length, plays, downloads };
  }, [profile, listed]);

  const cards = useMemo(() => {
    let out = listed;
    if (instrument !== 'all') {
      out = out.filter((s) => s.parts.map((p) => p.toLowerCase()).includes(instrument));
    }
    const q = query.trim().toLowerCase();
    if (q) out = out.filter((s) => s.title.toLowerCase().includes(q));
    return [...out].sort((a, b) => {
      if (sort === 'plays') return b.plays - a.plays;
      if (sort === 'downloads') return b.downloads - a.downloads;
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    });
  }, [listed, instrument, query, sort]);

  const trulyEmpty = !!profile && listed.length === 0;
  const searchNoResults = !!profile && !trulyEmpty && cards.length === 0;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch (_) {
      /* clipboard unavailable — still flash the confirmation */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="creator-page">
        <div className="dot-grid" />
        <Header onLoginClick={onLoginClick} />
        <main className="creator-main">
          <SkeletonPanel height={196} style={{ borderRadius: 13, marginBottom: 60 }} />
          <SkeletonPanel height={28} style={{ width: 240, marginBottom: 24 }} />
          <div className="creator-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonPanel key={i} height={300} style={{ borderRadius: 13 }} />
            ))}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 404 — creator not found
  // -------------------------------------------------------------------------
  if (notFound || !profile) {
    return (
      <div className="creator-page">
        <div className="dot-grid" />
        <Header onLoginClick={onLoginClick} />
        <main className="creator-main">
          <div className="creator-notfound">
            <div className="creator-404">404</div>
            <h1 className="creator-title">We couldn&apos;t find that creator</h1>
            <p className="creator-notfound-sub">
              The profile <span>@{normalizeHandle(username) || 'unknown'}</span> doesn&apos;t exist,
              or it may have been removed.
            </p>
            <LocalizedLink to="/explore" className="cp-btn cp-btn-primary">
              Browse Explore
            </LocalizedLink>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Profile
  // -------------------------------------------------------------------------
  const { links } = profile;

  return (
    <div className="creator-page">
      <div className="dot-grid" />
      <Header onLoginClick={onLoginClick} />

      <main className="creator-main">
        {/* Header banner */}
        <section className="creator-banner">
          <div className="creator-banner-glow" />
          <div className="creator-banner-inner">
            {profile.avatar_url ? (
              <img className="creator-avatar" src={profile.avatar_url} alt={profile.display_name} />
            ) : (
              <div className="creator-avatar creator-avatar-fallback">{profile.initials}</div>
            )}

            <div className="creator-identity">
              {isOwner && (
                <span className="creator-owner-hint">
                  <span className="creator-owner-dot" />
                  This is your public profile
                </span>
              )}
              <h1 className="creator-name">{profile.display_name}</h1>
              <div className="creator-handle">@{profile.username}</div>

              <p className="creator-bio">{profile.bio}</p>

              <div className="creator-meta-row">
                <span className="creator-member">
                  <CalendarBlank size={15} />
                  Member since {profile.member_since}
                </span>
                <span className="creator-meta-sep" />
                <div className="creator-links">
                  {links.website && (
                    <a className="creator-link" href={links.website} aria-label="Website"
                      target="_blank" rel="noreferrer noopener">
                      <Globe size={17} />
                    </a>
                  )}
                  {links.youtube && (
                    <a className="creator-link" href={links.youtube} aria-label="YouTube"
                      target="_blank" rel="noreferrer noopener">
                      <YoutubeLogo size={18} />
                    </a>
                  )}
                  {links.instagram && (
                    <a className="creator-link" href={links.instagram} aria-label="Instagram"
                      target="_blank" rel="noreferrer noopener">
                      <InstagramLogo size={17} />
                    </a>
                  )}
                </div>
              </div>

              <div className="creator-stats">
                <div className="creator-stat">
                  <span className="creator-stat-num">{totals.published}</span>
                  <span className="creator-stat-label">Published</span>
                </div>
                <div className="creator-stat">
                  <span className="creator-stat-num">{fmtCount(totals.plays)}</span>
                  <span className="creator-stat-label">Plays</span>
                </div>
                <div className="creator-stat">
                  <span className="creator-stat-num">{fmtCount(totals.downloads)}</span>
                  <span className="creator-stat-label">Downloads</span>
                </div>
                <div className="creator-stat">
                  <span className="creator-stat-num">{fmtCount(followers)}</span>
                  <span className="creator-stat-label">Followers</span>
                </div>
              </div>
            </div>

            <div className="creator-actions">
              {isOwner ? (
                <LocalizedLink to="/account/profile" className="cp-btn cp-btn-secondary">
                  <PencilSimple size={15} />
                  Edit profile
                </LocalizedLink>
              ) : (
                <>
                  <button
                    type="button"
                    className={`cp-btn ${following ? 'cp-btn-secondary' : 'cp-btn-primary'}`}
                    onClick={handleFollowToggle}
                    disabled={followBusy}
                  >
                    {following ? 'Following' : 'Follow'}
                  </button>
                  <button type="button" className="cp-btn cp-btn-secondary" onClick={handleShare}>
                    <ShareNetwork size={15} />
                    {copied ? 'Link copied' : 'Share'}
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Empty — no published songs */}
        {trulyEmpty ? (
          <div className="creator-empty">
            <div className="creator-empty-icon">
              <MusicNotes size={30} />
            </div>
            <h2 className="creator-empty-title">No published transcriptions yet</h2>
            <p className="creator-empty-sub">
              When {profile.display_name.split(' ')[0]} publishes a transcription, it&apos;ll show up
              here for everyone to view and download.
            </p>
            {isOwner && (
              <LocalizedLink to="/account/history" className="cp-btn cp-btn-primary">
                Publish from your library
                <ArrowRight size={15} />
              </LocalizedLink>
            )}
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="creator-toolbar-head">
              <h2 className="creator-section-title">Published</h2>
              <span className="creator-result-count">{cards.length}</span>
            </div>

            <div className="creator-toolbar">
              <div className="creator-search">
                <MagnifyingGlass size={18} />
                <input
                  type="text"
                  aria-label="Search this creator's songs"
                  placeholder="Search songs by title"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <div className="creator-sort">
                <button
                  type="button"
                  className="creator-sort-btn"
                  aria-haspopup="listbox"
                  aria-expanded={sortOpen}
                  onClick={() => setSortOpen((o) => !o)}
                >
                  <span className="creator-sort-prefix">Sort:</span>
                  {SORTS.find((s) => s.key === sort).label}
                  <CaretDown size={14} weight="bold" />
                </button>
                {sortOpen && (
                  <>
                    <div className="creator-sort-backdrop" onClick={() => setSortOpen(false)} />
                    <ul role="listbox" aria-label="Sort songs" className="creator-sort-menu">
                      {SORTS.map((opt) => (
                        <li
                          key={opt.key}
                          role="option"
                          aria-selected={sort === opt.key}
                          tabIndex={0}
                          className={`creator-sort-opt${sort === opt.key ? ' is-active' : ''}`}
                          onClick={() => {
                            setSort(opt.key);
                            setSortOpen(false);
                          }}
                        >
                          <span>{opt.label}</span>
                          {sort === opt.key && <Check size={15} weight="bold" />}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>

            <div className="creator-chips">
              {INSTRUMENT_CHIPS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={instrument === key}
                  className={`creator-chip${instrument === key ? ' is-active' : ''}`}
                  onClick={() => setInstrument(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Grid / no-results */}
            {searchNoResults ? (
              <div className="creator-empty creator-empty--search">
                <div className="creator-empty-icon">
                  <MagnifyingGlass size={26} />
                </div>
                <h2 className="creator-empty-title">No songs match your filters</h2>
                <p className="creator-empty-sub">Try a different search term or clear the filters.</p>
                <button
                  type="button"
                  className="cp-btn cp-btn-secondary"
                  onClick={() => {
                    setQuery('');
                    setInstrument('all');
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="creator-grid">
                {cards.map((song) => (
                  <div key={song.id} className="creator-card-wrap">
                    {isOwner && song.visibility === 'unlisted' && (
                      <span className="creator-unlisted">
                        <span className="creator-unlisted-dot" />
                        Unlisted
                      </span>
                    )}
                    <SongCard
                      song={song}
                      variant={song.variant}
                      onClick={(s) => navigate(`/explore/${s.id}`)}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default CreatorProfile;
