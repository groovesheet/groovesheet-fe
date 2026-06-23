import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import {
  OpenSheetMusicDisplay,
  PlaybackManager,
  LinearTimingSource,
  BasicAudioPlayer,
} from 'osmd-extended';

// Rewrite every note's stem direction with a hybrid clef + voice rule.
// midi2score gives each clef its own part and splits dense polyphony into
// many simultaneous voices (MIRROR: 6 in the treble), with auto/mixed stems
// that (a) broke beam groups when stems inside one voice disagreed and
// (b) stacked every voice's beam line on top of the next.
//   - Base direction by clef: bass (F) → down, everything else → up. This is
//     the convention and gives the clean single-voice look (e.g. Night in
//     Tunisia's bass all-down).
//   - Then flip per voice parity so voice 2/4/6 oppose the base. Multiple
//     voices in one staff get separated vertically instead of colliding.
// stemUp = (voice is odd) XOR (clef is bass). OSMD ignores stem direction set
// on the parsed model after load(), so we rewrite the MusicXML up front.
function forceStems(xmlString) {
  try {
    const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
    if (doc.querySelector('parsererror')) return xmlString;
    let touched = false;
    doc.querySelectorAll('part').forEach((part) => {
      let bass = false; // base direction once a clef is seen (document order)
      part.querySelectorAll('clef, note').forEach((node) => {
        if (node.tagName === 'clef') {
          bass = node.querySelector('sign')?.textContent?.trim() === 'F';
          return;
        }
        if (node.querySelector('rest')) return;
        const voice = parseInt(node.querySelector('voice')?.textContent, 10) || 1;
        const dir = ((voice % 2 === 1) !== bass) ? 'up' : 'down';
        let stem = node.querySelector('stem');
        if (!stem) {
          stem = doc.createElement('stem');
          const ref = node.querySelector('beam, notations, lyric');
          if (ref) node.insertBefore(stem, ref); else node.appendChild(stem);
        }
        if (stem.textContent !== dir) { stem.textContent = dir; touched = true; }
      });
    });
    return touched ? new XMLSerializer().serializeToString(doc) : xmlString;
  } catch (e) {
    return xmlString;
  }
}

