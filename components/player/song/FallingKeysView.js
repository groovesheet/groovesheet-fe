import React, { useMemo } from 'react';
import VideoPianoRoll from '../video/VideoPianoRoll';

/**
 * Falling keys — the view /video2forpiano renders, on the library page.
 *
 * Notes descend onto a keyboard and light the key they land on, which is what
 * makes a transcription readable to someone who does not read notation: the
 * piano roll answers "what was played", this answers "where do my hands go".
 *
 * The drawing is VideoPianoRoll, unchanged — the video preview page and this
 * page should not drift into two different pictures of the same MIDI. That
 * component drives itself from `timeRef.current` each frame while this page
 * owns a shared transport, so the bridge is a ref-shaped getter rather than a
 * second animation loop copying the position across every frame.
 */

// Mirrors SongDetail's CenteredNotice, which is defined inside that file; kept
// local so this view stays a leaf with no import back into the page.
function Notice({ title, body }) {
  return (
    <div style={{ padding: '120px 24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
        {title}
      </h1>
      {body && <p style={{ fontSize: 13, color: 'var(--color-muted-foreground)' }}>{body}</p>}
    </div>
  );
}

export default function FallingKeysView({ midiBuffer, transport, loading, error }) {
  const timeRef = useMemo(
    () => ({
      get current() {
        return transport ? transport.getPosition() : 0;
      },
    }),
    [transport]
  );

  if (loading) return <Notice title="Loading notes…" />;
  if (error) return <Notice title="Could not load the MIDI" body={String(error)} />;
  if (!midiBuffer) {
    return (
      <Notice
        title="No MIDI for this instrument yet"
        body="Falling keys are drawn from the transcription MIDI. Pick another instrument from the dropdown above."
      />
    );
  }
  return <VideoPianoRoll midiBuffer={midiBuffer} timeRef={timeRef} mode="piano" />;
}
