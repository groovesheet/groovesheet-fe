// Mock library data for the GrooveSheet Explore page.
// Ported from the Anthropic design pack (data.js). Replaced by real
// /library endpoints once the backend lands.

export const INSTRUMENTS = [
  'Piano',
  'Guitar',
  'Bass',
  'Drums',
  'Strings',
  'Vocals',
  'Brass',
  'Woodwinds',
  'Synth',
];

export const ROLL_COLORS = {
  Vocals: '#7CC4FF',
  Piano: '#6B8AFF',
  Bass: '#FFC857',
  Drums: '#FF7BA9',
  Guitar: '#84F2A6',
  Strings: '#C9A0FF',
  Brass: '#FF9F66',
  Woodwinds: '#5EE7DF',
  Synth: '#A6E22E',
};

export const SONGS = [
  { id: 's01', title: 'Clair de Lune',          artist: 'Claude Debussy',   genre: 'Classical',  length: 325, primary: 'Piano',   parts: ['Piano','Strings'],                difficulty: 'Intermediate', saves: 48210, rating: 4.8, noteCount: 1842, skill: 'Two-handed coordination', cover: '#8FAEFF' },
  { id: 's02', title: 'Stairway Forever',       artist: 'The Echoes',       genre: 'Rock',       length: 482, primary: 'Guitar',  parts: ['Guitar','Bass','Drums','Vocals'], difficulty: 'Advanced',     saves: 31900, rating: 4.9, noteCount: 3210, skill: 'Fingerpicking',           cover: '#FFB97C' },
  { id: 's03', title: 'Lo-fi Sunset',           artist: 'mira.beats',       genre: 'Hip Hop',    length: 142, primary: 'Drums',   parts: ['Drums','Bass','Piano','Synth'],   difficulty: 'Beginner',     saves: 18420, rating: 4.6, noteCount: 612,  skill: 'Drum technique',          cover: '#FFA0C2' },
  { id: 's04', title: 'Concerto in G',          artist: 'J.S. Bach',        genre: 'Classical',  length: 611, primary: 'Strings', parts: ['Strings','Brass','Woodwinds'],    difficulty: 'Advanced',     saves: 9420,  rating: 4.7, noteCount: 5102, skill: 'Sight reading',           cover: '#BFA8FF' },
  { id: 's05', title: 'Sunlight Bloom',         artist: 'Akari Mori',       genre: 'Anime/Game', length: 218, primary: 'Piano',   parts: ['Piano','Strings','Vocals'],       difficulty: 'Intermediate', saves: 24210, rating: 4.8, noteCount: 1244, skill: 'Pedaling',                cover: '#7CC4FF' },
  { id: 's06', title: 'Brooklyn Underground',   artist: 'King Kobalt',      genre: 'Hip Hop',    length: 198, primary: 'Bass',    parts: ['Drums','Bass','Vocals','Synth'],  difficulty: 'Intermediate', saves: 14100, rating: 4.5, noteCount: 982,  skill: 'Groove pocket',           cover: '#FFC857' },
  { id: 's07', title: 'Glass Lanterns',         artist: 'Aevia',            genre: 'Pop',        length: 201, primary: 'Vocals',  parts: ['Vocals','Piano','Synth','Drums'], difficulty: 'Beginner',     saves: 36420, rating: 4.7, noteCount: 842,  skill: 'Vocal phrasing',          cover: '#6BCFAE' },
  { id: 's08', title: 'Midnight Drive',         artist: 'NEONHIME',         genre: 'Electronic', length: 248, primary: 'Synth',   parts: ['Synth','Drums','Bass'],           difficulty: 'Beginner',     saves: 21100, rating: 4.6, noteCount: 1620, skill: 'Programming',             cover: '#A6E22E' },
  { id: 's09', title: 'Blue Train Reprise',     artist: 'Quintet Nocturne', genre: 'Jazz',       length: 362, primary: 'Brass',   parts: ['Brass','Piano','Bass','Drums'],   difficulty: 'Advanced',     saves: 7920,  rating: 4.9, noteCount: 2840, skill: 'Improvisation',           cover: '#FF9F66' },
  { id: 's10', title: 'Pixel Princess (OST)',   artist: 'Hideo Takanaka',   genre: 'Anime/Game', length: 184, primary: 'Piano',   parts: ['Piano','Synth','Strings'],        difficulty: 'Beginner',     saves: 42100, rating: 4.8, noteCount: 704,  skill: 'Sight reading',           cover: '#FF7BA9' },
  { id: 's11', title: 'Velvet Hours',           artist: 'Lea Marchand',     genre: 'R&B',        length: 226, primary: 'Vocals',  parts: ['Vocals','Piano','Bass','Drums'],  difficulty: 'Intermediate', saves: 19420, rating: 4.7, noteCount: 1108, skill: 'Slow tempo',              cover: '#C9A0FF' },
  { id: 's12', title: 'Cinematic Rain',         artist: 'Hans Albrecht',    genre: 'Soundtrack', length: 312, primary: 'Strings', parts: ['Strings','Brass','Piano'],        difficulty: 'Advanced',     saves: 11800, rating: 4.8, noteCount: 3920, skill: 'Dynamics',                cover: '#5EE7DF' },
  { id: 's13', title: 'Two Hands, One Heart',   artist: 'Yuki Tanaka',      genre: 'Pop',        length: 154, primary: 'Piano',   parts: ['Piano','Vocals'],                 difficulty: 'Beginner',     saves: 55800, rating: 4.9, noteCount: 486,  skill: 'Two-handed coordination', cover: '#7CC4FF' },
  { id: 's14', title: 'After the Storm',        artist: 'Ben Northcote',    genre: 'Soundtrack', length: 268, primary: 'Piano',   parts: ['Piano','Strings','Brass'],        difficulty: 'Intermediate', saves: 13400, rating: 4.7, noteCount: 1622, skill: 'Pedaling',                cover: '#8FAEFF' },
  { id: 's15', title: 'Riverbed Waltz',         artist: 'Petra Aaltonen',   genre: 'Classical',  length: 204, primary: 'Piano',   parts: ['Piano'],                          difficulty: 'Beginner',     saves: 8200,  rating: 4.6, noteCount: 528,  skill: 'Sight reading',           cover: '#BFA8FF' },
  { id: 's16', title: 'Tape Hiss Romance',      artist: 'Kid Karaoke',      genre: 'R&B',        length: 178, primary: 'Vocals',  parts: ['Vocals','Synth','Drums'],         difficulty: 'Beginner',     saves: 9800,  rating: 4.5, noteCount: 740,  skill: 'Vocal phrasing',          cover: '#6BCFAE' },
  { id: 's17', title: 'Boss Battle Theme',      artist: 'Hideo Takanaka',   genre: 'Anime/Game', length: 142, primary: 'Drums',   parts: ['Drums','Synth','Brass','Bass'],   difficulty: 'Advanced',     saves: 18700, rating: 4.7, noteCount: 2410, skill: 'Drum technique',          cover: '#FF7BA9' },
  { id: 's18', title: 'Garage Door',            artist: 'Crooked Lamps',    genre: 'Rock',       length: 235, primary: 'Guitar',  parts: ['Guitar','Bass','Drums','Vocals'], difficulty: 'Intermediate', saves: 7400,  rating: 4.4, noteCount: 1840, skill: 'Power chords',            cover: '#FFB97C' },
  { id: 's19', title: 'Sevens & Tens',          artist: 'Quintet Nocturne', genre: 'Jazz',       length: 298, primary: 'Piano',   parts: ['Piano','Bass','Drums','Brass'],   difficulty: 'Intermediate', saves: 6100,  rating: 4.7, noteCount: 1860, skill: 'Improvisation',           cover: '#FFC857' },
  { id: 's20', title: 'Aria of the Garden',     artist: 'Camille Voss',     genre: 'Classical',  length: 294, primary: 'Vocals',  parts: ['Vocals','Piano','Strings'],       difficulty: 'Advanced',     saves: 5800,  rating: 4.8, noteCount: 1402, skill: 'Vocal phrasing',          cover: '#C9A0FF' },
  { id: 's21', title: 'Hard Drive',             artist: 'NEONHIME',         genre: 'Electronic', length: 212, primary: 'Synth',   parts: ['Synth','Drums','Bass'],           difficulty: 'Intermediate', saves: 12900, rating: 4.6, noteCount: 2640, skill: 'Programming',             cover: '#A6E22E' },
  { id: 's22', title: 'Apricot Sky',            artist: 'Akari Mori',       genre: 'Anime/Game', length: 172, primary: 'Piano',   parts: ['Piano','Strings','Vocals'],       difficulty: 'Beginner',     saves: 28400, rating: 4.8, noteCount: 608,  skill: 'Sight reading',           cover: '#FFA0C2' },
  { id: 's23', title: 'Caravan Reprise',        artist: 'Duke Ngozi',       genre: 'Jazz',       length: 386, primary: 'Brass',   parts: ['Brass','Piano','Bass','Drums'],   difficulty: 'Advanced',     saves: 4800,  rating: 4.9, noteCount: 3210, skill: 'Improvisation',           cover: '#FF9F66' },
  { id: 's24', title: 'Static Garden',          artist: 'mira.beats',       genre: 'Hip Hop',    length: 188, primary: 'Drums',   parts: ['Drums','Bass','Synth'],           difficulty: 'Beginner',     saves: 9600,  rating: 4.5, noteCount: 540,  skill: 'Drum technique',          cover: '#FFB97C' },
];

