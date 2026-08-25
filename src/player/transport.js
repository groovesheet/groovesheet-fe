/**
 * transport.js — shared playback transport (plain JS, no React).
 *
 * MIDI time is truth: `positionSec` is always expressed in MIDI seconds.
 * State lives in a plain object mutated inside a rAF loop; React components
 * read it via `subscribe()` (see transport-react.js) or poll `getPosition()`
 * from their own render loops.
 *
 * ## API
 *   const transport = createTransport();
 *   transport.play()                 // start (delegates to active engine if any)
 *   transport.pause()
 *   transport.seek(sec)              // clamped to [0, durationSec] when duration known
 *   transport.getPosition()          // -> number (MIDI seconds)
 *   transport.getState()             // -> { positionSec, isPlaying, rate, durationSec }
 *   transport.subscribe(cb)          // cb(state) immediately + on every change/tick; returns unsubscribe()
 *   transport.setDuration(sec)
 *   transport.setRate(rate)          // playback rate used by the self-advancing clock
 *   transport.attachEngine(engine)   // register an engine (see below)
 *   transport.detachEngine(id)
 *   transport.setActiveEngine(id)    // id or null; exactly ONE engine advances the clock
 *   transport.getActiveEngineId()    // -> id | null
 *   transport.dispose()
 *
 * ## Engine contract
 *   engine = {
 *     id:        string,
 *     play(atSec),                 // start audio from atSec (MIDI seconds)
 *     pause(),
 *     seek(sec),                   // move to sec, PRESERVING the engine's current play/pause state
 *     readTime() -> sec | null,    // current MIDI-seconds position, or null if unknown/not ready
 *   }
 *
 * Engine methods may be async; the transport calls them fire-and-forget. An
 * engine whose underlying seek/play primitives race each other (e.g. OSMD's
 * PlaybackManager) should serialize its own commands internally. The
 * transport never calls play() and seek() back-to-back: on engine switch it
 * issues a single play(atSec) when playing, or a single seek(sec) when
 * paused.
 *
 * Exactly one engine is "active": while playing, the transport polls
 * `activeEngine.readTime()` every animation frame and adopts that as the clock.
 * If there is no active engine (or readTime() returns null), the transport
 * self-advances using performance.now() * rate.
 *
 * Switching active engines preserves position and play state: the old engine
 * is paused, the new one is seeked to the current position, and if the
 * transport was playing the new engine is started.
 */

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function createTransport() {
  const state = { positionSec: 0, isPlaying: false, rate: 1, durationSec: 0 };
  const engines = new Map();
  const subscribers = new Set();
  let activeId = null;
  let rafId = null;
  let disposed = false;
  let lastEngineTime = null;

  // Anchor for the self-advancing clock (used when no engine reports time).
  let anchorPos = 0;
  let anchorPerf = now();

  const getState = () => ({ ...state });

  const notify = () => {
    const snapshot = getState();
    subscribers.forEach((cb) => {
      try { cb(snapshot); } catch (e) { /* subscriber errors must not kill the loop */ }
    });
  };

  const activeEngine = () => (activeId != null ? engines.get(activeId) || null : null);

  const anchor = (pos) => {
    anchorPos = pos;
    anchorPerf = now();
  };

  const stopLoop = () => {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  const tick = () => {
    rafId = null;
    if (disposed || !state.isPlaying) return;

    const eng = activeEngine();
    let t = null;
    if (eng && typeof eng.readTime === 'function') {
      try {
        const r = eng.readTime();
        if (typeof r === 'number' && Number.isFinite(r)) {
          // Audio engines can briefly report their reset/default zero while an
          // async seek or internal timing update settles. Playback is monotonic
          // unless transport.seek() explicitly changes it, so ignore a large
          // backwards sample instead of rewinding the shared UI clock.
          if (lastEngineTime == null || r >= lastEngineTime - 0.25) {
            t = r;
            lastEngineTime = r;
          }
        }
      } catch (e) { /* treat as unknown */ }
    }
    if (t == null) {
      // Self-advance with the wall clock.
      t = anchorPos + ((now() - anchorPerf) / 1000) * state.rate;
    } else {
      // Engine is the clock — re-anchor so a readTime() dropout degrades smoothly.
      anchor(t);
    }

    if (state.durationSec > 0 && t >= state.durationSec) {
      state.positionSec = state.durationSec;
      state.isPlaying = false;
      if (eng) { try { eng.pause(); } catch (e) { /* ignore */ } }
      notify();
      return;
    }

    state.positionSec = Math.max(0, t);
    notify();
    rafId = requestAnimationFrame(tick);
  };

  const startLoop = () => {
    if (rafId == null) rafId = requestAnimationFrame(tick);
  };

  return {
    play() {
      if (disposed || state.isPlaying) return;
      state.isPlaying = true;
      anchor(state.positionSec);
      lastEngineTime = state.positionSec;
      const eng = activeEngine();
      if (eng) { try { eng.play(state.positionSec); } catch (e) { /* ignore */ } }
      startLoop();
      notify();
    },

    pause() {
      if (disposed || !state.isPlaying) return;
      state.isPlaying = false;
      stopLoop();
      const eng = activeEngine();
      if (eng) { try { eng.pause(); } catch (e) { /* ignore */ } }
      anchor(state.positionSec);
      notify();
    },

    seek(sec) {
      if (disposed) return;
      let target = Math.max(0, Number(sec) || 0);
      if (state.durationSec > 0) target = Math.min(target, state.durationSec);
      state.positionSec = target;
      anchor(target);
      lastEngineTime = target;
      const eng = activeEngine();
      if (eng) { try { eng.seek(target); } catch (e) { /* ignore */ } }
      notify();
    },

    getPosition() {
      return state.positionSec;
    },

    getState,

    subscribe(cb) {
      subscribers.add(cb);
      try { cb(getState()); } catch (e) { /* ignore */ }
      return () => subscribers.delete(cb);
    },

    setDuration(sec) {
      const d = Math.max(0, Number(sec) || 0);
      if (d === state.durationSec) return;
      state.durationSec = d;
      notify();
    },

    setRate(rate) {
      const r = Number(rate) || 1;
      if (r === state.rate) return;
      // Re-anchor first so already-elapsed time is counted at the old rate.
      anchor(state.positionSec);
      state.rate = r;
      notify();
    },

    attachEngine(engine) {
      if (!engine || engine.id == null) return;
      engines.set(engine.id, engine);
    },

    detachEngine(id) {
      engines.delete(id);
      if (activeId === id) {
        activeId = null;
        anchor(state.positionSec);
        lastEngineTime = null;
      }
    },

    setActiveEngine(id) {
      if (disposed) return;
      const nextId = id == null ? null : id;
      if (nextId === activeId) return;
      const old = activeEngine();
      if (old) { try { old.pause(); } catch (e) { /* ignore */ } }
      activeId = nextId;
      anchor(state.positionSec);
      lastEngineTime = state.positionSec;
      const eng = activeEngine();
      if (eng) {
        // Single command: play(at) already implies the seek; seek(at) when
        // paused. Issuing both would race engines whose seek is async.
        try {
          if (state.isPlaying) eng.play(state.positionSec);
          else eng.seek(state.positionSec);
        } catch (e) { /* ignore */ }
      }
      notify();
    },

    getActiveEngineId() {
      return activeId;
    },

    dispose() {
      disposed = true;
      stopLoop();
      const eng = activeEngine();
      if (eng && state.isPlaying) { try { eng.pause(); } catch (e) { /* ignore */ } }
      state.isPlaying = false;
      subscribers.clear();
      engines.clear();
      activeId = null;
    },
  };
}

export default createTransport;
