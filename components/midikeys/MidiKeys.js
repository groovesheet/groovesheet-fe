import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import StatusMessage from '@/components/ui/StatusMessage';
import { buildKeyLayout, keyAtPoint, noteName } from '../bistable/keyLayout';
import { createLooper } from './looper';
import {
  createSoundEngine, DEFAULT_TONE_HZ, DEFAULT_SOUND, SOUND_FAMILIES, soundById, soundTitle, stepSound, isKnownSound,
} from './soundEngine';
import { SAMPLE_SETS, instrumentForProgram } from './instruments';
import { findLaunchkeyOutput, showLines, TARGET_GLOBAL, TARGET_KNOB_1 } from './launchkeyDisplay';
import { DEFAULT_PAD_MAP, DRUM_CHANNEL, DRUM_VOICES, PAD_ROWS, voiceById, voiceForNote } from './drumKit';
import { ACTIONS, DEFAULT_BINDINGS, actionFor, describeBinding, pressFromMessage, sanitizeBindings } from './bindings';
import { bendAmount } from './wheels';
import { FX, DEFAULT_FX, DEFAULT_KNOBS, PAGE_COUNT, PAGE_NAMES, PAGE_SCREEN_NAMES, fxOnPage, knobForMessage, sanitizeFx } from './fx';
import Knob from './Knob';
import Fader from './Fader';
import {
  FADERS, DEFAULT_FADERS, DEFAULT_FADER_BINDINGS, faderForMessage, faderGain, faderLabel, sanitizeFaders,
} from './faders';
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
 *   - The eight knobs play a stage-piano effects section on the keys (Drive,
 *     Treble, Bass, Tremolo, Phaser, Delay amount and time, Reverb), each
 *     re-learnable from any knob; see fx.js.
 *   - The pitch wheel bends the notes you are playing (±2 semitones by default,
 *     the GM convention) and the mod wheel adds vibrato. The keys' sound can be
 *     run through a band-pass filter (the "Aluminium band-pass" preset), whose
 *     centre is the Tone slider.
 *
 * Its sibling /bistable is the projection-mapped installation view; this page
 * is the one to keep open while practising.
 *
 * Time is performance.now() seconds throughout (`nowSec`), so recording and
 * the visualiser work even before audio is unlocked; soundEngine converts to
 * AudioContext time when a sound is actually scheduled.
 */

const STORAGE_KEY = 'gs.midiKeyboard.v1';
// Bumped when a default changes enough that a saved value should be reset to it.
// v3: levels moved from `volumes` (gains) to `faders` (positions).
const SETTINGS_VERSION = 3;
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
  piano: DEFAULT_SOUND, // the keys' sound: a GM instrument id, or one of ours
  sampleSet: SAMPLE_SETS[0].id,
  faders: DEFAULT_FADERS, // 0..1 positions, see faders.js
  faderBindings: DEFAULT_FADER_BINDINGS,
  trimEnd: true, // cut the silence after the last note when the first take is closed
  onePass: true, // an overdub ends by itself one loop after its first note
  fx: DEFAULT_FX, // 0..1 per effect
  knobs: DEFAULT_KNOBS, // controls learnt to one effect each
  fxPage: 0, // the page of effects the eight knobs turn
  bendRange: 2, // semitones each way
  tone: DEFAULT_TONE_HZ, // band-pass centre, Hz
};

const BEND_RANGES = [1, 2, 7, 12];
const TONE_MIN = 250;
const TONE_MAX = 6000;
// The Tone slider is logarithmic: equal travel = equal musical interval.
const toneToSlider = (hz) => Math.log(hz / TONE_MIN) / Math.log(TONE_MAX / TONE_MIN);
const sliderToTone = (x) => Math.round(TONE_MIN * Math.pow(TONE_MAX / TONE_MIN, x));


