import React, { useCallback, useEffect, useRef, useState } from 'react';
import OSMDViewer from '../PreviewPanel/OSMDViewer';
import VideoPianoRoll from './VideoPianoRoll';

/**
 * Video2 — live-editable preview of the *animated* GrooveSheet social video.
 *
 * Two toggleable views, both authored at native 3840x2160 (4K, 16:9) and scaled
 * to fit the viewport (same approach as Video1):
 *   - "cover"  → the thumbnail layout (Figma 724:3323): full-width sheet + roll
 *                behind a right sidebar (album art, title, artist, CTA). Static.
 *   - "video"  → the playing frame (Figma 724:3272): one line of music sheet on
 *                top, falling-note piano roll below. Autoplays + loops.
 *
 * Sync: the music sheet (OSMD) is transcribed at a tempo whose natural length
 * (sheetDur) differs from the MIDI/piano-roll length (midiDur). We slow the
 * sheet so both span the same wall-clock time:
 *     factor = sheetDur / midiDur   →   osmd.setSpeed(factor)
 * A single master clock (0..midiDur, looping) drives the roll and the
 * one-line-at-a-time paging of the sheet.
 */

const ASSETS = '/images';
const ICONS = '/video-assets/icons';

const SAMPLE_XML_URL = `${process.env.PUBLIC_URL || ''}/sample-preview/sample.musicxml`;

const FRAME_W = 3840;
const FRAME_H = 2160;
const SHEET_H = 825; // top band (Figma)
const ROLL_Y = 825;
const ROLL_H = FRAME_H - ROLL_Y; // 1335
const FOOTER_Y = 1657;
const SHEET_ZOOM = 2.6;
const SHEET_BARS_PER_ROW = 4; // measures per visible line
const SHEET_ROW_GAP = 18.0; // OSMD units between systems (rows of bars); default ~7
const SHEET_STAFF_GAP = 13.0; // OSMD units between treble & bass staff; default ~7
const SHEET_BOTTOM_PAD = 10; // px gap below the row within the band (smaller = lower)

const DEFAULT_LEGAL =
  'All rights to the original song belong to its respective artists and labels. Stems and transcription by GrooveSheet for educational use only.';

