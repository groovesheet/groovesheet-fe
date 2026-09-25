/**
 * melSpectrogram.js — mel-scale STFT for the stem spectrogram overlay.
 *
 * Same shape of analysis the `react-audio-spectrogram-player` package performs
 * in wasm (mel filterbank over an STFT, power → dB, clipped to `topDb` below
 * the peak), written in plain JS so it can run on ALREADY-DECODED stem samples
 * instead of on a file URL. That is the whole reason it exists: the npm player
 * owns its own <audio> element and can only show one file, and this view has to
 * overlay every stem on one canvas driven by the shared transport.
 *
 * Output is a Uint8Array of `frames * nMels` values (0-255), row-major by frame,
 * which SpectrogramView tints per stem and composites additively.
 *
 * The transform yields to the event loop every CHUNK_FRAMES so a 4-minute
 * 4-stem track never blocks paint.
 */

const CHUNK_FRAMES = 250;

export const DEFAULTS = {
  sampleRate: 16000, // stems are resampled to this at decode time
  nFft: 1024,
  hopLength: 512,
  nMels: 128,
  fMin: 30,
  fMax: 8000,
  topDb: 68, // tighter range than a single-file viewer: several layers stack
};

// --- FFT ------------------------------------------------------------------
// In-place iterative radix-2 Cooley-Tukey. `size` must be a power of two.
function makeFft(size) {
  const levels = Math.log2(size);
  if (!Number.isInteger(levels)) throw new Error('FFT size must be a power of two');
  const cos = new Float32Array(size / 2);
  const sin = new Float32Array(size / 2);
  for (let i = 0; i < size / 2; i += 1) {
    cos[i] = Math.cos((2 * Math.PI * i) / size);
    sin[i] = Math.sin((2 * Math.PI * i) / size);
  }
  // Bit-reversal permutation table.
  const rev = new Uint32Array(size);
  for (let i = 0; i < size; i += 1) {
    let x = i;
    let r = 0;
    for (let j = 0; j < levels; j += 1) {
      r = (r << 1) | (x & 1);
      x >>= 1;
    }
    rev[i] = r;
  }

  return function fft(re, im) {
    for (let i = 0; i < size; i += 1) {
      const j = rev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let half = 1; half < size; half *= 2) {
      const step = size / (half * 2);
      for (let i = 0; i < size; i += half * 2) {
        for (let j = i, k = 0; j < i + half; j += 1, k += step) {
          const l = j + half;
          const tre = re[l] * cos[k] + im[l] * sin[k];
          const tim = -re[l] * sin[k] + im[l] * cos[k];
          re[l] = re[j] - tre;
          im[l] = im[j] - tim;
          re[j] += tre;
          im[j] += tim;
        }
      }
    }
  };
}

// --- mel filterbank -------------------------------------------------------
const hzToMel = (f) => 2595 * Math.log10(1 + f / 700);
const melToHz = (m) => 700 * (10 ** (m / 2595) - 1);

/**
 * Triangular mel filters over the `nFft/2 + 1` real FFT bins.
 * Each filter is stored sparsely as {start, weights} so the per-frame inner
 * loop only touches the bins it actually overlaps.
 */
function makeMelFilterbank({ sampleRate, nFft, nMels, fMin, fMax }) {
  const nBins = nFft / 2 + 1;
  const binHz = sampleRate / nFft;
  const melMin = hzToMel(fMin);
  const melMax = hzToMel(Math.min(fMax, sampleRate / 2));
  // nMels + 2 mel-spaced edges → nMels overlapping triangles.
  const edges = new Float64Array(nMels + 2);
  for (let i = 0; i < nMels + 2; i += 1) {
    edges[i] = melToHz(melMin + ((melMax - melMin) * i) / (nMels + 1)) / binHz;
  }

  const filters = [];
  for (let m = 0; m < nMels; m += 1) {
    const left = edges[m];
    const center = edges[m + 1];
    const right = edges[m + 2];
    const start = Math.max(0, Math.floor(left));
    const end = Math.min(nBins - 1, Math.ceil(right));
    const weights = new Float32Array(Math.max(0, end - start + 1));
    for (let b = start; b <= end; b += 1) {
      let w = 0;
      if (b > left && b < center) w = (b - left) / (center - left || 1);
      else if (b >= center && b < right) w = (right - b) / (right - center || 1);
      // A triangle narrower than one bin would vanish entirely — give the
      // nearest bin full weight so the low mel bands never read as silence.
      weights[b - start] = w;
    }
    let sum = 0;
    for (let i = 0; i < weights.length; i += 1) sum += weights[i];
    if (sum === 0) {
      const nearest = Math.min(nBins - 1, Math.max(0, Math.round(center)));
      if (nearest >= start && nearest - start < weights.length) weights[nearest - start] = 1;
    }
    filters.push({ start, weights });
  }
  return filters;
}

