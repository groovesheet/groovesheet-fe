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

// Sidebar facet labels.
export const DIFFICULTY_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

// Sidebar "Format" facet labels → backend `formats` values.
export const FORMAT_FILTER_MAP = {
  'Sheet Music': 'musicxml',
  MIDI: 'midi',
  Stems: 'stem',
};

export const LENGTH_BUCKETS = ['Under 2 min', '2 to 5 min', '5+ min'];

/** Map a duration in seconds to its sidebar "Length" facet label. */
export const lengthBucket = (sec) => {
  const s = sec || 0;
  if (s < 120) return LENGTH_BUCKETS[0];
  if (s <= 300) return LENGTH_BUCKETS[1];
  return LENGTH_BUCKETS[2];
};

export const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const fmtDur = (s) => {
  const t = Math.max(0, Math.round(s || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

export const fmtCount = (n) =>
  n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n);

// --- Results page (/explore/search) -----------------------------------------
// The sidebar speaks in human labels; the API speaks in short param keys.
// These maps are the only place the two vocabularies meet.

/** Sidebar "Format" label → `format=` param value. */
export const FORMAT_PARAM_BY_LABEL = {
  'Sheet Music': 'sheet',
  MIDI: 'midi',
  Stems: 'stems',
};

export const FORMAT_LABEL_BY_PARAM = Object.fromEntries(
  Object.entries(FORMAT_PARAM_BY_LABEL).map(([label, param]) => [param, label])
);

/** Backend facet key (LibraryAsset.asset_type) → sidebar "Format" label. */
export const FORMAT_LABEL_BY_ASSET_TYPE = Object.fromEntries(
  Object.entries(FORMAT_FILTER_MAP).map(([label, assetType]) => [assetType, label])
);

/** Sidebar "Length" label → `length=` param value. */
export const LENGTH_PARAM_BY_LABEL = {
  'Under 2 min': 'under2',
  '2 to 5 min': '2to5',
  '5+ min': 'over5',
};

export const LENGTH_LABEL_BY_PARAM = Object.fromEntries(
  Object.entries(LENGTH_PARAM_BY_LABEL).map(([label, param]) => [param, label])
);

/**
 * Sort options, in menu order. Every one is backed by a real column — there is
 * deliberately no "Highest rated" or "Easiest first" here, because the catalog
 * carries no rating or difficulty to sort by.
 */
export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Best match', searchOnly: true },
  { value: 'popular', label: 'Most popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'plays', label: 'Most played' },
  { value: 'downloads', label: 'Most downloaded' },
  { value: 'title', label: 'A–Z' },
];

export const SORT_VALUES = SORT_OPTIONS.map((o) => o.value);

/** Results per page. Matches the API's `limit` ceiling of 60. */
export const RESULTS_PER_PAGE = 24;
