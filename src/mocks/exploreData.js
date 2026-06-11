// Legacy mock data for GrooveSheet.
//
// The /explore page now reads the real public library API
// (src/utils/libraryApi.js → GET /api/library/tracks); its mock SONGS/ROWS/
// FILTERS arrays were deleted and the shared constants moved to
// src/components/explore/constants.js (re-exported below for compatibility).
//
// What remains here is the Song detail page's mock fallback (getMockTrack),
// still used by src/components/Song.js when GET /library/tracks/{id} has no
// data for an id.

// Re-exports: kept so any straggler import of the moved constants keeps
// working. New code should import from components/explore/constants instead.
export {
  INSTRUMENTS,
  ROLL_COLORS,
  fmtDur,
  fmtCount,
} from '../components/explore/constants';

// Minimal catalog backing getMockTrack() below. No longer rendered on
// /explore — only used to synthesize Song-page fallback records.
const SONGS = [
  { id: 's01', title: 'Clair de Lune',          artist: 'Claude Debussy',   length: 325, parts: ['Piano','Strings'],                saves: 48210 },
  { id: 's02', title: 'Stairway Forever',       artist: 'The Echoes',       length: 482, parts: ['Guitar','Bass','Drums','Vocals'], saves: 31900 },
  { id: 's03', title: 'Lo-fi Sunset',           artist: 'mira.beats',       length: 142, parts: ['Drums','Bass','Piano','Synth'],   saves: 18420 },
  { id: 's04', title: 'Concerto in G',          artist: 'J.S. Bach',        length: 611, parts: ['Strings','Brass','Woodwinds'],    saves: 9420 },
  { id: 's05', title: 'Sunlight Bloom',         artist: 'Akari Mori',       length: 218, parts: ['Piano','Strings','Vocals'],       saves: 24210 },
  { id: 's06', title: 'Brooklyn Underground',   artist: 'King Kobalt',      length: 198, parts: ['Drums','Bass','Vocals','Synth'],  saves: 14100 },
  { id: 's07', title: 'Glass Lanterns',         artist: 'Aevia',            length: 201, parts: ['Vocals','Piano','Synth','Drums'], saves: 36420 },
  { id: 's08', title: 'Midnight Drive',         artist: 'NEONHIME',         length: 248, parts: ['Synth','Drums','Bass'],           saves: 21100 },
  { id: 's09', title: 'Blue Train Reprise',     artist: 'Quintet Nocturne', length: 362, parts: ['Brass','Piano','Bass','Drums'],   saves: 7920 },
  { id: 's10', title: 'Pixel Princess (OST)',   artist: 'Hideo Takanaka',   length: 184, parts: ['Piano','Synth','Strings'],        saves: 42100 },
  { id: 's11', title: 'Velvet Hours',           artist: 'Lea Marchand',     length: 226, parts: ['Vocals','Piano','Bass','Drums'],  saves: 19420 },
  { id: 's12', title: 'Cinematic Rain',         artist: 'Hans Albrecht',    length: 312, parts: ['Strings','Brass','Piano'],        saves: 11800 },
  { id: 's13', title: 'Two Hands, One Heart',   artist: 'Yuki Tanaka',      length: 154, parts: ['Piano','Vocals'],                 saves: 55800 },
  { id: 's14', title: 'After the Storm',        artist: 'Ben Northcote',    length: 268, parts: ['Piano','Strings','Brass'],        saves: 13400 },
  { id: 's15', title: 'Riverbed Waltz',         artist: 'Petra Aaltonen',   length: 204, parts: ['Piano'],                          saves: 8200 },
  { id: 's16', title: 'Tape Hiss Romance',      artist: 'Kid Karaoke',      length: 178, parts: ['Vocals','Synth','Drums'],         saves: 9800 },
  { id: 's17', title: 'Boss Battle Theme',      artist: 'Hideo Takanaka',   length: 142, parts: ['Drums','Synth','Brass','Bass'],   saves: 18700 },
  { id: 's18', title: 'Garage Door',            artist: 'Crooked Lamps',    length: 235, parts: ['Guitar','Bass','Drums','Vocals'], saves: 7400 },
  { id: 's19', title: 'Sevens & Tens',          artist: 'Quintet Nocturne', length: 298, parts: ['Piano','Bass','Drums','Brass'],   saves: 6100 },
  { id: 's20', title: 'Aria of the Garden',     artist: 'Camille Voss',     length: 294, parts: ['Vocals','Piano','Strings'],       saves: 5800 },
  { id: 's21', title: 'Hard Drive',             artist: 'NEONHIME',         length: 212, parts: ['Synth','Drums','Bass'],           saves: 12900 },
  { id: 's22', title: 'Apricot Sky',            artist: 'Akari Mori',       length: 172, parts: ['Piano','Strings','Vocals'],       saves: 28400 },
  { id: 's23', title: 'Caravan Reprise',        artist: 'Duke Ngozi',       length: 386, parts: ['Brass','Piano','Bass','Drums'],   saves: 4800 },
  { id: 's24', title: 'Static Garden',          artist: 'mira.beats',       length: 188, parts: ['Drums','Bass','Synth'],           saves: 9600 },
];

