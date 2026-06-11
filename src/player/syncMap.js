/**
 * syncMap.js — MIDI-seconds ↔ score-position mapping (plain JS, no React).
 *
 * A sync map relates positions in the performed MIDI (wall-clock seconds) to
 * positions in the engraved score (quarter notes):
 *
 *   { "version": 1, "pairs": [[qn, sec], [qn, sec], ...] }
 *
 * Both axes must be non-decreasing. Mapping between the two is
 * piecewise-linear over the pairs, with CLAMPED extrapolation: inputs outside
 * the mapped range are clamped to the first/last pair before interpolating
 * (i.e. the mapping holds the boundary value rather than extrapolating a
 * slope). Sync maps are expected to cover the whole piece.
 *
 * With the backend tempo fix, sheet wall-clock time ≈ MIDI wall-clock time, so
 * the default playback path is `osmd.syncCursorToTime(positionSec)` directly
 * (identity). The mapper exists for residual correction when a sync map file
 * is present: compose the qn axis with the score's own timing to get sheet
 * seconds (see createSheetSecMapper).
 */

/**
 * Validate and normalize a sync map. Accepts a parsed object or a JSON
 * string. Returns `{ version, pairs }` with pairs sorted by MIDI seconds, or
 * throws an Error describing what is invalid.
 */
export function parseSyncMap(json) {
  let data = json;
  if (typeof data === 'string') {
    data = JSON.parse(data);
  }
  if (!data || typeof data !== 'object') {
    throw new Error('sync map: expected an object');
  }
  if (data.version == null) {
    throw new Error('sync map: missing "version"');
  }
  if (!Array.isArray(data.pairs)) {
    throw new Error('sync map: "pairs" must be an array');
  }
  const pairs = data.pairs.map((p, i) => {
    if (!Array.isArray(p) || p.length < 2) {
      throw new Error(`sync map: pairs[${i}] must be [qn, sec]`);
    }
    const qn = Number(p[0]);
    const sec = Number(p[1]);
    if (!Number.isFinite(qn) || !Number.isFinite(sec)) {
      throw new Error(`sync map: pairs[${i}] has non-numeric values`);
    }
    return [qn, sec];
  });
  pairs.sort((a, b) => a[1] - b[1]);
  for (let i = 1; i < pairs.length; i += 1) {
    if (pairs[i][0] < pairs[i - 1][0]) {
      throw new Error(`sync map: qn values not monotonic at pairs[${i}]`);
    }
  }
  return { version: data.version, pairs };
}

/** Piecewise-linear interpolation over sorted [x, y] points, clamped at the ends. */
function interpolate(points, x) {
  const n = points.length;
  if (n === 0) return x; // identity fallback
  if (n === 1) return points[0][1];
  if (x <= points[0][0]) return points[0][1];
  if (x >= points[n - 1][0]) return points[n - 1][1];
  // Binary search for the segment containing x.
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] <= x) lo = mid; else hi = mid;
  }
  const [x0, y0] = points[lo];
  const [x1, y1] = points[hi];
  if (x1 === x0) return y0;
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}

/**
 * createMapper(pairs) → { midiSecToScoreQn(sec), scoreQnToMidiSec(qn) }
 *
 * `pairs` is the validated `[[qn, sec], ...]` array from parseSyncMap.
 * With fewer than 2 pairs the mapping degenerates to identity.
 */
export function createMapper(pairs) {
  if (!Array.isArray(pairs) || pairs.length < 2) {
    return {
      midiSecToScoreQn: (sec) => sec,
      scoreQnToMidiSec: (qn) => qn,
    };
  }
  const bySec = pairs.map(([qn, sec]) => [sec, qn]); // x = midi sec, y = qn
  const byQn = pairs.map(([qn, sec]) => [qn, sec]); // x = qn, y = midi sec
  return {
    midiSecToScoreQn: (sec) => interpolate(bySec, sec),
    scoreQnToMidiSec: (qn) => interpolate(byQn, qn),
  };
}

/**
 * identityMapper(durationSec) — fallback when no sync map exists. Treats the
 * score-qn axis as seconds, so both directions are pass-through. `durationSec`
 * is carried for callers that want to clamp.
 */
export function identityMapper(durationSec = 0) {
  return {
    durationSec,
    midiSecToScoreQn: (sec) => sec,
    scoreQnToMidiSec: (qn) => qn,
  };
}

/**
 * createSheetSecMapper({ pairs, sheetDurationSec }) →
 *   { midiSecToSheetSec(sec), sheetSecToMidiSec(sec), isIdentity }
 *
 * What OSMD cursor syncing actually needs: MIDI seconds → SHEET wall-clock
 * seconds (the unit `osmd.syncCursorToTime()` / `seekMs()` consume).
 *
 * If a sync map AND the natural sheet duration are available, we compose the
 * sync map (midi sec ↔ score qn) with a linear qn → sheet-seconds scale
 * derived from the sheet's total duration (valid because midi2score emits a
 * constant-tempo score; the last sync-map qn corresponds to the end of the
 * sheet). Otherwise the mapping is identity — with the backend tempo fix the
 * sheet and MIDI clocks already agree.
 */
export function createSheetSecMapper({ pairs, sheetDurationSec } = {}) {
  const usable =
    Array.isArray(pairs) &&
    pairs.length >= 2 &&
    Number.isFinite(sheetDurationSec) &&
    sheetDurationSec > 0;

  if (!usable) {
    return {
      isIdentity: true,
      midiSecToSheetSec: (sec) => sec,
      sheetSecToMidiSec: (sec) => sec,
    };
  }

  const mapper = createMapper(pairs);
  const lastQn = pairs[pairs.length - 1][0];
  if (!(lastQn > 0)) {
    return {
      isIdentity: true,
      midiSecToSheetSec: (sec) => sec,
      sheetSecToMidiSec: (sec) => sec,
    };
  }
  const sheetSecPerQn = sheetDurationSec / lastQn;
  return {
    isIdentity: false,
    midiSecToSheetSec: (sec) => mapper.midiSecToScoreQn(sec) * sheetSecPerQn,
    sheetSecToMidiSec: (sheetSec) => mapper.scoreQnToMidiSec(sheetSec / sheetSecPerQn),
  };
}

export default createMapper;
