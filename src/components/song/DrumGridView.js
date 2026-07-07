// Drum visualizer — the second viewer tab when the selected instrument's note
// data is unpitched (note_view === 'drums'). Reuses the top-down drum-kit
// visualiser from the social video frame (/video2fordrums): kit photo with
// each piece flashing on its hits, driven by the page's shared transport.
import React, { useEffect, useMemo, useRef } from 'react';
import { Midi } from '@tonejs/midi';
import VideoDrumKit from '../video/VideoDrumKit';
import SkeletonPanel from '../ui/SkeletonPanel';
import StatusMessage from '../ui/StatusMessage';

function DrumGridView({ midiBuffer, transport, loading, error }) {
  const transportRef = useRef(transport);

  useEffect(() => { transportRef.current = transport; }, [transport]);

  // VideoDrumKit reads `timeRef.current` inside its own rAF loop — a getter
  // that proxies the transport clock means no extra loop and no re-renders.
  const timeRef = useMemo(
    () => ({
      get current() {
        const t = transportRef.current;
        return t ? t.getPosition() : 0;
      },
    }),
    []
  );

  // Flatten the drums MIDI into the [{ midi, time }] shape the kit expects.
  const { notes, parseError } = useMemo(() => {
    if (!midiBuffer) return { notes: [], parseError: null };
    let midi;
    try {
      midi = new Midi(midiBuffer);
    } catch (e) {
      return { notes: [], parseError: 'Could not parse the drum MIDI file.' };
    }
    const out = [];
    midi.tracks.forEach((t) => {
      (t.notes || []).forEach((n) => out.push({ midi: n.midi, time: n.time }));
    });
    return { notes: out, parseError: null };
  }, [midiBuffer]);

  return (
    <div className="gs-pianoroll" style={{ position: 'relative' }}>
      {loading && (
        <div style={{ padding: 24 }}>
          <SkeletonPanel count={1} height={200} />
        </div>
      )}
      {(error || parseError) && !loading && (
        <div style={{ padding: 24 }}>
          <StatusMessage variant="error">{error || parseError}</StatusMessage>
        </div>
      )}
      {!loading && !error && !parseError && midiBuffer && (
        <div style={{ width: '100%', height: 460, background: '#08091a' }}>
          <VideoDrumKit notes={notes} timeRef={timeRef} />
        </div>
      )}
    </div>
  );
}

export default DrumGridView;
