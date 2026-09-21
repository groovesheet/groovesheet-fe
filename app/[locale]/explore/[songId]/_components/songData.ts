/**
 * Pure helpers over a library track, shared by the song page's server code
 * (metadata, JSON-LD) and its client components. No React, no browser APIs.
 */
import type { LibraryAsset } from '@/components/player/types';
import type { LibraryTrack } from '@/lib/types';

/** One entry of LibraryTrack.assets, with the fields the song page reads. */
export interface SongAsset extends LibraryAsset {
  id?: string;
  note_view?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const optionalString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
const nullableString = (value: unknown): string | null | undefined =>
  typeof value === 'string' ? value : value === null ? null : undefined;

/** `track.assets` is untyped JSON on LibraryTrack; narrow it once, here. */
export function trackAssets(track: LibraryTrack | null | undefined): SongAsset[] {
  const raw = track ? track.assets : null;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((a) => ({
    ...a,
    id: optionalString(a.id),
    asset_type: optionalString(a.asset_type),
    stem_name: nullableString(a.stem_name),
    format: nullableString(a.format),
    stream_url: nullableString(a.stream_url),
    note_view: nullableString(a.note_view),
  }));
}

/** Stable identity of an asset across refetches (presigned URLs change, ids do not). */
export function assetKey(asset: SongAsset): string {
  return asset.id || `${asset.asset_type || ''}|${asset.format || ''}|${asset.stem_name || ''}`;
}

/** True audio duration: thumb_data.duration_sec, not the Spotify metadata one. */
export function trackDurationSec(track: Pick<LibraryTrack, 'thumb_data' | 'duration_sec'>): number {
  return (track.thumb_data && track.thumb_data.duration_sec) || track.duration_sec || 0;
}

/** The path a track is canonical at: its stable slug when it has one. */
export function trackPath(track: Pick<LibraryTrack, 'id' | 'slug'>): string {
  return `/explore/${encodeURIComponent(track.slug || track.id)}`;
}

/**
 * Titled for the notation cluster, not the brand. "drum sheet music" and its
 * phrasings are ~8,100 searches/mo and the intent is "find the notation for
 * this song", which is exactly what this page answers. Song and artist lead
 * so the phrase match is front-loaded.
 */
export function songTitle(track: Pick<LibraryTrack, 'title' | 'artist'>): string {
  return track.artist ? `${track.title} by ${track.artist}: Sheet Music & MIDI` : `${track.title}: Sheet Music & MIDI`;
}

export function songDescription(track: Pick<LibraryTrack, 'title' | 'artist'>): string {
  const subject = track.artist ? `${track.title} by ${track.artist}` : track.title;
  return `Free sheet music, MIDI and isolated stems for ${subject}. AI-transcribed notation you can play along to, download or edit.`;
}

/** Seconds to an ISO 8601 duration (PT3M25S), for schema.org. */
export function isoDuration(sec: number): string | undefined {
  if (!Number.isFinite(sec) || sec <= 0) return undefined;
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `PT${m ? `${m}M` : ''}${s}S`;
}
