import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createSoundEngine } from '../midikeys/soundEngine';
import { createLooper } from '../midikeys/looper';
import { DRUM_VOICES, voiceById } from '../midikeys/drumKit';
import {
  DEFAULT_GRID, FAMILIES, GRID_NOTES, SESSION_LAYOUT, SIDE, SIDE_NOTES, TOP_CCS,
  LP_DIM_BLUE, LP_DIM_RED, LP_OFF, familyOf, hitColor, isGridNote, loopColor, restColor, sanitizeGrid,
} from './layout';
import { ANIMATIONS, frame, liveWaves, makeWave, paletteFor, rgbMessages } from './ripple';
import './LaunchpadDrums.css';

/*
 * /launchpad: a drum kit on a Novation Launchpad, for a drummer to jam on.
 *
 *   - The 8x8 grid plays the drums from /midi-keyboard's synthesised kit (all
 *     49 of them, see layout.js), each pad lit in its drum family's colour.
 *     A hit (or a loop replay, softer) sends a wave of light across the grid,
 *     on the Launchpad and on the page alike (see ripple.js).
 *   - The round buttons down the right are a loop pedal: top = Loop (record,
 *     close, overdub), next = Stop (twice clears), next = Undo the last layer.
 *     Same one-button looper as /midi-keyboard.
 *   - Any pad's drum can be changed on the page; the kit is remembered.
 *   - Only the Launchpad is heard here. A keyboard plugged in beside it is
 *     /midi-keyboard's, and /midi-keyboard ignores the Launchpad in turn, so
 *     with both pages open nothing plays twice.
 *
 * Audio needs one click or key press on the page before it can start (browser
 * rule); a pad hit does not count, so the page asks for it up front.
 */

const STORAGE_KEY = 'gs.launchpadDrums.v1';
const LOOKAHEAD_SEC = 0.12;
const HIDDEN_LOOKAHEAD_SEC = 1.2;
const TICK_MS = 25;
const ANIM_MS = 30; // ~33 frames a second for the light show
const LOOP_WAVE = 0.55; // loop replays ripple softer than live hits
const LOOP_OPTS = { trimEnd: true, onePass: true };

const nowSec = () => performance.now() / 1000;
const isLaunchpad = (port) => /launchpad/i.test(port?.name || '');

const DEFAULTS = { grid: DEFAULT_GRID, strength: 110, volume: 0.9, anim: 'ripple', restLit: false };

function loadSettings() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return DEFAULTS;
    const num = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(Math.max(v, lo), hi) : d);
    return {
      grid: sanitizeGrid(saved.grid),
      strength: num(saved.strength, 20, 127, DEFAULTS.strength),
      volume: num(saved.volume, 0, 1.5, DEFAULTS.volume),
      anim: ANIMATIONS.some((a) => a.id === saved.anim) ? saved.anim : DEFAULTS.anim,
      restLit: saved.restLit === true,
    };
  } catch (e) {
    return DEFAULTS;
  }
}

const LOOP_LABEL = {
  empty: 'Press Loop, then play. Recording starts on your first hit.',
  armed: 'Armed: recording starts on your first hit.',
  recording: 'Recording. Press Loop to close the loop.',
  playing: 'Looping. Press Loop to play a layer over it.',
  overdub: 'Adding a layer. It stops by itself after one pass.',
  stopped: 'Stopped. Loop plays it again, Stop again clears it.',
};

const VOICES_BY_FAMILY = Object.keys(FAMILIES).map((f) => ({
  family: f,
  voices: DRUM_VOICES.filter((v) => familyOf(v.id) === f),
}));