export const FILTERS = {
  popular: ['Piano', 'Beginner', 'Violin', 'Pop', 'Classical', 'Drums', 'Movie themes', 'Anime', 'Jazz', 'Two-handed'],
  difficulty: [
    { label: 'Beginner',     count: 4124 },
    { label: 'Intermediate', count: 5821 },
    { label: 'Advanced',     count: 2410 },
  ],
  instrument: [
    { label: 'Piano',     count: 6420 },
    { label: 'Drums',     count: 2812 },
    { label: 'Bass',      count: 1990 },
    { label: 'Guitar',    count: 4218 },
    { label: 'Vocals',    count: 1844 },
    { label: 'Strings',   count: 2180 },
    { label: 'Brass',     count: 962 },
    { label: 'Woodwinds', count: 821 },
  ],
  genre: [
    { label: 'Pop',         count: 3210 },
    { label: 'Rock',        count: 2840 },
    { label: 'Classical',   count: 2410 },
    { label: 'Soundtrack',  count: 1180 },
    { label: 'Hip Hop',     count: 1410 },
    { label: 'Jazz',        count: 840 },
    { label: 'R&B',         count: 712 },
    { label: 'Electronic',  count: 1620 },
    { label: 'Anime/Game',  count: 2080 },
  ],
  format: [
    { label: 'Sheet Music', count: 12384 },
    { label: 'MIDI',        count: 12384 },
    { label: 'Stems',       count: 12384 },
  ],
  length: [
    { label: 'Under 2 min', count: 3210 },
    { label: '2 to 5 min',  count: 7840 },
    { label: '5+ min',      count: 1334 },
  ],
};

export const ROWS = {
  sheet:    ['s01','s05','s13','s15','s10','s14','s20','s22','s07','s11','s12','s19'],
  midi:     ['s08','s21','s06','s03','s17','s07','s11','s10','s02','s16','s24','s05'],
  stems:    ['s07','s11','s02','s06','s16','s18','s08','s24','s12','s23','s09','s14'],
  trending: ['s13','s10','s22','s03','s07','s17','s05','s11','s08','s21','s06','s24'],
  newWeek:  ['s14','s19','s23','s20','s18','s24','s12','s09','s04','s15','s16','s11'],
  learners: ['s13','s07','s10','s15','s22','s24','s08','s16','s03'],
};

export const fmtDur = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
export const fmtCount = (n) =>
  n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n);
