import { applyMusicXmlMetadata, titleFromFilename } from './musicXmlMetadata';

describe('MusicXML metadata', () => {
  const source = `<?xml version="1.0"?><score-partwise version="4.0">
    <movement-title>Music21 Fragment</movement-title>
    <identification><creator type="composer">Music21</creator></identification>
    <part-list />
  </score-partwise>`;

  it('replaces worker placeholders and adds a work title', () => {
    const result = applyMusicXmlMetadata(source, { title: 'Real Song', artist: 'Transcribed by GrooveSheet' });
    const doc = new DOMParser().parseFromString(result, 'application/xml');
    expect(doc.querySelector('work-title').textContent).toBe('Real Song');
    expect(doc.querySelector('movement-title').textContent).toBe('Real Song');
    expect(doc.querySelector('creator[type="composer"]').textContent).toBe('Transcribed by GrooveSheet');
  });

  it('derives a clean title from a common upload filename', () => {
    expect(titleFromFilename('Artist - Song Title.mp3')).toBe('Song Title');
    expect(titleFromFilename('plain-recording.wav')).toBe('plain-recording');
  });
});
