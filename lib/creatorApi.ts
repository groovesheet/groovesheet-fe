/**
 * Public creator-profile API helpers (/u/:username).
 *
 * Wired to the real backend (`GET /api/creators/:username`). The endpoint is
 * public: anonymous callers get `public` songs only; passing the signed-in
 * user's token lets the owner also see their `unlisted` songs + a real
 * `is_following` flag. Returned songs use the SAME card model as Explore
 * (`trackToCard` in the Explore page) so the profile grid reuses <SongCard>.
 *
 * The server-rendered profile page must call getCreatorProfile() in
 * lib/api-server.ts (anonymous, cached), then let a Client Component refetch
 * with a token for the owner-only extras. Never render is_owner/is_following
 * from the server: that page is cached for everyone (brief 5.9).
 */

import { ROLL_COLORS, capitalize } from '@/lib/exploreConstants';
import { authenticatedFetch } from '@/lib/api';
import type { CreatorProfile, CreatorSongCard, FollowState, GetToken, LibraryTrack } from '@/lib/types';

/** Normalize a username/handle for comparison + lookups (no leading @, lowercase). */
export function normalizeHandle(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
}

/**
 * Fallback creator handle for a library track that has no real `owner` block
 * (e.g. social-pipeline tracks with no linked profile). Deterministic from the
 * track's artist/id. Prefer `track.owner.username` when present.
 */
export function creatorHandleForTrack(track: Pick<LibraryTrack, 'owner' | 'artist' | 'title' | 'id'> | null | undefined): string | null {
  if (!track) return null;
  if (track.owner && track.owner.username) return normalizeHandle(track.owner.username);
  const base = String(track.artist || track.title || track.id || '');
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 14);
  return slug || null;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/** ISO timestamp -> "March 2023" (matches the design). Empty string if unparseable. */
function formatMemberSince(iso: unknown): string {
  if (!iso || typeof iso !== 'string') return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function initialsFromName(name: unknown): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Lead format -> SongCard thumb variant. */
function variantFromFormats(formats: string[] | undefined): CreatorSongCard['variant'] {
  const f = formats || [];
  if (f.includes('musicxml')) return 'sheet';
  if (f.includes('midi') || f.includes('mid')) return 'midi';
  if (f.includes('stem')) return 'stems';
  return 'sheet';
}

/**
 * Map a backend creator song (same shape as GET /api/library/tracks, plus
 * visibility/plays/downloads) to the Explore card model + profile extras.
 */
function songToCard(track: LibraryTrack): CreatorSongCard {
  const stems = (track.thumb_data && track.thumb_data.stems) || {};
  const parts = Object.keys(stems).map((s) => capitalize(s));
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    length: (track.thumb_data && track.thumb_data.duration_sec) || track.duration_sec,
    year: track.year || null,
    coverUrl: track.cover_url || null,
    previewUrls: track.preview_urls || {},
    formats: track.formats || [],
    thumbData: track.thumb_data || null,
    parts,
    popularity: track.popularity ?? 0,
    publishedAt: track.published_at || null,
    // Profile-specific extras the grid + toolbar read.
    variant: variantFromFormats(track.formats),
    plays: track.plays ?? 0,
    downloads: track.downloads ?? 0,
    visibility: track.visibility || 'public',
    rollColor: ROLL_COLORS[parts[0]] || ROLL_COLORS.Other,
  };
}

/** The raw GET /creators/:username payload, as far as the mapper reads it. */
export interface CreatorResponse {
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  member_since?: string | null;
  links?: CreatorProfile['links'] | null;
  is_owner?: boolean;
  is_following?: boolean;
  stats?: { followers?: number } | null;
  songs?: LibraryTrack[];
  [key: string]: unknown;
}

/**
 * Pure mapping from the API payload to the profile model. Shared by the
 * browser fetcher below and the server fetcher in lib/api-server.ts, so the
 * server-rendered page and the client refetch agree field for field.
 */
export function mapCreatorResponse(data: CreatorResponse): CreatorProfile {
  const songs = Array.isArray(data.songs) ? data.songs.map(songToCard) : [];
  return {
    username: data.username,
    display_name: data.display_name || data.username,
    avatar_url: data.avatar_url || null,
    initials: initialsFromName(data.display_name || data.username),
    bio: data.bio || '',
    member_since: formatMemberSince(data.member_since),
    links: data.links || { website: null, youtube: null, instagram: null },
    is_owner: !!data.is_owner,
    is_following: !!data.is_following,
    stats: { followers: (data.stats && data.stats.followers) || 0 },
    songs,
  };
}

/**
 * Fetch a public creator profile by username, in the browser.
 *
 * Returns `null` when the creator does not exist (drives the 404 state) or on
 * any network/5xx error. Pass `getToken` (from useAuth) so the owner sees their
 * unlisted songs and a real `is_following`.
 */
export async function fetchCreatorProfile(username: string, getToken: GetToken | null = null): Promise<CreatorProfile | null> {
  const handle = normalizeHandle(username);
  if (!handle || handle === 'unknown') return null;

  let response: Response;
  try {
    if (getToken) {
      response = await authenticatedFetch(
        `/api/creators/${encodeURIComponent(handle)}`,
        { method: 'GET', headers: { Accept: 'application/json' } },
        getToken,
      );
    } else {
      response = await fetch(`/api/creators/${encodeURIComponent(handle)}`, {
        headers: { Accept: 'application/json' },
      });
    }
  } catch {
    return null;
  }

  if (response.status === 404) return null;
  if (!response.ok) return null;

  return mapCreatorResponse((await response.json()) as CreatorResponse);
}

/** Follow a creator. Returns `{ is_following, followers }`. */
export async function followCreator(username: string, getToken: GetToken): Promise<FollowState> {
  const handle = normalizeHandle(username);
  const response = await authenticatedFetch(
    `/api/creators/${encodeURIComponent(handle)}/follow`,
    { method: 'POST', headers: { Accept: 'application/json' } },
    getToken,
  );
  return response.json() as Promise<FollowState>;
}

/** Unfollow a creator. Returns `{ is_following, followers }`. */
export async function unfollowCreator(username: string, getToken: GetToken): Promise<FollowState> {
  const handle = normalizeHandle(username);
  const response = await authenticatedFetch(
    `/api/creators/${encodeURIComponent(handle)}/follow`,
    { method: 'DELETE', headers: { Accept: 'application/json' } },
    getToken,
  );
  return response.json() as Promise<FollowState>;
}