// ---- Editable frame metadata ---------------------------------------------
const meta = {
  title: 'Remember You (feat. Olivia Olson & Tom Kenny)',
  artist: 'Green Day',
  year: 2004,
  coverPath: `${ASSETS}/Preview.png`,
  avatarPath: `${ASSETS}/Logo_Dark.png`,
  ctaLabel: 'Keyboard Transcription',
  ctaIcon: `${ICONS}/Keyboard.svg`,
  legal: DEFAULT_LEGAL,
  logo: `${ICONS}/groovesheet-logo.svg`,
};
// ---------------------------------------------------------------------------

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export default function Video2() {
  const [view, setView] = useState('video'); // 'video' | 'cover'
  const [xml, setXml] = useState(null);
  const [notes, setNotes] = useState(null); // [{time,duration,midi}] from OSMD
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scale, setScale] = useState(1);

  const wrapRef = useRef(null);
  const osmdRef = useRef(null);

  // sync state
  const timeRef = useRef(0); // master clock seconds, fed to the roll
  const clockRef = useRef({ playing: false, anchorPerf: 0, anchorT: 0 });
  const durRef = useRef(0); // master duration = natural sheet seconds
  const systemsRef = useRef([]); // [{ topPx, heightPx, startWall }]
  const initedRef = useRef(false);
  const svgElRef = useRef(null); // cached sheet <svg>, avoids per-frame querySelector
  const lastSysIdxRef = useRef(-1); // last paged system; skip redundant transform writes
  const [ready, setReady] = useState(false);

  // ---- load sample sheet + midi -----------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const xmlRes = await fetch(SAMPLE_XML_URL);
        if (!xmlRes.ok) throw new Error(`XML ${xmlRes.status}`);
        const xmlText = await xmlRes.text();
        if (cancelled) return;
        setXml(xmlText);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ---- fit-to-viewport scaling ------------------------------------------
  useEffect(() => {
    const fit = () => {
      const el = wrapRef.current;
      if (!el) return;
      setScale(Math.min(el.clientWidth / FRAME_W, el.clientHeight / FRAME_H));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // ---- one-line sheet paging --------------------------------------------
  const layoutSheet = useCallback((t) => {
    const systems = systemsRef.current;
    if (!systems.length) return;
    let idx = 0;
    for (let i = 0; i < systems.length; i += 1) {
      if (systems[i].startWall <= t + 0.001) idx = i; else break;
    }
    if (idx === lastSysIdxRef.current) return; // same line — nothing to repaint
    // (re)cache the svg; re-query only if it was dropped/replaced by a re-render
    let svg = svgElRef.current;
    if (!svg || !svg.isConnected) {
      svg = osmdRef.current?.getContainer?.()?.querySelector('svg') || null;
      svgElRef.current = svg;
    }
    if (!svg) return;
    const sys = systems[idx];
    const offset = SHEET_H - sys.heightPx - SHEET_BOTTOM_PAD; // bottom-align line within band
    const ty = offset - sys.topPx; // container padding is 0 in video mode
    svg.style.transition = 'none';
    svg.style.transform = `translateY(${ty}px)`;
    // OSMD renders the play cursor as <img> sibling(s) of the svg; page them by
    // the same offset or the current-note indicator parks off-band (invisible).
    const cont = osmdRef.current?.getContainer?.();
    cont?.querySelectorAll('img')?.forEach((img) => {
      img.style.transition = 'none';
      img.style.transform = `translateY(${ty}px)`;
    });
    lastSysIdxRef.current = idx;
  }, []);

  // ---- master clock loop -------------------------------------------------
  useEffect(() => {
    let raf;
    const loop = () => {
      const c = clockRef.current;
      const dur = durRef.current || 0;
      let t = c.playing ? c.anchorT + (now() - c.anchorPerf) / 1000 : c.anchorT;
      if (dur && t >= dur) {
        t = 0;
        c.anchorT = 0;
        c.anchorPerf = now();
      }
      timeRef.current = t;
      layoutSheet(t);
      // Drive the OSMD cursor off this same clock (no OSMD playback loop).
      try { osmdRef.current?.syncCursorToTime?.(t); } catch (e) {}
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [layoutSheet]);

  // ---- init sync once both sheet + midi are measured --------------------
  const tryInit = useCallback(() => {
    if (initedRef.current) return;
    const sheetDur = durRef.current;
    if (!sheetDur) return;
    // Single source: roll notes + sheet paging both come from OSMD's parsed
    // sheet, in natural sheet seconds. No tempo reconciliation needed.
    const raw = osmdRef.current?.getSystems?.() || [];
    // Guard the timing race: if OSMD's playback settings aren't populated yet,
    // every startSheetSec reads 0 → paging parks on the last system. Wait and
    // let the next OSMD frame re-invoke tryInit.
    const maxStart = raw.reduce((m, s) => Math.max(m, s.startSheetSec || 0), 0);
    if (raw.length > 1 && maxStart <= 0) return;
    systemsRef.current = raw.map((s) => ({ ...s, startWall: s.startSheetSec }));
    setNotes(osmdRef.current?.getNotes?.() || []);
    initedRef.current = true;
    lastSysIdxRef.current = -1; // force the next layoutSheet to (re)apply the transform
    layoutSheet(0);
    setReady(true);
  }, [layoutSheet]);

  // OSMD reports playback state every frame; capture the natural duration once.
  const handleOsmdState = useCallback((s) => {
    if (!durRef.current && s.duration > 0) durRef.current = s.duration;
    if (!initedRef.current) tryInit();
  }, [tryInit]);

  // ---- play controls -----------------------------------------------------
  const restartAndPlay = useCallback(() => {
    const c = clockRef.current;
    c.anchorT = 0;
    c.anchorPerf = now();
    c.playing = true;
    timeRef.current = 0;
    lastSysIdxRef.current = -1; // force the next layoutSheet to (re)apply the transform
    layoutSheet(0);
    try { osmdRef.current?.syncCursorToTime?.(0); } catch (e) {}
    setIsPlaying(true);
  }, [layoutSheet]);

  const pauseAtStart = useCallback(() => {
    const c = clockRef.current;
    c.anchorT = 0;
    c.playing = false;
    timeRef.current = 0;
    lastSysIdxRef.current = -1; // force the next layoutSheet to (re)apply the transform
    layoutSheet(0);
    try { osmdRef.current?.syncCursorToTime?.(0); } catch (e) {}
    setIsPlaying(false);
  }, [layoutSheet]);

  const togglePlay = useCallback(() => {
    const c = clockRef.current;
    if (c.playing) {
      c.anchorT = timeRef.current;
      c.playing = false;
      setIsPlaying(false);
    } else {
      c.anchorT = timeRef.current;
      c.anchorPerf = now();
      c.playing = true;
      setIsPlaying(true);
    }
  }, []);

  // ---- drive view: video autoplays, cover is frozen at t=0 --------------
  useEffect(() => {
    if (!ready) return;
    if (view === 'video') restartAndPlay();
    else pauseAtStart();
  }, [ready, view, restartAndPlay, pauseAtStart]);

  const isCover = view === 'cover';

  return (
    <div
      ref={wrapRef}
      style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
    >
      {/* controls (outside the rendered frame) */}
      <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 10, display: 'flex', gap: 8 }}>
        {['video', 'cover'].map((v) => (
          <button key={v} onClick={() => setView(v)} style={ctrlStyle(view === v)}>
            {v === 'video' ? 'Video' : 'Cover'}
          </button>
        ))}
        {!isCover && (
          <>
            <button onClick={togglePlay} style={ctrlStyle(false)}>{isPlaying ? 'Pause' : 'Play'}</button>
            <button onClick={restartAndPlay} style={ctrlStyle(false)}>Restart</button>
          </>
        )}
      </div>

      {error && (
        <div style={{ position: 'fixed', top: 60, left: 16, color: '#ff6b6b', zIndex: 10 }}>Failed: {error}</div>
      )}

      <div style={{ width: FRAME_W, height: FRAME_H, transform: `scale(${scale})`, transformOrigin: 'center center', flexShrink: 0, position: 'relative', background: '#171717', fontFamily: 'Hubot Sans, Inter, system-ui, sans-serif', overflow: 'hidden' }}>
        {/* Sheet band */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: FRAME_W, height: SHEET_H, background: '#fff', overflow: 'hidden' }}>
          {xml && (
            <OSMDViewer
              ref={osmdRef}
              xmlString={xml}
              theme="light"
              zoom={SHEET_ZOOM}
              measuresPerSystem={SHEET_BARS_PER_ROW}
              systemDistance={SHEET_ROW_GAP}
              betweenStaffDistance={SHEET_STAFF_GAP}
              drawTitle={false}
              containerStyle={{ width: FRAME_W, maxWidth: 'none', padding: 0, minHeight: 0 }}
              onPlaybackStateChange={handleOsmdState}
            />
          )}
        </div>

        {/* Roll band */}
        <div style={{ position: 'absolute', top: ROLL_Y, left: 0, width: FRAME_W, height: ROLL_H, background: '#0c100c', overflow: 'hidden' }}>
          {notes && <VideoPianoRoll notes={notes} timeRef={timeRef} />}
        </div>

        {/* Footer: logo bottom-left */}
        <div style={{ position: 'absolute', top: FOOTER_Y + 10, left: 57, height: 93, display: 'flex', alignItems: 'center', zIndex: 3 }}>
          <img src={meta.logo} alt="GrooveSheet" style={{ height: 70, width: 'auto' }} />
        </div>

        {/* Footer: legal bottom-right (hidden under the cover sidebar) */}
        {!isCover && (
          <div style={{ position: 'absolute', top: FOOTER_Y, left: 3120, width: 660, height: 93, color: '#fff', fontSize: 24, lineHeight: '31px', textAlign: 'right', zIndex: 3 }}>
            {meta.legal}
          </div>
        )}

        {/* Cover sidebar */}
        {isCover && (
          <div style={{ position: 'absolute', top: 0, left: 2616, width: 1224, height: FRAME_H, background: '#171717', zIndex: 4, padding: 60, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            {/* album art */}
            <div style={{ width: 1104, height: 1104, borderRadius: 16, overflow: 'hidden', background: '#222', flexShrink: 0 }}>
              <img src={meta.coverPath} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            {/* title + artist */}
            <div style={{ marginTop: 32, flex: 1 }}>
              <div style={{ fontSize: 108, lineHeight: '124px', color: '#fff', fontWeight: 500 }}>{meta.title}</div>
              <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 26 }}>
                <div style={{ width: 94, height: 94, borderRadius: 9999, overflow: 'hidden', background: '#333', flexShrink: 0 }}>
                  <img src={meta.avatarPath} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ fontSize: 60, color: '#fff' }}>{meta.artist}</div>
                <div style={{ fontSize: 60, color: '#777' }}>•</div>
                <div style={{ fontSize: 60, color: '#777' }}>{meta.year}</div>
              </div>
            </div>
            {/* CTA */}
            <div style={{ height: 188, borderRadius: 24, background: '#2a2a2d', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexShrink: 0 }}>
              <img src={meta.ctaIcon} alt="" style={{ height: 62, width: 'auto', filter: 'brightness(0) invert(1)' }} />
              <span style={{ fontSize: 56, color: '#fff' }}>{meta.ctaLabel}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ctrlStyle(active) {
  return {
    padding: '6px 14px',
    borderRadius: 8,
    border: '1px solid #444',
    background: active ? '#012FA7' : '#222',
    color: '#fff',
    fontSize: 13,
    cursor: 'pointer',
  };
}