function loadSettings() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return DEFAULT_SETTINGS;
    const padMap = { ...DEFAULT_PAD_MAP };
    if (saved.padMap && typeof saved.padMap === 'object') {
      Object.entries(saved.padMap).forEach(([note, id]) => { if (voiceById(id)) padMap[note] = id; });
    }
    const ch = Number(saved.drumChannel);
    const fx = sanitizeFx(saved.fx, saved.knobs);
    // Levels saved as gains before the faders carry over; v1's drums were the
    // old loud default, so those start from the new one.
    const oldVolumes = saved.volumes && (saved.version || 1) < 2 ? { ...saved.volumes, drums: undefined } : saved.volumes;
    const mixer = sanitizeFaders(saved.faders, saved.faderBindings, saved.faders ? null : oldVolumes);
    return {
      padMap,
      drumChannel: Number.isInteger(ch) && ch >= 0 && ch <= 15 ? ch : DRUM_CHANNEL,
      bindings: sanitizeBindings(saved.bindings),
      piano: isKnownSound(saved.piano) ? saved.piano : DEFAULT_SETTINGS.piano,
      sampleSet: SAMPLE_SETS.some((x) => x.id === saved.sampleSet) ? saved.sampleSet : DEFAULT_SETTINGS.sampleSet,
      faders: mixer.values,
      faderBindings: mixer.bindings,
      trimEnd: saved.trimEnd !== false,
      fx: fx.values,
      knobs: fx.knobs,
      fxPage: Number.isInteger(saved.fxPage) && saved.fxPage >= 0 && saved.fxPage < PAGE_COUNT ? saved.fxPage : 0,
      onePass: saved.onePass !== false,
      bendRange: BEND_RANGES.includes(saved.bendRange) ? saved.bendRange : DEFAULT_SETTINGS.bendRange,
      tone: Number.isFinite(saved.tone) ? Math.min(Math.max(saved.tone, TONE_MIN), TONE_MAX) : DEFAULT_SETTINGS.tone,
    };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, version: SETTINGS_VERSION }));
  } catch (e) { /* private window */ }
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
  overdubWaiting: { label: 'Overdub', hint: 'Play to start the layer. It records one pass, then stops.' },
  stopped: { label: 'Stopped', hint: 'Press to play from the top. Stop again clears.' },
};

// The line under each non-layer fader.
const FADER_SUBS = {
  keys: (st) => soundById(st.piano).label,
  drums: () => 'Pads',
  loop: () => 'All layers',
  master: () => 'Output',
};

/** Per mixer layer slot (0..4), the instruments its notes were played on. */
function layerSummary(events) {
  const names = Array.from({ length: 5 }, () => new Set());
  events.forEach((e) => {
    const slot = Math.min(e.layer || 0, 4);
    names[slot].add(e.type === 'drum' ? 'Drums' : (e.sound ? soundById(e.sound).label : 'Keys'));
  });
  return names.map((set) => [...set].join(' + '));
}

// What each part of the keyboard does, for the controls map.
function controlMap(settings) {
  const sound = soundById(settings.piano);
  return [
    ['Keys', `Play the sound: ${soundTitle(sound)}`],
    ['Sustain pedal', 'Holds the notes, and they record into the loop held'],
    ['Pitch wheel', `Bends the notes you hold, ±${settings.bendRange} semitones`],
    ['Mod wheel', sound.filter ? 'Auto-wah and tremolo on this sound' : 'Vibrato'],
    ['Pads', `Drums, in Drum mode on channel ${settings.drumChannel + 1}; change a pad's sound in Drum pads`],
    ['Knobs 1-8', `The highlighted effects row (now row ${settings.fxPage + 1})`],
    ['Faders 1-9', 'Keys, Drums, Take 1, Layers 2-5+, Loop, Master (the Mixer)'],
    ['Play ▶ / Record ● / Loop', 'Loop button: arm, close the loop, overdub'],
    ['Stop ■', 'Stop the loop; press again to clear'],
    ['Track ◄ ►', 'Previous / next sound'],
    ['Program change', 'Picks that General MIDI instrument'],
  ];
}

