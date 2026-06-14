import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Midi } from '@tonejs/midi';
import OSMDViewer from '../PreviewPanel/OSMDViewer';
import VideoPianoRoll from './VideoPianoRoll';
import { createSynth } from './videoSynth';

/**
 * Video2 — live-editable preview of the *animated* GrooveSheet social video,
 * doubling as the per-worker quality-comparison frame on /video2.
 *
 * Layout (authored at native 3840x2160, scaled to fit the viewport):
 *   - "video" → one line of sheet on top, falling-note roll below. Autoplays.
 *   - "cover" → the static thumbnail layout (album art + title sidebar).
 *
 * Sources are decoupled so every worker renders well:
 *   - SHEET (top band) comes from MusicXML via OSMD. Each line is fit-scaled to
 *     the band height, so dense transcriptions no longer overflow it.
 *   - ROLL + AUDIO come from MIDI when a `midiUrl` is given (drums and bass MIDI
 *     carry the real instruments the flattened MusicXML loses), otherwise from
 *     the same parsed OSMD sheet (pitched piano/bass XML) so roll and staff
 *     share one timeline.
 *
 * A single master clock (0..dur, looping) drives the roll, one-line paging, the
 * OSMD cursor, and the Web Audio synth (videoSynth.js).
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
const SHEET_TOP_PAD = 8; // px gap above the row within the band
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

/**
 * @param {object}  props
 * @param {string} [props.xmlUrl]       MusicXML for the sheet band (OSMD). Omit for MIDI-only workers.
 * @param {string} [props.midiUrl]      MIDI for the roll + audio (preferred source when present).
 * @param {'piano'|'bass'|'drums'} [props.kind]  drives roll mode + drum audio voices
 * @param {object} [props.metaOverride] partial overrides for the editable frame metadata
 */
