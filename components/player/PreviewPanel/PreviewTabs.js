import React from 'react';
import { Playlist, PianoKeys, Cube } from '@phosphor-icons/react';

const TABS = [
  { id: 'music_sheet', label: 'Music Sheet', Icon: Playlist },
  { id: 'piano_roll', label: 'Piano Roll', Icon: PianoKeys },
  { id: 'piano_3d', label: '3D Piano', Icon: Cube },
];

export default function PreviewTabs({ active, onChange }) {
  return (
    <div className="preview-tabs">
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            className={`preview-tab ${isActive ? 'active' : ''}`}
            onClick={() => onChange(id)}
          >
            <Icon size={24} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