// The controller buttons each row of bindings shows, and the computer key for it.
const BINDING_ROWS = {
  loop: { label: 'Loop button', key: 'Space' },
  stop: { label: 'Stop / clear', key: 'Esc' },
  prevSound: { label: 'Previous sound', key: '[' },
  nextSound: { label: 'Next sound', key: ']' },
  knobPage: { label: 'Knob page', key: null },
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
  const [showControls, setShowControls] = useState(false); // the full-screen controls map
  const showControlsRef = useRef(false);
  showControlsRef.current = showControls;
  const [toast, setToast] = useState(null); // { id, title, detail }: sound / page changes
  const lkOutRef = useRef(null); // { output, sku }: the Launchkey screen, if SysEx is allowed
  const showSoundRef = useRef(() => {}); // names the sound on screen once the Launchkey appears
  const knobScreenRef = useRef(new Map()); // slot -> { timer, last } throttle for knob screens
  const [learningKnob, setLearningKnob] = useState(null); // effect id
  const learningKnobRef = useRef(null);
  learningKnobRef.current = learningKnob;

  const engineRef = useRef(null);
  const looperRef = useRef(null);
  if (!looperRef.current) looperRef.current = createLooper();

  const heldRef = useRef(new Map()); // midi -> velocity, keys physically down
  const sustainRef = useRef(false);
  const sustainedRef = useRef(new Set()); // released keys the pedal is holding
  const trailsRef = useRef([]); // { midi, start, end|null, loop, vel, layer }
  const liveTrailRef = useRef(new Map()); // midi -> its open live trail
  const flashesRef = useRef([]); // { note, at, loop }
  const bendRef = useRef(0); // pitch wheel, -1..1
  const modRef = useRef(0); // mod wheel, 0..127
  const bendFillRef = useRef(null);
  const modFillRef = useRef(null);

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
    const key = `${info.state}|${info.length.toFixed(2)}|${Math.floor(info.elapsed * 10)}|${info.count}|${info.layers}|${info.overdubWaiting}|${Math.ceil(info.overdubLeft * 10)}`;
    if (key === lastInfoKeyRef.current) return;
    lastInfoKeyRef.current = key;
    setLoopInfo(info);
  }, []);

  // ---- the Launchkey screen and the on-page toast -------------------------

  const sendToScreen = useCallback((target, lines) => {
    const lk = lkOutRef.current;
    if (!lk) return;
    try { showLines(lk.sku, target, lines).forEach((msg) => lk.output.send(msg)); } catch (e) { /* port gone */ }
  }, []);

  const announce = useCallback((title, detail, screenLines) => {
    setToast({ id: Date.now(), title, detail });
    sendToScreen(TARGET_GLOBAL, screenLines);
  }, [sendToScreen]);

  // A knob's name and value on its own screen, at most every 40 ms per knob
  // (the last value always lands).
  const showKnob = useCallback((knob) => {
    const f = FX.find((x) => x.id === knob.id);
    if (!f || !lkOutRef.current) return;
    const name = ['Amount', 'Time', 'Feedback'].includes(f.label) ? `${f.group} ${f.label.toLowerCase()}` : f.label;
    const send = () => {
      const lines = [name, f.fmt(settingsRef.current.fx[f.id])];
      // CC 21-28 are the knobs themselves; a learnt control uses the general display
      sendToScreen(knob.viaKnob ? TARGET_KNOB_1 + knob.slot : TARGET_GLOBAL, lines);
    };
    const st = knobScreenRef.current.get(knob.slot) || {};
    const now = performance.now();
    clearTimeout(st.timer);
    if (!st.last || now - st.last > 40) {
      st.last = now;
      send();
    } else {
      st.timer = setTimeout(() => { st.last = performance.now(); send(); }, 40);
    }
    knobScreenRef.current.set(knob.slot, st);
  }, [sendToScreen]);

  // A fader's name and level on the Launchkey: its own display (targets
  // 05h-0Dh) when it is one of the nine faders, else the general one.
  const showFader = useCallback((fader, onFader) => {
    if (!lkOutRef.current) return;
    const f = FADERS.find((x) => x.id === fader.id);
    if (!f) return;
    sendToScreen(onFader ? 0x05 + fader.slot : TARGET_GLOBAL, [f.label, faderLabel(fader.value)]);
  }, [sendToScreen]);

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
    const st = settingsRef.current;
    looperRef.current.pianoOn(midiNote, vel, now, { sound: st.piano, set: st.sampleSet, level: faderGain(st.faders.keys) });
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
    looperRef.current.drum(note, voice, vel, now, { level: faderGain(settingsRef.current.faders.drums) });
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
    if (action === 'prevSound' || action === 'nextSound') {
      setSettings((s) => ({ ...s, piano: stepSound(s.piano, action === 'nextSound' ? 1 : -1) }));
      return;
    }
    if (action === 'knobPage') {
      setSettings((s) => ({ ...s, fxPage: (s.fxPage + 1) % PAGE_COUNT }));
      return;
    }
    const now = nowSec();
    const looper = looperRef.current;
    const opts = { trimEnd: settingsRef.current.trimEnd, onePass: settingsRef.current.onePass };
    if (action === 'loop') {
      looper.press(now, opts);
    } else if (action === 'stop') {
      looper.stop(now, opts);
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

    if (learningKnobRef.current && (status & 0xf0) === 0xb0) {
      const cc = data[1];
      if (cc !== 1 && cc !== 64 && cc < 120) {
        const id = learningKnobRef.current;
        const channel = status & 0x0f;
        if (FADERS.some((f) => f.id === id)) {
          setSettings((s) => ({
            ...s,
            faderBindings: s.faderBindings.map((b) => {
              if (b.id === id) return { id, cc, channel };
              return b.cc === cc && (b.channel == null || b.channel === channel) ? { ...b, cc: null } : b;
            }),
            faders: { ...s.faders, [id]: data[2] / 127 },
          }));
          setLearningKnob(null);
          return;
        }
        setSettings((s) => ({
          ...s,
          // the control now belongs to this effect alone
          knobs: s.knobs.map((k) => {
            if (k.id === id) return { id, cc, channel };
            return k.cc === cc && (k.channel == null || k.channel === channel) ? { ...k, cc: null } : k; // unassigned
          }),
          fx: { ...s.fx, [id]: data[2] / 127 },
        }));
        setLearningKnob(null);
        return;
      }
    }

    const knob = knobForMessage(settingsRef.current.knobs, data, settingsRef.current.fxPage);
    if (knob) {
      // settingsRef first, so the screen shows this value, not the last render's
      settingsRef.current = { ...settingsRef.current, fx: { ...settingsRef.current.fx, [knob.id]: knob.value } };
      setSettings((s) => ({ ...s, fx: { ...s.fx, [knob.id]: knob.value } }));
      const cc = data[1];
      showKnob({ ...knob, viaKnob: cc >= 21 && cc <= 28 && knob.slot === cc - 21 });
      return;
    }

    const fader = faderForMessage(settingsRef.current.faderBindings, data);
    if (fader) {
      settingsRef.current = { ...settingsRef.current, faders: { ...settingsRef.current.faders, [fader.id]: fader.value } };
      setSettings((s) => ({ ...s, faders: { ...s.faders, [fader.id]: fader.value } }));
      showFader(fader, data[1] === 5 + fader.slot);
      return;
    }

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
    else if (cmd === 0xc0) {
      // Program Change: the General MIDI instrument with that number
      const inst = instrumentForProgram(d1);
      if (inst) setSettings((s) => ({ ...s, piano: inst.id }));
    }
    else if (cmd === 0xe0) {
      bendRef.current = bendAmount(d1, d2);
      engineRef.current?.setPitchBend(bendRef.current, settingsRef.current.bendRange);
    } else if (cmd === 0xb0 && d1 === 1) {
      modRef.current = d2;
      engineRef.current?.setModulation(d2);
    } else if (cmd === 0xb0 && d1 === 64) setSustain(d2 >= 64);
    else if (cmd === 0xb0 && d1 === 121) {
      // Reset All Controllers: wheels back to rest, pedal up.
      bendRef.current = 0;
      modRef.current = 0;
      engineRef.current?.setPitchBend(0, settingsRef.current.bendRange);
      engineRef.current?.setModulation(0);
      setSustain(false);
    } else if (cmd === 0xb0 && (d1 === 120 || d1 === 123)) allNotesOff();
  }, [allNotesOff, drumHit, keyDown, keyUp, loopAction, setSustain, showKnob, showFader]);

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
      const hadScreen = !!lkOutRef.current;
      lkOutRef.current = access.sysexEnabled && access.outputs ? findLaunchkeyOutput(access.outputs.values()) : null;
      setMidi({ status: 'ready', error: null, inputs: list, screen: !!lkOutRef.current });
      if (lkOutRef.current && !hadScreen) showSoundRef.current();
    };

    // SysEx lets the page write to the Launchkey's screen. If that permission
    // is refused, ask again without it: everything else works the same.
    navigator.requestMIDIAccess({ sysex: true })
      .catch(() => navigator.requestMIDIAccess({ sysex: false }))
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

  useEffect(() => { engineRef.current?.loadPiano(settings.piano, settings.sampleSet); }, [settings.piano, settings.sampleSet]);

  // Name the sound on the page and on the Launchkey's screen whenever it changes.
  const showSound = useCallback(() => {
    const sound = soundById(settingsRef.current.piano);
    const set = SAMPLE_SETS.find((x) => x.id === settingsRef.current.sampleSet);
    announce(soundTitle(sound), set ? `${set.label} samples` : '', ['Sound', soundTitle(sound), set ? set.label : '']);
  }, [announce]);
  useEffect(() => { showSoundRef.current = showSound; }, [showSound]);
  const firstSoundRef = useRef(true);
  useEffect(() => {
    if (firstSoundRef.current) { firstSoundRef.current = false; return; }
    showSound();
  }, [settings.piano, settings.sampleSet, showSound]);

  const firstPageRef = useRef(true);
  useEffect(() => {
    if (firstPageRef.current) { firstPageRef.current = false; return; }
    const p = settings.fxPage;
    announce(`Knob page ${p + 1}`, PAGE_NAMES[p], ['Knobs', `Page ${p + 1} of ${PAGE_COUNT}`, PAGE_SCREEN_NAMES[p]]);
  }, [settings.fxPage, announce]);

  // Push only the faders that moved.
  const appliedFadersRef = useRef({});
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    Object.entries(settings.faders).forEach(([k, v]) => {
      if (appliedFadersRef.current[k] === v) return;
      appliedFadersRef.current[k] = v;
      e.setLevel(k, faderGain(v));
    });
  }, [settings.faders]);

  useEffect(() => { engineRef.current?.setTone(settings.tone); }, [settings.tone]);

  // Push only the effects that changed (a drive change rebuilds its curve).
  const appliedFxRef = useRef({});
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    Object.entries(settings.fx).forEach(([id, v]) => {
      if (appliedFxRef.current[id] === v) return;
      appliedFxRef.current[id] = v;
      e.setFx(id, v);
    });
  }, [settings.fx]);

  // A new range re-applies the wheel where it is now.
  useEffect(() => { engineRef.current?.setPitchBend(bendRef.current, settings.bendRange); }, [settings.bendRange]);

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
      // A one-pass overdub can end on its own; show that even when no frame is drawn.
      refreshLoopInfo();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [refreshLoopInfo]);

  // ---- computer keyboard -------------------------------------------------

  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape' && learningKnobRef.current) {
        setLearningKnob(null);
        return;
      }
      // Esc closes the controls map (after cancelling a learn inside it)
      if (e.key === 'Escape' && showControlsRef.current) {
        if (learningRef.current) setLearning(null);
        else setShowControls(false);
        return;
      }
      if (e.key === '[' || e.key === ']') {
        loopAction(e.key === ']' ? 'nextSound' : 'prevSound');
        return;
      }
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
      updateWheels();
      refreshLoopInfo();
    };

    const updateWheels = () => {
      const b = bendRef.current;
      if (bendFillRef.current) {
        // fills from the centre line, up for sharp, down for flat
        bendFillRef.current.style.top = `${50 - Math.max(b, 0) * 50}%`;
        bendFillRef.current.style.height = `${Math.abs(b) * 50}%`;
      }
      if (modFillRef.current) modFillRef.current.style.height = `${(modRef.current / 127) * 100}%`;
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
  const setFader = (k, v) => setSettings((s) => ({ ...s, faders: { ...s.faders, [k]: v } }));

  const downloadLoop = async () => {
    const looper = looperRef.current;
    if (!looper.events.length || !looper.length) return;
    const { Midi } = await import('@tonejs/midi');
    const file = new Midi();
    file.header.name = 'GrooveSheet loop';
    // One track per instrument the loop was played on, with its General MIDI
    // program, and the level each note was played at folded into its velocity.
    const tracks = new Map();
    const trackFor = (soundId) => {
      if (!tracks.has(soundId)) {
        const sound = soundById(soundId);
        const t = file.addTrack();
        t.name = sound.label;
        t.channel = tracks.size >= 9 ? tracks.size + 1 : tracks.size; // skip channel 10 (drums)
        const program = Number.isInteger(sound.program) ? sound.program
          : (soundById(sound.after) || {}).program;
        if (Number.isInteger(program)) t.instrument.number = program;
        tracks.set(soundId, t);
      }
      return tracks.get(soundId);
    };
    let drums = null;
    const vel = (ev) => Math.min(1, (ev.vel / 127) * Math.min(Number.isFinite(ev.level) ? ev.level : 1, 1.25));
    looper.events.forEach((ev) => {
      if (ev.type === 'piano') {
        trackFor(ev.sound || settingsRef.current.piano).addNote({ midi: ev.midi, time: ev.t, duration: ev.dur, velocity: vel(ev) });
      } else {
        if (!drums) {
          drums = file.addTrack();
          drums.name = 'Drums';
          drums.channel = 9;
        }
        const v = voiceById(ev.voice);
        drums.addNote({ midi: v ? v.gm : ev.note, time: ev.t, duration: 0.1, velocity: vel(ev) });
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

  const bindingRow = (action) => {
    const meta = BINDING_ROWS[action];
    return (
      <div key={action} className="midikeys__binding">
        <span className="midikeys__binding-name">{meta.label}</span>
        <span className="midikeys__chips">
          {learning === action ? (
            <span className="midikeys__chip is-learning">Press a button on the keyboard… (Esc cancels)</span>
          ) : (
            <>
              {settings.bindings[action].map((b) => <span key={describeBinding(b)} className="midikeys__chip">{describeBinding(b)}</span>)}
              {!settings.bindings[action].length && <span className="midikeys__chip is-key">Not set</span>}
              {meta.key && <span className="midikeys__chip is-key">{meta.key}</span>}
            </>
          )}
        </span>
        <button type="button" className="midikeys__link" onClick={() => setLearning(learning === action ? null : action)}>
          {learning === action ? 'Cancel' : 'Learn'}
        </button>
      </div>
    );
  };

  // What each loop layer was played on, for its mixer channel ('' = empty).
  // Re-read whenever the loop changes, which re-renders through loopInfo.
  const layerNames = layerSummary(looperRef.current.events);
  let copy = LOOP_COPY[loopInfo.state] || LOOP_COPY.empty;
  if (loopInfo.overdubWaiting) copy = LOOP_COPY.overdubWaiting;
  else if (loopInfo.overdubLeft > 0) copy = { ...copy, hint: `Layering, ${loopInfo.overdubLeft.toFixed(1)} s of the pass left. Press to stop early.` };
  const hasLoop = loopInfo.length > 0;
  const readout = loopInfo.state === 'recording'
    ? fmtTime(loopInfo.elapsed)
    : hasLoop ? `${fmtTime(loopInfo.length)} loop` : '—';
  const stopLabel = loopInfo.state === 'stopped' ? 'Clear' : 'Stop';
  const drumCh = settings.drumChannel;

  return (
    <div className="midikeys">
      <header className="midikeys__head">
        <div className="midikeys__titlebar">
          <div>
            <h1 className="midikeys__title">MIDI Keyboard</h1>
            <p className="midikeys__sub">
              Play, loop and layer. Keys play any of 128 instruments, pads play drums, and the Launchkey&apos;s Play ▶ works the looper.
            </p>
          </div>
          <button type="button" className="midikeys__btn midikeys__controls-btn" onClick={() => setShowControls(true)}>
            Controls
          </button>
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
            <span>Sound</span>
            <select value={settings.piano} onChange={(e) => setSettings((s) => ({ ...s, piano: e.target.value }))}>
              {SOUND_FAMILIES.map((f) => (
                <optgroup key={f.family} label={f.family}>
                  {f.sounds.map((x) => <option key={x.id} value={x.id}>{soundTitle(x)}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="midikeys__select">
            <span>Samples</span>
            <select value={settings.sampleSet} onChange={(e) => setSettings((s) => ({ ...s, sampleSet: e.target.value }))}>
              {SAMPLE_SETS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </label>
          {soundById(settings.piano).filter && (
            <label className="midikeys__range midikeys__tone">
              <span>Tone</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.005"
                value={toneToSlider(settings.tone)}
                onChange={(e) => setSettings((s) => ({ ...s, tone: sliderToTone(Number(e.target.value)) }))}
              />
              <output>{settings.tone >= 1000 ? `${(settings.tone / 1000).toFixed(1)} kHz` : `${settings.tone} Hz`}</output>
            </label>
          )}
          <label className="midikeys__select">
            <span>Bend</span>
            <select value={settings.bendRange} onChange={(e) => setSettings((s) => ({ ...s, bendRange: Number(e.target.value) }))}>
              {BEND_RANGES.map((r) => <option key={r} value={r}>±{r} st</option>)}
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
        <div className="midikeys__col">
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
                <label className="midikeys__check">
                  <input
                    type="checkbox"
                    checked={settings.trimEnd}
                    onChange={(e) => setSettings((s) => ({ ...s, trimEnd: e.target.checked }))}
                  />
                  Trim the silence after the last note
                </label>
                <label className="midikeys__check">
                  <input
                    type="checkbox"
                    checked={settings.onePass}
                    onChange={(e) => setSettings((s) => ({ ...s, onePass: e.target.checked }))}
                  />
                  Overdubs stop after one pass
                </label>
              </div>
            </div>

            <canvas ref={laneRef} className="midikeys__lane" aria-label="The recorded loop" />
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
          </section>
        </div>

        <div className="midikeys__col">
          {/* ---- effects (the Launchkey knobs) ---- */}
          <section className="midikeys__card midikeys__fx" aria-label="Effects">
            <div className="midikeys__card-head">
              <div>
                <h2 className="midikeys__card-title">Effects</h2>
                <p className="midikeys__card-sub">
                  The eight Launchkey knobs, left to right, turn the highlighted row. Drag a knob here, double-click to reset.
                </p>
              </div>
            </div>
            {PAGE_NAMES.map((pageName, p) => {
              const rowFx = fxOnPage(p);
              const active = settings.fxPage === p;
              return (
                <div key={pageName} className={`midikeys__fxpage ${active ? 'is-active' : ''}`}>
                  <button
                    type="button"
                    className="midikeys__fxpage-tag"
                    aria-pressed={active}
                    title={active ? 'The Launchkey knobs turn this row' : 'Make the Launchkey knobs turn this row'}
                    onClick={() => setSettings((s) => ({ ...s, fxPage: p }))}
                  >
                    <span className="midikeys__fxpage-num">{p + 1}</span>
                    <span className="midikeys__fxpage-state">{active ? 'Knobs' : 'Use'}</span>
                  </button>
                  <div className="midikeys__fxrow">
                    {rowFx.map((f, i) => {
                      const groupStart = i === 0 || rowFx[i - 1].group !== f.group;
                      return (
                        <div key={f.id} className={`midikeys__fxslot ${groupStart ? 'is-group-start' : ''}`}>
                          <span className="midikeys__fxgroup">{groupStart ? f.group : '\u00a0'}</span>
                          <Knob
                            label={f.label}
                            value={settings.fx[f.id]}
                            def={f.def}
                            centred={f.def === 0.5}
                            display={f.fmt(settings.fx[f.id])}
                            learning={learningKnob === f.id}
                            onLearn={() => setLearningKnob(learningKnob === f.id ? null : f.id)}
                            onChange={(v) => setSettings((s) => ({ ...s, fx: { ...s.fx, [f.id]: v } }))}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div className="midikeys__fxfoot">
              <button
                type="button"
                className="midikeys__link midikeys__link--reset"
                onClick={() => setSettings((s) => ({ ...s, fx: DEFAULT_FX, knobs: DEFAULT_KNOBS, fxPage: 0 }))}
              >
                Reset effects
              </button>
            </div>
          </section>

          {/* ---- mixer (the Launchkey faders) ---- */}
          <section className="midikeys__card midikeys__mixercard" aria-label="Mixer">
            <div className="midikeys__card-head">
              <div>
                <h2 className="midikeys__card-title">Mixer</h2>
                <p className="midikeys__card-sub">
                  The nine Launchkey faders, left to right. Every loop layer keeps the instrument and level it was played at.
                </p>
              </div>
              <button
                type="button"
                className="midikeys__link"
                onClick={() => setSettings((s) => ({ ...s, faders: DEFAULT_FADERS, faderBindings: DEFAULT_FADER_BINDINGS }))}
              >
                Reset mixer
              </button>
            </div>
            <div className="midikeys__faders">
              {FADERS.map((f) => (
                <Fader
                  key={f.id}
                  label={f.label}
                  sub={f.layer != null ? layerNames[f.layer] || 'Empty' : FADER_SUBS[f.id](settings)}
                  dim={f.layer != null && !layerNames[f.layer]}
                  value={settings.faders[f.id]}
                  def={f.def}
                  display={faderLabel(settings.faders[f.id])}
                  learning={learningKnob === f.id}
                  onLearn={() => setLearningKnob(learningKnob === f.id ? null : f.id)}
                  onChange={(v) => setFader(f.id, v)}
                />
              ))}
            </div>
          </section>
        </div>
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
        {toast && (
          <div key={toast.id} className="midikeys__toast" role="status">
            <strong>{toast.title}</strong>
            {toast.detail && <span>{toast.detail}</span>}
          </div>
        )}
        <div className="midikeys__wheels" aria-hidden="true">
          <div className="midikeys__wheel">
            <div className="midikeys__wheel-track midikeys__wheel-track--bend">
              <div ref={bendFillRef} className="midikeys__wheel-fill" />
            </div>
            <span>Pitch</span>
          </div>
          <div className="midikeys__wheel">
            <div className="midikeys__wheel-track">
              <div ref={modFillRef} className="midikeys__wheel-fill midikeys__wheel-fill--mod" />
            </div>
            <span>Mod</span>
          </div>
        </div>
        <div className="midikeys__legend" aria-hidden="true">
          <span><i style={{ background: LIVE }} /> You</span>
          <span><i style={{ background: LOOP }} /> Loop</span>
        </div>
      </div>

      {showControls && createPortal(
        <div className="midikeys midikeys-controls" role="dialog" aria-modal="true" aria-label="Controls">
          <div className="midikeys-controls__inner">
            <div className="midikeys-controls__head">
              <div>
                <h2 className="midikeys__title">Controls</h2>
                <p className="midikeys__sub">What every part of the Launchkey does here, and which buttons are mapped. Esc closes.</p>
              </div>
              <button type="button" className="midikeys__btn" onClick={() => setShowControls(false)}>Close</button>
            </div>

            <div className="midikeys-controls__grid">
              <section className="midikeys__card">
                <h3 className="midikeys__card-title">Buttons</h3>
                <p className="midikeys__card-sub">Click Learn, then press the button on the Launchkey you want for it.</p>
                <div className="midikeys__bindings">
                  {['loop', 'stop', 'prevSound', 'nextSound', 'knobPage'].map(bindingRow)}
                  <button
                    type="button"
                    className="midikeys__link midikeys__link--reset"
                    onClick={() => setSettings((s) => ({ ...s, bindings: DEFAULT_BINDINGS }))}
                  >
                    Reset to Launchkey defaults
                  </button>
                </div>
              </section>

              <section className="midikeys__card">
                <h3 className="midikeys__card-title">The keyboard</h3>
                <dl className="midikeys-controls__map">
                  {controlMap(settings).map(([part, does]) => (
                    <React.Fragment key={part}>
                      <dt>{part}</dt>
                      <dd>{does}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              </section>

              <section className="midikeys__card">
                <h3 className="midikeys__card-title">Knobs</h3>
                <p className="midikeys__card-sub">
                  Knobs 1 to 8 turn row {settings.fxPage + 1} of the effects. Effects with a control of their own:
                </p>
                <dl className="midikeys-controls__map">
                  {settings.knobs.filter((k) => k.cc != null).map((k) => {
                    const f = FX.find((x) => x.id === k.id);
                    return (
                      <React.Fragment key={k.id}>
                        <dt>{`CC ${k.cc}${k.channel == null ? '' : ` · ch ${k.channel + 1}`}`}</dt>
                        <dd>{f ? `${f.group}: ${f.label}` : k.id}</dd>
                      </React.Fragment>
                    );
                  })}
                  {!settings.knobs.some((k) => k.cc != null) && <dd className="midikeys-controls__none">None yet. Use Learn under a knob.</dd>}
                </dl>
              </section>

              <section className="midikeys__card">
                <h3 className="midikeys__card-title">Computer keys</h3>
                <dl className="midikeys-controls__map">
                  <dt>Space</dt><dd>Loop button</dd>
                  <dt>Esc</dt><dd>Stop, then clear</dd>
                  <dt>[ and ]</dt><dd>Previous / next sound</dd>
                  <dt>Click the keys</dt><dd>Play the on-screen keyboard</dd>
                </dl>
              </section>
            </div>
          </div>
        </div>,
        document.body
      )}

      <p className="midikeys__credits">
        Instrument samples: the MusyngKite (CC BY-SA 3.0), FluidR3 (CC BY 3.0) and FatBoy (CC BY-SA 3.0) General MIDI
        soundfonts, rendered by{' '}
        <a href="https://github.com/gleitz/midi-js-soundfonts" target="_blank" rel="noopener noreferrer">gleitz/midi-js-soundfonts</a>.
      </p>
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
