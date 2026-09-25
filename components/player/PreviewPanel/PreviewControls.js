import React from 'react';
import { CircleHalf, MagnifyingGlassPlus, MagnifyingGlassMinus, CornersOut } from '@phosphor-icons/react';

const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

function nearestIdx(zoom) {
  let best = 0;
  let bestDiff = Infinity;
  ZOOM_STEPS.forEach((z, i) => {
    const d = Math.abs(z - zoom);
    if (d < bestDiff) { bestDiff = d; best = i; }
  });
  return best;
}

export default function PreviewControls({
  theme,
  onToggleTheme,
  zoom,
  onCycleZoom,
  onToggleFullscreen,
}) {
  const handleZoomIn = () => {
    const idx = nearestIdx(zoom);
    onCycleZoom(ZOOM_STEPS[Math.min(idx + 1, ZOOM_STEPS.length - 1)]);
  };
  const handleZoomOut = () => {
    const idx = nearestIdx(zoom);
    onCycleZoom(ZOOM_STEPS[Math.max(idx - 1, 0)]);
  };
  return (
    <div className="preview-controls">
      <button
        type="button"
        className="preview-control-btn"
        onClick={onToggleTheme}
        aria-label="Toggle theme"
        title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      >
        <CircleHalf size={32} />
      </button>
      <button
        type="button"
        className="preview-control-btn"
        onClick={handleZoomOut}
        aria-label="Zoom out"
        title={`Zoom out (${Math.round(zoom * 100)}%)`}
      >
        <MagnifyingGlassMinus size={32} />
      </button>
      <button
        type="button"
        className="preview-control-btn"
        onClick={handleZoomIn}
        aria-label="Zoom in"
        title={`Zoom in (${Math.round(zoom * 100)}%)`}
      >
        <MagnifyingGlassPlus size={32} />
      </button>
      <button
        type="button"
        className="preview-control-btn"
        onClick={onToggleFullscreen}
        aria-label="Toggle fullscreen"
      >
        <CornersOut size={32} />
      </button>
    </div>
  );
}
