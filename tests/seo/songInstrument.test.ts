import { describe, expect, it } from 'vitest';
import {
  SONG_INSTRUMENTS,
  hasScoreFor,
  instrumentAdjective,
  instrumentExportFormats,
  scoredInstruments,
  songInstrumentDescription,
  songInstrumentHeading,
  songInstrumentPath,
  songInstrumentTitle,
} from '@/app/[locale]/explore/[songId]/_components/songData';
import { hubsOfKind } from '@/lib/seo/instrumentHubs';
import type { LibraryTrack } from '@/lib/types';

/**
 * /explore/{song}/{instrument} turns ~300 track pages into several hundred
 * more, so these are claims tests as much as routing tests: the page may only
 * exist where the score does, and its title may only promise the part it has.
 * That is the difference between an instrument page and the bulk pages
 * Google's scaled-content policy is aimed at.
 */

function track(assets: { asset_type: string; stem_name: string | null }[]): LibraryTrack {
  return {
    id: 'abc123',
    slug: 'sample-song',
    title: 'Sample Song',
    artist: 'Sample Artist',
    assets,
  } as unknown as LibraryTrack;
}

/**
 * Shaped like the real records: every part is separated, drums and piano carry
 * a score, and bass has MIDI without one. That last case is the common one in
 * the live library (0 of 45 sampled bass transcriptions had MusicXML), and it
 * is the case the guard exists for.
 */
const DRUMS_AND_PIANO = track([
  { asset_type: 'stem', stem_name: 'drums' },
  { asset_type: 'stem', stem_name: 'bass' },
  { asset_type: 'stem', stem_name: 'piano' },
  { asset_type: 'stem', stem_name: 'vocals' },
  { asset_type: 'musicxml', stem_name: 'drums' },
  { asset_type: 'midi', stem_name: 'drums' },
  { asset_type: 'musicxml', stem_name: 'piano' },
  { asset_type: 'midi', stem_name: 'bass' },
]);

describe('song instrument pages', () => {
  // The route list and the hub list have to be the same list: a page under an
  // instrument that has no transcriber would promise notation nobody can get.
  it('covers exactly the instruments that have a transcriber', () => {
    expect([...SONG_INSTRUMENTS]).toEqual(hubsOfKind('notation').map((h) => h.slug));
    expect(SONG_INSTRUMENTS).not.toContain('guitar');
    expect(SONG_INSTRUMENTS).not.toContain('vocals');
  });

  // The guard the whole design rests on. A bass stem is not a bass
  // transcription, and nearly every track has one.
  it('reports a part only when that part has a score', () => {
    expect(scoredInstruments(DRUMS_AND_PIANO)).toEqual(['drums', 'piano']);
    expect(hasScoreFor(DRUMS_AND_PIANO, 'drums')).toBe(true);
    expect(hasScoreFor(DRUMS_AND_PIANO, 'piano')).toBe(true);
    expect(hasScoreFor(DRUMS_AND_PIANO, 'guitar')).toBe(false);
  });

  // MIDI is not a score: the player's sheet-music tab is disabled without
  // MusicXML, so a page titled "Bass Sheet Music" would show a piano roll.
  it('refuses a part that has MIDI but no MusicXML', () => {
    expect(hasScoreFor(DRUMS_AND_PIANO, 'bass')).toBe(false);
    expect(scoredInstruments(DRUMS_AND_PIANO)).not.toContain('bass');
    expect(hasScoreFor(track([{ asset_type: 'midi', stem_name: 'drums' }]), 'drums')).toBe(false);
  });

  it('has no parts for a track with no assets at all', () => {
    expect(scoredInstruments(track([]))).toEqual([]);
    expect(scoredInstruments(null)).toEqual([]);
    expect(hasScoreFor(null, 'drums')).toBe(false);
  });

  // "drums sheet music" is not what anyone types; "drum sheet music" is.
  it('uses the adjective form, not the stem name', () => {
    expect(instrumentAdjective('drums')).toBe('Drum');
    expect(instrumentAdjective('piano')).toBe('Piano');
    expect(instrumentAdjective('bass')).toBe('Bass');
  });

  it('puts the searched phrase in the title, artist included', () => {
    expect(songInstrumentTitle(DRUMS_AND_PIANO, 'drums')).toBe('Sample Song by Sample Artist: Drum Sheet Music');
    expect(songInstrumentTitle({ title: 'Untitled', artist: null }, 'piano')).toBe('Untitled: Piano Sheet Music');
    // Each part must produce a different title, or the split buys nothing.
    const titles = SONG_INSTRUMENTS.map((i) => songInstrumentTitle(DRUMS_AND_PIANO, i));
    expect(new Set(titles).size).toBe(SONG_INSTRUMENTS.length);
  });

  it('describes the part, and only claims what the page offers', () => {
    const description = songInstrumentDescription(DRUMS_AND_PIANO, 'drums');
    expect(description).toContain('drum sheet music for Sample Song by Sample Artist');
    expect(description).toContain('PDF, MusicXML or MIDI');
    expect(description).toContain('Isolated drum stem included');
    // Google truncates around 160 characters; a description longer than that is
    // a sentence nobody reads the end of.
    expect(description.length).toBeLessThanOrEqual(200);
    expect(songInstrumentHeading('drums')).toBe('Drum sheet music');
  });

  // The export list is read off the record, so it cannot offer a MIDI the
  // track has not got. Piano here is scored but was never exported as MIDI.
  it('lists only the exports the part actually has', () => {
    expect(instrumentExportFormats(DRUMS_AND_PIANO, 'drums')).toEqual(['PDF', 'MusicXML', 'MIDI']);
    expect(instrumentExportFormats(DRUMS_AND_PIANO, 'piano')).toEqual(['PDF', 'MusicXML']);
    expect(songInstrumentDescription(DRUMS_AND_PIANO, 'piano')).toContain('export PDF or MusicXML');
    expect(songInstrumentDescription(DRUMS_AND_PIANO, 'piano')).not.toContain('MIDI');
  });

  // A stem is a separate promise from a score, and the sentence only makes it
  // when the audio is there.
  it('mentions the stem only when the track has one', () => {
    const noStem = track([{ asset_type: 'musicxml', stem_name: 'drums' }]);
    expect(songInstrumentDescription(noStem, 'drums')).not.toContain('stem');
  });

  // The part page hangs off the song page's own URL, so the two agree on
  // slug-or-id and the breadcrumb is a real path.
  it('builds the part URL under the song URL', () => {
    expect(songInstrumentPath(DRUMS_AND_PIANO, 'drums')).toBe('/explore/sample-song/drums');
    expect(songInstrumentPath({ id: 'abc123', slug: null }, 'piano')).toBe('/explore/abc123/piano');
  });
});
