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
  drums: 'adtof_drums_midi',
  jazz_bass: 'bassunet_jazz_bass_midi',
  bass: 'fcpe_bass_midi',
  piano: 'transkun_v2_piano_midi',
};
