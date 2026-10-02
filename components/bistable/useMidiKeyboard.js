import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Subscribes to every Web MIDI input and reports which notes are held down.
 *
 * Attaches to *all* inputs, not just the first: the Launchkey (and most
 * controllers with pads or an InControl/DAW mode) exposes two ports, with the
 * keys on one and the pads/knobs on the other.
 *
 * Held notes live in a ref (`activeRef`) so the canvas rAF loop can read them
 * without a React render, and in state (`active`) for the DOM readout. Note
 * on/off arrive at human rates, so mirroring them into state is cheap —
 * MIDI clock and active sensing never reach here because the status-byte
 * switch below ignores anything that isn't a note message.
 *
 * @param {boolean} enabled  pass false to tear the connection down
 * @param {object}  [handlers]  { onNoteOn(midi, velocity), onNoteOff(midi), onAllNotesOff() }
 *   — fired for every note change whatever its source (MIDI or the pointer
 *   helpers returned below), so a listener like the piano voice subscribes once.
 */
export default function useMidiKeyboard(enabled = true, handlers = {}) {
  // 'unsupported' | 'prompting' | 'ready' | 'denied'
  const [status, setStatus] = useState('prompting');
  const [error, setError] = useState(null);
  const [inputs, setInputs] = useState([]);
  const [active, setActive] = useState(() => new Map()); // midi -> velocity

  const activeRef = useRef(new Map());

  // Held in a ref so a caller passing inline handlers doesn't re-run the
  // effect below and tear down every MIDI binding on each render.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const apply = useCallback((mutate) => {
    const next = new Map(activeRef.current);
    mutate(next);
    activeRef.current = next;
    setActive(next);
  }, []);

  const noteOn = useCallback((midi, velocity) => {
    apply((m) => m.set(midi, velocity));
    handlersRef.current.onNoteOn?.(midi, velocity);
  }, [apply]);

  const noteOff = useCallback((midi) => {
    // Ignore a note-off for a key that is not down; otherwise the duplicate
    // note-off some controllers emit would retrigger the release envelope.
    if (!activeRef.current.has(midi)) return;
    apply((m) => m.delete(midi));
    handlersRef.current.onNoteOff?.(midi);
  }, [apply]);

  const allNotesOff = useCallback(() => {
    apply((m) => m.clear());
    handlersRef.current.onAllNotesOff?.();
  }, [apply]);

  useEffect(() => {
    if (!enabled) return undefined;

    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      setStatus('unsupported');
      return undefined;
    }

    let access = null;
    let cancelled = false;

    const handleMessage = (event) => {
      const [statusByte, data1, data2] = event.data;
      const command = statusByte & 0xf0;

      if (command === 0x90 && data2 > 0) {
        noteOn(data1, data2);
      } else if (command === 0x80 || (command === 0x90 && data2 === 0)) {
        // Many controllers send note-on with velocity 0 instead of note-off.
        noteOff(data1);
      } else if (command === 0xb0 && (data1 === 123 || data1 === 120)) {
        allNotesOff(); // "all notes off" / "all sound off"
      }
    };

    const bind = () => {
      if (!access) return;
      const list = [];
      access.inputs.forEach((input) => {
        input.onmidimessage = handleMessage;
        list.push({ id: input.id, name: input.name, manufacturer: input.manufacturer });
      });
      setInputs(list);
    };

    navigator
      .requestMIDIAccess({ sysex: false })
      .then((midiAccess) => {
        if (cancelled) return;
        access = midiAccess;
        setStatus('ready');
        bind();
        // Re-bind on hot-plug so unplugging or powering the keyboard on mid-session works.
        access.onstatechange = () => {
          bind();
          allNotesOff();
        };
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('denied');
        setError(err?.message || String(err));
      });

    return () => {
      cancelled = true;
      if (access) {
        access.onstatechange = null;
        access.inputs.forEach((input) => { input.onmidimessage = null; });
      }
    };
  }, [enabled, noteOn, noteOff, allNotesOff]);

  return { status, error, inputs, active, activeRef, noteOn, noteOff, allNotesOff };
}