export default function Video2({ xmlUrl = SAMPLE_XML_URL, midiUrl = null, kind = 'piano', metaOverride } = {}) {
  const m = { ...meta, ...(metaOverride || {}) };
  const useMidi = !!midiUrl;
  const hasSheet = !!xmlUrl;
  const rollMode = kind === 'drums' ? 'drums' : 'piano';

  const [view, setView] = useState('video'); // 'video' | 'cover'
  const [xml, setXml] = useState(null);
  const [notes, setNotes] = useState(null); // [{time,duration,midi,drum}] roll + audio source
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [scale, setScale] = useState(1);

  const wrapRef = useRef(null);
  const osmdRef = useRef(null);
  const synthRef = useRef(null);

  // sync state
  const timeRef = useRef(0); // master clock seconds, fed to the roll
  const clockRef = useRef({ playing: false, anchorPerf: 0, anchorT: 0 });
  const durRef = useRef(0); // master duration seconds
  const systemsRef = useRef([]); // [{ topPx, heightPx, startWall }]
  const initedRef = useRef(false);
  const svgElRef = useRef(null); // cached sheet <svg>
  const lastSysIdxRef = useRef(-1);
  // audio scheduling
  const notesSortedRef = useRef(null);
  const fireIdxRef = useRef(0);
  const lastFireTRef = useRef(0);
  const [ready, setReady] = useState(false);

  // ---- synth lifecycle ---------------------------------------------------
  useEffect(() => {
    synthRef.current = createSynth(kind);
    return () => { try { synthRef.current?.dispose(); } catch (e) {} synthRef.current = null; };
  }, [kind]);
  useEffect(() => { synthRef.current?.setMuted(muted); }, [muted]);
  const resumeAudio = useCallback(() => { synthRef.current?.resume(); }, []);

  // ---- load sheet XML ----------------------------------------------------
  useEffect(() => {
    if (!hasSheet) { setXml(null); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const xmlRes = await fetch(xmlUrl);
        if (!xmlRes.ok) throw new Error(`XML ${xmlRes.status}`);
        const xmlText = await xmlRes.text();
        if (!cancelled) setXml(xmlText);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [xmlUrl, hasSheet]);

  // ---- load MIDI (roll + audio source) -----------------------------------
  useEffect(() => {
    if (!useMidi) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(midiUrl);
        if (!res.ok) throw new Error(`MIDI ${res.status}`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        const midi = new Midi(buf);
        const drum = kind === 'drums';
        const out = midi.tracks
          .flatMap((t) => t.notes)
          .map((n) => ({ time: n.time, duration: n.duration, midi: n.midi, drum }));
        durRef.current = Math.max(durRef.current, midi.duration || 0);
        setNotes(out);
        // MIDI-only worker (no sheet): nothing to wait on — go live now.
        if (!hasSheet && !initedRef.current) {
          systemsRef.current = [];
          initedRef.current = true;
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [midiUrl, useMidi, kind, hasSheet]);

  // keep a sorted copy for the audio scheduler
  useEffect(() => {
    notesSortedRef.current = notes ? notes.slice().sort((a, b) => a.time - b.time) : null;
    fireIdxRef.current = 0;
    lastFireTRef.current = 0;
  }, [notes]);

  // ---- fit-to-viewport scaling -------------------------------------------
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

  // ---- one-line sheet paging (with band-fit scaling) ---------------------
  const layoutSheet = useCallback((t) => {
    const systems = systemsRef.current;
    if (!systems.length) return;
    let idx = 0;
    for (let i = 0; i < systems.length; i += 1) {
      if (systems[i].startWall <= t + 0.001) idx = i; else break;
    }
    if (idx === lastSysIdxRef.current) return;
    let svg = svgElRef.current;
    if (!svg || !svg.isConnected) {
      svg = osmdRef.current?.getContainer?.()?.querySelector('svg') || null;
      svgElRef.current = svg;
    }
    if (!svg) return;
    const sys = systems[idx];
    // Fit THIS line to the band: scale down only lines taller than the band
    // (the overflow case); never enlarge — keeps idea-10-style lines untouched
    // and guarantees the active line fills/clips to exactly one system.
    const avail = SHEET_H - SHEET_TOP_PAD - SHEET_BOTTOM_PAD;
    const fit = sys.heightPx > avail && sys.heightPx > 0 ? avail / sys.heightPx : 1;
    const scaledH = sys.heightPx * fit;
    const offset = SHEET_H - scaledH - SHEET_BOTTOM_PAD; // bottom-align line within band
    const ty = offset - sys.topPx * fit;
    const tx = (FRAME_W * (1 - fit)) / 2; // keep the shrunk line centred
    const tf = `translate(${tx}px, ${ty}px) scale(${fit})`;
    svg.style.transition = 'none';
    svg.style.transformOrigin = '0 0';
    svg.style.transform = tf;
    // page OSMD's cursor <img>(s) by the identical transform or they drift off-band
    const cont = osmdRef.current?.getContainer?.();
    cont?.querySelectorAll('img')?.forEach((img) => {
      img.style.transition = 'none';
      img.style.transformOrigin = '0 0';
      img.style.transform = tf;
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
      try { osmdRef.current?.syncCursorToTime?.(t); } catch (e) {}
      // fire audio for notes crossing the hit line since the last frame
      const synth = synthRef.current;
      const arr = notesSortedRef.current;
      if (synth && arr && c.playing) {
        if (t < lastFireTRef.current) fireIdxRef.current = 0; // clock wrapped
        while (fireIdxRef.current < arr.length && arr[fireIdxRef.current].time <= t) {
          const nt = arr[fireIdxRef.current];
          if (t - nt.time < 0.25) synth.noteOn(nt); // skip stale notes on big jumps
          fireIdxRef.current += 1;
        }
        lastFireTRef.current = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [layoutSheet]);

  // ---- init sync once the sheet (and/or MIDI) is measured ----------------
  const tryInit = useCallback(() => {
    if (initedRef.current) return;
    if (!durRef.current) return;
    const raw = osmdRef.current?.getSystems?.() || [];
    // Guard the timing race: OSMD playback settings may not be populated yet.
    const maxStart = raw.reduce((mx, s) => Math.max(mx, s.startSheetSec || 0), 0);
    if (raw.length > 1 && maxStart <= 0) return;
    systemsRef.current = raw.map((s) => ({ ...s, startWall: s.startSheetSec }));
    // pitched-XML worker: roll notes come from the same parsed sheet
    if (!useMidi) setNotes(osmdRef.current?.getNotes?.() || []);
    initedRef.current = true;
    lastSysIdxRef.current = -1;
    layoutSheet(0);
    setReady(true);
  }, [layoutSheet, useMidi]);

  // OSMD reports playback state every frame; capture sheet duration if MIDI didn't.
  const handleOsmdState = useCallback((s) => {
    if (!useMidi && !durRef.current && s.duration > 0) durRef.current = s.duration;
    if (!initedRef.current) tryInit();
  }, [tryInit, useMidi]);

  // ---- play controls -----------------------------------------------------
  const restartAndPlay = useCallback(() => {
    resumeAudio();
    const c = clockRef.current;
    c.anchorT = 0;
    c.anchorPerf = now();
    c.playing = true;
    timeRef.current = 0;
    fireIdxRef.current = 0;
    lastFireTRef.current = 0;
    lastSysIdxRef.current = -1;
    layoutSheet(0);
    try { osmdRef.current?.syncCursorToTime?.(0); } catch (e) {}
    setIsPlaying(true);
  }, [layoutSheet, resumeAudio]);

  const pauseAtStart = useCallback(() => {
    const c = clockRef.current;
    c.anchorT = 0;
    c.playing = false;
    timeRef.current = 0;
    lastSysIdxRef.current = -1;
    layoutSheet(0);
    try { osmdRef.current?.syncCursorToTime?.(0); } catch (e) {}
    setIsPlaying(false);
  }, [layoutSheet]);

  const togglePlay = useCallback(() => {
    resumeAudio();
    const c = clockRef.current;
    if (c.playing) {
      c.anchorT = timeRef.current;
      c.playing = false;
      setIsPlaying(false);
    } else {
      c.anchorT = timeRef.current;
      c.anchorPerf = now();
      lastFireTRef.current = timeRef.current; // don't replay notes we already passed
      c.playing = true;
      setIsPlaying(true);
    }
  }, [resumeAudio]);

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
      onClick={resumeAudio}
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
            <button onClick={() => { resumeAudio(); setMuted((x) => !x); }} style={ctrlStyle(false)} title="toggle audio">
              {muted ? '🔇 Muted' : '🔊 Sound'}
            </button>
          </>
        )}
      </div>

      {error && (
        <div style={{ position: 'fixed', top: 60, left: 16, color: '#ff6b6b', zIndex: 10 }}>Failed: {error}</div>
      )}

      <div style={{ width: FRAME_W, height: FRAME_H, transform: `scale(${scale})`, transformOrigin: 'center center', flexShrink: 0, position: 'relative', background: '#171717', fontFamily: 'Hubot Sans, Inter, system-ui, sans-serif', overflow: 'hidden' }}>
        {/* Sheet band */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: FRAME_W, height: SHEET_H, background: hasSheet ? '#fff' : '#0c100c', overflow: 'hidden' }}>
          {hasSheet && xml && (
            <OSMDViewer
              ref={osmdRef}
              xmlString={xml}
              theme="light"
              zoom={SHEET_ZOOM}
              measuresPerSystem={SHEET_BARS_PER_ROW}
              systemDistance={SHEET_ROW_GAP}
              betweenStaffDistance={SHEET_STAFF_GAP}
              drawTitle={false}
              drawMetronomeMarks={false}
              containerStyle={{ width: FRAME_W, maxWidth: 'none', padding: 0, minHeight: 0 }}
              onPlaybackStateChange={handleOsmdState}
            />
          )}
          {!hasSheet && (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a6', fontSize: 40 }}>
              {kind === 'bass' ? 'Bass — MIDI only (no score)' : 'MIDI only (no score)'}
            </div>
          )}
        </div>

        {/* Roll band */}
        <div style={{ position: 'absolute', top: ROLL_Y, left: 0, width: FRAME_W, height: ROLL_H, background: '#0c100c', overflow: 'hidden' }}>
          {notes && <VideoPianoRoll notes={notes} timeRef={timeRef} mode={rollMode} />}
        </div>

        {/* Footer: logo bottom-left */}
        <div style={{ position: 'absolute', top: FOOTER_Y + 10, left: 57, height: 93, display: 'flex', alignItems: 'center', zIndex: 3 }}>
          <img src={m.logo} alt="GrooveSheet" style={{ height: 70, width: 'auto' }} />
        </div>

        {/* Footer: legal bottom-right (hidden under the cover sidebar) */}
        {!isCover && (
          <div style={{ position: 'absolute', top: FOOTER_Y, left: 3120, width: 660, height: 93, color: '#fff', fontSize: 24, lineHeight: '31px', textAlign: 'right', zIndex: 3 }}>
            {m.legal}
          </div>
        )}

        {/* Cover sidebar — faithful to Figma node 724:3323 (sidebar 724:3361).
            Frame is native 3840x2160 so Figma px == frame px (scale 1:1).
            Sidebar: x=2616, w=1224, full height; inner content inset 60px. */}
        {isCover && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 2616,
              width: 1224,
              height: FRAME_H,
              background: '#171717',
              zIndex: 4,
              fontFamily: 'Hubot Sans, Inter, system-ui, sans-serif',
            }}
          >
            {/* Album art + title block — Figma 790:3224: (60,60), DYNAMIC height
                (album → title → artist all flow in a column, so the title can be
                1–3 lines and the artist row follows its real bottom). */}
            <div style={{ position: 'absolute', top: 60, left: 60, width: 1104, display: 'flex', flexDirection: 'column' }}>
              {/* Album art — 790:3225: 1104x1104 */}
              <div style={{ width: 1104, height: 1104, borderRadius: 32, overflow: 'hidden', background: '#222', flexShrink: 0 }}>
                <img src={m.coverPath} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>

              {/* Title block — 790:3226: 32px below the art, flex column gap 35.864, px-4 */}
              <div style={{ marginTop: 32, paddingLeft: 4, width: 961, display: 'flex', flexDirection: 'column', gap: 35.864, alignItems: 'flex-start' }}>
                {/* Title — 790:3227: Hubot Sans Regular 108.296 / 130.024, dynamic height */}
                <div style={{ width: '100%', fontSize: 108.296, lineHeight: '130.024px', fontWeight: 400, color: '#ffffff', wordBreak: 'break-word' }}>
                  {m.title}
                </div>

                {/* Artist row — 790:3228: gap 26.18, items-center, Regular 52.36 / 114.538 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 26.18 }}>
                  <div style={{ width: 93.859, height: 93.859, borderRadius: 9999, overflow: 'hidden', background: '#333', flexShrink: 0 }}>
                    <img src={m.avatarPath} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <span style={{ fontSize: 52.36, lineHeight: '114.538px', fontWeight: 400, color: '#ffffff', whiteSpace: 'nowrap' }}>{m.artist}</span>
                  <span style={{ fontSize: 52.36, lineHeight: '114.538px', fontWeight: 400, color: '#666666' }}>•</span>
                  <span style={{ fontSize: 52.36, lineHeight: '114.538px', fontWeight: 400, color: '#666666', whiteSpace: 'nowrap' }}>{m.year}</span>
                </div>
              </div>
            </div>

            {/* CTA — 790:3233: (60,1911.611), 1104x188.389, panel1 #323033, radius 14.142 */}
            <div
              style={{
                position: 'absolute',
                top: 1911.611,
                left: 60,
                width: 1104,
                height: 188.389,
                borderRadius: 14.142,
                background: '#323033',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 17.939,
              }}
            >
              <img src={m.ctaIcon} alt="" style={{ width: 61.965, height: 61.965, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
              <span style={{ fontSize: 52.616, lineHeight: '75.691px', fontWeight: 400, color: '#ffffff', whiteSpace: 'nowrap' }}>{m.ctaLabel}</span>
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
