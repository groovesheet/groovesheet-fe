import React, { useEffect, useMemo, useRef } from 'react';

/**
 * VideoDrumKit — top-down drum-kit visualiser for the GrooveSheet social video
 * frame (the drums alternative to the falling-note roll).
 *
 * A photo of the kit (back.png) sits underneath; each kit piece has its own
 * pre-positioned overlay PNG (a solid brand-blue disc exported on the same
 * 1200x562 canvas, so every overlay stacks 1:1 on the photo with no layout
 * math). When a hit crosses the master clock we flash that piece's overlay:
 * it holds solid blue for a beat-flash moment, then decays to invisible. Simultaneous
 * hits just light several overlays at once — that's why the overlays are
 * separate files instead of one baked image per combination.
 *
 * Time is driven externally by `timeRef` (seconds, looping, seekable); the
 * component runs its own rAF loop and writes overlay opacity directly to the
 * DOM so the parent never re-renders per frame.
 *
 * A hit flashes only when the clock moves forward across it. Sitting still
 * (stopped at 0:00, paused, just seeked) lights nothing, even when the part has
 * a hit at exactly the current time: most drum MIDI opens with a kick and a
 * crash at 0.00, which used to leave both pieces solid blue before playback.
 *
 * `glow` (the song and transcription pages): hits read as a translucent,
 * brightened glow over the pad instead of the video frame's solid disc.
 */

const KIT = '/video-assets/drumkit';

// Native size of back.png and every overlay (single shared canvas).
const IMG_W = 1200;
const IMG_H = 562;

const HOLD_SEC = 0.09; // overlay stays solid blue for this long after a hit
const FLASH_SEC = 0.16; // total flash length (hold + fade-out)
const MIN_ALPHA = 0.0; // overlays fully invisible at rest
const REST_MS = 250; // clock unchanged this long (wall time) = stopped: clear any flash
const SEEK_SEC = 0.5; // a forward step larger than this is a seek, not playback
const GLOW_ALPHA = 0.6; // peak opacity of a `glow` flash
const GLOW_FILTER = 'brightness(2.2) drop-shadow(0 0 6px rgba(96, 150, 255, 0.9))';

// One entry per kit piece. GM channel-10 note numbers → piece, mirroring the
// voice families in videoSynth.js but at per-piece granularity (three toms,
// two crashes) since the kit photo can show them individually.
const PIECES = [
  { key: 'kick', src: `${KIT}/kick.png`, midis: [35, 36] },
  { key: 'snare', src: `${KIT}/snare.png`, midis: [37, 38, 39, 40] },
  { key: 'hihat', src: `${KIT}/hihat.png`, midis: [42, 44, 46] },
  { key: 'tomHigh', src: `${KIT}/tom-high.png`, midis: [48, 50] },
  { key: 'tomMid', src: `${KIT}/tom-mid.png`, midis: [45, 47] },
  { key: 'tomFloor', src: `${KIT}/tom-floor.png`, midis: [41, 43] },
  { key: 'crashLeft', src: `${KIT}/crash-left.png`, midis: [49, 55] },
  { key: 'crashRight', src: `${KIT}/crash-right.png`, midis: [52, 57] },
  { key: 'ride', src: `${KIT}/ride.png`, midis: [51, 53, 59] },
];

const MIDI_TO_PIECE = {};
PIECES.forEach((p, i) => p.midis.forEach((m) => { MIDI_TO_PIECE[m] = i; }));
const FALLBACK_PIECE = 1; // unknown percussion → snare, same default as the roll

export default function VideoDrumKit({ notes, timeRef, glow = false }) {
  const imgRefs = useRef([]); // one <img> per piece
  const rafRef = useRef(null);

  // Per-piece sorted hit times, rebuilt only when the note list changes.
  const hitsByPiece = useMemo(() => {
    const buckets = PIECES.map(() => []);
    (notes || []).forEach((n) => {
      const idx = MIDI_TO_PIECE[n.midi];
      buckets[idx == null ? FALLBACK_PIECE : idx].push(n.time);
    });
    buckets.forEach((b) => b.sort((a, c) => a - c));
    return buckets;
  }, [notes]);

  useEffect(() => {
    // Per-piece cursor: index of the first hit the clock has not yet crossed.
    // The clock loops and is seekable, so on any jump we re-seat the cursors
    // with a binary search instead of assuming monotonic time.
    const cursors = hitsByPiece.map(() => 0);
    const fired = hitsByPiece.map(() => -Infinity); // time of the last hit that flashed
    const peak = glow ? GLOW_ALPHA : 1;
    let prevT = null;
    let lastMoveAt = 0;

    const seat = (arr, t) => {
      // first index with arr[i] >= t: a hit AT the new position is still ahead
      let lo = 0;
      let hi = arr.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid] < t) lo = mid + 1; else hi = mid;
      }
      return lo;
    };

    const loop = () => {
      const t = timeRef?.current ?? 0;
      const now = performance.now();
      const step = prevT == null ? NaN : t - prevT;
      const playing = step > 0 && step <= SEEK_SEC;
      if (step !== 0) lastMoveAt = now;
      // First frame, seek or loop wrap: re-seat without flashing anything.
      const jumped = !(step >= 0 && step <= SEEK_SEC);
      const resting = now - lastMoveAt > REST_MS;
      for (let i = 0; i < hitsByPiece.length; i += 1) {
        const arr = hitsByPiece[i];
        if (jumped) {
          cursors[i] = seat(arr, t);
          fired[i] = -Infinity;
        } else if (playing) {
          while (cursors[i] < arr.length && arr[cursors[i]] <= t) {
            fired[i] = arr[cursors[i]];
            cursors[i] += 1;
          }
        }
        const img = imgRefs.current[i];
        if (!img) continue;
        const age = t - fired[i];
        let a = MIN_ALPHA;
        if (resting) a = MIN_ALPHA;
        else if (age < HOLD_SEC) a = peak;
        else if (age < FLASH_SEC) a = peak - ((age - HOLD_SEC) / (FLASH_SEC - HOLD_SEC)) * (peak - MIN_ALPHA);
        img.style.opacity = String(a);
      }
      prevT = t;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [hitsByPiece, timeRef, glow]);

  // The kit keeps its native aspect and is fit-scaled to whatever box the
  // parent gives us; overlays share the photo's canvas so one wrapper scales
  // all. `object-fit: contain` keeps the photo undistorted when max-width
  // narrows the box below the aspect ratio (phones), and since every layer is
  // letterboxed the same way the overlays still land on their pieces.
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', height: '92%', aspectRatio: `${IMG_W} / ${IMG_H}`, maxWidth: '96%' }}>
        <img src={`${KIT}/back.png`} alt="" draggable={false} style={layerStyle} />
        {PIECES.map((p, i) => (
          <img
            key={p.key}
            ref={(el) => { imgRefs.current[i] = el; }}
            src={p.src}
            alt=""
            draggable={false}
            style={{ ...layerStyle, opacity: 0, filter: glow ? GLOW_FILTER : undefined }}
          />
        ))}
      </div>
    </div>
  );
}

const layerStyle = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  userSelect: 'none',
  pointerEvents: 'none',
};
