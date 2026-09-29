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
 * The translator every copy helper here takes, with the page's locale for the
 * one thing ICU messages cannot do, which is join a list ("a, b and c",
 * "鼓、钢琴和贝斯"). Any next-intl translator scoped to the `song` namespace
 * fits: getTranslations on the server, useTranslations in the browser,
 * createTranslator in tests.
 *
 * The copy itself lives in messages/{locale}.json under `song`. Before, it was
 * English written into these functions, so /zh-CN/explore/... served English
 * titles, descriptions and facts under lang="zh-CN": three URLs per page that
 * Google saw as one English page declared three times.
 */
export interface SongT {
  (key: string, values?: Record<string, string | number>): string;
  has(key: string): boolean;
}

export interface SongCopy {
  t: SongT;
  locale: string;
}

/**
 * The forms an instrument takes in copy. In English they differ ("Drums",
 * "drums", "drum", "Drum Sheet Music"); in Chinese most of them collapse to
 * one word, and the sheet forms to one term (架子鼓谱, 爵士鼓譜).
 */
export type InstrumentForm = 'name' | 'noun' | 'adjective' | 'sheet' | 'sheetHeading' | 'sheetTitle' | 'sub';

/** One form of an instrument's name. A stem the messages do not know keeps its own. */
export function instrumentWord(t: SongT, instrument: string, form: InstrumentForm): string {
  const part = instrument.toLowerCase();
  const key = `instruments.${part}.${form}`;
  if (t.has(key)) return t(key);
  // Sheet forms exist only for the scored instruments; fall back to the name.
  if (form.startsWith('sheet') && t.has(`instruments.${part}.name`)) return t(`instruments.${part}.name`);
  return form === 'name' ? part.charAt(0).toUpperCase() + part.slice(1) : part;
}

/**
 * Every form at once, for passing into a message. Locales pick different
 * variables for the same sentence (English "the drum part" wants `adjective`,
 * Chinese "鼓声部" wants `name`), and a message that references a variable it
 * was not given fails to format, so every caller passes all of them.
 */
export function instrumentVars(t: SongT, instrument: string): Record<InstrumentForm, string> {
  const forms: InstrumentForm[] = ['name', 'noun', 'adjective', 'sheet', 'sheetHeading', 'sheetTitle', 'sub'];
  return Object.fromEntries(forms.map((f) => [f, instrumentWord(t, instrument, f)])) as Record<InstrumentForm, string>;
}

/** A list in the page's language. en-GB for English: the house style has no serial comma. */
export function joinList(locale: string, items: string[], type: 'conjunction' | 'disjunction' = 'conjunction'): string {
  const tag = locale === 'en' ? 'en-GB' : locale;
  return new Intl.ListFormat(tag, { style: 'long', type }).format(items);
}

/** "Shape of You by Ed Sheeran", "Ed Sheeran《Shape of You》". */
export function songSubject(t: SongT, track: Pick<LibraryTrack, 'title' | 'artist'>): string {
  return track.artist
    ? t('meta.subject', { title: track.title, artist: track.artist })
    : t('meta.subjectNoArtist', { title: track.title });
}

/**
 * Titled for the notation cluster, not the brand. "drum sheet music" and its
 * phrasings are ~8,100 searches/mo and the intent is "find the notation for
 * this song", which is exactly what this page answers. Song and artist lead
 * so the phrase match is front-loaded.
 */
export function songTitle(t: SongT, track: Pick<LibraryTrack, 'title' | 'artist'>): string {
  return t('meta.title', { subject: songSubject(t, track) });
}

export function songDescription(t: SongT, track: Pick<LibraryTrack, 'title' | 'artist'>): string {
  return t('meta.description', { subject: songSubject(t, track) });
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
 * song name: "…: Drum Sheet Music", "…架子鼓谱", "…爵士鼓譜".
 */
export function songInstrumentTitle(t: SongT, track: Pick<LibraryTrack, 'title' | 'artist'>, instrument: string): string {
  return t('meta.partTitle', { subject: songSubject(t, track), sheetTitle: instrumentWord(t, instrument, 'sheetTitle') });
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

export function songInstrumentDescription({ t, locale }: SongCopy, track: LibraryTrack, instrument: string): string {
  const vars = instrumentVars(t, instrument);
  const formats = instrumentExportFormats(track, instrument);
  const exports = formats.length ? t('meta.partExports', { formats: joinList(locale, formats, 'disjunction') }) : '';
  const hasStem = trackAssets(track).some(
    (a) => a.asset_type === 'stem' && (a.stem_name || '').toLowerCase() === instrument.toLowerCase()
  );
  const stem = hasStem ? t('meta.partStem', vars) : '';
  return t('meta.partDescription', { ...vars, subject: songSubject(t, track), exports, stem });
}

/** The instrument half of the page's h1: "Drum sheet music", "架子鼓谱". */
export const songInstrumentHeading = (t: SongT, instrument: string): string =>
  instrumentWord(t, instrument, 'sheetHeading');
