/**
 * Pure helpers over a library track, shared by the song page's server code
 * (metadata, JSON-LD) and its client components. No React, no browser APIs.
 */
import type { LibraryAsset } from '@/components/player/types';
import { hubsOfKind } from '@/lib/seo/instrumentHubs';
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

// --- per-instrument song pages ------------------------------------------------
//
// /explore/{song}/drums, /piano and /bass. One URL per part GrooveSheet
// actually transcribed, because the phrase people search is "{song} drum sheet
// music", not "{song} sheet music", and a single page cannot carry all three.
//
// The rule that keeps this on the right side of Google's scaled-content
// guidance is `scoredInstruments`: a page exists only where the score exists.
// Generating /piano for a track with no piano score would be publishing empty
// pages at scale, which is the behaviour that policy targets.

/** URL segments, in the order the hubs use. Never guitar or vocals: no model. */
export const SONG_INSTRUMENTS: readonly string[] = hubsOfKind('notation').map((h) => h.slug);

/** Instrument as it reads before "sheet music": drums -> "Drum". */
export function instrumentAdjective(instrument: string): string {
  const hub = hubsOfKind('notation').find((h) => h.slug === instrument);
  const word = hub ? hub.adjective : instrument;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * The parts of this track that have an actual score, as URL segments.
 *
 * MusicXML, and deliberately not MIDI. The two are not interchangeable here:
 * the player's "Sheet music" tab reads MusicXML and is disabled without it, and
 * the PDF is engraved from the same file, so a part with MIDI alone has a piano
 * roll and nothing to read. Measured over 94 library records on 25 Sep 2026:
 * drums had MusicXML on all 88 it was transcribed for, piano on 35 of 71, and
 * bass on 0 of 45. Gating on MIDI would have published a "Bass Sheet Music"
 * page, with that title and that description, for every bass track in the
 * catalogue and a disabled score tab on each.
 *
 * Note this is a stricter test than the `?notation=` filter behind the
 * instrument hubs, which accepts either format. The hub is a listing; this
 * decides whether a page claiming sheet music may exist.
 */
export function scoredInstruments(track: LibraryTrack | null | undefined): string[] {
  const names = new Set(
    trackAssets(track)
      .filter((a) => a.asset_type === 'musicxml')
      .map((a) => (a.stem_name || '').toLowerCase())
  );
  return SONG_INSTRUMENTS.filter((i) => names.has(i));
}

export const hasScoreFor = (track: LibraryTrack | null | undefined, instrument: string): boolean =>
  scoredInstruments(track).includes(instrument);

export function songInstrumentPath(track: Pick<LibraryTrack, 'id' | 'slug'>, instrument: string): string {
  return `${trackPath(track)}/${instrument}`;
}

/**
 * Bare <title>; the layout appends " | GrooveSheet". The instrument leads the
 * qualifier so the searched phrase survives Google's truncation on a long
 * song name.
 */
export function songInstrumentTitle(track: Pick<LibraryTrack, 'title' | 'artist'>, instrument: string): string {
  const subject = track.artist ? `${track.title} by ${track.artist}` : track.title;
  return `${subject}: ${instrumentAdjective(instrument)} Sheet Music`;
}

/**
 * The formats this part can actually be exported as, in the order the page
 * offers them. Read off the record rather than written out, so the description
 * cannot promise a MIDI or a stem the track does not have.
 */
export function instrumentExportFormats(track: LibraryTrack | null | undefined, instrument: string): string[] {
  const part = instrument.toLowerCase();
  const types = new Set(
    trackAssets(track)
      .filter((a) => (a.stem_name || '').toLowerCase() === part)
      .map((a) => a.asset_type || '')
  );
  const formats: string[] = [];
  // PDF and MusicXML are the same engraving, so both hang off the MusicXML.
  if (types.has('musicxml')) formats.push('PDF', 'MusicXML');
  if (types.has('midi')) formats.push('MIDI');
  return formats;
}

function joinList(values: string[]): string {
  if (values.length <= 1) return values.join('');
  return `${values.slice(0, -1).join(', ')} or ${values[values.length - 1]}`;
}

export function songInstrumentDescription(track: LibraryTrack, instrument: string): string {
  const subject = track.artist ? `${track.title} by ${track.artist}` : track.title;
  const adjective = instrumentAdjective(instrument).toLowerCase();
  const formats = instrumentExportFormats(track, instrument);
  const exports = formats.length ? ` and export ${joinList(formats)}` : '';
  const stem = trackAssets(track).some(
    (a) => a.asset_type === 'stem' && (a.stem_name || '').toLowerCase() === instrument.toLowerCase()
  )
    ? ` Isolated ${adjective} stem included.`
    : '';
  return `Free ${adjective} sheet music for ${subject}: read the score, hear it play against the recording${exports}.${stem}`;
}

/** The instrument half of the page's h1. */
export const songInstrumentHeading = (instrument: string): string =>
  `${instrumentAdjective(instrument)} sheet music`;
