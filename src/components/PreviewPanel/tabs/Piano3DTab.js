import React, { useEffect, useMemo, useRef, useState } from 'react';

export default function Piano3DTab({ midiBuffer, isLoading, error }) {
  const [iframeUrl, setIframeUrl] = useState(null);
  const blobUrlRef = useRef(null);

  useEffect(() => {
    if (!midiBuffer) return undefined;
    const blob = new Blob([midiBuffer], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    blobUrlRef.current = url;
    setIframeUrl(`${process.env.PUBLIC_URL || ''}/3d-piano-player/index.html?midiUrl=${encodeURIComponent(url)}`);
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    };
  }, [midiBuffer]);

  return (
    <div className="piano-3d-tab">
      {isLoading && <div className="preview-loading">Loading 3D scene…</div>}
      {error && <div className="preview-error">{error}</div>}
      {iframeUrl && (
        <iframe
          title="3D Piano Player"
          src={iframeUrl}
          className="piano-3d-iframe"
          allow="autoplay"
        />
      )}
    </div>
  );
}
