// Offline stem mixdown — no React, no user gesture needed.
//
// A separation job returns one file per stem. The result page wants two rows:
// the stem that was asked for, and "everything else" — which is not a file the
// backend produces. So we decode the other stems here, sum them, and hand the
// engine a single WAV blob. OfflineAudioContext decodes without an activated
// AudioContext, so this works before the first play() (autoplay policy).

const OAC = () => window.OfflineAudioContext || window.webkitOfflineAudioContext;

/** Decode any audio blob the browser understands into an AudioBuffer. */
export async function decodeBlob(blob) {
  const Ctx = OAC();
  if (!Ctx) throw new Error('Web Audio is not available in this browser');
  const arrayBuffer = await blob.arrayBuffer();
  // Tiny scratch context: decodeAudioData ignores its length/rate; the
  // decoded buffer keeps the file's own sample rate.
  const ctx = new Ctx(1, 1, 44100);
  return new Promise((resolve, reject) => {
    const maybe = ctx.decodeAudioData(arrayBuffer, resolve, reject);
    if (maybe && typeof maybe.then === 'function') maybe.then(resolve, reject);
  });
}

/** Sum several AudioBuffers sample-by-sample (channels padded, lengths padded). */
export function sumBuffers(buffers) {
  const live = buffers.filter(Boolean);
  if (!live.length) return null;
  const sampleRate = live[0].sampleRate;
  const channels = Math.max(...live.map((b) => b.numberOfChannels));
  const length = Math.max(...live.map((b) => b.length));
  const out = Array.from({ length: channels }, () => new Float32Array(length));
  let peak = 0;
  live.forEach((b) => {
    for (let c = 0; c < channels; c += 1) {
      // A mono stem contributes to every output channel.
      const src = b.getChannelData(Math.min(c, b.numberOfChannels - 1));
      const dst = out[c];
      for (let i = 0; i < src.length; i += 1) dst[i] += src[i];
    }
  });
  // Stems of one mix rarely clip when re-summed, but normalise if they do.
  out.forEach((ch) => { for (let i = 0; i < ch.length; i += 1) { const a = Math.abs(ch[i]); if (a > peak) peak = a; } });
  if (peak > 1) out.forEach((ch) => { for (let i = 0; i < ch.length; i += 1) ch[i] /= peak; });
  return { channels: out, sampleRate, length };
}

/** 16-bit PCM WAV encoder for { channels: Float32Array[], sampleRate }. */
export function encodeWav({ channels, sampleRate, length }) {
  const numCh = channels.length;
  const bytesPerSample = 2;
  const dataBytes = length * numCh * bytesPerSample;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i += 1) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + dataBytes, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, numCh, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * numCh * bytesPerSample, true);
  v.setUint16(32, numCh * bytesPerSample, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, dataBytes, true);
  let o = 44;
  for (let i = 0; i < length; i += 1) {
    for (let c = 0; c < numCh; c += 1) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/**
 * Mix several stem blobs into one WAV blob.
 * @returns {Promise<{ blob: Blob, durationSec: number }>}
 */
export async function mixBlobsToWav(blobs) {
  const buffers = await Promise.all(blobs.map(decodeBlob));
  const summed = sumBuffers(buffers);
  if (!summed) throw new Error('Nothing to mix');
  return { blob: encodeWav(summed), durationSec: summed.length / summed.sampleRate };
}

/** Duration of an audio blob, via decode (works before any user gesture). */
export async function blobDurationSec(blob) {
  const b = await decodeBlob(blob);
  return b.duration;
}
