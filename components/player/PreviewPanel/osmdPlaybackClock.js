export function createPlaybackClock(positionMs = 0) {
  return { positionMs: Math.max(0, Number(positionMs) || 0), lastNowMs: null };
}

export function seekPlaybackClock(clock, positionMs) {
  clock.positionMs = Math.max(0, Number(positionMs) || 0);
  clock.lastNowMs = null;
  return clock.positionMs;
}

/**
 * Keep an absolute score clock beside OSMD's native PlaybackManager.
 * LinearTimingSource resets its local millisecond counter at every tempo
 * instruction; this accumulator deliberately advances across those internal
 * resets while PlaybackManager remains the sole driver of notes and cursor.
 */
export function advancePlaybackClock(clock, { isPlaying, nowMs, rate = 1, durationMs = 0 }) {
  const now = Number(nowMs) || 0;
  if (isPlaying) {
    if (clock.lastNowMs != null) {
      clock.positionMs += Math.max(0, now - clock.lastNowMs) * Math.max(0, Number(rate) || 1);
    }
    clock.lastNowMs = now;
  } else {
    clock.lastNowMs = null;
  }
  if (durationMs > 0) clock.positionMs = Math.min(clock.positionMs, durationMs);
  return clock.positionMs;
}