export default function LaunchpadDrums() {
  const [settings, setSettings] = useState(loadSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [audioOn, setAudioOn] = useState(false);
  const [midi, setMidi] = useState({ status: 'prompting', launchpad: false, others: [] });
  const [loopInfo, setLoopInfo] = useState({ state: 'empty', length: 0, layers: 0, count: 0 });
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(null); // pad note being changed
  const editingRef = useRef(false);
  editingRef.current = editing;

  const engineRef = useRef(null);
  const looperRef = useRef(null);
  if (!looperRef.current) looperRef.current = createLooper();
  const outputsRef = useRef([]); // Launchpad outputs, to light the pads
  const padElsRef = useRef(new Map());
  const wavesRef = useRef([]); // light waves running across the grid
  const sentRef = useRef(new Map()); // note -> what the Launchpad shows now ('r,g,b' or palette index)
  const shownRef = useRef(new Map()); // note -> glow drawn on the page
  const sysexRef = useRef(false); // RGB lights need SysEx; without it, palette colours
  const lastLoopKeyRef = useRef('');

  // ---- Launchpad lights -----------------------------------------------------

  const send = useCallback((bytes) => {
    outputsRef.current.forEach((out) => { try { out.send(bytes); } catch (e) { /* unplugged */ } });
  }, []);

  const lightPad = useCallback((note, color) => send([0x90, note, color]), [send]);

  const paintSide = useCallback((info) => {
    lightPad(SIDE.loop, loopColor(info.state));
    lightPad(SIDE.stop, info.state === 'empty' ? LP_OFF : LP_DIM_RED);
    lightPad(SIDE.undo, info.layers > 0 ? LP_DIM_BLUE : LP_OFF);
  }, [lightPad]);

  // The grid is drawn by the light show; this makes it resend every pad.
  const paintAll = useCallback(() => {
    sentRef.current.clear();
    SIDE_NOTES.forEach((n) => lightPad(n, LP_OFF));
    TOP_CCS.forEach((cc) => send([0xb0, cc, LP_OFF]));
    paintSide(looperRef.current.info(nowSec()));
  }, [lightPad, paintSide, send]);

  const clearAll = useCallback(() => {
    GRID_NOTES.concat(SIDE_NOTES).forEach((n) => lightPad(n, LP_OFF));
    TOP_CCS.forEach((cc) => send([0xb0, cc, LP_OFF]));
  }, [lightPad, send]);

  // Start a wave of light from a pad, now or (for a loop replay) when it sounds.
  const wave = useCallback((note, at, amp) => {
    wavesRef.current.push(makeWave(note, settingsRef.current.grid[note], at, amp));
  }, []);

  // ---- playing --------------------------------------------------------------

  const refreshLoop = useCallback(() => {
    const info = looperRef.current.info(nowSec());
    const key = `${info.state}|${info.layers}|${info.count}|${info.length.toFixed(2)}`;
    if (key === lastLoopKeyRef.current) return;
    lastLoopKeyRef.current = key;
    setLoopInfo(info);
    paintSide(info);
  }, [paintSide]);

  const play = useCallback((voice, vel, note) => {
    if (!voice) return;
    const now = nowSec();
    engineRef.current?.drum(voice, vel);
    looperRef.current.drum(note, voice, vel, now, { level: 1 });
    refreshLoop();
  }, [refreshLoop]);

  // A grid pad. The MK2's pads send a fixed 127, so "Hit strength" sets how hard.
  const hitPad = useCallback((note, vel = 127) => {
    const voice = settingsRef.current.grid[note];
    play(voice, Math.max(1, Math.round((vel * settingsRef.current.strength) / 127)), note);
    wave(note, nowSec(), 1);
  }, [wave, play]);

  const loopAction = useCallback((action) => {
    const now = nowSec();
    const looper = looperRef.current;
    if (action === 'loop') looper.press(now, LOOP_OPTS);
    else if (action === 'stop') {
      looper.stop(now, LOOP_OPTS);
      if (looper.state !== 'playing' && looper.state !== 'overdub') engineRef.current?.stopLoop();
    } else if (action === 'undo') looper.undoLayer(now);
    refreshLoop();
  }, [refreshLoop]);

  // ---- MIDI -----------------------------------------------------------------

  const onMidi = useCallback((data) => {
    const [status, d1, d2] = data;
    if ((status & 0xf0) !== 0x90 || !d2) return; // presses only
    if (isGridNote(d1)) {
      hitPad(d1, d2);
      if (editingRef.current) setSelected(d1); // pick the pad to change from the Launchpad too
    }
    else if (d1 === SIDE.loop) loopAction('loop');
    else if (d1 === SIDE.stop) loopAction('stop');
    else if (d1 === SIDE.undo) loopAction('undo');
  }, [hitPad, loopAction]);

  const onMidiRef = useRef(onMidi);
  onMidiRef.current = onMidi;

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      setMidi({ status: 'unsupported', launchpad: false, others: [] });
      return undefined;
    }
    let access = null;
    let cancelled = false;
    const bound = new Map(); // input -> listener

    const bind = () => {
      let launchpad = false;
      const others = [];
      access.inputs.forEach((input) => {
        if (isLaunchpad(input) && !bound.has(input)) {
          const listener = (e) => onMidiRef.current(e.data);
          input.addEventListener('midimessage', listener);
          bound.set(input, listener);
        }
        if (input.state === 'disconnected') return;
        if (isLaunchpad(input)) launchpad = true;
        else others.push(input.name);
      });
      const outs = [];
      access.outputs.forEach((out) => { if (isLaunchpad(out) && out.state !== 'disconnected') outs.push(out); });
      const fresh = outs.filter((o) => !outputsRef.current.includes(o));
      outputsRef.current = outs;
      // Session layout, so the grid sends 11-88 whatever mode it was left in.
      sysexRef.current = !!access.sysexEnabled;
      if (access.sysexEnabled) fresh.forEach((o) => { try { o.send(SESSION_LAYOUT); } catch (e) { /* ignore */ } });
      if (fresh.length) paintAll();
      setMidi({ status: 'ready', launchpad, others });
    };

    navigator.requestMIDIAccess({ sysex: true })
      .catch(() => navigator.requestMIDIAccess({ sysex: false }))
      .then((a) => {
        if (cancelled) return;
        access = a;
        access.onstatechange = bind;
        bind();
      })
      .catch(() => { if (!cancelled) setMidi({ status: 'blocked', launchpad: false, others: [] }); });

    return () => {
      cancelled = true;
      bound.forEach((listener, input) => input.removeEventListener('midimessage', listener));
      if (access) access.onstatechange = null;
      clearAll();
      outputsRef.current = [];
    };
  }, [paintAll, clearAll]);

  // ---- audio, loop clock, keys ----------------------------------------------

  useEffect(() => {
    const check = () => setAudioOn(!!engineRef.current?.isRunning());
    const engine = createSoundEngine({ onStatus: check });
    if (!engine) return undefined;
    engineRef.current = engine;
    const unlock = () => { engine.unlock(); setTimeout(check, 100); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    check();
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      engineRef.current = null;
      engine.close();
    };
  }, []);

  useEffect(() => { engineRef.current?.setLevel('drums', settings.volume); }, [settings.volume, audioOn]);

  useEffect(() => {
    const id = setInterval(() => {
      const now = nowSec();
      looperRef.current.schedule(now, document.hidden ? HIDDEN_LOOKAHEAD_SEC : LOOKAHEAD_SEC, (ev, at) => {
        engineRef.current?.scheduleLoopEvent(ev, at);
        if (isGridNote(ev.note)) wave(ev.note, at, LOOP_WAVE);
      });
      refreshLoop();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [wave, refreshLoop]);

  // ---- the light show -------------------------------------------------------

  // A timer, not requestAnimationFrame, so the Launchpad keeps animating when
  // the page is in a background tab.
  useEffect(() => {
    let idle = false;
    const id = setInterval(() => {
      const now = nowSec();
      wavesRef.current = liveWaves(wavesRef.current, now);
      const waves = wavesRef.current;
      // Nothing moving and the last frame already drawn: skip the work.
      if (!waves.length && idle && sentRef.current.size) return;
      idle = !waves.length;
      const { grid, anim, restLit } = settingsRef.current;
      const { colors, glow } = frame(now, waves, grid, anim, { rest: restLit });

      // The Launchpad: send only the pads whose colour changed.
      const changes = new Map();
      colors.forEach((rgb, note) => {
        const voice = grid[note];
        const value = sysexRef.current
          ? rgb.join(',')
          : paletteFor(glow.get(note), hitColor(voice), restColor(voice), restLit ? restColor(voice) : LP_OFF);
        if (sentRef.current.get(note) === value) return;
        sentRef.current.set(note, value);
        if (sysexRef.current) changes.set(note, rgb);
        else lightPad(note, value);
      });
      if (changes.size) rgbMessages(changes).forEach(send);

      // The page: a glow over each pad in the wave's colour.
      glow.forEach((level, note) => {
        const shown = Math.round(level * 50) / 50;
        if (shownRef.current.get(note) === shown) return;
        shownRef.current.set(note, shown);
        const el = padElsRef.current.get(note);
        if (!el) return;
        const [r, g, b] = colors.get(note);
        el.style.setProperty('--glow', String(shown));
        el.style.setProperty('--glow-rgb', `${Math.min(255, r * 4)}, ${Math.min(255, g * 4)}, ${Math.min(255, b * 4)}`);
      });
    }, ANIM_MS);
    return () => clearInterval(id);
  }, [lightPad, send]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); loopAction('loop'); }
      else if (e.key === 'Escape') loopAction('stop');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loopAction]);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) { /* private window */ }
  }, [settings]);

  // Repaint the grid when a pad's drum or the animation changes.
  useEffect(() => { sentRef.current.clear(); }, [settings.grid, settings.anim, settings.restLit]);

  const assign = (note, id) => {
    setSettings((s) => ({ ...s, grid: { ...s.grid, [note]: id } }));
    engineRef.current?.drum(id, settingsRef.current.strength);
  };

  // ---- view -----------------------------------------------------------------

  const selVoice = selected != null ? voiceById(settings.grid[selected]) : null;
  const loopState = loopInfo.state;

  return (
    <div className={`lpdrums ${settings.restLit ? '' : 'is-dark-rest'}`}>
      <header className="lpdrums__head">
        <div>
          <h1 className="lpdrums__title">Launchpad Drums</h1>
          <p className="lpdrums__sub">
            A drum kit on a Novation Launchpad. Hit the pads to play; the round buttons on the right loop what you play.
          </p>
        </div>
        <div className="lpdrums__status">
          <span className={`lpdrums__pill ${midi.launchpad ? 'is-on' : ''}`}>
            <i />
            {midi.status === 'ready' && (midi.launchpad ? 'Launchpad connected' : 'No Launchpad found')}
            {midi.status === 'prompting' && 'Asking for MIDI access…'}
            {midi.status === 'blocked' && 'MIDI access was blocked'}
            {midi.status === 'unsupported' && 'This browser has no Web MIDI'}
          </span>
          <span className={`lpdrums__pill ${audioOn ? 'is-on' : ''}`}><i />{audioOn ? 'Sound on' : 'Sound off'}</span>
        </div>
      </header>

      {!audioOn && (
        <button type="button" className="lpdrums__start" onClick={() => engineRef.current?.unlock()}>
          <strong>Click here to start the sound</strong>
          <span>Browsers only allow sound after a click on the page. Pads on the Launchpad don&apos;t count, so click once before you play.</span>
        </button>
      )}
      {midi.status === 'unsupported' && (
        <p className="lpdrums__note">Web MIDI works in Chrome and Edge on a computer. You can still tap the pads below.</p>
      )}
      {midi.status === 'blocked' && (
        <p className="lpdrums__note">Allow MIDI devices for this site in the browser&apos;s site settings, then reload.</p>
      )}
      {midi.status === 'ready' && !midi.launchpad && (
        <p className="lpdrums__note">Plug in the Launchpad (USB) and it lights up here by itself. You can still tap the pads below.</p>
      )}

      <div className="lpdrums__main">
        <section className="lpdrums__deck" aria-label="Pads">
          <div className="lpdrums__grid">
            {GRID_NOTES.map((note) => {
              const voice = voiceById(settings.grid[note]);
              const fam = FAMILIES[familyOf(voice?.id)];
              const setEl = (el) => { if (el) padElsRef.current.set(note, el); else padElsRef.current.delete(note); };
              return (
                <button
                  key={note}
                  ref={setEl}
                  type="button"
                  className={`lpdrums__pad ${selected === note ? 'is-selected' : ''}`}
                  style={{ '--pad': fam.css }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    if (editing) setSelected(note);
                    hitPad(note);
                  }}
                >
                  <span>{voice ? voice.label : '—'}</span>
                </button>
              );
            })}
          </div>
          <div className="lpdrums__side" aria-label="Loop buttons">
            <button type="button" className={`lpdrums__round is-loop is-${loopState}`} onClick={() => loopAction('loop')}>Loop</button>
            <button type="button" className="lpdrums__round" disabled={loopState === 'empty'} onClick={() => loopAction('stop')}>Stop</button>
            <button type="button" className="lpdrums__round" disabled={!loopInfo.layers} onClick={() => loopAction('undo')}>Undo</button>
          </div>
        </section>

        <aside className="lpdrums__panel">
          <section className="lpdrums__card">
            <h2 className="lpdrums__card-title">Loop</h2>
            <p className="lpdrums__loop-state">{LOOP_LABEL[loopState] || ''}</p>
            {loopInfo.length > 0 && (
              <p className="lpdrums__muted">
                {loopInfo.length.toFixed(1)} s loop{loopInfo.layers ? `, ${loopInfo.layers} layer${loopInfo.layers > 1 ? 's' : ''} on top` : ''}
              </p>
            )}
            <p className="lpdrums__muted">Space = Loop, Esc = Stop on the computer keyboard.</p>
          </section>

          <section className="lpdrums__card">
            <h2 className="lpdrums__card-title">Sound</h2>
            <label className="lpdrums__slider">
              <span>Volume</span>
              <input type="range" min="0" max="1.5" step="0.01" value={settings.volume}
                onChange={(e) => setSettings((s) => ({ ...s, volume: Number(e.target.value) }))} />
            </label>
            <label className="lpdrums__slider">
              <span>Hit strength</span>
              <input type="range" min="20" max="127" step="1" value={settings.strength}
                onChange={(e) => setSettings((s) => ({ ...s, strength: Number(e.target.value) }))} />
            </label>
            <p className="lpdrums__muted">The Launchpad MK2&apos;s pads hit at one strength; this sets how hard.</p>
          </section>

          <section className="lpdrums__card">
            <h2 className="lpdrums__card-title">Lights</h2>
            <div className="lpdrums__seg" role="radiogroup" aria-label="Animation">
              {ANIMATIONS.map((a) => (
                <button key={a.id} type="button" role="radio" aria-checked={settings.anim === a.id}
                  className={`lpdrums__seg-btn ${settings.anim === a.id ? 'is-active' : ''}`}
                  onClick={() => setSettings((s) => ({ ...s, anim: a.id }))}>
                  {a.label}
                </button>
              ))}
            </div>
            <div className="lpdrums__seg" role="radiogroup" aria-label="Pads at rest">
              {[[false, 'Dark'], [true, 'Colours']].map(([v, label]) => (
                <button key={label} type="button" role="radio" aria-checked={settings.restLit === v}
                  className={`lpdrums__seg-btn ${settings.restLit === v ? 'is-active' : ''}`}
                  onClick={() => setSettings((s) => ({ ...s, restLit: v }))}>
                  {label} at rest
                </button>
              ))}
            </div>
            <p className="lpdrums__muted">What a hit sends across the grid, and whether the pads show their colours when nothing is playing.</p>
          </section>

          <section className="lpdrums__card">
            <div className="lpdrums__card-row">
              <h2 className="lpdrums__card-title">Pads</h2>
              <div className="lpdrums__tools">
                <button type="button" className={`lpdrums__btn ${editing ? 'is-active' : ''}`}
                  onClick={() => { setEditing((v) => !v); setSelected(null); }}>
                  {editing ? 'Done' : 'Change sounds'}
                </button>
                {editing && (
                  <button type="button" className="lpdrums__link" onClick={() => setSettings((s) => ({ ...s, grid: DEFAULT_GRID }))}>
                    Reset kit
                  </button>
                )}
              </div>
            </div>
            {editing ? (
              selected == null ? (
                <p className="lpdrums__muted">Hit a pad (here or on the Launchpad), then pick its new drum.</p>
              ) : (
                <div className="lpdrums__picker">
                  <p className="lpdrums__muted">Pad {selected}: <strong>{selVoice ? selVoice.label : '—'}</strong></p>
                  {VOICES_BY_FAMILY.map(({ family, voices }) => (
                    <div key={family} className="lpdrums__picker-group">
                      <span className="lpdrums__picker-label" style={{ color: FAMILIES[family].css }}>{FAMILIES[family].label}</span>
                      <div className="lpdrums__chips">
                        {voices.map((v) => (
                          <button key={v.id} type="button"
                            className={`lpdrums__chip ${selVoice?.id === v.id ? 'is-active' : ''}`}
                            style={{ '--pad': FAMILIES[family].css }}
                            onClick={() => assign(selected, v.id)}>
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <ul className="lpdrums__legend">
                {Object.entries(FAMILIES).map(([k, f]) => (
                  <li key={k}><i style={{ background: f.css }} />{f.label}</li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
