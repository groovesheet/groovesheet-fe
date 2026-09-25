// The 5 benchmark songs that have ALL FOUR instruments transcribed
// (see groovesheet-be/development-related/local-tools/run_multiinstrument_benchmark.py).
// The /video2for* pages pin these to the front of the song row and mark them
// with a blue border so cross-instrument comparisons are easy to find.

export const BENCHMARK_SONGS = [
  'dont-stop-me-now',
  'sweet-home-alabama',
  'uptown-girl',
  'im-still-standing',
  'everybody-wants-to-rule-the-world',
];

// benchmark songs first (in the order above), everything else after
export function orderSongIds(songIds) {
  const bench = BENCHMARK_SONGS.filter((s) => songIds.includes(s));
  return [...bench, ...songIds.filter((s) => !BENCHMARK_SONGS.includes(s))];
}

export const isBenchmark = (songId) => BENCHMARK_SONGS.includes(songId);

// visible blue ring on unselected benchmark songs (active stays filled blue)
export const BENCHMARK_BORDER = '#4d7cff';
