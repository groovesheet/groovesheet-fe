import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { OpenSheetMusicDisplay } from 'osmd-extended';

const OSMDViewer = forwardRef(function OSMDViewer({ xmlString, theme = 'light', zoom = 1.0 }, ref) {
  const containerRef = useRef(null);
  const osmdRef = useRef(null);

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
    });
    osmdRef.current = osmd;
    return () => {
      osmdRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []);

  useEffect(() => {
    const osmd = osmdRef.current;
    if (!osmd || !xmlString) return;
    let cancelled = false;
    (async () => {
      try {
        await osmd.load(xmlString);
        if (cancelled) return;
        osmd.zoom = zoom;
        osmd.render();
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
      style={{ background: bg, padding: '24px', minHeight: '400px', borderRadius: '4px' }}
    />
  );
});

export default OSMDViewer;
