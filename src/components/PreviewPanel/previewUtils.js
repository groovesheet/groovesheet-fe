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

export const MUSICXML_KEY_BY_INSTRUMENT = {
  drums: 'adtof_plus_drums_musicxml',
  jazz_bass: 'bassunet_jazz_bass_musicxml',
  bass: 'fcpe_bass_musicxml',
  piano: 'transkun_v2_piano_musicxml',
};

// Optional per-instrument sync map output ({ version, pairs: [[qn, sec], ...] },
// see src/player/syncMap.js). Only chains that emit one are listed; when the
// key is absent (or the download 404s) the playback cursor falls back to the
// score's own timing (identity mapping).
export const SYNC_MAP_KEY_BY_INSTRUMENT = {
  drums: 'adtof_plus_drums_sync_map',
};
