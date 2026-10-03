import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createSoundEngine } from '../midikeys/soundEngine';
import { createLooper } from '../midikeys/looper';
import { DEFAULT_PAD_MAP, DRUM_CHANNEL, DRUM_VOICES, voiceById, voiceForNote } from '../midikeys/drumKit';
import {
  DEFAULT_GRID, FAMILIES, GRID_NOTES, SESSION_LAYOUT, SIDE, SIDE_NOTES, TOP_CCS,
  LP_DIM_BLUE, LP_DIM_RED, LP_OFF, familyOf, hitColor, isGridNote, loopColor, restColor, sanitizeGrid,
} from './layout';
import './LaunchpadDrums.css';

/*
 * /launchpad: a drum kit on a Novation Launchpad, for a drummer to jam on.
 *
 *   - The 8x8 grid plays the drums from /midi-keyboard's synthesised kit (all
 *     49 of them, see layout.js), each pad lit in its drum family's colour and
 *     flashing bright when hit or replayed by the loop.
 *   - The round buttons down the right are a loop pedal: top = Loop (record,
 *     close, overdub), next = Stop (twice clears), next = Undo the last layer.
 *     Same one-button looper as /midi-keyboard.
 *   - Any pad's drum can be changed on the page; the kit is remembered.
 *   - A drum pad controller on channel 10 (a Launchkey in Drum mode) plays its
 *     General MIDI drums here too.
 *
 * Audio needs one click or key press on the page before it can start (browser
 * rule); a pad hit does not count, so the page asks for it up front.
 */

const STORAGE_KEY = 'gs.launchpadDrums.v1';
const LOOKAHEAD_SEC = 0.12;
const HIDDEN_LOOKAHEAD_SEC = 1.2;
const TICK_MS = 25;
const FLASH_MS = 120;
const LOOP_OPTS = { trimEnd: true, onePass: true };

const nowSec = () => performance.now() / 1000;
const isLaunchpad = (port) => /launchpad/i.test(port?.name || '');

const DEFAULTS = { grid: DEFAULT_GRID, strength: 110, volume: 0.9 };

function loadSettings() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return DEFAULTS;
    const num = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(Math.max(v, lo), hi) : d);
    return {
      grid: sanitizeGrid(saved.grid),
      strength: num(saved.strength, 20, 127, DEFAULTS.strength),
      volume: num(saved.volume, 0, 1.5, DEFAULTS.volume),
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
  const flashTimersRef = useRef(new Map());
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

  const paintAll = useCallback(() => {
    const grid = settingsRef.current.grid;
    GRID_NOTES.forEach((n) => lightPad(n, restColor(grid[n])));
    SIDE_NOTES.forEach((n) => lightPad(n, LP_OFF));
    TOP_CCS.forEach((cc) => send([0xb0, cc, LP_OFF]));
    paintSide(looperRef.current.info(nowSec()));
  }, [lightPad, paintSide, send]);

  const clearAll = useCallback(() => {
    GRID_NOTES.concat(SIDE_NOTES).forEach((n) => lightPad(n, LP_OFF));
    TOP_CCS.forEach((cc) => send([0xb0, cc, LP_OFF]));
  }, [lightPad, send]);

  // Flash a pad on the page and on the Launchpad, then back to its colour.
  const flash = useCallback((note, loop) => {
    const voice = settingsRef.current.grid[note];
    const el = padElsRef.current.get(note);
    if (el) el.classList.add(loop ? 'is-loop-hit' : 'is-hit');
    lightPad(note, hitColor(voice));
    clearTimeout(flashTimersRef.current.get(note));
    flashTimersRef.current.set(note, setTimeout(() => {
      if (el) el.classList.remove('is-hit', 'is-loop-hit');
      lightPad(note, restColor(settingsRef.current.grid[note]));
    }, FLASH_MS));
  }, [lightPad]);

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
    flash(note, false);
  }, [flash, play]);

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

  const onMidi = useCallback((data, fromLaunchpad) => {
    const status = data[0];
    if (status >= 0xf0) return;
    const cmd = status & 0xf0;
    const [, d1, d2] = data;
    const press = cmd === 0x90 && d2 > 0;
    if (fromLaunchpad) {
      if (!press) return;
      if (isGridNote(d1)) {
        hitPad(d1, d2);
        if (editingRef.current) setSelected(d1); // pick the pad to change from the Launchpad too
      }
      else if (d1 === SIDE.loop) loopAction('loop');
      else if (d1 === SIDE.stop) loopAction('stop');
      else if (d1 === SIDE.undo) loopAction('undo');
      return;
    }
    // Any other controller's drum pads (channel 10) play their GM drum.
    if (press && (status & 0x0f) === DRUM_CHANNEL) play(voiceForNote(DEFAULT_PAD_MAP, d1), d2, d1);
  }, [hitPad, loopAction, play]);

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
        if (!bound.has(input)) {
          const lp = isLaunchpad(input);
          const listener = (e) => onMidiRef.current(e.data, lp);
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
        if (isGridNote(ev.note)) setTimeout(() => flash(ev.note, true), Math.max(0, (at - now) * 1000));
      });
      refreshLoop();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [flash, refreshLoop]);

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

  // Repaint the grid when a pad's drum changes.
  useEffect(() => {
    GRID_NOTES.forEach((n) => lightPad(n, restColor(settings.grid[n])));
  }, [settings.grid, lightPad]);

  const assign = (note, id) => {
    setSettings((s) => ({ ...s, grid: { ...s.grid, [note]: id } }));
    engineRef.current?.drum(id, settingsRef.current.strength);
  };

  // ---- view -----------------------------------------------------------------

  const selVoice = selected != null ? voiceById(settings.grid[selected]) : null;
  const loopState = loopInfo.state;

  return (
    <div className="lpdrums">
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
