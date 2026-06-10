// GrooveSheet — Song detail page mock data.
// Ported from the Anthropic design pack (song-data.js). One fully described
// hero song ("Nuvole Bianche — Cinematic Arrangement") plus related rails.
// Replaced by real /scores/:id endpoints once the backend lands.

// Stem palette — kept cohesive with the explore-page roll colors.
export const STEM_COLORS = {
  Piano: '#7AA2FF', // cool blue
  Strings: '#C9A0FF', // lilac
  Bass: '#FFC857', // amber
  Pads: '#5EE7DF', // teal
  Drums: '#FF7BA9',
  Vocals: '#84F2A6',
};

// The hero song.
export const SONG = {
  id: 'nuvole-bianche',
  title: 'Nuvole Bianche',
  subtitle: 'Cinematic Arrangement',
  artist: 'Ludovico Einaudi',
  publisher: 'Chester Music',
  publisherVerified: true,
  cover: '#7AA2FF',
  pages: 6,
  measures: 94,
  durationSec: 325, // 05:25
  tempo: 60,
  timeSig: '4/4',
  key: 'B♭ Minor',
  parts: 4,
  instrument: 'Piano',
  difficulty: 'Intermediate',
  license: 'GrooveSheet Public',
  privacy: 'Public',
  uploaded: 'Aug 25, 2021',
  updated: 'May 04, 2026',
  views: 543900,
  likes: 7700,
  comments: 73,
  rating: 4.5,
  ratingCount: 1247,
  saves: 7700,
  stems: [
    { name: 'Piano', detected: 97, color: STEM_COLORS.Piano, sub: 'lead · sustained' },
    { name: 'Strings', detected: 92, color: STEM_COLORS.Strings, sub: 'pad · bowed' },
    { name: 'Bass', detected: 88, color: STEM_COLORS.Bass, sub: 'sub · low end' },
    { name: 'Pads', detected: 74, color: STEM_COLORS.Pads, sub: 'texture · ambient' },
  ],
  tags: [
    'Intermediate',
    'Classical',
    'Cinematic',
    'Solo Piano',
    'Pop',
    'Minimalist',
    '5/4',
    'Einaudi',
  ],
};

