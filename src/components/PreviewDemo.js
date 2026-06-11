import React, { useEffect, useState } from 'react';
import PreviewPanel from './PreviewPanel/PreviewPanel';
import { parseSyncMap } from '../player/syncMap';

const SAMPLE_XML_URL = `${process.env.PUBLIC_URL || ''}/sample-preview/sample.musicxml`;
const SAMPLE_MIDI_URL = `${process.env.PUBLIC_URL || ''}/sample-preview/sample.mid`;
const SAMPLE_SYNC_MAP_URL = `${process.env.PUBLIC_URL || ''}/sample-preview/sample_sync_map.json`;

export default function PreviewDemo() {
  const [xml, setXml] = useState(null);
  const [midi, setMidi] = useState(null);
  const [syncMap, setSyncMap] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [xmlRes, midiRes] = await Promise.all([
          fetch(SAMPLE_XML_URL),
          fetch(SAMPLE_MIDI_URL),
        ]);
        if (!xmlRes.ok) throw new Error(`XML fetch failed: ${xmlRes.status}`);
        if (!midiRes.ok) throw new Error(`MIDI fetch failed: ${midiRes.status}`);
        const xmlText = await xmlRes.text();
        const midiBuf = await midiRes.arrayBuffer();
        if (cancelled) return;
        setXml(xmlText);
        setMidi(midiBuf);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    // Optional sync map: 404 / invalid JSON → identity mapping (sheet clock ≈
    // MIDI clock after the backend tempo fix). Never blocks the demo.
    (async () => {
      try {
        const res = await fetch(SAMPLE_SYNC_MAP_URL);
        if (!res.ok) return;
        // CRA's dev server serves index.html for missing files; parseSyncMap /
        // res.json() will throw on that and we fall through to identity.
        const map = parseSyncMap(await res.json());
        if (!cancelled) setSyncMap(map);
      } catch (e) {
        /* identity fallback */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="hero">
      <div className="hero-container success-expanded" style={{ paddingTop: 40 }}>
        <div className="upload-area state-success expanded" style={{ position: 'relative' }}>
          <div className="upload-content-top compact">
            <div className="upload-text success-text">
              <h3>Preview Demo — Beethoven sample</h3>
              <p className="filename-text">sample.musicxml + sample.mid</p>
            </div>
          </div>
          {error && (
            <p style={{ color: '#ff6b6b', padding: 16 }}>Failed to load samples: {error}</p>
          )}
          {(xml || midi) && (
            <PreviewPanel
              workflowId="demo"
              selectedInstrument="piano"
              prefetchedFiles={{}}
              preloadedMusicXml={xml}
              preloadedMidiBuffer={midi}
              preloadedSyncMap={syncMap}
            />
          )}
          {!xml && !midi && !error && (
            <p style={{ color: 'var(--color-muted-foreground)', padding: 16 }}>Loading samples…</p>
          )}
        </div>
      </div>
    </section>
  );
}
