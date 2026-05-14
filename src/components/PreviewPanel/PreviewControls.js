import React from 'react';
import { CircleHalf, MagnifyingGlassPlus, CornersOut } from '@phosphor-icons/react';

const ZOOM_CYCLE = [0.75, 1.0, 1.25, 1.5];

export default function PreviewControls({
  theme,
  onToggleTheme,
  zoom,
  onCycleZoom,
  onToggleFullscreen,
}) {
  return (
    <div className="preview-controls">
      <button
        type="button"
        className="preview-control-btn"
        onClick={onToggleTheme}
        aria-label="Toggle theme"
        title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      >
        <CircleHalf size={28} />
      </button>
      <button
        type="button"
        className="preview-control-btn"
        onClick={() => {
          const idx = ZOOM_CYCLE.indexOf(zoom);
          onCycleZoom(ZOOM_CYCLE[(idx + 1) % ZOOM_CYCLE.length]);
        }}
        aria-label="Cycle zoom"
        title={`Zoom ${Math.round(zoom * 100)}%`}
      >
        <MagnifyingGlassPlus size={28} />
      </button>
      <button
        type="button"
        className="preview-control-btn"
        onClick={onToggleFullscreen}
        aria-label="Toggle fullscreen"
      >
        <CornersOut size={28} />
      </button>
    </div>
  );
}