// Related rails.
export const RELATED = {
  versions: [
    { id: 'v1', title: 'Nuvole Bianche — Easy Piano', sub: 'Solo Piano · Beginner', rating: 4.5, official: true, pages: 4, dur: '04:58' },
    { id: 'v2', title: 'Nuvole Bianche — Abridged', sub: 'Solo Piano · Intermediate', rating: 4.6, official: false, pages: 3, dur: '03:12' },
    { id: 'v3', title: 'Nuvole Bianche (String Quartet)', sub: 'Strings · Advanced', rating: 4.8, official: true, pages: 9, dur: '05:25' },
    { id: 'v4', title: 'Nuvole Bianche (Cello + Piano)', sub: 'Cello + Piano · Intermediate', rating: 4.7, official: false, pages: 7, dur: '05:25' },
  ],
  recommended: [
    { id: 'r1', title: 'Una Mattina', artist: 'Ludovico Einaudi', diff: 'Intermediate', rating: 4.8, dur: '06:42', views: 612000 },
    { id: 'r2', title: 'River Flows In You', artist: 'Yiruma', diff: 'Intermediate', rating: 4.9, dur: '03:35', views: 805000 },
    { id: 'r3', title: 'Comptine d’un autre été', artist: 'Yann Tiersen', diff: 'Beginner', rating: 4.7, dur: '02:18', views: 421000 },
    { id: 'r4', title: 'Experience', artist: 'Ludovico Einaudi', diff: 'Intermediate', rating: 4.9, dur: '05:14', views: 487000 },
    { id: 'r5', title: 'Divenire', artist: 'Ludovico Einaudi', diff: 'Advanced', rating: 4.7, dur: '06:42', views: 198000 },
    { id: 'r6', title: 'Le Onde', artist: 'Ludovico Einaudi', diff: 'Intermediate', rating: 4.6, dur: '06:21', views: 145000 },
    { id: 'r7', title: 'Primavera', artist: 'Ludovico Einaudi', diff: 'Advanced', rating: 4.8, dur: '07:46', views: 162000 },
    { id: 'r8', title: 'I Giorni', artist: 'Ludovico Einaudi', diff: 'Intermediate', rating: 4.8, dur: '05:18', views: 254000 },
  ],
  difficulties: [
    { id: 'd1', title: 'Nuvole Bianche — Beginner', artist: 'Ludovico Einaudi', diff: 'Beginner', rating: 4.4, dur: '03:42', views: 184000 },
    { id: 'd2', title: 'Nuvole Bianche — Easy Piano', artist: 'Ludovico Einaudi', diff: 'Beginner', rating: 4.5, dur: '04:58', views: 280600 },
    { id: 'd3', title: 'Nuvole Bianche (Original)', artist: 'Ludovico Einaudi', diff: 'Intermediate', rating: 4.5, dur: '05:25', views: 543900, current: true },
    { id: 'd4', title: 'Nuvole Bianche — Concert Edition', artist: 'Ludovico Einaudi', diff: 'Advanced', rating: 4.7, dur: '06:08', views: 92400 },
    { id: 'd5', title: 'Nuvole Bianche — Virtuoso', artist: 'Ludovico Einaudi', diff: 'Advanced', rating: 4.9, dur: '06:21', views: 54200 },
  ],
  arrangements: [
    { id: 'a1', title: 'Nuvole Bianche (Guitar)', artist: 'arr. M. Yates', diff: 'Intermediate', rating: 4.6, dur: '05:18', views: 88200, primary: 'Guitar' },
    { id: 'a2', title: 'Nuvole Bianche (String Quartet)', artist: 'arr. Voss Ensemble', diff: 'Advanced', rating: 4.8, dur: '05:25', views: 41100, primary: 'Strings' },
    { id: 'a3', title: 'Nuvole Bianche (Cello + Piano)', artist: 'arr. R. Halsall', diff: 'Intermediate', rating: 4.7, dur: '05:25', views: 67400, primary: 'Cello' },
    { id: 'a4', title: 'Nuvole Bianche (Solo Violin)', artist: 'arr. K. Park', diff: 'Advanced', rating: 4.5, dur: '04:58', views: 29800, primary: 'Violin' },
    { id: 'a5', title: 'Nuvole Bianche (Harp)', artist: 'arr. L. Marchand', diff: 'Intermediate', rating: 4.7, dur: '05:25', views: 18200, primary: 'Harp' },
    { id: 'a6', title: 'Nuvole Bianche (Brass Quintet)', artist: 'arr. D. Ngozi', diff: 'Advanced', rating: 4.5, dur: '05:18', views: 12400, primary: 'Brass' },
  ],
  artist: [
    { id: 'b1', title: 'I Giorni', artist: 'Ludovico Einaudi', diff: 'Intermediate', rating: 4.8, dur: '05:18', views: 254000 },
    { id: 'b2', title: 'Una Mattina', artist: 'Ludovico Einaudi', diff: 'Intermediate', rating: 4.8, dur: '06:42', views: 612000 },
    { id: 'b3', title: 'Experience', artist: 'Ludovico Einaudi', diff: 'Intermediate', rating: 4.9, dur: '05:14', views: 487000 },
    { id: 'b4', title: 'Primavera', artist: 'Ludovico Einaudi', diff: 'Advanced', rating: 4.8, dur: '07:46', views: 162000 },
    { id: 'b5', title: 'Divenire', artist: 'Ludovico Einaudi', diff: 'Advanced', rating: 4.7, dur: '06:42', views: 198000 },
    { id: 'b6', title: 'Fly', artist: 'Ludovico Einaudi', diff: 'Intermediate', rating: 4.6, dur: '04:32', views: 121000 },
    { id: 'b7', title: 'Andare', artist: 'Ludovico Einaudi', diff: 'Beginner', rating: 4.5, dur: '04:08', views: 78400 },
    { id: 'b8', title: 'Berlin Song', artist: 'Ludovico Einaudi', diff: 'Intermediate', rating: 4.7, dur: '04:42', views: 64200 },
  ],
  bestOf: [
    { id: 'g1', title: 'Clair de Lune', artist: 'Claude Debussy', diff: 'Intermediate', rating: 4.8, dur: '05:25', views: 482100 },
    { id: 'g2', title: 'Moonlight Sonata', artist: 'Beethoven', diff: 'Advanced', rating: 4.9, dur: '05:00', views: 519100 },
    { id: 'g3', title: 'Gymnopédie No. 1', artist: 'Erik Satie', diff: 'Beginner', rating: 4.7, dur: '03:21', views: 410200 },
    { id: 'g4', title: 'Prelude in C', artist: 'J.S. Bach', diff: 'Intermediate', rating: 4.8, dur: '02:42', views: 318100 },
    { id: 'g5', title: 'River Flows In You', artist: 'Yiruma', diff: 'Intermediate', rating: 4.9, dur: '03:35', views: 805000 },
    { id: 'g6', title: 'Kiss the Rain', artist: 'Yiruma', diff: 'Intermediate', rating: 4.7, dur: '04:08', views: 442100 },
  ],
  trending: [
    { id: 't1', title: 'Liebestraum No. 3', artist: 'Franz Liszt', diff: 'Advanced', rating: 4.8, dur: '04:32', views: 184000 },
    { id: 't2', title: 'Comptine d’un autre été', artist: 'Yann Tiersen', diff: 'Beginner', rating: 4.7, dur: '02:18', views: 421000 },
    { id: 't3', title: 'Time', artist: 'Hans Zimmer', diff: 'Intermediate', rating: 4.9, dur: '04:33', views: 612200 },
    { id: 't4', title: 'Interstellar Main Theme', artist: 'Hans Zimmer', diff: 'Intermediate', rating: 4.9, dur: '03:54', views: 482100 },
    { id: 't5', title: 'The Nights', artist: 'Avicii', diff: 'Intermediate', rating: 4.6, dur: '03:35', views: 318100 },
    { id: 't6', title: 'Bohemian Rhapsody', artist: 'Queen', diff: 'Advanced', rating: 4.8, dur: '05:55', views: 605200 },
  ],
  courses: [
    { id: 'c1', title: 'Master Einaudi: 4-Week Path', lessons: 12, level: 'Intermediate', author: 'Lea Marchand' },
    { id: 'c2', title: 'Cinematic Piano: Pedal & Voicing', lessons: 8, level: 'Intermediate', author: 'Ben Northcote' },
    { id: 'c3', title: 'Reading 16ths at Slow Tempo', lessons: 6, level: 'Beginner', author: 'Petra Aaltonen' },
  ],
  playlists: [
    { id: 'p1', name: 'Cinematic Piano Essentials', count: 24, cover: '#7AA2FF' },
    { id: 'p2', name: 'Best of Einaudi', count: 18, cover: '#C9A0FF' },
    { id: 'p3', name: 'Weekend Practice (Slow)', count: 9, cover: '#FFC857' },
  ],
};

// Helpers
export const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  return `${String(m).padStart(2, '0')}:${ss}`;
};

export const fmtNum = (n) =>
  n >= 1000000
    ? (n / 1000000).toFixed(1) + 'M'
    : n >= 1000
    ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K'
    : String(n);
