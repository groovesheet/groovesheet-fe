// Shared constants + tiny formatters for the Explore page.
// Moved out of src/mocks/exploreData.js when /explore was wired to the real
// public library API (GET /api/library/tracks).

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

// Instruments the backend actually emits as stem names (thumb_data.stems keys,
// capitalized). Used for the sidebar instrument chips so every chip can match
// real data.
export const STEM_INSTRUMENTS = ['Piano', 'Guitar', 'Bass', 'Drums', 'Vocals', 'Other'];

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
  Other: '#9AA8C7',
};

// Backend `formats` values → card badge labels.
export const FORMAT_LABELS = {
  musicxml: 'SHEET',
  midi: 'MIDI',
  stem: 'STEMS',
};

export const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const fmtDur = (s) => {
  const t = Math.max(0, Math.round(s || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

export const fmtCount = (n) =>
  n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n);
