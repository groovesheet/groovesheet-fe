// Spectrum view — every stem's mel spectrogram, tinted in its signature colour
// and composited additively onto one canvas, with a left rail that switches
// each layer (and its audio) on and off.
//
// Why not `react-audio-spectrogram-player` verbatim: that component owns its
// own <audio> element and renders exactly one file, so N stems would mean N
// unsynchronised players. The analysis it performs (mel STFT → dB, clipped
// `topDb` below the peak) lives in src/player/melSpectrogram.js instead, fed by
// the samples the stem engine already downloaded, and the playhead comes from
// the shared transport like every other viewer on this page.
//
// Rendering: one offscreen canvas per stem at analysis resolution (frames ×
// mel bands), redrawn onto the visible canvas only when the enabled set, the
// gain or the size changes. The playhead and the unplayed dimming are DOM
// layers driven by a `--gs-prog` CSS variable — no canvas work per frame.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StatusMessage from '../ui/StatusMessage';
import { computeMelSpectrogram, DEFAULTS, hzToMelFraction } from '../../player/melSpectrogram';

const AXIS_W = 46; // frequency gutter
const RULER_H = 22; // time ruler
const PLOT_H = 420;
const MAX_IMAGE_W = 16000; // stay well inside canvas dimension limits
const GAMMA = 2.2; // pushes the noise floor down so the layers stay legible
// Additive compositing of 5-6 stems saturates to white long before any single
// layer clips, so each one is drawn back a little.
const LAYER_ALPHA = 0.8;
const AXIS_HZ = [50, 100, 250, 500, 1000, 2000, 4000, 8000];

function fmtClock(s) {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  return `${m}:${ss}`;
}

function fmtHz(hz) {
  return hz >= 1000 ? `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)}k` : String(Math.round(hz));
}