// Yield via MessageChannel, NOT requestAnimationFrame: rAF is paused in a
// background tab, which would stall the analysis for as long as the user is
// looking at another tab. A message port task still runs (and, unlike
// setTimeout, is not clamped to 4ms when the page is in front).
const yieldToEventLoop = () =>
  new Promise((resolve) => {
    if (typeof MessageChannel === 'undefined') {
      setTimeout(resolve, 0);
      return;
    }
    const ch = new MessageChannel();
    ch.port1.onmessage = () => {
      ch.port1.close();
      resolve();
    };
    ch.port2.postMessage(0);
  });

/**
 * Mel spectrogram of a mono signal.
 *
 * @param {Float32Array} samples  mono audio at `opts.sampleRate`
 * @param {Object}   [opts]       overrides for DEFAULTS
 * @param {Function} [onProgress] called with 0..1 as frames are transformed
 * @returns {Promise<{data: Uint8Array, frames: number, nMels: number,
 *                    hopSec: number, durationSec: number, melMin: number, melMax: number}>}
 *          `data` is row-major by frame: data[frame * nMels + mel], 0 = silence.
 */
export async function computeMelSpectrogram(samples, opts = {}, onProgress) {
  const cfg = { ...DEFAULTS, ...opts };
  const { sampleRate, nFft, hopLength, nMels, topDb } = cfg;
  const fft = makeFft(nFft);
  const filters = makeMelFilterbank(cfg);

  const n = samples.length;
  const frames = Math.max(1, Math.floor(Math.max(0, n - nFft) / hopLength) + 1);

  // Hann window, matching the STFT the reference player uses.
  const window = new Float32Array(nFft);
  for (let i = 0; i < nFft; i += 1) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / nFft);

  const re = new Float32Array(nFft);
  const im = new Float32Array(nFft);
  const nBins = nFft / 2 + 1;
  const power = new Float32Array(nBins);
  const db = new Float32Array(frames * nMels);
  let peak = -Infinity;

  for (let f = 0; f < frames; f += 1) {
    const off = f * hopLength;
    for (let i = 0; i < nFft; i += 1) {
      re[i] = (samples[off + i] || 0) * window[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let b = 0; b < nBins; b += 1) power[b] = re[b] * re[b] + im[b] * im[b];

    const base = f * nMels;
    for (let m = 0; m < nMels; m += 1) {
      const { start, weights } = filters[m];
      let acc = 0;
      for (let i = 0; i < weights.length; i += 1) acc += power[start + i] * weights[i];
      // 10*log10 of power (equivalently 20*log10 of magnitude).
      const v = 10 * Math.log10(acc + 1e-10);
      db[base + m] = v;
      if (v > peak) peak = v;
    }

    if (f % CHUNK_FRAMES === CHUNK_FRAMES - 1) {
      if (onProgress) onProgress((f + 1) / frames);
      await yieldToEventLoop();
    }
  }

  // dB → 0..255, clipped to `topDb` below this stem's own peak. Normalizing
  // per stem (not across the mix) is what makes a quiet stem still readable
  // once it is the only one left enabled.
  const floor = peak - topDb;
  const scale = 255 / topDb;
  const data = new Uint8Array(frames * nMels);
  for (let i = 0; i < db.length; i += 1) {
    const v = (db[i] - floor) * scale;
    data[i] = v <= 0 ? 0 : v >= 255 ? 255 : v;
  }

  if (onProgress) onProgress(1);
  return {
    data,
    frames,
    nMels,
    hopSec: hopLength / sampleRate,
    durationSec: n / sampleRate,
    melMin: hzToMel(cfg.fMin),
    melMax: hzToMel(Math.min(cfg.fMax, sampleRate / 2)),
  };
}

/** Where a frequency sits in a 0..1 mel-scaled axis (0 = fMin edge). */
export function hzToMelFraction(hz, melMin, melMax) {
  return (hzToMel(hz) - melMin) / (melMax - melMin);
}

export { hzToMel, melToHz };