// ---------- Song detail page mock data ----------
// The /explore/:trackId page expects the same shape the backend's
// GET /library/tracks/{id} endpoint returns. Until that endpoint has data,
// the Song page falls back to synthesizing a record from the SONGS row above.
//
// Stems map explore "parts" labels → backend stem_names. The Song page only
// renders 'opus' format stems anonymously; under mock fallback the audio
// elements get no src (playback is disabled — clearly noted in the UI).

const PART_TO_STEM = {
  Vocals: 'vocals',
  Drums: 'drums',
  Bass: 'bass',
  Piano: 'piano',
  Guitar: 'guitar',
  Strings: 'other',
  Brass: 'other',
  Woodwinds: 'other',
  Synth: 'other',
};

// Album + year fill-ins keyed by song id. Only entries present here get the
// richer sidebar metadata; others fall through with album/year omitted.
const TRACK_EXTRAS = {
  s01: { album: 'Suite bergamasque',  year: 1905 },
  s02: { album: 'Long Way Home',      year: 1971 },
  s03: { album: 'After Hours',        year: 2023 },
  s04: { album: 'Brandenburg Suite',  year: 1721 },
  s05: { album: 'Hanami',             year: 2024 },
  s07: { album: 'Glass Lanterns EP',  year: 2025 },
  s10: { album: 'Pixel Princess OST', year: 2022 },
  s13: { album: 'Two Hands',          year: 2024 },
  s14: { album: 'After the Storm',    year: 2025 },
  s20: { album: 'Aria',               year: 2024 },
};

function synthAssets(songId, parts) {
  // Deduplicate after mapping (Brass + Strings + Synth could all collapse to 'other')
  const seen = new Set();
  const stems = [];
  for (const p of parts) {
    const name = PART_TO_STEM[p] || 'other';
    if (seen.has(name)) continue;
    seen.add(name);
    stems.push(name);
  }
  return stems.map((stem_name) => ({
    id: `mock-${songId}-${stem_name}`,
    asset_type: 'stem',
    stem_name,
    format: 'opus',
    r2_key: null,
    size_bytes: null,
  }));
}

/**
 * Look up a mock track record by Explore song id.
 * Returns a backend-shaped object (matches GET /library/tracks/{id}) plus a
 * sentinel `_isMock: true` so the UI can mark playback as disabled.
 */
export function getMockTrack(id) {
  const song = SONGS.find((s) => s.id === id);
  if (!song) return null;
  const extras = TRACK_EXTRAS[id] || {};
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: extras.album || null,
    year: extras.year || null,
    duration_sec: song.length,
    cover_r2_key: null,
    popularity: song.saves || 0,
    source: 'mock_fixture',
    published_at: '2026-01-15T00:00:00Z',
    assets: synthAssets(song.id, song.parts),
    _isMock: true,
  };
}
