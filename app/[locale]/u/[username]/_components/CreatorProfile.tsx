'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import Header from '@/components/chrome/Header';
import Footer from '@/components/chrome/Footer';
import { useLoginModal } from '@/components/chrome/LoginModalProvider';
import { fmtCount } from '@/lib/exploreConstants';
import { fetchCreatorProfile, followCreator, unfollowCreator } from '@/lib/creatorApi';
import { useUser, useAuth } from '@/lib/auth';
import { Link } from '@/lib/navigation';
import type { CreatorProfile as CreatorProfileData } from '@/lib/types';
import SongCard from '../../../explore/_components/SongCard';
import './CreatorProfile.css';

type SortKey = 'newest' | 'plays' | 'downloads';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'plays', label: 'Most played' },
  { key: 'downloads', label: 'Most downloaded' },
];

const INSTRUMENT_CHIPS: [string, string][] = [
  ['all', 'All'],
  ['drums', 'Drums'],
  ['piano', 'Piano'],
  ['bass', 'Bass'],
  ['vocals', 'Vocals'],
];

const publishedTime = (iso: string | null) => (iso ? new Date(iso).getTime() || 0 : 0);

/**
 * The /u/:username body. The server renders the anonymous view (public songs,
 * no owner or follow state), which is what every visitor and crawler gets.
 * Once the browser knows who is signed in, the profile is refetched with their
 * token, so the owner sees unlisted songs and "Edit profile" and a follower
 * sees their real follow state. None of that is ever in the cached HTML.
 */
export default function CreatorProfile({ initialProfile }: { initialProfile: CreatorProfileData }) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { openLoginModal } = useLoginModal();

  const [profile, setProfile] = useState(initialProfile);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [instrument, setInstrument] = useState('all');
  const [following, setFollowing] = useState(initialProfile.is_following);
  const [followers, setFollowers] = useState(initialProfile.stats.followers);
  const [followBusy, setFollowBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  // Whether `profile` is a signed-in view, so signing out goes back to the
  // anonymous one instead of leaving the owner's unlisted songs on screen.
  const personalized = useRef(false);

  const username = initialProfile.username;
  useEffect(() => {
    if (!user && !personalized.current) return undefined;
    let active = true;
    fetchCreatorProfile(username, user ? getToken : null).then((data) => {
      if (!active || !data) return;
      personalized.current = Boolean(user);
      setProfile(data);
      setFollowing(data.is_following);
      setFollowers(data.stats.followers);
    });
    return () => {
      active = false;
    };
  }, [username, user, getToken]);

  const handleFollowToggle = async () => {
    if (!user) {
      openLoginModal();
      return;
    }
    if (followBusy) return;
    const next = !following;
    // Optimistic flip.
    setFollowing(next);
    setFollowers((c) => Math.max(0, c + (next ? 1 : -1)));
    setFollowBusy(true);
    try {
      const res = next ? await followCreator(profile.username, getToken) : await unfollowCreator(profile.username, getToken);
      if (res && typeof res.followers === 'number') {
        setFollowing(!!res.is_following);
        setFollowers(res.followers);
      }
    } catch {
      // Revert on failure.
      setFollowing(!next);
      setFollowers((c) => Math.max(0, c + (next ? -1 : 1)));
    } finally {
      setFollowBusy(false);
    }
  };

  // Ownership comes from the API (matched against the auth token); deriving
  // it client-side from the email local-part breaks the moment a user picks a
  // username that differs from their email.
  const isOwner = profile.is_owner;

  // The server already visibility-filters songs per caller (owner also gets
  // unlisted; visitors get public only); render what it returns.
  const listed = profile.songs;

  const totals = useMemo(() => {
    const plays = listed.reduce((a, x) => a + (x.plays || 0), 0);
    const downloads = listed.reduce((a, x) => a + (x.downloads || 0), 0);
    return { published: listed.length, plays, downloads };
  }, [listed]);

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
      return publishedTime(b.publishedAt) - publishedTime(a.publishedAt);
    });
  }, [listed, instrument, query, sort]);

  const trulyEmpty = listed.length === 0;
  const searchNoResults = !trulyEmpty && cards.length === 0;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      /* clipboard unavailable; still flash the confirmation */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const { links } = profile;
  const sortLabel = SORTS.find((s) => s.key === sort)?.label;

  return (
    <div className="creator-page">
      <div className="dot-grid" />
      <Header />

      <main className="creator-main">
        {/* Header banner */}
        <section className="creator-banner">
          <div className="creator-banner-glow" />
          <div className="creator-banner-inner">
            {profile.avatar_url ? (
              // Avatars are served from storage hosts next/image is not configured for.
              // eslint-disable-next-line @next/next/no-img-element
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
                {profile.member_since && (
                  <>
                    <span className="creator-member">
                      <CalendarBlank size={15} />
                      Member since {profile.member_since}
                    </span>
                    <span className="creator-meta-sep" />
                  </>
                )}
                <div className="creator-links">
                  {links.website && (
                    <a
                      className="creator-link"
                      href={links.website}
                      aria-label="Website"
                      target="_blank"
                      rel="noreferrer noopener nofollow"
                    >
                      <Globe size={17} />
                    </a>
                  )}
                  {links.youtube && (
                    <a
                      className="creator-link"
                      href={links.youtube}
                      aria-label="YouTube"
                      target="_blank"
                      rel="noreferrer noopener nofollow"
                    >
                      <YoutubeLogo size={18} />
                    </a>
                  )}
                  {links.instagram && (
                    <a
                      className="creator-link"
                      href={links.instagram}
                      aria-label="Instagram"
                      target="_blank"
                      rel="noreferrer noopener nofollow"
                    >
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
                <Link href="/account/profile" className="cp-btn cp-btn-secondary">
                  <PencilSimple size={15} />
                  Edit profile
                </Link>
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

        {/* Empty: no published songs */}
        {trulyEmpty ? (
          <div className="creator-empty">
            <div className="creator-empty-icon">
              <MusicNotes size={30} />
            </div>
            <h2 className="creator-empty-title">No published transcriptions yet</h2>
            <p className="creator-empty-sub">
              When {profile.display_name.split(' ')[0]} publishes a transcription, it&apos;ll show up here for everyone
              to view and download.
            </p>
            {isOwner && (
              <Link href="/account/history" className="cp-btn cp-btn-primary">
                Publish from your library
                <ArrowRight size={15} />
              </Link>
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
                  {sortLabel}
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
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSort(opt.key);
                              setSortOpen(false);
                            }
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
                    <SongCard song={song} variant={song.variant} href={`/explore/${song.id}`} />
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
