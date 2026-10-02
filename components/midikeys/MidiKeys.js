import React, { useCallback, useEffect, useRef, useState } from 'react';
import StatusMessage from '@/components/ui/StatusMessage';
import { buildKeyLayout, keyAtPoint, noteName } from '../bistable/keyLayout';
import { createLooper } from './looper';
import { createSoundEngine, PIANO_SOUNDS } from './soundEngine';
import { DEFAULT_PAD_MAP, DRUM_CHANNEL, DRUM_VOICES, PAD_ROWS, voiceById, voiceForNote } from './drumKit';
import { ACTIONS, DEFAULT_BINDINGS, actionFor, describeBinding, pressFromMessage, sanitizeBindings } from './bindings';
import './MidiKeys.css';

/**
 * MidiKeys: /midi-keyboard, a practice workstation for a MIDI keyboard.
 *
 *   - The keys play a sampled piano (with the sustain pedal) and rise as light
 *     out of an 88-key keyboard, so you can see what you just played.
 *   - The pads (channel 10, the Launchkey's Drum mode) play a drum kit; each
 *     pad's sound can be changed on the page.
 *   - A one-button looper records what you play from your FIRST NOTE after
 *     arming, closes the loop on the next press and plays it back from that
 *     first note, then layers overdubs. On a Launchkey MK4 the Play button
 *     (MIDI Start) is the loop button and Stop stops / clears; both can be
 *     re-learnt from any button. Space and Esc do the same from the computer.
 *
 * Its sibling /bistable is the projection-mapped installation view; this page
 * is the one to keep open while practising.
 *
 * Time is performance.now() seconds throughout (`nowSec`), so recording and
 * the visualiser work even before audio is unlocked; soundEngine converts to
 * AudioContext time when a sound is actually scheduled.
 */

const STORAGE_KEY = 'gs.midiKeyboard.v1';
const LOOKAHEAD_SEC = 0.12; // how far ahead loop events are scheduled
const HIDDEN_LOOKAHEAD_SEC = 1.2; // background tabs only get ~1 timer per second
const TICK_MS = 25;
const RISE_SEC = 5; // seconds a note takes to rise the full height of the visualiser
const PAD_FLASH_SEC = 0.14;

const LIVE = '#3f74e8'; // brand blue, brightened to read on near-black
const LIVE_KEY = '#012fa7';
const LOOP = '#ffb020'; // loop playback: warning amber from the site tokens
const LAYER_COLORS = ['#ffb020', '#4fd1c5', '#f472b6', '#a78bfa', '#93b4ff'];

const nowSec = () => performance.now() / 1000;

const DEFAULT_SETTINGS = {
  padMap: DEFAULT_PAD_MAP,
  drumChannel: DRUM_CHANNEL,
  bindings: DEFAULT_BINDINGS,
  piano: PIANO_SOUNDS[0].id,
  volumes: { master: 0.9, piano: 1, drums: 0.9, loop: 0.9 },
};

function loadSettings() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return DEFAULT_SETTINGS;
    const padMap = { ...DEFAULT_PAD_MAP };
    if (saved.padMap && typeof saved.padMap === 'object') {
      Object.entries(saved.padMap).forEach(([note, id]) => { if (voiceById(id)) padMap[note] = id; });
    }
    const ch = Number(saved.drumChannel);
    return {
      padMap,
      drumChannel: Number.isInteger(ch) && ch >= 0 && ch <= 15 ? ch : DRUM_CHANNEL,
      bindings: sanitizeBindings(saved.bindings),
      piano: PIANO_SOUNDS.some((p) => p.id === saved.piano) ? saved.piano : DEFAULT_SETTINGS.piano,
      volumes: { ...DEFAULT_SETTINGS.volumes, ...(saved.volumes || {}) },
    };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) { /* private window */ }
}

