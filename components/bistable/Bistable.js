import React, { useCallback, useEffect, useRef, useState } from 'react';
import StatusMessage from '@/components/ui/StatusMessage';
import useMidiKeyboard from './useMidiKeyboard';
import usePianoSound from './usePianoSound';
import { createFluidSim } from './fluidSim';
import { createParticleField } from './particleField';
import { buildKeyLayout, keyAtPoint, noteName, isBlackKey } from './keyLayout';
import {
  gridToTransform, loadGrid, saveGrid, resetGrid, isBaseQuad, at as gridAt,
  insertColumn, insertRow, removeColumn, removeRow, edgeHit,
} from './projection';
import { createMeshWarp } from './warpMesh';
import useSongPlayback, { DEFAULT_TRACK_ID } from './useSongPlayback';
import SongTransport from './SongTransport';
import { drawFallingNotes } from './fallingNotes';
import './Bistable.css';

/**
 * Bistable — /bistable: a live 88-key keyboard that lights up the key you
 * press on a connected MIDI controller, sounds a grand piano, and rises
 * light out of the played keys.
 *
 * "Bistable" as in each key has exactly two states: down or up. Note-on lights
 * it, note-off clears it. Sustain is deliberately ignored — the display tracks
 * the physical key, not the sounding note.
 *
 * Every note-on plants an EMITTER at the key; it emits only while the key is
 * down. Each emitted particle then transitions color over its OWN lifetime —
 * shot out bright yellow, turning pink, settling bright blue as it rises —
 * so the gradient lives in the flight, not in the emission. Render modes:
 *   - 'particles': discrete glowing squares (particleField.js) — crisp,
 *     no smearing.
 *   - 'fluid': dye in a WebGL Navier-Stokes sim (fluidSim.js) — ink plumes.
 *     (Dye can't re-tint after injection, so there the color follows the
 *     hold duration instead.)
 *   - 'both': squares over a faint plume.
 *
 * The floating "Fluid tuning" panel exposes every parameter as a live slider
 * plus one-click PRESETS; the chosen values persist in localStorage. Tune by
 * eye, then bake winners into DEFAULT_TUNING / PRESETS.
 *
 * Sound is the same acoustic grand the rest of the site plays (usePianoSound).
 * Keys are also clickable, so the page works without hardware.
 *
 * PROJECTION: press P for projection mode — all UI chrome drops away and the
 * stage goes fullscreen-black. Press C there to warp the image onto a physical
 * surface: drag the corner nodes, or CLICK AN EDGE to add a node and bend the
 * mapping locally (double-click a node to remove it). K hides the on-screen
 * keyboard when a real piano stands in for it.
 *
 * Four corners stay a pure CSS matrix3d — free, and the common case. Adding
 * nodes switches rendering to the WebGL mesh path (warpMesh.js), which
 * composites the three canvases and draws them through the warp grid.
 */

const WHITE_KEY = '#f5f5ef';
const WHITE_KEY_EDGE = '#c9c9c2';
const BLACK_KEY = '#1a1a1a';
const LIT = '#012FA7'; // GrooveSheet brand blue
const LIT_BLACK = '#3f74e8'; // brightened so it reads against the black key
const HIT_LINE = '#012FA7';

// Keyboard takes the bottom slice of the 2D canvas; the effects own the rest.
// 11/28 keeps the keys at the exact proportions of the old full-canvas layout;
// the keyHeight slider scales it, and keyWidth narrows the played span so the
// on-screen octaves can be lined up with a real keyboard under the projection.
const KEY_FRACTION = 11 / 28;

// ---- tunables — every one of these is a slider on the panel ---------------
// mode: 'particles' | 'fluid' | 'both'
const DEFAULT_TUNING = {
  mode: 'fluid',
  burstPower: 260, // note-on impulse: higher = shoots higher
  risePower: 150, //  sustained stream lift while held
  damp: 0.2, //       velocity decay: LOWER = travels farther/higher
  curl: 50, //        fluid swirl - high curl folds the stream into filaments
  inkFade: 0.08, //   fluid dye fade; particles: lifetime = ~0.4/inkFade s
  splatSize: 0.2, //  fluid splat radius; particles: ember size scale
  emitRate: 0.5, //   fluid: stream dye amount; particles: puff odds per frame
  colorTime: 2.6, //  particles only: seconds from yellow to blue
  couple: 3, //       how strongly particles ride each other's flow (0 = off)
  keyHeight: 1, //    white-key height: multiplier on the keyboard's canvas share
  keyWidth: 1, //     fraction of the canvas width the 88 keys span (centred)
  blackHeight: 0.62, // black-key length as a fraction of the white-key length
  blackWidth: 0.6, //  black-key width as a fraction of a white key
};

const PRESETS = [
  { name: 'Marble ink', values: { ...DEFAULT_TUNING } },
  {
    name: 'Sparks',
    values: { mode: 'particles', burstPower: 380, risePower: 110, damp: 1.1, curl: 14, inkFade: 0.16, splatSize: 0.045, emitRate: 0.5, colorTime: 2.6, couple: 3 },
  },
  {
    name: 'Ember drift',
    values: { mode: 'particles', burstPower: 180, risePower: 60, damp: 0.6, curl: 8, inkFade: 0.07, splatSize: 0.06, emitRate: 0.28, colorTime: 4.5, couple: 2 },
  },
  {
    name: 'Fireflies',
    values: { mode: 'particles', burstPower: 90, risePower: 35, damp: 1.8, curl: 20, inkFade: 0.045, splatSize: 0.03, emitRate: 0.75, colorTime: 5, couple: 1 },
  },
  {
    name: 'Aurora',
    values: { mode: 'both', burstPower: 200, risePower: 90, damp: 0.8, curl: 26, inkFade: 0.12, splatSize: 0.04, emitRate: 0.35, colorTime: 3.5, couple: 4 },
  },
];

