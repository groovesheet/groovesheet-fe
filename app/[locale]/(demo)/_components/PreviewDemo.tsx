/**
 * /preview1: the PreviewPanel in demo mode, fed the Beethoven sample from
 * public/sample-preview. Ported from src/components/PreviewDemo.js; the
 * `process.env.PUBLIC_URL` prefixes are gone (brief 5.2) and the Hero.css
 * classes it borrowed are now its own (PreviewDemo.css).
 */
'use client';

import { useEffect, useState } from 'react';
import { PreviewPanel } from '@/components/player';
import type { ParsedSyncMap } from '@/components/player/engine';
import SkeletonPanel from '@/components/ui/SkeletonPanel';
import StatusMessage from '@/components/ui/StatusMessage';
import './PreviewDemo.css';

const SAMPLE_XML_URL = '/sample-preview/sample.musicxml';
const SAMPLE_MIDI_URL = '/sample-preview/sample.mid';
const SAMPLE_SYNC_MAP_URL = '/sample-preview/sample_sync_map.json';

export default function PreviewDemo() {
  const [xml, setXml] = useState<string | null>(null);
  const [midi, setMidi] = useState<ArrayBuffer | null>(null);
  const [syncMap, setSyncMap] = useState<ParsedSyncMap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [xmlRes, midiRes] = await Promise.all([fetch(SAMPLE_XML_URL), fetch(SAMPLE_MIDI_URL)]);
        if (!xmlRes.ok) throw new Error(`XML fetch failed: ${xmlRes.status}`);
        if (!midiRes.ok) throw new Error(`MIDI fetch failed: ${midiRes.status}`);
        const xmlText = await xmlRes.text();
        const midiBuf = await midiRes.arrayBuffer();
        if (cancelled) return;
        setXml(xmlText);
        setMidi(midiBuf);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    // Optional sync map: 404 or invalid JSON means identity mapping (sheet
    // clock roughly equals MIDI clock after the backend tempo fix). Never
    // blocks the demo.
    (async () => {
      try {
        const res = await fetch(SAMPLE_SYNC_MAP_URL);
        if (!res.ok) return;
        // Loaded here rather than at the top: engine.ts also carries the MIDI
        // engine, which would pull osmd-extended into this page's own chunk.
        const { parseSyncMap } = await import('@/components/player/engine');
        const map = parseSyncMap(await res.json());
        if (!cancelled) setSyncMap(map);
      } catch {
        /* identity fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="pd-section">
      <div className="pd-container">
        <div className="pd-card">
          <div className="pd-head">
            <h1 className="pd-title">{'Preview Demo \u2014 Beethoven sample'}</h1>
            <p className="pd-filename">sample.musicxml + sample.mid</p>
          </div>
          {error && (
            <div className="pd-slot">
              <StatusMessage variant="error" title="Failed to load samples">
                {error}
              </StatusMessage>
            </div>
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
            <div className="pd-slot">
              <SkeletonPanel count={1} height={240} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