const fmtTime = (sec) => {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toFixed(1).padStart(4, '0')}`;
};

const LOOP_COPY = {
  empty: { label: 'Loop', hint: 'Press, then play. Recording starts on your first note.' },
  armed: { label: 'Ready', hint: 'Waiting for your first note…' },
  recording: { label: 'Recording', hint: 'Press again to close the loop.' },
  playing: { label: 'Playing', hint: 'Press to layer an overdub.' },
  overdub: { label: 'Overdub', hint: 'Press to stop layering.' },
  stopped: { label: 'Stopped', hint: 'Press to play from the top. Stop again clears.' },
};

const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

export default function MidiKeys() {
  const [settings, setSettings] = useState(loadSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [audio, setAudio] = useState({ status: 'loading', error: null });
  const [midi, setMidi] = useState({ status: 'prompting', error: null, inputs: [] });
  const [loopInfo, setLoopInfo] = useState({ state: 'empty', length: 0, elapsed: 0, count: 0, layers: 0 });
  const [learning, setLearning] = useState(null); // 'loop' | 'stop' | null
  const learningRef = useRef(null);
  learningRef.current = learning;
  const [editPads, setEditPads] = useState(false);

  const engineRef = useRef(null);
  const looperRef = useRef(null);
  if (!looperRef.current) looperRef.current = createLooper();

  const heldRef = useRef(new Map()); // midi -> velocity, keys physically down
  const sustainRef = useRef(false);
  const sustainedRef = useRef(new Set()); // released keys the pedal is holding
  const trailsRef = useRef([]); // { midi, start, end|null, loop, vel, layer }
  const liveTrailRef = useRef(new Map()); // midi -> its open live trail
  const flashesRef = useRef([]); // { note, at, loop }

  const canvasRef = useRef(null);
  const laneRef = useRef(null);
  const ringRef = useRef(null);
  const padElsRef = useRef(new Map());
  const keyLayoutRef = useRef(null);
  const pointerKeyRef = useRef(new Map()); // pointerId -> midi

  useEffect(() => { saveSettings(settings); }, [settings]);

  // ---- loop info for the UI (only re-render when something visible changed)
  const lastInfoKeyRef = useRef('');
  const refreshLoopInfo = useCallback(() => {
    const info = looperRef.current.info(nowSec());
    const key = `${info.state}|${info.length.toFixed(2)}|${Math.floor(info.elapsed * 10)}|${info.count}|${info.layers}`;
    if (key === lastInfoKeyRef.current) return;
    lastInfoKeyRef.current = key;
    setLoopInfo(info);
  }, []);

  // ---- note handling -----------------------------------------------------

  const endLiveTrail = (midiNote, now) => {
    const trail = liveTrailRef.current.get(midiNote);
    if (trail) {
      trail.end = now;
      liveTrailRef.current.delete(midiNote);
    }
  };

  const releaseSound = useCallback((midiNote, now) => {
    engineRef.current?.pianoOff(midiNote);
    looperRef.current.pianoOff(midiNote, now);
    endLiveTrail(midiNote, now);
  }, []);

  const keyDown = useCallback((midiNote, vel) => {
    const now = nowSec();
    // A key struck again while the pedal holds it ends the old note first.
    if (sustainedRef.current.has(midiNote)) {
      sustainedRef.current.delete(midiNote);
      releaseSound(midiNote, now);
    }
    endLiveTrail(midiNote, now);
    heldRef.current.set(midiNote, vel);
    engineRef.current?.pianoOn(midiNote, vel);
    looperRef.current.pianoOn(midiNote, vel, now);
    const trail = { midi: midiNote, start: now, end: null, loop: false, vel };
    trailsRef.current.push(trail);
    liveTrailRef.current.set(midiNote, trail);
    refreshLoopInfo();
  }, [refreshLoopInfo, releaseSound]);

  const keyUp = useCallback((midiNote) => {
    if (!heldRef.current.has(midiNote)) return;
    heldRef.current.delete(midiNote);
    if (sustainRef.current) {
      sustainedRef.current.add(midiNote);
      return;
    }
    releaseSound(midiNote, nowSec());
  }, [releaseSound]);

  const setSustain = useCallback((down) => {
    sustainRef.current = down;
    if (down) return;
    const now = nowSec();
    sustainedRef.current.forEach((m) => { if (!heldRef.current.has(m)) releaseSound(m, now); });
    sustainedRef.current.clear();
  }, [releaseSound]);

  const allNotesOff = useCallback(() => {
    const now = nowSec();
    heldRef.current.forEach((_, m) => releaseSound(m, now));
    sustainedRef.current.forEach((m) => releaseSound(m, now));
    heldRef.current.clear();
    sustainedRef.current.clear();
    engineRef.current?.allNotesOff();
  }, [releaseSound]);

  const drumHit = useCallback((note, vel) => {
    const voice = voiceForNote(settingsRef.current.padMap, note);
    if (!voice) return;
    const now = nowSec();
    engineRef.current?.drum(voice, vel);
    looperRef.current.drum(note, voice, vel, now);
    flashesRef.current.push({ note, at: now, loop: false });
    refreshLoopInfo();
  }, [refreshLoopInfo]);

  // ---- looper actions ----------------------------------------------------

  const silenceLoop = useCallback((now) => {
    engineRef.current?.stopLoop();
    // Drop replayed notes that have not risen yet and cut the ones sounding.
    trailsRef.current = trailsRef.current.filter((t) => !t.loop || t.start <= now);
    trailsRef.current.forEach((t) => { if (t.loop && t.end > now) t.end = now; });
    flashesRef.current = flashesRef.current.filter((f) => !f.loop || f.at <= now);
  }, []);

  const loopAction = useCallback((action) => {
    const now = nowSec();
    const looper = looperRef.current;
    if (action === 'loop') {
      looper.press(now);
    } else if (action === 'stop') {
      looper.stop(now);
      if (looper.state !== 'playing' && looper.state !== 'overdub') silenceLoop(now);
    } else if (action === 'undo') {
      looper.undoLayer(now);
    } else if (action === 'clear') {
      looper.clear();
      silenceLoop(now);
    }
    refreshLoopInfo();
  }, [refreshLoopInfo, silenceLoop]);

  // ---- MIDI in -------------------------------------------------------------

  const onMidiMessage = useCallback((data) => {
    const status = data[0];
    if (status === 0xf8 || status === 0xfe) return; // clock, active sensing

    if (learningRef.current) {
      const press = pressFromMessage(data, { strict: true });
      if (press) {
        const action = learningRef.current;
        setSettings((s) => ({ ...s, bindings: { ...s.bindings, [action]: [press] } }));
        setLearning(null);
        return;
      }
    }

    const action = actionFor(settingsRef.current.bindings, pressFromMessage(data));
    if (action) {
      loopAction(action);
      return;
    }
    if (status >= 0xf0) return;

    const cmd = status & 0xf0;
    const channel = status & 0x0f;
    const [, d1, d2] = data;

    if (channel === settingsRef.current.drumChannel) {
      if (cmd === 0x90 && d2 > 0) drumHit(d1, d2);
      return; // pad releases and pad aftertouch are not needed
    }
    if (cmd === 0x90 && d2 > 0) keyDown(d1, d2);
    else if (cmd === 0x80 || cmd === 0x90) keyUp(d1);
    else if (cmd === 0xb0 && d1 === 64) setSustain(d2 >= 64);
    else if (cmd === 0xb0 && (d1 === 120 || d1 === 123)) allNotesOff();
  }, [allNotesOff, drumHit, keyDown, keyUp, loopAction, setSustain]);

  const onMidiRef = useRef(onMidiMessage);
  onMidiRef.current = onMidiMessage;

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      setMidi({ status: 'unsupported', error: null, inputs: [] });
      return undefined;
    }
    let access = null;
    let cancelled = false;
    const bound = new Set();
    const listener = (e) => onMidiRef.current(e.data);

    // Every input, not just the first: the Launchkey shows up as two ports
    // (MIDI and DAW) and a second controller should work too.
    const bind = () => {
      const list = [];
      access.inputs.forEach((input) => {
        if (!bound.has(input)) {
          input.addEventListener('midimessage', listener);
          bound.add(input);
        }
        if (input.state !== 'disconnected') list.push({ id: input.id, name: input.name });
      });
      setMidi({ status: 'ready', error: null, inputs: list });
    };

    navigator.requestMIDIAccess({ sysex: false })
      .then((a) => {
        if (cancelled) return;
        access = a;
        bind();
        access.onstatechange = () => { bind(); };
      })
      .catch((err) => {
        if (!cancelled) setMidi({ status: 'denied', error: err?.message || String(err), inputs: [] });
      });

    return () => {
      cancelled = true;
      if (access) access.onstatechange = null;
      bound.forEach((input) => input.removeEventListener('midimessage', listener));
    };
  }, []);

  // ---- audio -------------------------------------------------------------

  useEffect(() => {
    const engine = createSoundEngine({
      onStatus: (status, error) => setAudio({ status, error: error || null }),
    });
    if (!engine) return undefined;
    engineRef.current = engine;
    const unlock = () => engine.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      engineRef.current = null;
      engine.close();
    };
  }, []);

  useEffect(() => { engineRef.current?.loadPiano(settings.piano); }, [settings.piano]);

  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    Object.entries(settings.volumes).forEach(([k, v]) => e.setVolume(k, v));
  }, [settings.volumes]);

  // ---- loop scheduler ----------------------------------------------------

  useEffect(() => {
    const id = setInterval(() => {
      const lookahead = document.hidden ? HIDDEN_LOOKAHEAD_SEC : LOOKAHEAD_SEC;
      looperRef.current.schedule(nowSec(), lookahead, (ev, at) => {
        engineRef.current?.scheduleLoopEvent(ev, at);
        if (ev.type === 'piano') {
          trailsRef.current.push({ midi: ev.midi, start: at, end: at + ev.dur, loop: true, vel: ev.vel, layer: ev.layer });
        } else {
          flashesRef.current.push({ note: ev.note, at, loop: true });
        }
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  // ---- computer keyboard -------------------------------------------------

  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'Space') {
        e.preventDefault();
        loopAction('loop');
      } else if (e.key === 'Escape') {
        if (learningRef.current) setLearning(null);
        else loopAction('stop');
      }
    };
    // A focused button would also "click" on Space's keyup; Space is the loop key here.
    const onKeyUp = (e) => {
      if (e.code === 'Space' && !isTyping(e.target)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [loopAction]);

  // ---- drawing -------------------------------------------------------------

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const now = nowSec();
      drawVisualizer(canvasRef.current, now);
      drawLane(laneRef.current, looperRef.current, now);
      updateRing(ringRef.current, looperRef.current, now);
      updatePads(now);
      refreshLoopInfo();
    };

    const drawVisualizer = (canvas, now) => {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (!w || !h) return;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const ctx = canvas.getContext('2d');

      const keyH = Math.round(Math.min(Math.max(h * 0.24, 70 * dpr), 150 * dpr));
      const keyTop = h - keyH;
      const layout = buildKeyLayout(w, keyH);
      const byMidi = new Map();
      layout.whites.forEach((k) => byMidi.set(k.midi, k));
      layout.blacks.forEach((k) => byMidi.set(k.midi, k));
      keyLayoutRef.current = { layout, keyTop, dpr };

      ctx.fillStyle = '#0b0b0d';
      ctx.fillRect(0, 0, w, h);

      // octave guides, one faint line at every C
      ctx.fillStyle = 'rgba(255,255,255,0.045)';
      layout.whites.forEach((k) => { if (k.midi % 12 === 0) ctx.fillRect(Math.round(k.x), 0, Math.max(1, dpr), keyTop); });

      // rising notes
      const speed = keyTop / RISE_SEC;
      const loopSounding = new Set();
      const kept = [];
      const radius = 3 * dpr;
      ctx.save();
      for (const t of trailsRef.current) {
        if (t.start > now) { kept.push(t); continue; } // scheduled loop note, not sounding yet
        const end = t.end == null ? now : Math.min(t.end, now);
        const yBottom = keyTop - (now - end) * speed;
        if (yBottom <= 0) continue; // risen off the top: drop it
        kept.push(t);
        if (t.loop && now < t.end) loopSounding.add(t.midi);
        const k = byMidi.get(t.midi);
        if (!k) continue;
        const yTop = Math.max(0, keyTop - (now - t.start) * speed);
        const color = t.loop ? (LAYER_COLORS[t.layer % LAYER_COLORS.length] || LOOP) : LIVE;
        ctx.globalAlpha = 0.5 + 0.5 * Math.min(t.vel, 127) / 127;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14 * dpr;
        ctx.beginPath();
        ctx.roundRect(k.x + dpr, yTop, Math.max(dpr, k.w - 2 * dpr), Math.max(2 * dpr, yBottom - yTop), radius);
        ctx.fill();
      }
      ctx.restore();
      trailsRef.current = kept.length > 4000 ? kept.slice(-4000) : kept;

      // keyboard
      const held = heldRef.current;
      const sustained = sustainedRef.current;
      const fillKey = (k, base) => {
        const live = held.has(k.midi) || sustained.has(k.midi);
        const loop = loopSounding.has(k.midi);
        ctx.fillStyle = live ? (k.black ? LIVE : LIVE_KEY) : loop ? LOOP : base;
        ctx.globalAlpha = !live && sustained.has(k.midi) ? 0.7 : 1;
        ctx.fillRect(k.x, keyTop + k.y, k.w, k.h);
        ctx.globalAlpha = 1;
      };
      layout.whites.forEach((k) => {
        fillKey(k, '#f5f5ef');
        ctx.fillStyle = '#c9c9c2';
        ctx.fillRect(Math.round(k.x + k.w) - dpr, keyTop, dpr, keyH);
        if (k.midi % 12 === 0 && k.w > 9 * dpr) {
          ctx.fillStyle = held.has(k.midi) ? '#ffffff' : '#8c8c86';
          ctx.font = `${Math.round(Math.min(10 * dpr, k.w * 0.55))}px 'Hubot Sans', system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(noteName(k.midi), k.x + k.w / 2, h - 6 * dpr);
        }
      });
      layout.blacks.forEach((k) => fillKey(k, '#1a1a1a'));

      // hit line
      ctx.fillStyle = LIVE_KEY;
      ctx.shadowColor = LIVE;
      ctx.shadowBlur = 10 * dpr;
      ctx.fillRect(0, keyTop - 2 * dpr, w, 2 * dpr);
      ctx.shadowBlur = 0;
    };

    const updatePads = (now) => {
      const lit = new Map(); // note -> 'live' | 'loop'
      flashesRef.current = flashesRef.current.filter((f) => now < f.at + PAD_FLASH_SEC);
      flashesRef.current.forEach((f) => {
        if (f.at <= now && lit.get(f.note) !== 'live') lit.set(f.note, f.loop ? 'loop' : 'live');
      });
      padElsRef.current.forEach((el, note) => {
        const state = lit.get(note);
        el.classList.toggle('is-hit', state === 'live');
        el.classList.toggle('is-loop-hit', state === 'loop');
      });
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [refreshLoopInfo]);

  // ---- on-screen keys ------------------------------------------------------

  const keyFromPointer = (e) => {
    const k = keyLayoutRef.current;
    const canvas = canvasRef.current;
    if (!k || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * k.dpr;
    const y = (e.clientY - rect.top) * k.dpr - k.keyTop;
    if (y < 0) return null;
    return keyAtPoint(k.layout, x, y);
  };

  const onCanvasDown = (e) => {
    const m = keyFromPointer(e);
    if (m == null) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
    pointerKeyRef.current.set(e.pointerId, m);
    keyDown(m, 96);
  };
  const onCanvasMove = (e) => {
    if (!pointerKeyRef.current.has(e.pointerId)) return;
    const m = keyFromPointer(e);
    const prev = pointerKeyRef.current.get(e.pointerId);
    if (m == null || m === prev) return;
    keyUp(prev);
    pointerKeyRef.current.set(e.pointerId, m);
    keyDown(m, 96);
  };
  const onCanvasUp = (e) => {
    const prev = pointerKeyRef.current.get(e.pointerId);
    if (prev == null) return;
    pointerKeyRef.current.delete(e.pointerId);
    keyUp(prev);
  };

  // ---- settings helpers ----------------------------------------------------

  const setPad = (note, id) => setSettings((s) => ({ ...s, padMap: { ...s.padMap, [note]: id } }));
  const setVolume = (k, v) => setSettings((s) => ({ ...s, volumes: { ...s.volumes, [k]: v } }));

  const downloadLoop = async () => {
    const looper = looperRef.current;
    if (!looper.events.length || !looper.length) return;
    const { Midi } = await import('@tonejs/midi');
    const file = new Midi();
    file.header.name = 'GrooveSheet loop';
    const keys = file.addTrack();
    keys.name = 'Keys';
    keys.channel = 0;
    const drums = file.addTrack();
    drums.name = 'Drums';
    drums.channel = 9;
    looper.events.forEach((ev) => {
      if (ev.type === 'piano') {
        keys.addNote({ midi: ev.midi, time: ev.t, duration: ev.dur, velocity: ev.vel / 127 });
      } else {
        const v = voiceById(ev.voice);
        drums.addNote({ midi: v ? v.gm : ev.note, time: ev.t, duration: 0.1, velocity: ev.vel / 127 });
      }
    });
    const blob = new Blob([file.toArray()], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'groovesheet-loop.mid';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // ---- render ----------------------------------------------------------------

  const copy = LOOP_COPY[loopInfo.state] || LOOP_COPY.empty;
  const hasLoop = loopInfo.length > 0;
  const readout = loopInfo.state === 'recording'
    ? fmtTime(loopInfo.elapsed)
    : hasLoop ? `${fmtTime(loopInfo.length)} loop` : '—';
  const stopLabel = loopInfo.state === 'stopped' ? 'Clear' : 'Stop';
  const drumCh = settings.drumChannel;

  return (
    <div className="midikeys">
      <header className="midikeys__head">
        <div>
          <h1 className="midikeys__title">MIDI Keyboard</h1>
          <p className="midikeys__sub">
            Play, loop and layer. Keys play piano, pads play drums, and the Launchkey&apos;s Play ▶ works the looper.
          </p>
        </div>
        <div className="midikeys__status">
          <span className={`midikeys__pill ${midi.inputs.length ? 'is-on' : ''}`}>
            <span className="midikeys__dot" />
            {midi.status === 'ready' && midi.inputs.length
              ? midi.inputs.map((i) => i.name).join(' · ')
              : midi.status === 'prompting' ? 'Asking for MIDI access…' : 'No MIDI device'}
          </span>
          <span className={`midikeys__pill ${audio.status === 'ready' ? 'is-on' : ''}`}>
            <span className="midikeys__dot" />
            {audio.status === 'ready' && 'Sound on'}
            {audio.status === 'loading' && 'Loading sounds…'}
            {audio.status === 'locked' && 'Click to turn sound on'}
            {audio.status === 'error' && 'Sound failed'}
          </span>
          <label className="midikeys__select">
            <span>Piano</span>
            <select value={settings.piano} onChange={(e) => setSettings((s) => ({ ...s, piano: e.target.value }))}>
              {PIANO_SOUNDS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
        </div>
      </header>

      {midi.status === 'unsupported' && (
        <StatusMessage variant="warning" title="This browser can't read MIDI">
          Web MIDI works in Chrome, Edge and Opera on desktop. You can still play the on-screen keys and pads.
        </StatusMessage>
      )}
      {midi.status === 'denied' && (
        <StatusMessage variant="error" title="MIDI access was blocked">
          Allow MIDI devices for this site in the browser&apos;s site settings, then reload.
        </StatusMessage>
      )}
      {midi.status === 'ready' && !midi.inputs.length && (
        <StatusMessage variant="info">
          No MIDI device found. Plug in the keyboard (it appears as soon as it is connected), or play the on-screen keys.
        </StatusMessage>
      )}
      {audio.status === 'error' && (
        <StatusMessage variant="error" title="The piano sound did not load">{audio.error}</StatusMessage>
      )}

      <div className="midikeys__deck">
        {/* ---- looper ---- */}
        <section className="midikeys__card midikeys__looper" aria-label="Looper">
          <div className="midikeys__looper-main">
            <button
              type="button"
              className={`midikeys__loopbtn is-${loopInfo.state}`}
              onClick={() => loopAction('loop')}
              aria-label={`Looper: ${copy.label}`}
            >
              <svg className="midikeys__ring" viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="54" className="midikeys__ring-track" />
                <circle ref={ringRef} cx="60" cy="60" r="54" className="midikeys__ring-fill" pathLength="1" />
              </svg>
              <span className="midikeys__loopbtn-label">{copy.label}</span>
              <span className="midikeys__loopbtn-time">{readout}</span>
            </button>
            <div className="midikeys__looper-side">
              <p className="midikeys__hint">{copy.hint}</p>
              <div className="midikeys__btnrow">
                <button type="button" className="midikeys__btn" onClick={() => loopAction('stop')} disabled={loopInfo.state === 'empty'}>
                  {stopLabel}
                </button>
                <button type="button" className="midikeys__btn" onClick={() => loopAction('undo')} disabled={!loopInfo.layers}>
                  Undo layer
                </button>
                <button type="button" className="midikeys__btn" onClick={downloadLoop} disabled={!hasLoop || !loopInfo.count}>
                  Save .mid
                </button>
              </div>
              <label className="midikeys__range">
                <span>Loop volume</span>
                <input type="range" min="0" max="1.2" step="0.05" value={settings.volumes.loop} onChange={(e) => setVolume('loop', Number(e.target.value))} />
              </label>
            </div>
          </div>

          <canvas ref={laneRef} className="midikeys__lane" aria-label="The recorded loop" />

          <div className="midikeys__bindings">
            {ACTIONS.map((action) => (
              <div key={action} className="midikeys__binding">
                <span className="midikeys__binding-name">{action === 'loop' ? 'Loop button' : 'Stop / clear'}</span>
                <span className="midikeys__chips">
                  {learning === action ? (
                    <span className="midikeys__chip is-learning">Press a button on the keyboard… (Esc cancels)</span>
                  ) : (
                    <>
                      {settings.bindings[action].map((b) => <span key={describeBinding(b)} className="midikeys__chip">{describeBinding(b)}</span>)}
                      <span className="midikeys__chip is-key">{action === 'loop' ? 'Space' : 'Esc'}</span>
                    </>
                  )}
                </span>
                <button type="button" className="midikeys__link" onClick={() => setLearning(learning === action ? null : action)}>
                  {learning === action ? 'Cancel' : 'Learn'}
                </button>
              </div>
            ))}
            <button type="button" className="midikeys__link midikeys__link--reset" onClick={() => setSettings((s) => ({ ...s, bindings: DEFAULT_BINDINGS }))}>
              Reset to Launchkey defaults
            </button>
          </div>
        </section>

        {/* ---- drum pads ---- */}
        <section className="midikeys__card midikeys__pads" aria-label="Drum pads">
          <div className="midikeys__card-head">
            <div>
              <h2 className="midikeys__card-title">Drum pads</h2>
              <p className="midikeys__card-sub">Launchkey pads in Drum mode send on channel {drumCh + 1}. Tap a pad here to try it.</p>
            </div>
            <div className="midikeys__pad-tools">
              <label className="midikeys__select">
                <span>Channel</span>
                <select value={drumCh} onChange={(e) => setSettings((s) => ({ ...s, drumChannel: Number(e.target.value) }))}>
                  {Array.from({ length: 16 }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}
                </select>
              </label>
              <button type="button" className={`midikeys__btn ${editPads ? 'is-active' : ''}`} onClick={() => setEditPads((v) => !v)}>
                {editPads ? 'Done' : 'Change sounds'}
              </button>
              {editPads && (
                <button type="button" className="midikeys__link" onClick={() => setSettings((s) => ({ ...s, padMap: DEFAULT_PAD_MAP }))}>
                  Reset
                </button>
              )}
            </div>
          </div>
          <div className="midikeys__padgrid">
            {[0, 1].map((half) => (
              <div key={half} className="midikeys__padhalf">
                {PAD_ROWS.map((row) => row.slice(half * 4, half * 4 + 4).map((note) => {
                  const voice = voiceById(voiceForNote(settings.padMap, note));
                  const setEl = (el) => { if (el) padElsRef.current.set(note, el); else padElsRef.current.delete(note); };
                  return editPads ? (
                    <label key={note} ref={setEl} className="midikeys__pad is-editing">
                      <span className="midikeys__pad-note">Pad {note}</span>
                      <select value={voice ? voice.id : ''} onChange={(e) => setPad(note, e.target.value)}>
                        {DRUM_VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                      </select>
                    </label>
                  ) : (
                    <button
                      key={note}
                      ref={setEl}
                      type="button"
                      className="midikeys__pad"
                      onPointerDown={(e) => { e.preventDefault(); drumHit(note, 100); }}
                    >
                      <span className="midikeys__pad-name">{voice ? voice.label : '—'}</span>
                      <span className="midikeys__pad-note">{note}</span>
                    </button>
                  );
                }))}
              </div>
            ))}
          </div>
          <div className="midikeys__mixer">
            {[['master', 'Master'], ['piano', 'Piano'], ['drums', 'Drums']].map(([k, label]) => (
              <label key={k} className="midikeys__range">
                <span>{label}</span>
                <input type="range" min="0" max="1.2" step="0.05" value={settings.volumes[k]} onChange={(e) => setVolume(k, Number(e.target.value))} />
              </label>
            ))}
          </div>
        </section>
      </div>

      <div className="midikeys__stage">
        <canvas
          ref={canvasRef}
          className="midikeys__canvas"
          onPointerDown={onCanvasDown}
          onPointerMove={onCanvasMove}
          onPointerUp={onCanvasUp}
          onPointerCancel={onCanvasUp}
        />
        <div className="midikeys__legend" aria-hidden="true">
          <span><i style={{ background: LIVE }} /> You</span>
          <span><i style={{ background: LOOP }} /> Loop</span>
        </div>
      </div>
    </div>
  );
}

// ---- loop lane: the recorded loop as a small piano roll ---------------------

function drawLane(canvas, looper, now) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (!w || !h) return;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  const info = looper.info(now);
  const events = looper.events;
  const span = info.state === 'recording' ? Math.max(info.elapsed, 2) : info.length;

  if (!events.length || !span) {
    ctx.fillStyle = '#5f5e60';
    ctx.font = `${12 * dpr}px 'Hubot Sans', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(info.state === 'armed' ? 'Play to start the loop' : 'Your loop appears here', w / 2, h / 2);
    return;
  }

  const piano = events.filter((e) => e.type === 'piano');
  const drums = events.filter((e) => e.type === 'drum');
  const drumRows = [...new Set(drums.map((e) => e.voice))];
  const drumH = drumRows.length ? Math.min(h * 0.35, drumRows.length * 6 * dpr) : 0;
  const pianoH = h - drumH - (drumH ? 3 * dpr : 0);
  let lo = 127;
  let hi = 0;
  piano.forEach((e) => { lo = Math.min(lo, e.midi); hi = Math.max(hi, e.midi); });
  if (lo > hi) { lo = 60; hi = 72; }
  const mid = (lo + hi) / 2;
  const range = Math.max(12, hi - lo + 2);
  const rowH = pianoH / range;
  const yOf = (m) => pianoH - ((m - (mid - range / 2)) / range) * pianoH - rowH;
  const xOf = (t) => (t / span) * w;

  piano.forEach((e) => {
    ctx.fillStyle = LAYER_COLORS[e.layer % LAYER_COLORS.length];
    const x = xOf(e.t);
    const len = Math.max(2 * dpr, xOf(e.dur));
    const y = yOf(e.midi);
    const hh = Math.max(2 * dpr, rowH - dpr);
    ctx.fillRect(x, y, Math.min(len, w - x), hh);
    if (x + len > w && info.state !== 'recording') ctx.fillRect(0, y, x + len - w, hh); // wraps round
  });
  drums.forEach((e) => {
    const row = drumRows.indexOf(e.voice);
    const y = pianoH + 3 * dpr + (row + 0.5) * (drumH / drumRows.length);
    ctx.fillStyle = LAYER_COLORS[e.layer % LAYER_COLORS.length];
    ctx.beginPath();
    ctx.arc(xOf(e.t), y, Math.min(2.5 * dpr, drumH / drumRows.length / 2), 0, Math.PI * 2);
    ctx.fill();
  });

  // playhead
  const head = info.state === 'recording' ? w - dpr : (info.state === 'playing' || info.state === 'overdub') ? xOf(info.position) : null;
  if (head != null) {
    ctx.fillStyle = info.state === 'recording' || info.state === 'overdub' ? '#ff5a5a' : '#ffffff';
    ctx.fillRect(head, 0, 2 * dpr, h);
  }
}

// Progress ring round the loop button: how far through the loop playback is.
function updateRing(circle, looper, now) {
  if (!circle) return;
  const info = looper.info(now);
  const looping = info.state === 'playing' || info.state === 'overdub';
  const frac = looping && info.length ? info.position / info.length : info.state === 'recording' ? 1 : 0;
  circle.style.strokeDasharray = `${frac} 1`;
  circle.style.opacity = frac > 0 ? '1' : '0'; // a round cap would still draw a dot at 0
}
