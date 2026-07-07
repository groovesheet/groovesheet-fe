// Fretboard view — the second viewer tab when the selected instrument is a
// fretted string (note_view === 'fretboard': guitar, bass). Reuses the
// falling-note fretboard visualiser from the social video frame
// (VideoFretboardRoll), driven by the page's shared transport — the same
// adapter pattern as DrumGridView.
import React, { useEffect, useMemo, useRef } from 'react';
import { Midi } from '@tonejs/midi';
import VideoFretboardRoll from '../video/VideoFretboardRoll';
import SkeletonPanel from '../ui/SkeletonPanel';
import StatusMessage from '../ui/StatusMessage';

function FretboardView({ midiBuffer, transport, loading, error }) {
  const transportRef = useRef(transport);

  useEffect(() => { transportRef.current = transport; }, [transport]);

  // VideoFretboardRoll reads `timeRef.current` in its own rAF loop — a getter
  // proxying the transport clock keeps it seek/pause-synced with no extra loop.
  const timeRef = useMemo(
    () => ({
      get current() {
        const t = transportRef.current;
        return t ? t.getPosition() : 0;
      },
    }),
    []
  );

  const { notes, parseError } = useMemo(() => {
    if (!midiBuffer) return { notes: [], parseError: null };
    let midi;
    try {
      midi = new Midi(midiBuffer);
    } catch (e) {
      return { notes: [], parseError: 'Could not parse the MIDI file.' };
    }
    const out = [];
    midi.tracks.forEach((t) => {
      (t.notes || []).forEach((n) => out.push({ midi: n.midi, time: n.time, duration: n.duration }));
    });
    out.sort((a, b) => a.time - b.time);
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
          <VideoFretboardRoll notes={notes} timeRef={timeRef} />
        </div>
      )}
    </div>
  );
}

export default FretboardView;
