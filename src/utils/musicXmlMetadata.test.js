import { applyMusicXmlMetadata, titleFromFilename } from './musicXmlMetadata';

describe('MusicXML metadata', () => {
  const source = `<?xml version="1.0"?><score-partwise version="4.0">
    <movement-title>Music21 Fragment</movement-title>
    <identification><creator type="composer">Music21</creator></identification>
    <part-list />
  </score-partwise>`;

  it('replaces worker placeholders and adds a work title', () => {
    const result = applyMusicXmlMetadata(source, {
      title: 'Real Song',
      artist: 'Transcribed by GrooveSheet',
      sourceCredit: 'Song by Real Artist',
    });
    const doc = new DOMParser().parseFromString(result, 'application/xml');
    expect(doc.querySelector('work-title').textContent).toBe('Real Song');
    expect(doc.querySelector('movement-title').textContent).toBe('Real Song');
    expect(doc.querySelector('creator[type="composer"]').textContent).toBe('Transcribed by GrooveSheet');
    expect(doc.querySelector('creator[type="lyricist"]').textContent).toBe('Song by Real Artist');
  });

  test('adds General MIDI percussion IDs to legacy unpitched notes', () => {
    const source = `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"><part-name>Percussion</part-name></score-part></part-list><part id="P1"><measure><note><unpitched><display-step>G</display-step><display-octave>5</display-octave></unpitched><duration>1</duration><voice>1</voice><notehead>x</notehead></note><note><unpitched><display-step>F</display-step><display-octave>4</display-octave></unpitched><duration>1</duration><voice>2</voice></note></measure></part></score-partwise>`;
    const result = applyMusicXmlMetadata(source, {});
    const doc = new DOMParser().parseFromString(result, 'application/xml');
    expect(doc.querySelector('note instrument[id="P1-GS-I43"]')).not.toBeNull();
    expect(doc.querySelector('note instrument[id="P1-GS-I37"]')).not.toBeNull();
    expect(doc.querySelector('midi-instrument[id="P1-GS-I43"] midi-channel')?.textContent).toBe('10');
    expect(doc.querySelector('midi-instrument[id="P1-GS-I43"] midi-unpitched')?.textContent).toBe('43');
  });

  it('derives a clean title from a common upload filename', () => {
    expect(titleFromFilename('Artist - Song Title.mp3')).toBe('Song Title');
    expect(titleFromFilename('plain-recording.wav')).toBe('plain-recording');
  });
});
