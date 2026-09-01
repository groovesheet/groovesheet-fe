/**
 * stemEngine.js — Web Audio multitrack stem engine (plain JS, no React).
 *
 * Implements the transport engine contract (see src/player/transport.js):
 *   { play(atSec), pause(), seek(sec), readTime() }
 * plus a mixer API:
 *   setStemGain(name, vol01), setStemMuted(name, bool), setSolo(nameOrNull),
 *   setMasterVolume(vol01), dispose()
 *
 * Audio graph (per stem):
 *   AudioBufferSourceNode → stem GainNode → master GainNode → destination
 *
 * Design notes
 * - The AudioContext is created/resumed lazily on the first user play()
 *   (autoplay policy). Stem files are FETCHED eagerly (network needs no
 *   gesture); DECODING happens once the context exists.
 * - All stems co-start sample-accurately: one shared `when = ctx.currentTime
 *   + 0.05` and per-source `start(when, offsetSec)`.
 * - Seek = stop all sources + restart at the new offset (BufferSources are
 *   one-shot).
 * - readTime() = startedAtPos + (ctx.currentTime - startedAtCtx) while
 *   playing; the paused position otherwise.
 * - Presigned stream_urls expire (~900s): on fetch failure each stem retries
 *   ONCE after calling `refreshAssets()` (caller refetches the track and
 *   returns the fresh asset list).
 */

const PREFERRED_FORMATS = ['mp3', 'opus', 'wav'];
const START_DELAY_SEC = 0.05;

/** Pick one playable asset per stem name (mp3 by default). */
export function pickStemAssets(assets) {
  const byName = new Map();
  (assets || []).forEach((a) => {
    if (!a || a.asset_type !== 'stem' || !a.stem_name || !a.stream_url) return;
    const existing = byName.get(a.stem_name);
    const rank = PREFERRED_FORMATS.indexOf(a.format);
    const existingRank = existing ? PREFERRED_FORMATS.indexOf(existing.format) : Infinity;
    const effRank = rank === -1 ? PREFERRED_FORMATS.length : rank;
    if (!existing || effRank < existingRank) byName.set(a.stem_name, a);
  });
  return byName;
}

// Client-side waveform thumbnails (fallback for tracks whose
// library_tracks.thumb_data was never backfilled): decode each fetched stem
// at a low sample rate in an OfflineAudioContext — no user gesture needed,
// unlike the playback AudioContext — and reduce to PEAKS_POINTS values
// normalized 0–100, the exact shape thumb_data.stems carries.
const PEAKS_POINTS = 200;
const PEAKS_SAMPLE_RATE = 8000;

/** Max-pool one channel of an AudioBuffer down to 0..100 ints. */
function peaksFromBuffer(audioBuffer) {
  const data = audioBuffer.getChannelData(0);
  const n = data.length;
  if (!n) return null;
  const bucket = Math.max(1, Math.floor(n / PEAKS_POINTS));
  const peaks = new Array(PEAKS_POINTS).fill(0);
  for (let i = 0; i < PEAKS_POINTS; i++) {
    let m = 0;
    const end = Math.min(n, (i + 1) * bucket);
    for (let j = i * bucket; j < end; j++) {
      const v = Math.abs(data[j]);
      if (v > m) m = v;
    }
    peaks[i] = m;
  }
  const max = Math.max(...peaks) || 1;
  return peaks.map((p) => Math.round((p * 100) / max));
}

/** Average an AudioBuffer's channels into one Float32Array. */
function monoFromBuffer(audioBuffer) {
  const chans = audioBuffer.numberOfChannels;
  const first = audioBuffer.getChannelData(0);
  if (chans === 1) return first.slice(0);
  const out = new Float32Array(first.length);
  for (let c = 0; c < chans; c += 1) {
    const data = audioBuffer.getChannelData(c);
    for (let i = 0; i < out.length; i += 1) out[i] += data[i];
  }
  for (let i = 0; i < out.length; i += 1) out[i] /= chans;
  return out;
}

