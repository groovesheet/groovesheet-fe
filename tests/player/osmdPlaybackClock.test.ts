/**
 * Ported from src/components/PreviewPanel/osmdPlaybackClock.test.js. Targets
 * P1's verbatim port of PreviewPanel/osmdPlaybackClock.js under
 * components/player/.
 */
import { onlyModule } from '../onlyModule';

interface PlaybackClock {
  positionMs: number;
}

interface AdvanceOptions {
  isPlaying: boolean;
  nowMs: number;
  rate: number;
  durationMs?: number;
}

interface ClockModule {
  createPlaybackClock: (initialMs?: number) => PlaybackClock;
  advancePlaybackClock: (clock: PlaybackClock, options: AdvanceOptions) => number;
  seekPlaybackClock: (clock: PlaybackClock, positionMs: number) => void;
}

const { advancePlaybackClock, createPlaybackClock, seekPlaybackClock } = onlyModule(
  import.meta.glob<ClockModule>('/components/player/**/osmdPlaybackClock.{ts,tsx,js,jsx}', { eager: true }),
  'components/player/**/osmdPlaybackClock'
);

test('continues monotonically across OSMD internal tempo-clock resets', () => {
  const clock = createPlaybackClock();
  advancePlaybackClock(clock, { isPlaying: true, nowMs: 1000, rate: 1 });
  expect(advancePlaybackClock(clock, { isPlaying: true, nowMs: 2000, rate: 1 })).toBe(1000);

  // LinearTimingSource may now report 0 after a tempo instruction. It is not
  // an input to the absolute clock, so native playback continues at 2s.
  expect(advancePlaybackClock(clock, { isPlaying: true, nowMs: 3000, rate: 1 })).toBe(2000);
});

test('pause, seek, playback rate, and duration are explicit', () => {
  const clock = createPlaybackClock(500);
  advancePlaybackClock(clock, { isPlaying: true, nowMs: 1000, rate: 2 });
  expect(advancePlaybackClock(clock, { isPlaying: true, nowMs: 1250, rate: 2 })).toBe(1000);
  advancePlaybackClock(clock, { isPlaying: false, nowMs: 2000, rate: 2 });
  expect(clock.positionMs).toBe(1000);
  seekPlaybackClock(clock, 4500);
  expect(advancePlaybackClock(clock, {
    isPlaying: true, nowMs: 3000, rate: 1, durationMs: 4000,
  })).toBe(4000);
});
