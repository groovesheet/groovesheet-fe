import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import {
  OpenSheetMusicDisplay,
  PlaybackManager,
  LinearTimingSource,
  BasicAudioPlayer,
} from 'osmd-extended';

const OSMDViewer = forwardRef(function OSMDViewer(
  {
    xmlString,
    theme = 'light',
    zoom = 1.0,
    onPlayNote,
    onPlaybackStateChange,
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
  const onPlayNoteRef = useRef(onPlayNote);
  const onPlaybackStateChangeRef = useRef(onPlaybackStateChange);

  useEffect(() => { onPlayNoteRef.current = onPlayNote; }, [onPlayNote]);
  useEffect(() => { onPlaybackStateChangeRef.current = onPlaybackStateChange; }, [onPlaybackStateChange]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const osmd = new OpenSheetMusicDisplay(containerRef.current, {
      backend: 'svg',
      drawTitle: true,
      drawSubtitle: false,
      drawComposer: false,
      drawCredits: false,
      drawPartNames: false,
      autoResize: true,
      cursorsOptions: [{ type: 0, color: '#4D9CFF', alpha: 0.4, follow: true }],
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
    (async () => {
      try {
        await osmd.load(xmlString);
        if (cancelled) return;
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
  }, [xmlString]);

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
  }));

  const bg = theme === 'dark' ? '#1a1a1a' : '#ffffff';
  return (
    <div
      ref={containerRef}
      className="osmd-viewer"
      style={{ background: bg, padding: '24px', minHeight: '400px', borderRadius: '4px', cursor: 'pointer' }}
    />
  );
});

export default OSMDViewer;
