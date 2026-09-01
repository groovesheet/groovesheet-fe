import { capitalize } from './constants';

/**
 * Map a backend library track (GET /api/library/tracks) to the card model
 * SongCard renders. Shared by Explore and the song page's related rails so
 * both surfaces show the same real cover art, score previews and waveform
 * thumbnails instead of drifting into per-page card shapes.
 */
export default function trackToCard(track) {
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
    // Capitalized for display + chip matching ('drums' → 'Drums').
    parts: Object.keys(stems).map(capitalize),
    popularity: track.popularity ?? 0,
    publishedAt: track.published_at || null,
    plays: track.plays ?? 0,
    downloads: track.downloads ?? 0,
    owner: track.owner || null,
  };
}