const OSMDViewer = forwardRef(function OSMDViewer(
  {
    xmlString,
    theme = 'light',
    zoom = 1.0,
    onPlayNote,
    onPlaybackStateChange,
    containerStyle,
    measuresPerSystem,
    betweenStaffDistance,
    systemDistance,
    drawTitle = true,
    drawMetronomeMarks = true,
    forceStemByStaff = false,
  },
  ref
) {
  const containerRef = useRef(null);
  const osmdRef = useRef(null);
  const playbackRef = useRef(null);
  const timingRef = useRef(null);
  const readyRef = useRef(false);
  const stateRafRef = useRef(null);
  const originalBpmRef = useRef(120);
  const cursorStepsRef = useRef(null); // [sec] natural time at each cursor step
  const cursorIdxRef = useRef(0); // index the cursor currently sits on
  const onPlayNoteRef = useRef(onPlayNote);
  const onPlaybackStateChangeRef = useRef(onPlaybackStateChange);

  useEffect(() => { onPlayNoteRef.current = onPlayNote; }, [onPlayNote]);
  useEffect(() => { onPlaybackStateChangeRef.current = onPlaybackStateChange; }, [onPlaybackStateChange]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const osmd = new OpenSheetMusicDisplay(containerRef.current, {
      backend: 'svg',
      drawTitle,
      drawMetronomeMarks,
      drawSubtitle: false,
      drawComposer: false,
      drawCredits: false,
      drawPartNames: false,
      autoResize: true,
      // follow:false — Video2 pages the sheet manually via a CSS transform.
      // OSMD's own follow auto-scrolls to the cursor each playback tick, which
      // reads layout geometry every frame → forced synchronous reflow (~700ms
      // of jank in a 20s trace). We don't need it; keep the cursor static and
      // let our paging move the line into the band.
      cursorsOptions: [{ type: 0, color: '#4D9CFF', alpha: 0.4, follow: false }],
    });
    osmdRef.current = osmd;

    const handleClick = (ev) => {
      const osmdInst = osmdRef.current;
      if (!osmdInst || !osmdInst.GraphicSheet || !readyRef.current) return;
      const svg = containerRef.current?.querySelector('svg');
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const unitsPerPx = 1 / (10 * (osmdInst.zoom || 1));
      const x = (ev.clientX - rect.left) * unitsPerPx;
      const y = (ev.clientY - rect.top) * unitsPerPx;
      let nearest;
      try { nearest = osmdInst.GraphicSheet.GetNearestNote({ x, y }); } catch (e) { return; }
      if (!nearest) return;

      const pm = playbackRef.current;
      const note = nearest.sourceNote;
      if (pm && note) {
        try { pm.playNote(note, false); } catch (e) {}
        try {
          const ts = note.getAbsoluteTimestamp?.();
          if (ts && pm.timingSource?.Settings) {
            const ms = pm.timingSource.Settings.getDurationInMilliseconds(ts);
            pm.playFromMs(ms, false);
          }
        } catch (e) {}
      }
    };
    containerRef.current.addEventListener('click', handleClick);

    return () => {
      containerRef.current?.removeEventListener('click', handleClick);
      if (stateRafRef.current) cancelAnimationFrame(stateRafRef.current);
      try { playbackRef.current?.pause(); } catch (e) {}
      try { playbackRef.current?.Dispose(); } catch (e) {}
      playbackRef.current = null;
      timingRef.current = null;
      osmdRef.current = null;
      readyRef.current = false;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []);

  useEffect(() => {
    const osmd = osmdRef.current;
    if (!osmd || !xmlString) return;
    let cancelled = false;
    readyRef.current = false;
    cursorStepsRef.current = null; // rebuild step table for the new sheet
    cursorIdxRef.current = 0;
    (async () => {
      try {
        await osmd.load(forceStemByStaff ? forceStems(xmlString) : xmlString);
        if (cancelled) return;
        if (measuresPerSystem && osmd.EngravingRules) {
          try { osmd.EngravingRules.RenderXMeasuresPerLineAkaSystem = measuresPerSystem; } catch (e) {}
        }
        if (betweenStaffDistance && osmd.EngravingRules) {
          try {
            // OSMD's skyline pass computes the treble↔bass gap as:
            //   n = skylineGap + MinSkyBottomDistBetweenStaves
            //   n = max(n, StaffHeight + MinimumStaffLineDistance)
            // To make the gap FIXED and CONTROLLABLE (no per-system widening):
            //   1. Drive MinSkyBottomDistBetweenStaves very negative so the
            //      dynamic skyline term always loses to the floor.
            //   2. Use the floor as the knob. StaffHeight defaults to 4, so the
            //      rendered gap = 4 + MinimumStaffLineDistance. Set the latter to
            //      hit the requested distance. (BetweenStaffDistance only seeds
            //      the initial layout and is then overwritten — set it too for
            //      consistency.)
            const STAFF_HEIGHT = osmd.EngravingRules.StaffHeight || 4;
            osmd.EngravingRules.BetweenStaffDistance = betweenStaffDistance;
            osmd.EngravingRules.MinSkyBottomDistBetweenStaves = -1000;
            osmd.EngravingRules.MinimumStaffLineDistance = Math.max(0, betweenStaffDistance - STAFF_HEIGHT);
          } catch (e) {}
        }
        if (systemDistance && osmd.EngravingRules) {
          try {
            osmd.EngravingRules.MinimumDistanceBetweenSystems = systemDistance;
            osmd.EngravingRules.MinSkyBottomDistBetweenSystems = systemDistance;
          } catch (e) {}
        }
        osmd.zoom = zoom;
        osmd.render();
        try { osmd.enableOrDisableCursors(true); } catch (e) {}
        const cursor = osmd.cursors?.[0] || osmd.cursor;
        if (cursor) {
          cursor.show();
          cursor.reset();
        }

        try { playbackRef.current?.Dispose(); } catch (e) {}
        const timingSource = new LinearTimingSource();
        const audioPlayer = new BasicAudioPlayer();
        const playbackManager = new PlaybackManager(timingSource, undefined, audioPlayer, undefined);
        playbackManager.DoPlayback = true;
        playbackManager.DoPreCount = false;
        playbackManager.PreCountMeasures = 1;

        timingSource.reset();
        await timingSource.pause();
        timingSource.Settings = osmd.Sheet.playbackSettings;
        playbackManager.initialize(osmd.Sheet.musicPartManager);
        if (cursor) playbackManager.addListener(cursor);
        playbackManager.reset();
        osmd.PlaybackManager = playbackManager;
        playbackRef.current = playbackManager;
        timingRef.current = timingSource;
        originalBpmRef.current = osmd.Sheet?.DefaultStartTempoInBpm || 120;
        readyRef.current = true;

        const tick = () => {
          const pm = playbackRef.current;
          const ts = timingRef.current;
          if (pm && ts) {
            const ms = ts.getCurrentTimeInMs() || 0;
            const durMs = pm.getSheetDurationInMs?.() || 0;
            const isPlaying = pm.RunningState === 1;
            if (onPlaybackStateChangeRef.current) {
              onPlaybackStateChangeRef.current({
                currentTime: ms / 1000,
                duration: durMs / 1000,
                isPlaying,
              });
            }
          }
          stateRafRef.current = requestAnimationFrame(tick);
        };
        if (stateRafRef.current) cancelAnimationFrame(stateRafRef.current);
        stateRafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.error('OSMD load/render failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [xmlString, forceStemByStaff]);

  useEffect(() => {
    const osmd = osmdRef.current;
    if (!osmd || !xmlString) return;
    osmd.zoom = zoom;
    try { osmd.render(); } catch (e) { /* ignore */ }
  }, [zoom]);

  useImperativeHandle(ref, () => ({
    play: async () => {
      const pm = playbackRef.current;
      if (pm) { try { await pm.play(); } catch (e) {} }
    },
    pause: async () => {
      const pm = playbackRef.current;
      if (pm) { try { await pm.pause(); } catch (e) {} }
    },
    seekMs: async (ms) => {
      const pm = playbackRef.current;
      if (pm) { try { await pm.playFromMs(ms, false); } catch (e) {} }
    },
    setSpeed: (factor) => {
      const pm = playbackRef.current;
      if (!pm) return;
      const newBpm = (originalBpmRef.current || 120) * factor;
      try { pm.bpmChanged(newBpm, true); } catch (e) {}
    },
    reset: () => {
      const pm = playbackRef.current;
      if (pm) { try { pm.reset(); } catch (e) {} }
    },
    rerender: () => {
      const osmd = osmdRef.current;
      if (osmd) {
        try { osmd.render(); } catch (e) { /* ignore */ }
      }
    },
    // --- video helpers -----------------------------------------------------
    getContainer: () => containerRef.current,
    // Drive the play cursor from an EXTERNAL clock (natural sheet seconds)
    // instead of OSMD's PlaybackManager loop. OSMD's loop costs ~300-400ms per
    // iteration on large zoomed sheets and freezes the page; we never call
    // play(). Builds a step→time table once, then advances with cheap next()
    // calls only when crossing a note boundary.
    syncCursorToTime: (sec) => {
      const osmd = osmdRef.current;
      if (!osmd) return;
      const cursor = osmd.cursors?.[0] || osmd.cursor;
      if (!cursor) return;
      if (!cursorStepsRef.current) {
        const pm = playbackRef.current;
        const settings = pm?.timingSource?.Settings || osmd.Sheet?.playbackSettings;
        if (!settings?.getDurationInMilliseconds) return; // tempo not populated yet
        const steps = [];
        try {
          cursor.reset();
          let guard = 0;
          while (!cursor.Iterator?.EndReached && guard < 100000) {
            const ts = cursor.Iterator?.CurrentSourceTimestamp;
            let s = 0;
            try { s = settings.getDurationInMilliseconds(ts) / 1000; } catch (e) { /* keep 0 */ }
            steps.push(s);
            cursor.next();
            guard += 1;
          }
          cursor.reset();
        } catch (e) { return; }
        if (!steps.length) return;
        cursorStepsRef.current = steps;
        cursorIdxRef.current = 0;
        try { cursor.show(); } catch (e) { /* ignore */ }
      }
      const steps = cursorStepsRef.current;
      let target = 0;
      for (let i = 0; i < steps.length; i += 1) {
        if (steps[i] <= sec + 1e-3) target = i; else break;
      }
      let cur = cursorIdxRef.current;
      try {
        if (target < cur) { cursor.reset(); cur = 0; }
        while (cur < target) { cursor.next(); cur += 1; }
      } catch (e) { /* ignore */ }
      cursorIdxRef.current = cur;
    },
    // Natural (un-sped) sheet duration in seconds. Read BEFORE setSpeed().
    getSheetDurationSec: () => {
      const pm = playbackRef.current;
      try { return (pm?.getSheetDurationInMs?.() || 0) / 1000; } catch (e) { return 0; }
    },
    // Per-system layout + start time, for one-line-at-a-time paging.
    // Returns [{ topPx, heightPx, staffTopPx, staffBottomPx, staffCenterPx,
    // startSheetSec }] in render-pixel space (OSMD units * 10 * zoom),
    // matching the rendered <svg>.
    //
    // topPx/heightPx are the FULL system bounding box — it grows and shrinks
    // with ledger lines and notes that stick out above/below the staves, so
    // it is NOT a stable anchor for vertical centering. staffTopPx/
    // staffBottomPx bracket only the 5-line staff block (treble top line →
    // bass bottom line), which is geometrically constant from system to
    // system; staffCenterPx is its midpoint. Center the band on staffCenterPx
    // and the music stops drifting up/down between lines.
    getSystems: () => {
      const osmd = osmdRef.current;
      const pm = playbackRef.current;
      if (!osmd?.GraphicSheet) return [];
      const page = osmd.GraphicSheet.MusicPages?.[0];
      if (!page?.MusicSystems) return [];
      const unit = 10 * (osmd.zoom || 1);
      // Real 5-line staff span. StaffLine.PositionAndShape.Size.height is
      // padded (it reserves room below the lines), so it overshoots the real
      // staff bottom and skews the center. AbsolutePosition.y is the TOP line;
      // the five lines span exactly StaffHeight units below it.
      const staffHeight = osmd.EngravingRules?.StaffHeight || 4;
      const settings = pm?.timingSource?.Settings || osmd.Sheet?.playbackSettings;
      const result = page.MusicSystems.map((sys) => {
        const bb = sys.PositionAndShape;
        const topPx = (bb?.AbsolutePosition?.y || 0) * unit;
        const heightPx = (bb?.Size?.height || 0) * unit;
        // Staff-block extent: top line of the highest staff → bottom line of
        // the lowest staff, using the true line span (not the padded bbox).
        let stTop = Infinity;
        let stBottom = -Infinity;
        for (const sl of (sys.StaffLines || [])) {
          const p = sl?.PositionAndShape;
          if (!p?.AbsolutePosition) continue;
          const y0 = p.AbsolutePosition.y;
          const y1 = y0 + staffHeight;
          if (y0 < stTop) stTop = y0;
          if (y1 > stBottom) stBottom = y1;
        }
        const hasStaves = stTop !== Infinity && stBottom !== -Infinity;
        const staffTopPx = hasStaves ? stTop * unit : topPx;
        const staffBottomPx = hasStaves ? stBottom * unit : topPx + heightPx;
        const staffCenterPx = (staffTopPx + staffBottomPx) / 2;
        let startSheetSec = 0;
        try {
          const col = sys.GraphicalMeasures?.[0];
          const gm = Array.isArray(col) ? col[0] : col;
          const sm = gm?.parentSourceMeasure;
          const ts = sm?.AbsoluteTimestamp;
          if (ts && settings?.getDurationInMilliseconds) {
            startSheetSec = settings.getDurationInMilliseconds(ts) / 1000;
          }
        } catch (e) { /* ignore */ }
        return { topPx, heightPx, staffTopPx, staffBottomPx, staffCenterPx, startSheetSec };
      });
      return result;
    },
    // Falling-note source for the piano roll, extracted from the SAME parsed
    // sheet that renders the staff — so roll + sheet share one timeline and
    // cannot drift. Times are in NATURAL sheet seconds (read BEFORE setSpeed).
    // Returns [{ time, duration, midi }].
    getNotes: () => {
      const osmd = osmdRef.current;
      const pm = playbackRef.current;
      const settings = pm?.timingSource?.Settings || osmd?.Sheet?.playbackSettings;
      const measures = osmd?.Sheet?.SourceMeasures;
      if (!measures || !settings?.getDurationInMilliseconds) return [];
      const out = [];
      for (const sm of measures) {
        for (const container of (sm.VerticalSourceStaffEntryContainers || [])) {
          for (const se of (container.StaffEntries || [])) {
            if (!se) continue;
            let startMs = 0;
            try { startMs = settings.getDurationInMilliseconds(se.AbsoluteTimestamp); } catch (e) { continue; }
            for (const ve of (se.VoiceEntries || [])) {
              for (const note of (ve.Notes || [])) {
                if (!note || !note.Pitch) continue; // skip rests
                if (note.isRest && note.isRest()) continue;
                let durMs = 0;
                try { durMs = settings.getDurationInMilliseconds(note.Length); } catch (e) { durMs = 0; }
                const ht = (typeof note.halfTone === 'number')
                  ? note.halfTone
                  : note.Pitch.getHalfTone?.();
                if (typeof ht !== 'number') continue;
                out.push({ time: startMs / 1000, duration: durMs / 1000, midi: ht + 12 });
              }
            }
          }
        }
      }
      return out;
    },
  }));

  const bg = theme === 'dark' ? '#1a1a1a' : '#ffffff';
  return (
    <div
      ref={containerRef}
      className="osmd-viewer"
      style={{ background: bg, padding: '24px', minHeight: '400px', borderRadius: '4px', cursor: 'pointer', ...containerStyle }}
    />
  );
});

export default OSMDViewer;
