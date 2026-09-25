import { capitalize } from '@/lib/exploreConstants';
import type { LibraryThumbData, LibraryTrack, LibraryTrackOwner } from '@/lib/types';

/**
 * The card model SongCard and ResultRow render. Creator profiles map their
 * songs to a superset of it (CreatorSongCard in lib/types), so the optional
 * fields are the ones only the library listing carries.
 */
export interface SongCardModel {
  id: string;
  title: string;
  artist: string | null | undefined;
  /** Seconds. */
  length: number | null | undefined;
  year: number | null;
  coverUrl: string | null;
  thumbUrl?: string | null;
  /** Server-rendered previews per rail variant (sheet, midi, stems). */
  previewUrls: Record<string, string>;
  formats: string[];
  thumbData: LibraryThumbData | null;
  /** Capitalized stem names, e.g. 'Drums'. */
  parts: string[];
  popularity: number;
  publishedAt: string | null;
  plays: number;
  downloads: number;
  owner?: LibraryTrackOwner | null;
  /** Only the procedural thumbnails read it; the API does not send one today. */
  difficulty?: string;
}

/**
 * Map a backend library track (GET /library/tracks) to the card model. Shared
 * by Explore, the results page and the song page's related rails so every
 * surface shows the same cover art, score previews and waveform thumbnails.
 */
export default function trackToCard(track: LibraryTrack): SongCardModel {
  const stems = (track.thumb_data && track.thumb_data.stems) || {};
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    length: (track.thumb_data && track.thumb_data.duration_sec) || track.duration_sec,
    year: track.year || null,
    coverUrl: track.cover_url || null,
    thumbUrl: track.thumb_url || null,
    previewUrls: track.preview_urls || {},
    formats: track.formats || [],
    thumbData: track.thumb_data || null,
    // Capitalized for display and chip matching ('drums' to 'Drums').
    parts: Object.keys(stems).map(capitalize),
    popularity: track.popularity ?? 0,
    publishedAt: track.published_at || null,
    plays: track.plays ?? 0,
    downloads: track.downloads ?? 0,
    owner: track.owner || null,
  };
}

/** Peak points per stem the thumbnails draw (StemThumb's bar count). */
const THUMB_SAMPLES = 48;

/** Max-pool 0..100 peaks down to `bars` values, as StemThumb does when drawing. */
function poolPeaks(points: number[], bars: number): number[] {
  const n = points.length;
  if (n <= bars) return points;
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const start = Math.floor((i * n) / bars);
    const end = Math.max(start + 1, Math.floor(((i + 1) * n) / bars));
    let m = 0;
    for (let j = start; j < end; j++) m = Math.max(m, points[j] || 0);
    out.push(m);
  }
  return out;
}

/**
 * thumb_data trimmed to what a card draws: each stem's 200 peaks pooled to the
 * 48 bars StemThumb renders (it pools the same way, so the picture is
 * identical) and the duration. The server pages pass dozens of tracks to the
 * browser, and the full peaks were most of that payload.
 */
export function compactThumbData(thumbData: LibraryThumbData | null | undefined): LibraryThumbData | null {
  if (!thumbData) return null;
  const stems: Record<string, number[]> = {};
  for (const [name, points] of Object.entries(thumbData.stems || {})) {
    if (Array.isArray(points)) stems[name] = poolPeaks(points, THUMB_SAMPLES);
  }
  return {
    ...(thumbData.stems ? { stems } : {}),
    ...(typeof thumbData.duration_sec === 'number' ? { duration_sec: thumbData.duration_sec } : {}),
  };
}

/** A card for a server page: the same model with compact thumbnail data. */
export function serverCard(track: LibraryTrack): SongCardModel {
  const card = trackToCard(track);
  return { ...card, thumbData: compactThumbData(card.thumbData) };
}

/**
 * A related track for the song page's rails and sidebar, with only the fields
 * they read. Keeps the player's own track (full peaks, assets) the only large
 * object in that page's payload.
 */
export function slimTrack(track: LibraryTrack): LibraryTrack {
  return {
    id: track.id,
    slug: track.slug,
    title: track.title,
    artist: track.artist,
    year: track.year,
    duration_sec: track.duration_sec,
    popularity: track.popularity,
    plays: track.plays,
    downloads: track.downloads,
    published_at: track.published_at,
    formats: track.formats,
    cover_url: track.cover_url,
    thumb_url: track.thumb_url,
    preview_urls: track.preview_urls,
    thumb_data: compactThumbData(track.thumb_data),
    owner: track.owner,
  };
}
