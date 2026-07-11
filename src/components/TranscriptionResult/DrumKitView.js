// DrumKitView — the "Drum Kit" tab of the transcription result viewer.
//
// Renders the existing top-down kit visualiser (src/components/video/
// VideoDrumKit.js) fed by hits parsed from the ADToF+ quantized drum MIDI
// (`adtof_plus_drums_quantized_midi`, GM channel-10 pitches, times aligned to
// the real audio). Parsing mirrors PianoRollView in src/components/song/
// SongViewers.js (@tonejs/midi), but reduced to note-on hits [{time, midi}].
//
// Clock: VideoDrumKit polls `timeRef.current` inside its own rAF loop, so we
// hand it a getter that reads the SHARED transport's position each frame —
// the same clock the stem-audio engine drives — and the flashes line up with
// the audio without any extra animation loop here.
import React, { useEffect, useMemo, useRef } from 'react';
import { Midi } from '@tonejs/midi';
import VideoDrumKit from '../video/VideoDrumKit';
import SkeletonPanel from '../ui/SkeletonPanel';
import StatusMessage from '../ui/StatusMessage';
import './DrumKitView.css';

// GM percussion lives on MIDI channel 10 (0-indexed 9).
const PERCUSSION_CHANNEL = 9;

/**
 * Parse a MIDI ArrayBuffer into kit hits [{time, midi}].
 * Note-on events only (velocity > 0), across all tracks; tracks flagged as
 * channel-10 percussion are preferred, with an all-tracks fallback for files
 * that don't carry channel metadata.
 */
function parseDrumHits(midiBuffer) {
  const midi = new Midi(midiBuffer);
  const withNotes = midi.tracks.filter((t) => t.notes && t.notes.length);
  const percussion = withNotes.filter((t) => t.channel === PERCUSSION_CHANNEL);
  const tracks = percussion.length ? percussion : withNotes;
  const hits = tracks
    .flatMap((t) => t.notes)
    .filter((n) => n.velocity > 0)
    .map((n) => ({ time: n.time, midi: n.midi }));
  hits.sort((a, b) => a.time - b.time);
  return hits;
}

export default function DrumKitView({ midiBuffer, transport, loading, error }) {
  const transportRef = useRef(transport);
  useEffect(() => {
    transportRef.current = transport;
  }, [transport]);

  // Live clock for VideoDrumKit: a ref-shaped object whose `current` getter
  // reads the shared transport position, so every rAF frame inside the kit
  // sees the same time the audio engines are at.
  const timeRef = useMemo(
    () => ({
      get current() {
        const t = transportRef.current;
        return t ? t.getPosition() : 0;
      },
    }),
    []
  );

  const parsed = useMemo(() => {
    if (!midiBuffer) return { hits: null, parseError: null };
    try {
      return { hits: parseDrumHits(midiBuffer), parseError: null };
    } catch (e) {
      return { hits: null, parseError: 'Could not parse the drum MIDI file.' };
    }
  }, [midiBuffer]);

  const showError = (error || parsed.parseError) && !loading;
  const empty = !loading && !showError && parsed.hits && parsed.hits.length === 0;
  const ready = !loading && !showError && parsed.hits && parsed.hits.length > 0;

  return (
    <div className="tr-drumkit">
      {loading && (
        <div style={{ padding: 24 }}>
          <SkeletonPanel count={1} height={200} />
        </div>
      )}
      {showError && (
        <div style={{ padding: 24 }}>
          <StatusMessage variant="error">{error || parsed.parseError}</StatusMessage>
        </div>
      )}
      {empty && (
        <div style={{ maxWidth: 560, margin: '48px auto 0', padding: '0 24px' }}>
          <StatusMessage variant="info" title="No drum hits detected">
            We couldn&apos;t find any drum hits in this section of the audio. Try a
            recording where the drums are clearly audible.
          </StatusMessage>
        </div>
      )}
      {ready && (
        <div className="tr-drumkit-stage">
          <VideoDrumKit notes={parsed.hits} timeRef={timeRef} />
        </div>
      )}
    </div>
  );
}
