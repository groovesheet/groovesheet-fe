import { Midi } from '@tonejs/midi';

const PREVIEW_MEASURES = 12;
const PREVIEW_SECONDS = 10;

export function truncateMusicXmlToMeasures(xmlString, measureCount = PREVIEW_MEASURES) {
  if (!xmlString) return xmlString;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');
    if (doc.querySelector('parsererror')) return xmlString;

    const parts = doc.querySelectorAll('part');
    parts.forEach((part) => {
      const measures = part.querySelectorAll('measure');
      for (let i = measureCount; i < measures.length; i += 1) {
        measures[i].remove();
      }
    });

    return new XMLSerializer().serializeToString(doc);
  } catch (err) {
    console.warn('truncateMusicXmlToMeasures failed:', err);
    return xmlString;
  }
}

export function truncateMidiToSeconds(arrayBuffer, seconds = PREVIEW_SECONDS) {
  if (!arrayBuffer) return null;
  try {
    const midi = new Midi(arrayBuffer);
    midi.tracks.forEach((track) => {
      track.notes = track.notes.filter((note) => note.time < seconds);
    });
    return midi.toArray().buffer;
  } catch (err) {
    console.warn('truncateMidiToSeconds failed:', err);
    return arrayBuffer;
  }
}

export const MIDI_KEY_BY_INSTRUMENT = {
  drums: 'adtof_plus_drums_quantized_midi',
  jazz_bass: 'bassunet_jazz_bass_midi',
  bass: 'fcpe_bass_midi',
  piano: 'transkun_v2_piano_midi',
};

// Candidate score keys per instrument, best first — the first one that exists
// is what gets engraved.
//
// Drums intentionally lead with the beat-tracked adtof+ score; midi2score is
// only the fallback there (same preference the social pipeline uses).
//
// For the melodic instruments it is the other way round: the raw model output
// (transkun / fcpe / bassunet) is un-quantized and, for piano, a SINGLE TREBLE
// PART with no left hand at all. The grand staff lives under the bare
// `musicxml` key that midi2score writes. Naming only the raw key here is why
// the sheet view rendered a one-staff score while the correct two-staff file
// sat in storage unused.
export const MUSICXML_KEYS_BY_INSTRUMENT = {
  drums: ['adtof_plus_drums_musicxml', 'midi2score_drums_v2_musicxml', 'musicxml'],
  jazz_bass: ['musicxml', 'bassunet_jazz_bass_musicxml'],
  bass: ['musicxml', 'fcpe_bass_musicxml'],
  piano: ['musicxml', 'transkun_v2_piano_musicxml'],
};

/**
 * Candidate score keys for an instrument, best first. Empty for anything
 * that has no score at all (vocals, guitar, "other", plain bass separation):
 * falling back to the drums list here made a stem split look like it had a
 * sheet to download, and rendered Score/PDF buttons that could only fail.
 */
export function musicXmlKeysFor(instrument) {
  return MUSICXML_KEYS_BY_INSTRUMENT[instrument] || [];
}

// Optional per-instrument sync map output ({ version, pairs: [[qn, sec], ...] },
// see src/player/syncMap.js). Only chains that emit one are listed; when the
// key is absent (or the download 404s) the playback cursor falls back to the
// score's own timing (identity mapping).
export const SYNC_MAP_KEY_BY_INSTRUMENT = {
  drums: 'adtof_plus_drums_sync_map',
};