/** '#7CC4FF' → [124, 196, 255] */
function hexToRgb(hex) {
  const h = String(hex || '#ffffff').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return Number.isNaN(n) ? [255, 255, 255] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Tint one stem's spectrogram into an offscreen canvas: pixel = colour ×
 * intensity, so compositing several with 'lighter' sums their energy and
 * overlaps bloom toward white.
 */
function paintLayer(spec, color, gain) {
  const { data, frames, nMels } = spec;
  const stride = Math.max(1, Math.ceil(frames / MAX_IMAGE_W));
  const w = Math.ceil(frames / stride);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = nMels;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, nMels);
  const px = img.data;
  const [r, g, b] = hexToRgb(color);

  // 256-entry curve so the per-pixel loop stays a table lookup.
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i += 1) {
    const v = Math.min(1, (i / 255) * gain);
    curve[i] = v ** GAMMA;
  }

  for (let x = 0; x < w; x += 1) {
    const f0 = x * stride;
    const f1 = Math.min(frames, f0 + stride);
    for (let m = 0; m < nMels; m += 1) {
      // Max-pool over the decimated frames so transients survive downsampling.
      let peak = 0;
      for (let f = f0; f < f1; f += 1) {
        const v = data[f * nMels + m];
        if (v > peak) peak = v;
      }
      const v = curve[peak];
      const o = ((nMels - 1 - m) * w + x) * 4; // row 0 = highest band
      px[o] = r * v;
      px[o + 1] = g * v;
      px[o + 2] = b * v;
      px[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export default function SpectrogramView({
  stems,
  stemState,
  onStemChange,
  onSeek,
  transport,
  stemEngine,
  trackId,
  statusText,
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [specs, setSpecs] = useState(null); // Map<name, spec>
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [gain, setGain] = useState(1); // slider position, updates every drag tick
  // Repainting six layers is ~5M pixel writes, far too much to do on every
  // input event — the layers only follow the slider once it settles.
  const [committedGain, setCommittedGain] = useState(1);
  const [hover, setHover] = useState(null); // { x, timeSec, hz }
  const [size, setSize] = useState({ w: 0, h: PLOT_H });

  useEffect(() => {
    if (gain === committedGain) return undefined;
    const id = setTimeout(() => setCommittedGain(gain), 140);
    return () => clearTimeout(id);
  }, [gain, committedGain]);

  const anySolo = useMemo(
    () => Object.values(stemState || {}).some((s) => s && s.solo),
    [stemState]
  );
  const isEnabled = useCallback(
    (name) => {
      const s = (stemState || {})[name] || {};
      return !s.mute && (!anySolo || s.solo);
    },
    [stemState, anySolo]
  );

  // --- analysis ------------------------------------------------------------
  // Runs once per track: pull the already-downloaded stem samples off the
  // engine, mel-transform each one, keep the results for the page's lifetime.
  useEffect(() => {
    if (!stemEngine) return undefined;
    let cancelled = false;
    setSpecs(null);
    setProgress(0);
    setError(null);
    (async () => {
      try {
        const total = stemEngine.getStemNames().length || 1;
        // Fraction transformed per stem, summed for the progress bar: the
        // engine decodes several stems at once, so they land interleaved.
        const done = new Map();
        let any = false;
        await stemEngine.getAnalysisSamples({
          sampleRate: DEFAULTS.sampleRate,
          onStem: async (name, samples) => {
            if (cancelled) return;
            const spec = await computeMelSpectrogram(samples, {}, (p) => {
              if (cancelled) return;
              done.set(name, p);
              let sum = 0;
              done.forEach((v) => { sum += v; });
              setProgress(Math.min(0.999, sum / total));
            });
            if (cancelled) return;
            any = true;
            done.set(name, 1);
            // Draw this layer immediately — waiting for all six before showing
            // anything makes a multi-stem track feel broken.
            setSpecs((prev) => new Map(prev || []).set(name, spec));
          },
        });
        if (cancelled) return;
        if (!any) throw new Error('No stem audio to analyse');
        setProgress(1);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not analyse the stems');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stemEngine, trackId]);

  // --- tinted layers -------------------------------------------------------
  // Painting is ~1M pixel writes per stem, and `specs` grows once per stem as
  // the analysis streams in — cache on (spec identity, colour, gain) so each
  // layer is tinted exactly once per brightness setting.
  const paintCache = useRef(new Map());
  const layers = useMemo(() => {
    if (!specs) return null;
    const map = new Map();
    const cache = paintCache.current;
    stems.forEach((s) => {
      const spec = specs.get(s.name);
      if (!spec) return;
      const hit = cache.get(s.name);
      if (hit && hit.spec === spec && hit.color === s.color && hit.gain === committedGain) {
        map.set(s.name, hit);
        return;
      }
      const entry = { canvas: paintLayer(spec, s.color, committedGain), spec, color: s.color, gain: committedGain };
      cache.set(s.name, entry);
      map.set(s.name, entry);
    });
    return map;
    // `stems` identity changes when client-side waveforms stream in; the colour
    // list behind it does not, so keying on names + colours avoids a repaint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specs, committedGain, stems.map((s) => `${s.name}:${s.color}`).join('|')]);

  const specDuration = useMemo(() => {
    if (!specs) return 0;
    let d = 0;
    specs.forEach((s) => { if (s.durationSec > d) d = s.durationSec; });
    return d;
  }, [specs]);

  // --- sizing --------------------------------------------------------------
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight || PLOT_H });
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layers]);

  // --- composite -----------------------------------------------------------
  const enabledKey = stems.map((s) => (isEnabled(s.name) ? '1' : '0')).join('');
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layers || !size.w) return;
    const dpr = window.devicePixelRatio || 1;
    const w = size.w;
    const h = size.h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#101010';
    ctx.fillRect(0, 0, w, h);

    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = LAYER_ALPHA;
    stems.forEach((s) => {
      const layer = layers.get(s.name);
      if (!layer || !isEnabled(s.name)) return;
      // Stems can differ in length by a frame or two — scale each to its own
      // share of the timeline rather than stretching all of them to the widest.
      const frac = specDuration > 0 ? layer.spec.durationSec / specDuration : 1;
      ctx.drawImage(layer.canvas, 0, 0, w * frac, h);
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, size.w, size.h, enabledKey, specDuration]);

  // --- playhead (CSS variable, no re-render per frame) ---------------------
  useEffect(() => {
    if (!transport) return undefined;
    let raf;
    const tick = () => {
      const el = wrapRef.current;
      if (el) {
        const st = transport.getState();
        const dur = st.durationSec || specDuration;
        const p = dur > 0 ? Math.max(0, Math.min(1, st.positionSec / dur)) : 0;
        el.style.setProperty('--gs-prog', `${(p * 100).toFixed(3)}%`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [transport, specDuration]);

  // --- interaction ---------------------------------------------------------
  const onCanvasClick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width) return;
    onSeek && onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
  };

  const onCanvasMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const fx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const fy = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    // y is inverted: the top row is the highest mel band.
    const spec = specs && specs.values().next().value;
    const melMin = spec ? spec.melMin : 0;
    const melMax = spec ? spec.melMax : 1;
    const mel = melMin + (melMax - melMin) * (1 - fy);
    setHover({ x: fx, timeSec: fx * specDuration, hz: 700 * (10 ** (mel / 2595) - 1) });
  };

  const axisTicks = useMemo(() => {
    const spec = specs && specs.values().next().value;
    if (!spec) return [];
    return AXIS_HZ.map((hz) => ({
      hz,
      frac: hzToMelFraction(hz, spec.melMin, spec.melMax),
    })).filter((t) => t.frac >= 0.02 && t.frac <= 0.99);
  }, [specs]);

  const timeTicks = useMemo(() => {
    if (!specDuration) return [];
    // Aim for roughly one label every 90px at a typical viewer width.
    const target = Math.max(1, Math.round(specDuration / 12));
    const step = [1, 2, 5, 10, 15, 30, 60, 120].find((s) => s >= target) || 120;
    const out = [];
    for (let t = 0; t <= specDuration; t += step) out.push(t);
    return out;
  }, [specDuration]);

  // Keep the progress bar up until every layer has landed, but stop covering
  // the canvas once the first one has something to show.
  const loading = !layers && !error;
  const analysing = !error && progress < 1;

  return (
    <div className="gs-spec-view">
      {/* Left rail — one switch per layer */}
      <aside className="gs-spec-rail">
        <div className="gs-spec-rail-head">
          <span>Layers</span>
          <button
            type="button"
            className="gs-spec-all"
            onClick={() =>
              stems.forEach((s) => onStemChange(s.name, { mute: false, solo: false }))
            }
            title="Show every layer"
          >
            All on
          </button>
        </div>

        {stems.map((s) => {
          const st = (stemState || {})[s.name] || {};
          const on = isEnabled(s.name);
          return (
            <div key={s.name} className={`gs-spec-layer ${on ? 'on' : 'off'}`}>
              <button
                type="button"
                className="gs-spec-swatch"
                style={{ '--layer': s.color }}
                onClick={() => onStemChange(s.name, { mute: !st.mute })}
                title={on ? `Hide & mute ${s.label}` : `Show & unmute ${s.label}`}
                aria-pressed={on}
              />
              <button
                type="button"
                className="gs-spec-layer-name"
                onClick={() => onStemChange(s.name, { mute: !st.mute })}
              >
                <span style={{ color: on ? s.color : undefined }}>{s.label}</span>
                <span className="gs-spec-layer-sub">{s.sub}</span>
              </button>
              <button
                type="button"
                className={`gs-ms-btn s ${st.solo ? 'on' : ''}`}
                onClick={() => onStemChange(s.name, { solo: !st.solo })}
                title="Solo"
              >
                S
              </button>
            </div>
          );
        })}

        <div className="gs-spec-gain">
          <label htmlFor="gs-spec-gain">Brightness</label>
          <input
            id="gs-spec-gain"
            className="gs-slider"
            type="range"
            min="50"
            max="250"
            step="5"
            value={Math.round(gain * 100)}
            onChange={(e) => setGain(parseInt(e.target.value, 10) / 100)}
            style={{ width: '100%', '--fill': `${((gain * 100 - 50) / 200) * 100}%` }}
          />
        </div>

        <p className="gs-spec-note">
          Mel spectrogram, {DEFAULTS.fMin}–{fmtHz(DEFAULTS.fMax)}Hz · layers add
          together, so overlapping energy burns white.
        </p>
      </aside>

      {/* Plot */}
      <div className="gs-spec-main">
        <div className="gs-spec-plot">
          <div className="gs-spec-axis" style={{ width: AXIS_W }}>
            {axisTicks.map((t) => (
              <span key={t.hz} style={{ bottom: `${t.frac * 100}%` }}>
                {fmtHz(t.hz)}
              </span>
            ))}
          </div>

          {/* wrapRef sits on the canvas box, not the plot: the canvas backing
              store and the `--gs-prog` playhead must both measure the drawing
              area only, with the frequency gutter excluded. */}
          <div
            className="gs-spec-canvas-wrap"
            ref={wrapRef}
            style={{ marginLeft: AXIS_W, height: PLOT_H }}
          >
            {loading && (
              <div className="gs-spec-loading">
                <div className="gs-spec-bar">
                  <div style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <span>Analysing stems… {Math.round(progress * 100)}%</span>
              </div>
            )}
            {error && (
              <div style={{ padding: 24, maxWidth: 460 }}>
                <StatusMessage variant="error" title="Spectrum unavailable">
                  {error}
                </StatusMessage>
              </div>
            )}
            {!loading && !error && (
              <>
                <canvas
                  ref={canvasRef}
                  className="gs-spec-canvas"
                  style={{ width: '100%', height: PLOT_H }}
                  onClick={onCanvasClick}
                  onMouseMove={onCanvasMove}
                  onMouseLeave={() => setHover(null)}
                />
                {/* Unplayed side sits slightly back, like the stems waveform. */}
                <div className="gs-spec-unplayed" />
                <div className="gs-spec-playhead" />
                {hover && (
                  <div className="gs-spec-hover" style={{ left: `${hover.x * 100}%` }}>
                    <span>{fmtClock(hover.timeSec)}</span>
                    <span>{fmtHz(Math.round(hover.hz))}Hz</span>
                  </div>
                )}
                {analysing && (
                  <div className="gs-spec-strip">
                    <div className="gs-spec-bar">
                      <div style={{ width: `${Math.round(progress * 100)}%` }} />
                    </div>
                    <span>Adding layers… {Math.round(progress * 100)}%</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="gs-spec-ruler" style={{ marginLeft: AXIS_W, height: RULER_H }}>
          {specDuration > 0 &&
            timeTicks.map((t) => (
              <span key={t} style={{ left: `${(t / specDuration) * 100}%` }}>
                {fmtClock(t)}
              </span>
            ))}
        </div>

        <div className="gs-spec-foot">
          <span>
            {stems.filter((s) => isEnabled(s.name)).length}/{stems.length} layers visible · click
            the spectrum to seek
          </span>
          {statusText && <span>{statusText}</span>}
        </div>
      </div>
    </div>
  );
}