/** Linear-interpolation resample — accurate enough for a spectrogram picture. */
function resampleLinear(samples, fromRate, toRate) {
  if (!samples || !fromRate || fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.max(1, Math.floor(samples.length / ratio)));
  for (let i = 0; i < out.length; i += 1) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    const a = samples[i0] || 0;
    const b = samples[i0 + 1] !== undefined ? samples[i0 + 1] : a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

/** decodeAudioData in callback form — Safari's promise form is newer. */
function decodeIn(decodeCtx, arrayBuffer) {
  return new Promise((resolve, reject) => {
    const maybe = decodeCtx.decodeAudioData(arrayBuffer, resolve, reject);
    if (maybe && typeof maybe.then === 'function') maybe.then(resolve, reject);
  });
}

/**
 * @param {Object} opts
 * @param {Array}    opts.assets        track.assets (stem entries are used)
 * @param {Function} [opts.onReady]     called once all stems are decoded
 * @param {Function} [opts.onError]     called with (Error) on a fatal load failure
 * @param {Function} [opts.onProgress]  called with ({loaded, total, phase}) as
 *                                      stems download ('fetch') and decode ('decode')
 * @param {Function} [opts.onPeaks]     called with (stemName, number[] 0-100) as each
 *                                      stem's waveform thumbnail is computed client-side
 * @param {Function} [opts.refreshAssets] async () => assets — refetch presigned URLs
 */
export function createStemEngine({ assets, onReady, onError, onProgress, onPeaks, refreshAssets } = {}) {
  const stemAssets = pickStemAssets(assets);
  const stems = new Map(); // name -> { asset, arrayBuffer, buffer, gain, source, vol, muted }
  stemAssets.forEach((asset, name) => {
    stems.set(name, { asset, arrayBuffer: null, buffer: null, gain: null, source: null, vol: 0.75, muted: false });
  });

  let ctx = null;
  let masterGain = null;
  let masterVol = 0.78;
  let soloName = null;

  let playing = false;
  let startedAtPos = 0; // MIDI-seconds position when sources started
  let startedAtCtx = 0; // ctx.currentTime the sources were scheduled for
  let pausedPos = 0;

  let disposed = false;
  let decoded = false;
  let decodePromise = null;
  let refreshPromise = null;
  let cmdSeq = 0; // monotonically increasing; async play() bails if superseded

  const report = (loaded, total, phase) => {
    if (onProgress) {
      try { onProgress({ loaded, total, phase }); } catch (e) { /* ignore */ }
    }
  };

  const fail = (err) => {
    if (onError) {
      try { onError(err); } catch (e) { /* ignore */ }
    }
  };

  // --- download ------------------------------------------------------------
  const refreshUrls = () => {
    if (!refreshPromise) {
      refreshPromise = Promise.resolve()
        .then(() => (refreshAssets ? refreshAssets() : null))
        .then((fresh) => {
          if (!fresh) return;
          const freshByName = pickStemAssets(fresh);
          freshByName.forEach((asset, name) => {
            const st = stems.get(name);
            if (st) st.asset = asset;
          });
        })
        .catch(() => { /* keep stale URLs; per-stem retry will surface the error */ });
    }
    return refreshPromise;
  };

  const fetchOne = async (name) => {
    const st = stems.get(name);
    const doFetch = async () => {
      const res = await fetch(st.asset.stream_url);
      if (!res.ok) throw new Error(`stem "${name}" HTTP ${res.status}`);
      return res.arrayBuffer();
    };
    try {
      st.arrayBuffer = await doFetch();
    } catch (firstErr) {
      // Presigned URL likely expired — refresh once and retry.
      await refreshUrls();
      st.arrayBuffer = await doFetch();
    }
  };

  let fetchedCount = 0;
  const fetchAllPromise = (async () => {
    const names = Array.from(stems.keys());
    report(0, names.length, 'fetch');
    await Promise.all(
      names.map(async (name) => {
        await fetchOne(name);
        fetchedCount += 1;
        report(fetchedCount, names.length, 'fetch');
      })
    );
  })();
  fetchAllPromise.catch((err) => fail(err instanceof Error ? err : new Error(String(err))));

  // Best-effort waveform thumbnails, one stem at a time so the transient
  // decode memory stays bounded. Works on copies of the fetched bytes: the
  // playback decode in ensureDecoded() detaches the originals.
  if (onPeaks) {
    (async () => {
      await fetchAllPromise;
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!OAC) return;
      for (const [name, st] of stems) {
        if (disposed) return;
        if (!st.arrayBuffer) continue;
        const copy = st.arrayBuffer.slice(0);
        try {
          let decodeCtx;
          try {
            decodeCtx = new OAC(1, 1, PEAKS_SAMPLE_RATE);
          } catch (e) {
            decodeCtx = new OAC(1, 1, 44100); // some engines floor the rate range
          }
          const buf = await decodeIn(decodeCtx, copy);
          const peaks = peaksFromBuffer(buf);
          if (peaks && !disposed) {
            try { onPeaks(name, peaks); } catch (e) { /* ignore */ }
          }
        } catch (e) { /* thumbnail only — never affects playback */ }
      }
    })().catch(() => { /* best-effort */ });
  }

  // --- audio graph ----------------------------------------------------------
  const applyGains = () => {
    if (!ctx) return;
    stems.forEach((st, name) => {
      if (!st.gain) return;
      const soloMuted = soloName != null && soloName !== name;
      const v = st.muted || soloMuted ? 0 : st.vol;
      st.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.01);
    });
    if (masterGain) masterGain.gain.setTargetAtTime(masterVol, ctx.currentTime, 0.01);
  };

  const ensureContext = () => {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = masterVol;
    masterGain.connect(ctx.destination);
    stems.forEach((st) => {
      st.gain = ctx.createGain();
      st.gain.connect(masterGain);
    });
    applyGains();
  };

  const ensureDecoded = () => {
    if (decodePromise) return decodePromise;
    decodePromise = (async () => {
      await fetchAllPromise;
      ensureContext();
      const names = Array.from(stems.keys());
      let done = 0;
      report(0, names.length, 'decode');
      await Promise.all(
        names.map(async (name) => {
          const st = stems.get(name);
          st.buffer = await ctx.decodeAudioData(st.arrayBuffer);
          st.arrayBuffer = null; // decodeAudioData detaches it anyway; drop the ref
          done += 1;
          report(done, names.length, 'decode');
        })
      );
      decoded = true;
      if (onReady) { try { onReady(); } catch (e) { /* ignore */ } }
    })();
    decodePromise.catch((err) => {
      decodePromise = null; // allow a later play() to retry
      fail(err instanceof Error ? err : new Error(String(err)));
    });
    return decodePromise;
  };

  // --- source lifecycle ------------------------------------------------------
  const stopSources = () => {
    stems.forEach((st) => {
      if (st.source) {
        try { st.source.stop(); } catch (e) { /* already stopped */ }
        try { st.source.disconnect(); } catch (e) { /* ignore */ }
        st.source = null;
      }
    });
  };

  const startSources = (atSec) => {
    stopSources();
    const when = ctx.currentTime + START_DELAY_SEC;
    stems.forEach((st) => {
      if (!st.buffer) return;
      const offset = Math.max(0, Math.min(atSec, st.buffer.duration));
      if (offset >= st.buffer.duration) return; // this stem already ended
      const src = ctx.createBufferSource();
      src.buffer = st.buffer;
      src.connect(st.gain);
      src.start(when, offset);
      st.source = src;
    });
    startedAtPos = atSec;
    startedAtCtx = when;
    playing = true;
  };

  const currentPos = () => {
    if (!playing || !ctx) return pausedPos;
    return startedAtPos + Math.max(0, ctx.currentTime - startedAtCtx);
  };

  // --- public API -------------------------------------------------------------
  return {
    id: 'stems',

    /** Transport engine contract. May be called before stems are decoded. */
    async play(atSec) {
      if (disposed) return;
      const seq = ++cmdSeq;
      const at = Number.isFinite(atSec) ? atSec : pausedPos;
      pausedPos = at;
      try {
        ensureContext();
        if (ctx.state === 'suspended') await ctx.resume();
        await ensureDecoded();
      } catch (err) {
        return; // onError already reported
      }
      if (disposed || seq !== cmdSeq) return; // superseded by pause
      // Use pausedPos (not `at`): a seek() issued while decoding updates it.
      startSources(pausedPos);
    },

    pause() {
      if (disposed) return;
      cmdSeq += 1;
      pausedPos = currentPos();
      stopSources();
      playing = false;
    },

    seek(sec) {
      if (disposed) return;
      const target = Math.max(0, Number(sec) || 0);
      if (playing && decoded) {
        cmdSeq += 1;
        startSources(target);
      } else {
        pausedPos = target;
        startedAtPos = target;
      }
    },

    readTime() {
      if (disposed) return null;
      if (!ctx) return pausedPos;
      return currentPos();
    },

    // --- mixer -----------------------------------------------------------
    setStemGain(name, vol) {
      const st = stems.get(name);
      if (!st) return;
      st.vol = Math.max(0, Math.min(1, Number(vol) || 0));
      applyGains();
    },

    setStemMuted(name, muted) {
      const st = stems.get(name);
      if (!st) return;
      st.muted = Boolean(muted);
      applyGains();
    },

    setSolo(name) {
      soloName = name == null ? null : name;
      applyGains();
    },

    setMasterVolume(v) {
      masterVol = Math.max(0, Math.min(1, Number(v) || 0));
      applyGains();
    },

    // --- analysis --------------------------------------------------------
    /**
     * Mono samples per stem at `sampleRate`, for offline analysis (the
     * spectrogram view). Never downloads anything twice: it decodes a copy of
     * the bytes this engine already fetched, or — if the playback decode has
     * since detached them — resamples the decoded playback buffer.
     *
     * Decoding runs through a small worker pool. `decodeAudioData` does its
     * work off the main thread, so a few in flight is much faster than one at
     * a time; the pool size is also what bounds memory, since a decoded
     * 3-minute stem at 16 kHz is ~13 MB.
     *
     * Pass `onStem(name, samples)` to consume each stem as it lands: the
     * samples are then handed over rather than retained, so the pool never
     * holds more than `concurrency` of them at once, and awaiting inside the
     * callback keeps it that way. Without it, every stem is accumulated into
     * the returned Map.
     *
     * @returns {Promise<Map<string, Float32Array>>} empty when `onStem` is used
     */
    async getAnalysisSamples({ sampleRate = 16000, concurrency = 3, onStem } = {}) {
      await fetchAllPromise;
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const names = Array.from(stems.keys());
      const results = new Map();

      const decodeOne = async (name) => {
        const st = stems.get(name);
        if (!st) return;
        // The playback decode may be mid-flight and about to detach the bytes.
        if (!st.arrayBuffer && !st.buffer && decodePromise) {
          try { await decodePromise; } catch (e) { /* use whatever survived */ }
        }
        let samples = null;
        if (st.arrayBuffer && OAC) {
          let copy = null;
          try {
            copy = st.arrayBuffer.slice(0); // throws if already detached
          } catch (e) {
            copy = null;
          }
          if (copy) {
            try {
              let decodeCtx;
              try {
                decodeCtx = new OAC(1, 1, sampleRate);
              } catch (e) {
                decodeCtx = new OAC(1, 1, 44100); // some engines floor the rate range
              }
              const buf = await decodeIn(decodeCtx, copy);
              samples = monoFromBuffer(buf);
              // A floored context decodes at its own rate, not the one asked for.
              if (Math.abs(decodeCtx.sampleRate - sampleRate) > 1) {
                samples = resampleLinear(samples, decodeCtx.sampleRate, sampleRate);
              }
            } catch (e) {
              samples = null;
            }
          }
        }
        if (!samples && st.buffer) {
          samples = resampleLinear(monoFromBuffer(st.buffer), st.buffer.sampleRate, sampleRate);
        }
        if (!samples || disposed) return;
        if (onStem) {
          try { await onStem(name, samples); } catch (e) { /* one stem failing is not fatal */ }
        } else {
          results.set(name, samples);
        }
      };

      let next = 0;
      const worker = async () => {
        for (;;) {
          if (disposed) return;
          const i = next;
          next += 1;
          if (i >= names.length) return;
          // eslint-disable-next-line no-await-in-loop
          await decodeOne(names[i]);
        }
      };
      await Promise.all(
        Array.from({ length: Math.max(1, Math.min(concurrency, names.length)) }, worker)
      );
      return results;
    },

    // --- meta ------------------------------------------------------------
    getStemNames() {
      return Array.from(stems.keys());
    },

    isReady() {
      return decoded;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      cmdSeq += 1;
      stopSources();
      playing = false;
      stems.forEach((st) => {
        st.buffer = null;
        st.arrayBuffer = null;
      });
      if (ctx) {
        try { ctx.close(); } catch (e) { /* ignore */ }
      }
      ctx = null;
      masterGain = null;
    },
  };
}

export default createStemEngine;