const SLIDERS = [
  { key: 'burstPower', label: 'Shoot power', min: 40, max: 800, step: 10 },
  { key: 'risePower', label: 'Rise speed', min: 10, max: 400, step: 5 },
  { key: 'damp', label: 'Drag (lower = higher)', min: 0.05, max: 2.5, step: 0.05 },
  { key: 'curl', label: 'Swirl / wander', min: 0, max: 60, step: 1 },
  { key: 'inkFade', label: 'Fade (lower = lasts)', min: 0.02, max: 1, step: 0.01 },
  { key: 'splatSize', label: 'Size', min: 0.01, max: 0.4, step: 0.005 },
  { key: 'emitRate', label: 'Emission amount', min: 0.05, max: 1, step: 0.05 },
  { key: 'colorTime', label: 'Yellow→blue seconds', min: 0.8, max: 8, step: 0.2 },
  { key: 'couple', label: 'Flow coupling', min: 0, max: 8, step: 0.25 },
  { key: 'keyHeight', label: 'White key height', min: 0.2, max: 2.2, step: 0.05 },
  { key: 'keyWidth', label: 'White key width', min: 0.25, max: 1, step: 0.01 },
  { key: 'blackHeight', label: 'Black key height', min: 0.15, max: 1, step: 0.01 },
  { key: 'blackWidth', label: 'Black key width', min: 0.2, max: 1, step: 0.01 },
];

const MODES = [
  { id: 'particles', label: 'Particles' },
  { id: 'fluid', label: 'Fluid' },
  { id: 'both', label: 'Both' },
];

// v4: marble-ink fluid default with pitch-band colors; resets stale settings.
const TUNING_STORE_KEY = 'bistable-fluid-tuning-v4';

function loadTuning() {
  try {
    const raw = localStorage.getItem(TUNING_STORE_KEY);
    if (!raw) return { ...DEFAULT_TUNING };
    return { ...DEFAULT_TUNING, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_TUNING };
  }
}

/** Particle lifetime in seconds from the shared fade slider. */
const particleLife = (inkFade) => Math.min(9, Math.max(1, 0.4 / inkFade));

// ---- color ----------------------------------------------------------------
// The emission's hue is a function of the EMITTER's age — the same journey
// every press: bright yellow at note-on, through pink, settling at bright
// blue. Fractions of `colorTime`, hues on an unwrapped scale so the
// interpolation never snaps (-30 = 330° pink, -125 = 235° bright blue).
const HUE_JOURNEY = [
  [0.0, 58], // bright yellow
  [0.18, 45], // hold warm through the attack
  [0.55, -30], // pink
  [1.0, -125], // bright blue
];

function hsv2rgb(h, s, v) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

/** Emission color for an emitter aged `ageSec`, over a `colorTime` journey. */
function dyeForAge(ageSec, colorTime) {
  const frac = Math.min(1, ageSec / Math.max(0.1, colorTime));
  const kf = HUE_JOURNEY;
  let hue = kf[kf.length - 1][1];
  for (let i = 1; i < kf.length; i += 1) {
    if (frac <= kf[i][0]) {
      const [t0, h0] = kf[i - 1];
      const [t1, h1] = kf[i];
      hue = h0 + ((frac - t0) / (t1 - t0)) * (h1 - h0);
      break;
    }
  }
  return hsv2rgb(((hue % 360) + 360) % 360, 0.95, 1.0);
}

const rand = (lo, hi) => lo + Math.random() * (hi - lo);

// FLUID mode paints like the reference clip: each register owns a stable
// vivid color (side-by-side plumes - gold bass, pink mids, cyan treble)
// rather than cycling over time; dye can't re-tint after injection anyway.
// Values are dye amounts; >1 channels overdrive the bloom into white-hot cores.
const FLUID_BANDS = [
  { max: 49, rgb: [1.15, 0.4, 0.02] }, // gold / orange
  { max: 69, rgb: [1.15, 0.1, 0.45] }, // pink / magenta
  { max: 128, rgb: [0.12, 0.75, 1.2] }, // cyan / ice
];

function fluidBandColor(midi) {
  const { rgb } = FLUID_BANDS.find((b) => midi <= b.max);
  const v = rand(0.9, 1.1); // slight per-press variation
  return [rgb[0] * v, rgb[1] * v, rgb[2] * v];
}

/** Velocity 1..127 -> 0.55..1.0 opacity, so a soft press glows softer. */
const velocityAlpha = (velocity) => 0.55 + (0.45 * Math.min(velocity, 127)) / 127;

