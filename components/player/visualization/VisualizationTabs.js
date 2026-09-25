import React from 'react';
import { Playlist, PianoKeys, PencilSimpleLine, CircleHalf, MagnifyingGlassPlus, CornersOut } from '@phosphor-icons/react';

const TABS = [
  { id: 'sheet', label: 'Music Sheet', Icon: Playlist },
  { id: 'pianoroll', label: 'Piano Roll', Icon: PianoKeys },
  { id: 'editor', label: 'MIDI Editor', Icon: PencilSimpleLine },
];

export default function VisualizationTabs({
  activeTab,
  onTabChange,
  onToggleTheme,
  onZoomIn,
  onFullscreen,
}) {
  return (
    <div className="viz-tabs-bar">
      <div className="viz-tabs-left">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`viz-tab ${activeTab === id ? 'viz-tab-active' : ''}`}
            onClick={() => onTabChange(id)}
          >
            <Icon size={24} weight={activeTab === id ? 'fill' : 'regular'} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="viz-tabs-right">
        <button className="viz-control-btn" onClick={onToggleTheme} aria-label="Toggle theme">
          <CircleHalf size={28} />
        </button>
        <button className="viz-control-btn" onClick={onZoomIn} aria-label="Zoom in">
          <MagnifyingGlassPlus size={28} />
        </button>
        <button className="viz-control-btn" onClick={onFullscreen} aria-label="Fullscreen">
          <CornersOut size={28} />
        </button>
      </div>
    </div>
  );
}