export default function Bistable() {
  const canvasRef = useRef(null);
  const fluidCanvasRef = useRef(null);
  const particleCanvasRef = useRef(null);
  const fluidRef = useRef(null);
  const particleFieldRef = useRef(null);
  const layoutRef = useRef(null); // { whites, blacks, whiteWidth, keyTop, byMidi }
  const resizeRef = useRef(null); // re-layout hook for keyboard-size changes
  const rafRef = useRef(null);
  const pointerNoteRef = useRef(null);
  const prevHeldRef = useRef(new Set());
  const emittersRef = useRef(new Map()); // midi -> emitter (survives note-off)
  const lastFrameRef = useRef(0);

  const [tuning, setTuning] = useState(loadTuning);
  const tuningRef = useRef(tuning);

  const [soundOn, setSoundOn] = useState(true);
  const soundOnRef = useRef(soundOn);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);

  const [panelOpen, setPanelOpen] = useState(true);

  // --- projection -----------------------------------------------------
  const [projecting, setProjecting] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [grid, setGrid] = useState(loadGrid);
  const gridRef = useRef(grid);
  const gridRevRef = useRef(0); // mesh-cache key; cheaper than hashing per frame
  useEffect(() => { gridRef.current = grid; }, [grid]);
  const warpCanvasRef = useRef(null);
  const compositeRef = useRef(null);
  const meshWarpRef = useRef(null);
  const [showKeys, setShowKeys] = useState(true);
  const showKeysRef = useRef(showKeys);
  useEffect(() => { showKeysRef.current = showKeys; }, [showKeys]);
  const stageRef = useRef(null);
  const guideRef = useRef(null);
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 });

  const commitGrid = useCallback((next) => {
    setGrid(next);
    gridRef.current = next;
    gridRevRef.current += 1;
    saveGrid(next);
  }, []);

  const resetWarp = useCallback(() => commitGrid(resetGrid()), [commitGrid]);

  /** Click near an edge inserts a node there; the image must not shift. */
  const addNodeAt = useCallback((x, y) => {
    const g = gridRef.current;
    const hit = edgeHit(g, x, y);
    if (!hit) return false;
    commitGrid(hit.axis === 'u' ? insertColumn(g, hit.s) : insertRow(g, hit.s));
    return true;
  }, [commitGrid]);

  /** Double-clicking an interior node removes its whole row or column. */
  const removeNode = useCallback((col, row) => {
    const g = gridRef.current;
    if (col > 0 && col < g.us.length - 1) commitGrid(removeColumn(g, col));
    else if (row > 0 && row < g.vs.length - 1) commitGrid(removeRow(g, row));
  }, [commitGrid]);

  const piano = usePianoSound(true);

  // Every note change — MIDI or mouse — flows through these into the piano.
  // The visuals are driven from the draw loop instead (it diffs held keys per
  // frame), so they stay identical with sound muted.
  const { status, error, inputs, active, activeRef, noteOn, noteOff, allNotesOff } =
    useMidiKeyboard(true, {
      onNoteOn: (midi, velocity) => { if (soundOnRef.current) piano.noteOn(midi, velocity); },
      onNoteOff: (midi) => piano.noteOff(midi), // always release, even while muted
      onAllNotesOff: () => piano.allNotesOff(),
    });

  // Muting mid-chord must not leave held notes ringing forever.
  useEffect(() => {
    if (!soundOn) piano.allNotesOff();
  }, [soundOn, piano]);

  // ---- song playback (falling keys + stems) ------------------------------
  // ?track= lets a session open on any library track without a rebuild.
  const [trackId, setTrackId] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('track') || DEFAULT_TRACK_ID;
    } catch (e) {
      return DEFAULT_TRACK_ID;
    }
  });
  const song = useSongPlayback({ trackId });
  // Destructured for the key handler's dependency list: naming `song.toggle`
  // there would make the whole hook result a dependency and re-bind the
  // listener on every playback tick.
  const { toggle: songToggle, seekBy: songSeekBy } = song;
  const schedulerRef = useRef(null);
  useEffect(() => { schedulerRef.current = song.scheduler; }, [song.scheduler]);
  // Notes the SONG is holding, so playback can release its own without
  // stealing a key the player is physically holding down.
  const songHeldRef = useRef(new Set());

  const releaseSongNotes = useCallback(() => {
    songHeldRef.current.forEach((midi) => noteOff(midi));
    songHeldRef.current = new Set();
  }, [noteOff]);

  // A pause or a seek must not strand the notes that were sounding.
  useEffect(() => {
    const t = song.transport;
    if (!t) return undefined;
    let wasPlaying = t.getState().isPlaying;
    return t.subscribe((s) => {
      if (wasPlaying && !s.isPlaying) releaseSongNotes();
      wasPlaying = s.isPlaying;
    });
  }, [song.transport, releaseSongNotes]);

  /**
   * One frame of song playback, called from the draw loop.
   *
   * Lives behind a ref, refreshed each render, so the draw-loop effect never
   * has to list the song as a dependency — re-running it would tear down the
   * canvases and the fluid sim on every track change.
   *
   * Returns the transport position so the same number that chose the notes
   * also places them on screen. While paused nothing is held (a stopped
   * playhead must not leave a chord ringing), but the position is still
   * returned so the roll keeps rendering under the playhead as you scrub.
   */
  const driveSongRef = useRef(() => null);
  useEffect(() => {
    driveSongRef.current = () => {
      const scheduler = song.scheduler;
      const t = song.transport;
      if (!scheduler || !t) return null;
      const pos = t.getPosition();
      const want = t.getState().isPlaying ? scheduler.heldAt(pos) : null;
      const cur = songHeldRef.current;

      if (!want) {
        if (cur.size) releaseSongNotes();
        return pos;
      }
      // Release first so a repeated pitch retriggers cleanly.
      cur.forEach((midi) => {
        if (!want.has(midi)) { noteOff(midi); cur.delete(midi); }
      });
      want.forEach((velocity, midi) => {
        if (!cur.has(midi)) { noteOn(midi, velocity); cur.add(midi); }
      });
      return pos;
    };
  });

  const [showLabels, setShowLabels] = useState(true);
  const showLabelsRef = useRef(showLabels);
  useEffect(() => { showLabelsRef.current = showLabels; }, [showLabels]);

  // Apply a tuning change: state (UI), ref (draw loop), sim config (live),
  // localStorage (survives reload).
  const applyTuning = useCallback((next) => {
    const prev = tuningRef.current;
    setTuning(next);
    tuningRef.current = next;
    if (prev.keyHeight !== next.keyHeight || prev.keyWidth !== next.keyWidth
      || prev.blackHeight !== next.blackHeight || prev.blackWidth !== next.blackWidth) {
      resizeRef.current?.(); // key geometry is cached in layoutRef; rebuild it
    }
    const fluid = fluidRef.current;
    if (fluid) {
      fluid.config.VELOCITY_DISSIPATION = next.damp;
      fluid.config.CURL = next.curl;
      fluid.config.DENSITY_DISSIPATION = next.inkFade;
    }
    try { localStorage.setItem(TUNING_STORE_KEY, JSON.stringify(next)); } catch (e) { /* private mode */ }
  }, []);

  // ---- effect layers (fluid WebGL + particle 2D, behind the keyboard) -----
  useEffect(() => {
    const fluidCanvas = fluidCanvasRef.current;
    const particleCanvas = particleCanvasRef.current;
    if (!fluidCanvas || !particleCanvas) return undefined;

    particleFieldRef.current = createParticleField(particleCanvas);

    const t = tuningRef.current;
    let sim = null;
    try {
      sim = createFluidSim(fluidCanvas, {
        SIM_RESOLUTION: 128,
        DYE_RESOLUTION: 1024,
        DENSITY_DISSIPATION: t.inkFade,
        VELOCITY_DISSIPATION: t.damp,
        CURL: t.curl,
        SPLAT_RADIUS: t.splatSize,
        PRESSURE: 0.8,
        SHADING: true,
        COLORFUL: false, // colors are ours, no random hue cycling
        BLOOM: true,
        BLOOM_INTENSITY: 0.6,
        SUNRAYS: true,
        BACK_COLOR: { r: 12, g: 16, b: 12 }, // #0c100c, matching the page
      });
      fluidRef.current = sim;
    } catch (e) {
      // No WebGL — particles still work; only 'fluid' mode goes dark.
      console.warn('[bistable] fluid sim unavailable:', e);
    }

    return () => {
      fluidRef.current = null;
      particleFieldRef.current = null;
      if (sim) sim.destroy();
    };
  }, []);

  // ---- mesh warp (only used once the grid is subdivided) -----------------
  useEffect(() => {
    const canvas = warpCanvasRef.current;
    if (!canvas) return undefined;
    const warp = createMeshWarp(canvas);
    if (!warp) {
      console.warn('[bistable] WebGL mesh warp unavailable; corner-pin only');
      return undefined;
    }
    meshWarpRef.current = warp;
    compositeRef.current = document.createElement('canvas');
    return () => {
      meshWarpRef.current = null;
      compositeRef.current = null;
      warp.destroy();
    };
  }, []);

  // ---- render loop (2D keyboard + emitter-driven effects) -----------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      // offsetWidth/Height, not getBoundingClientRect: in projection mode the
      // stage carries a CSS matrix3d, and getBoundingClientRect would report
      // the WARPED box — every bit of geometry below must stay in unwarped
      // layout space.
      const cw = canvas.offsetWidth;
      const ch = canvas.offsetHeight;
      if (!cw || !ch) return; // not laid out yet — the observer will call back
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(cw * dpr));
      const h = Math.max(1, Math.round(ch * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      const T = tuningRef.current;
      const keyHeight = Math.max(4, Math.round(h * KEY_FRACTION * T.keyHeight));
      const keyTop = h - keyHeight;
      // Narrowing the span keeps the keyboard centred, so it can be lined up
      // with a real piano of a different width under the projection.
      const span = Math.max(1, Math.round(w * T.keyWidth));
      const keyLeft = Math.round((w - span) / 2);
      const layout = buildKeyLayout(span, keyHeight, {
        widthRatio: T.blackWidth,
        heightRatio: T.blackHeight,
      });
      const shift = (k) => ({ ...k, x: k.x + keyLeft });
      const whites = layout.whites.map(shift);
      const blacks = layout.blacks.map(shift);
      const byMidi = new Map();
      whites.forEach((k) => byMidi.set(k.midi, k));
      blacks.forEach((k) => byMidi.set(k.midi, k));
      // Layout is in backing-store pixels; pointer coords get scaled to match.
      layoutRef.current = {
        ...layout, whites, blacks, keyTop, keyLeft, span, byMidi,
      };
    };

    resize();
    resizeRef.current = resize; // so a keyboard-size change can re-lay it out
    // A plain window-resize listener misses the cases that actually matter here:
    // the first layout pass (rect is still 0x0 when the effect runs) and the
    // reflow when a status banner appears or disappears above the keyboard.
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener('resize', resize); // catches DPR changes on monitor switch

    const draw = (now) => {
      const w = canvas.width;
      const h = canvas.height;
      const L = layoutRef.current;
      if (!L) { rafRef.current = requestAnimationFrame(draw); return; }

      // Clamped dt so a background-tab pause doesn't teleport particles.
      const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameRef.current) / 1000));
      lastFrameRef.current = now;

      // Song first: it presses and releases keys through the SAME noteOn /
      // noteOff the controller uses, so everything below — lit keys, emitters,
      // ink — treats a landing note exactly like a human press. It mutates
      // activeRef synchronously, so this frame already sees the result.
      const songPos = driveSongRef.current();

      const held = activeRef.current;
      const labels = showLabelsRef.current;
      const T = tuningRef.current;
      const glow = 40 * (w / 3840); // key glow, matching the video roll's convention

      const wantParticles = T.mode !== 'fluid';
      const wantFluid = T.mode !== 'particles';
      const fluid = wantFluid ? fluidRef.current : null;
      const field = particleFieldRef.current;

      const prev = prevHeldRef.current;
      const emitters = emittersRef.current;

      // Geometry shared by both effect layers (they fill the same container;
      // the keyboard canvas hugs its bottom). Everything derives from the
      // particle canvas' box, which always exists.
      const pCanvas = particleCanvasRef.current;
      if (field && pCanvas && field.resize()) {
        const pW = pCanvas.offsetWidth;
        const pH = pCanvas.offsetHeight;
        // Spawn at the keys' top edge, wherever the key-height slider put it.
        const keyCssHeight = h > 0
          ? canvas.offsetHeight * (1 - L.keyTop / h)
          : canvas.offsetHeight * KEY_FRACTION;
        const pDpr = pW > 0 ? pCanvas.width / pW : 1;
        const spawnY = pCanvas.height - keyCssHeight * pDpr; // keys' top edge, particle px
        const yBase = pH > 0
          ? Math.min(0.95, keyCssHeight / pH + 0.012) // same edge, fluid texcoords
          : KEY_FRACTION + 0.015;
        const pxScale = pCanvas.width / 1920; // speeds/sizes tuned at 1920 wide
        const emberSize = T.splatSize * 80 * pxScale;
        const life = particleLife(T.inkFade);
        const baseRadius = T.splatSize;

        // Fresh presses plant (or re-arm) an emitter and fire the burst.
        held.forEach((velocity, midi) => {
          if (prev.has(midi)) return;
          const k = L.byMidi.get(midi);
          if (!k) return;
          const vel01 = Math.min(velocity, 127) / 127;
          const em = {
            x: (k.x + k.w / 2) / w,
            kw: k.w / w,
            midi,
            vel01,
            start: now,
            lean: rand(-0.4, 0.4), // whole plume tilts left or right
            swaySpeed: rand(160, 480),
            swayPhase: rand(0, Math.PI * 2),
            swayPhase2: rand(0, Math.PI * 2), // second frequency for ink folding
            rgb: fluidBandColor(midi), // stable for the whole press (fluid mode)
          };
          emitters.set(midi, em);
          const sparks = 2 + Math.round(rand(0, 2) + vel01 * 3);
          if (wantParticles) {
            for (let i = 0; i < sparks; i += 1) {
              const angle = -Math.PI / 2 + em.lean + rand(-0.5, 0.5); // screen coords: up
              const speed = T.burstPower * rand(0.6, 1.3) * (0.5 + vel01 * 0.7);
              field.spawn(
                (em.x + rand(-em.kw, em.kw)) * pCanvas.width,
                spawnY - rand(0, 8) * pxScale,
                angle,
                speed * pxScale,
                emberSize * rand(0.5, 1.5),
                life * rand(0.7, 1.2),
              );
            }
          }
          if (fluid) {
            // one decisive kick in this press's color starts the column
            const [br, bg, bb] = em.rgb;
            const kick = 0.5 + 0.5 * vel01;
            fluid.config.SPLAT_RADIUS = baseRadius * 1.4;
            fluid.splat(
              em.x, yBase + 0.01,
              em.lean * 120, T.burstPower * kick,
              { r: br * 0.6, g: bg * 0.6, b: bb * 0.6 },
            );
          }
        });

        // Emitters live only while their key is down. New particles are
        // always born yellow (age 0); the journey to pink and blue happens
        // in each particle's own flight.
        emitters.forEach((em, midi) => {
          if (!held.has(midi)) { emitters.delete(midi); return; }
          if (wantParticles && Math.random() < T.emitRate) {
            const sway = Math.sin(now / em.swaySpeed + em.swayPhase) * 0.35 + em.lean * 0.4;
            const speed = T.risePower * rand(0.6, 1.4) * (0.7 + em.vel01 * 0.5);
            const angle = -Math.PI / 2 + sway * 0.8 + rand(-0.15, 0.15);
            field.spawn(
              (em.x + rand(-em.kw * 0.7, em.kw * 0.7)) * pCanvas.width,
              spawnY - rand(0, 5) * pxScale,
              angle,
              speed * pxScale,
              emberSize * rand(0.4, 1.1),
              life * rand(0.6, 1.1),
            );
          }
          if (fluid) {
            // Marbling needs an UNBROKEN stream: inject every frame at a
            // point that wanders on two frequencies. The slow sway bends the
            // column; the fast flutter is what the curl folds into those
            // fine parallel filaments.
            const wander = Math.sin(now / em.swaySpeed + em.swayPhase) * em.kw * 1.6
              + Math.sin(now / 53 + em.swayPhase2) * em.kw * 0.5;
            const [sr, sg, sb] = em.rgb;
            const amt = 0.06 + 0.14 * T.emitRate; // per-frame dye, steady
            const lift = T.risePower * (1.4 + 0.8 * em.vel01);
            fluid.config.SPLAT_RADIUS = baseRadius * rand(0.85, 1.15);
            fluid.splat(
              em.x + wander, yBase + 0.008,
              wander * 260 + em.lean * 60, lift,
              { r: sr * amt, g: sg * amt, b: sb * amt },
            );
          }
        });

        if (fluid) fluid.config.SPLAT_RADIUS = baseRadius;
        prevHeldRef.current = new Set(held.keys());

        // Physics + render for the ember layer. Buoyancy keeps dead-slow
        // embers drifting up instead of hanging; wander comes from the
        // shared swirl slider.
        field.step(dt, {
          damp: T.damp,
          buoy: (20 + T.risePower * 0.25) * pxScale,
          wander: T.curl * 0.12 * pxScale,
          couple: T.couple,
        });
        field.draw(now, (ageSec) => dyeForAge(ageSec, T.colorTime));
      }

      // -- 2D layer: transparent above the keys so the effects show through -
      ctx.clearRect(0, 0, w, h);

      // The roll is drawn ahead of the K check: with a real piano standing in
      // for the drawn keys, the falling notes are the whole point of the
      // projection and must survive the keyboard being hidden.
      if (schedulerRef.current && songPos != null) {
        drawFallingNotes(ctx, schedulerRef.current, songPos, L, { width: w });
      }

      // With a real piano under the projection the on-screen keys are just
      // noise, so K drops them (and the hit line) without touching geometry.
      if (!showKeysRef.current) { drawWarp(); rafRef.current = requestAnimationFrame(draw); return; }

      // hit line separating effect space from keys, like the video roll's
      const lineH = Math.max(2, 3 * (w / 1920));
      ctx.fillStyle = HIT_LINE;
      ctx.fillRect(L.keyLeft, L.keyTop - lineH, L.span, lineH);

      ctx.save();
      ctx.translate(0, L.keyTop);

      // White keys first — blacks overlap them.
      for (const k of L.whites) {
        const velocity = held.get(k.midi);
        ctx.fillStyle = WHITE_KEY;
        ctx.fillRect(k.x, k.y, k.w, k.h);
        if (velocity !== undefined) {
          ctx.save();
          ctx.globalAlpha = velocityAlpha(velocity);
          ctx.fillStyle = LIT;
          ctx.shadowColor = LIT;
          ctx.shadowBlur = glow;
          ctx.fillRect(k.x, k.y, k.w, k.h);
          ctx.restore();
        }
        ctx.strokeStyle = WHITE_KEY_EDGE;
        ctx.lineWidth = 1;
        ctx.strokeRect(k.x, k.y, k.w, k.h);
      }

      for (const k of L.blacks) {
        const velocity = held.get(k.midi);
        ctx.fillStyle = BLACK_KEY;
        ctx.fillRect(k.x, k.y, k.w, k.h);
        if (velocity !== undefined) {
          ctx.save();
          ctx.globalAlpha = velocityAlpha(velocity);
          ctx.fillStyle = LIT_BLACK;
          ctx.shadowColor = LIT_BLACK;
          ctx.shadowBlur = glow;
          ctx.fillRect(k.x, k.y, k.w, k.h);
          ctx.restore();
        }
      }

      // C labels give you a landmark for reading position at a glance.
      if (labels) {
        ctx.fillStyle = '#8c8c86';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = `600 ${Math.round(L.whiteWidth * 0.42)}px "Hubot Sans", Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        for (const k of L.whites) {
          if (k.midi % 12 !== 0) continue; // C only
          ctx.fillText(noteName(k.midi), k.x + k.w / 2, k.h - L.whiteWidth * 0.25);
        }
      }

      ctx.restore();

      drawWarp();
      rafRef.current = requestAnimationFrame(draw);
    };

    /**
     * Subdivided grids can't be a CSS matrix, so the three stacked canvases
     * are flattened into one image and drawn through the warp mesh. Skipped
     * entirely while the grid is a plain quad — that path stays pure CSS.
     */
    const drawWarp = () => {
      const g = gridRef.current;
      const warp = meshWarpRef.current;
      const composite = compositeRef.current;
      if (!warp || !composite || isBaseQuad(g)) return;
      const out = warpCanvasRef.current;
      if (!out || !out.offsetWidth) return;

      const cw = canvas.width;
      const ch = canvas.height;
      if (!cw || !ch) return;
      if (composite.width !== cw) composite.width = cw;
      if (composite.height !== ch) composite.height = ch;
      const cctx = composite.getContext('2d');
      cctx.clearRect(0, 0, cw, ch);
      const fluidCanvas = fluidCanvasRef.current;
      const partCanvas = particleCanvasRef.current;
      if (fluidCanvas && fluidCanvas.width) cctx.drawImage(fluidCanvas, 0, 0, cw, ch);
      if (partCanvas && partCanvas.width) cctx.drawImage(partCanvas, 0, 0, cw, ch);
      cctx.drawImage(canvas, 0, 0, cw, ch);

      warp.render(composite, g, gridRevRef.current);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [activeRef]);

  // ---- click / touch to play (works without hardware) --------------------
  const noteAtEvent = useCallback((event) => {
    const canvas = canvasRef.current;
    const L = layoutRef.current;
    if (!canvas || !L) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    return keyAtPoint(L, x, y - L.keyTop); // key rects live below the effect zone
  }, []);

  const handlePointerDown = useCallback((event) => {
    const midi = noteAtEvent(event);
    if (midi == null) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerNoteRef.current = midi;
    noteOn(midi, 100);
  }, [noteAtEvent, noteOn]);

  const handlePointerMove = useCallback((event) => {
    if (pointerNoteRef.current == null) return;
    const midi = noteAtEvent(event);
    if (midi === pointerNoteRef.current) return;
    noteOff(pointerNoteRef.current); // glissando: release the old key, light the new
    pointerNoteRef.current = midi;
    if (midi != null) noteOn(midi, 100);
  }, [noteAtEvent, noteOn, noteOff]);

  const handlePointerUp = useCallback(() => {
    if (pointerNoteRef.current == null) return;
    noteOff(pointerNoteRef.current);
    pointerNoteRef.current = null;
  }, [noteOff]);

  // Stage size drives the warp matrix; it changes on resize and whenever
  // projection mode swaps the stage between inline and fullscreen.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const measure = () => setStageBox({ w: stage.offsetWidth, h: stage.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [projecting]);

  useEffect(() => {
    const onKey = (e) => {
      // Never steal keys from the tuning sliders / checkboxes.
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      // Transport by keyboard: in projection mode every control is hidden, so
      // these are the only way to drive the song.
      if (e.key === ' ' || e.code === 'Space') songToggle();
      else if (e.key === 'ArrowLeft') songSeekBy(-5);
      else if (e.key === 'ArrowRight') songSeekBy(5);
      else if (k === 'p') { setProjecting((v) => !v); setCalibrating(false); }
      else if (k === 'r' && calibrating) resetWarp();
      else if (k === 'c') setCalibrating((v) => !v);
      else if (k === 'k') setShowKeys((v) => !v);
      else if (k === 'f') {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else document.documentElement.requestFullscreen?.().catch(() => { /* denied */ });
      } else if (e.key === 'Escape') {
        if (calibrating) setCalibrating(false);
        else if (projecting) setProjecting(false);
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [projecting, calibrating, resetWarp, songToggle, songSeekBy]);

  // A tab-switch can swallow the note-off and leave keys stuck lit.
  useEffect(() => {
    const onBlur = () => allNotesOff();
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [allNotesOff]);

  const heldNotes = [...active.keys()].sort((a, b) => a - b);
  const meshMode = !isBaseQuad(grid);
  const warp = meshMode ? 'none' : gridToTransform(grid, stageBox.w, stageBox.h);
  const nodeCols = grid.us.length;

  /**
   * One delegated handler for the whole overlay, so node count costs nothing
   * in listeners. A press near a node starts a drag; anywhere else on an edge
   * inserts one.
   *
   * Dragging deliberately bypasses React: re-rendering thousands of handles on
   * every pointermove is what caps the usable node count. Instead the dragged
   * circle and its two polylines are moved straight in the DOM and the warp
   * grid is mutated in a ref — the rAF loop already re-reads that ref, so the
   * mesh follows at frame rate. React state is synced once, on release.
   */
  const handleGuidePointerDown = (event) => {
    const svg = guideRef.current;
    const stage = stageRef.current;
    if (!svg || !stage) return;
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;

    const px = (event.clientX - r.left) / r.width;
    const py = (event.clientY - r.top) / r.height;
    const g = gridRef.current;

    // Nearest node within grab range wins; otherwise treat it as an edge click.
    const grabPx = 22;
    let hitIndex = -1;
    let bestDist = Infinity;
    g.points.forEach((p, i) => {
      const d = Math.hypot((p.x - px) * r.width, (p.y - py) * r.height);
      if (d < grabPx && d < bestDist) { bestDist = d; hitIndex = i; }
    });

    if (hitIndex < 0) {
      addNodeAt(px, py);
      return;
    }

    event.preventDefault();
    const width = g.us.length;
    const col = hitIndex % width;
    const row = Math.floor(hitIndex / width);
    const circle = svg.querySelector(`[data-node="${hitIndex}"]`);
    const rowLine = svg.querySelector(`[data-row="${row}"]`);
    const colLine = svg.querySelector(`[data-col="${col}"]`);

    const move = (ev) => {
      const x = Math.max(-0.5, Math.min(1.5, (ev.clientX - r.left) / r.width));
      const y = Math.max(-0.5, Math.min(1.5, (ev.clientY - r.top) / r.height));
      const live = gridRef.current;
      live.points[hitIndex] = { x, y };
      gridRevRef.current += 1; // the draw loop rebuilds the mesh from this

      if (circle) {
        circle.setAttribute('cx', x * stageBox.w);
        circle.setAttribute('cy', y * stageBox.h);
      }
      const pts = (list) => list.map((p) => `${p.x * stageBox.w},${p.y * stageBox.h}`).join(' ');
      if (rowLine) {
        rowLine.setAttribute('points', pts(
          Array.from({ length: width }, (_, c) => live.points[row * width + c]),
        ));
      }
      if (colLine) {
        colLine.setAttribute('points', pts(
          Array.from({ length: live.vs.length }, (_, rr) => live.points[rr * width + col]),
        ));
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      commitGrid({ ...gridRef.current, points: [...gridRef.current.points] });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const handleGuideDoubleClick = (event) => {
    const stage = stageRef.current;
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    const g = gridRef.current;
    const px = (event.clientX - r.left) / r.width;
    const py = (event.clientY - r.top) / r.height;
    const width = g.us.length;
    let hit = -1;
    let best = Infinity;
    g.points.forEach((p, i) => {
      const d = Math.hypot((p.x - px) * r.width, (p.y - py) * r.height);
      if (d < 22 && d < best) { best = d; hit = i; }
    });
    if (hit < 0) return;
    event.preventDefault();
    removeNode(hit % width, Math.floor(hit / width));
  };

  // Outline: the full grid, so every inserted line is visible while calibrating.
  // Each line is tagged with its row/column so a drag can move just the two
  // that touch the dragged node, without re-rendering the rest.
  const gridLines = [];
  if (calibrating) {
    const { w: sw, h: sh } = stageBox;
    const fmt = (p) => `${p.x * sw},${p.y * sh}`;
    for (let r = 0; r < grid.vs.length; r += 1) {
      gridLines.push({
        key: `r${r}`,
        row: r,
        points: Array.from({ length: nodeCols }, (_, c) => fmt(gridAt(grid, c, r))).join(' '),
      });
    }
    for (let c = 0; c < nodeCols; c += 1) {
      gridLines.push({
        key: `c${c}`,
        col: c,
        points: Array.from({ length: grid.vs.length }, (_, r) => fmt(gridAt(grid, c, r))).join(' '),
      });
    }
  }

  return (
    <div
      className={`bistable ${projecting ? 'bistable--projecting' : ''} ${
        projecting && !calibrating ? 'bistable--clean' : ''}`}
    >
      <header className="bistable__head">
        <div>
          <h1 className="bistable__title">Bistable</h1>
          <p className="bistable__sub">Live MIDI keyboard monitor</p>
        </div>
        <div className="bistable__controls">
          <label className="bistable__toggle">
            <input
              type="checkbox"
              checked={soundOn}
              onChange={(e) => setSoundOn(e.target.checked)}
            />
            Piano sound
          </label>
          <label className="bistable__toggle">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
            />
            Octave labels
          </label>
          <button
            type="button"
            className="bistable__panel-toggle"
            onClick={() => setPanelOpen((o) => !o)}
          >
            {panelOpen ? 'Hide tuning' : 'Tuning'}
          </button>
        </div>
      </header>

      {status === 'unsupported' && (
        <StatusMessage variant="error" title="This browser has no Web MIDI">
          Web MIDI is available in Chrome, Edge, and Firefox. Safari does not implement it.
        </StatusMessage>
      )}
      {status === 'denied' && (
        <StatusMessage variant="error" title="MIDI access was blocked">
          {error || 'Allow MIDI access for this site and reload.'}
        </StatusMessage>
      )}
      {status === 'ready' && inputs.length === 0 && (
        <StatusMessage variant="warning" title="No MIDI inputs found">
          Connect a controller and it will appear automatically. If it is plugged in,
          close any DAW or script holding the port — Windows gives MIDI ports to one
          application at a time.
        </StatusMessage>
      )}
      {soundOn && piano.status === 'locked' && (
        <StatusMessage variant="info">
          Click or tap anywhere once to enable sound — the browser blocks audio until
          a first interaction.
        </StatusMessage>
      )}
      {soundOn && piano.status === 'error' && (
        <StatusMessage variant="warning" title="Piano sound unavailable">
          {piano.error || 'The soundfont could not be loaded.'} The keyboard still works silently.
        </StatusMessage>
      )}

      {/* Projection mode drops every control; Space / ←→ drive the song there. */}
      {!projecting && (
        <SongTransport
          transport={song.transport}
          track={song.track}
          loadingTrack={song.loadingTrack}
          trackError={song.trackError}
          rollStem={song.rollStem}
          rollError={song.rollError}
          stems={song.stems}
          hasStems={song.hasStems}
          mixer={song.mixer}
          setStem={song.setStem}
          stemProgress={song.stemProgress}
          stemError={song.stemError}
          toggle={song.toggle}
          seek={song.seek}
          stop={song.stop}
          setMasterVolume={song.setMasterVolume}
          onPickTrack={setTrackId}
        />
      )}

      <div className="bistable__stage" ref={stageRef}>
        <canvas
          ref={warpCanvasRef}
          className={`bistable__warp-out ${meshMode ? 'is-on' : ''}`}
        />
        <div
          className={`bistable__keyboard ${meshMode ? 'is-source' : ''}`}
          style={{ transform: warp }}
        >
          <canvas ref={fluidCanvasRef} className="bistable__fluid" />
          <canvas ref={particleCanvasRef} className="bistable__particles" />
          <canvas
            ref={canvasRef}
            className="bistable__canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        </div>

        {calibrating && (
          <>
            <svg
              className="bistable__warp-guide"
              ref={guideRef}
              onPointerDown={handleGuidePointerDown}
              onDoubleClick={handleGuideDoubleClick}
            >
              {gridLines.map((l) => (
                <polyline
                  key={l.key}
                  points={l.points}
                  data-row={l.row}
                  data-col={l.col}
                />
              ))}
              {grid.points.map((p, i) => {
                const col = i % nodeCols;
                const row = Math.floor(i / nodeCols);
                const isCorner = (col === 0 || col === nodeCols - 1)
                  && (row === 0 || row === grid.vs.length - 1);
                return (
                  <circle
                    key={`${col}-${row}`}
                    data-node={i}
                    className={`bistable__node ${isCorner ? 'is-corner' : ''}`}
                    cx={p.x * stageBox.w}
                    cy={p.y * stageBox.h}
                    r={isCorner ? 11 : 7}
                  />
                );
              })}
            </svg>
            <div className="bistable__calib-hint">
              Drag nodes · <b>click an edge</b> to add · double-click to remove
              · <b>C</b> done · <b>R</b>eset · <b>K</b> keys · <b>F</b> fullscreen
              {` · ${grid.points.length} nodes`}
              {meshMode ? ' · mesh' : ' · corner-pin'}
            </div>
          </>
        )}

      </div>

      {panelOpen && !projecting && (
          <div className="bistable__panel">
            <div className="bistable__panel-head">
              <span>Tuning</span>
              <button
                type="button"
                className="bistable__panel-reset"
                onClick={() => applyTuning({ ...DEFAULT_TUNING })}
              >
                Reset
              </button>
            </div>

            <div className="bistable__presets">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="bistable__preset"
                  onClick={() => applyTuning({
                    ...DEFAULT_TUNING,
                    ...p.values,
                    // presets restyle the effect, not the physical keyboard fit
                    keyHeight: tuning.keyHeight,
                    keyWidth: tuning.keyWidth,
                    blackHeight: tuning.blackHeight,
                    blackWidth: tuning.blackWidth,
                  })}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <div className="bistable__modes">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`bistable__mode ${tuning.mode === m.id ? 'bistable__mode--on' : ''}`}
                  onClick={() => applyTuning({ ...tuning, mode: m.id })}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {SLIDERS.map(({ key, label, min, max, step }) => (
              <label key={key} className="bistable__slider">
                <span className="bistable__slider-label">
                  {label}
                  <em>{Number(tuning[key]).toFixed(step < 1 ? 2 : 0)}</em>
                </span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={tuning[key]}
                  onChange={(e) => applyTuning({ ...tuning, [key]: Number(e.target.value) })}
                />
              </label>
            ))}

            <div className="bistable__modes">
              <button
                type="button"
                className="bistable__mode"
                onClick={() => { setProjecting(true); setCalibrating(true); }}
              >
                Project + calibrate
              </button>
              <button type="button" className="bistable__mode" onClick={resetWarp}>
                Reset warp
              </button>
            </div>
          </div>
      )}

      <footer className="bistable__foot">
        <div className="bistable__devices">
          <span className={`bistable__dot bistable__dot--${inputs.length ? 'on' : 'off'}`} />
          {inputs.length
            ? inputs.map((i) => i.name).join(' · ')
            : status === 'ready' ? 'Waiting for a device' : 'Connecting…'}
        </div>
        <div className="bistable__held">
          {heldNotes.length === 0
            ? <span className="bistable__held-empty">No keys down</span>
            : heldNotes.map((midi) => (
              <span
                key={midi}
                className={`bistable__chip ${isBlackKey(midi) ? 'bistable__chip--black' : ''}`}
              >
                {noteName(midi)}
                <em>{active.get(midi)}</em>
              </span>
            ))}
        </div>
      </footer>
    </div>
  );
}
