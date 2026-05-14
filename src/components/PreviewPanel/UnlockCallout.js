import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PencilSimple, DownloadSimple, MusicNote } from '@phosphor-icons/react';

export default function UnlockCallout() {
  const navigate = useNavigate();
  return (
    <div className="unlock-callout">
      <p className="unlock-callout-question">Happy with the first 12 bars?</p>
      <button
        type="button"
        className="unlock-callout-cta"
        onClick={() => navigate('/#pricing')}
      >
        <PencilSimple size={20} />
        TRANSCRIBE FULL AUDIO
      </button>
      <p className="unlock-callout-subtitle">Unlock full potential</p>
      <div className="unlock-callout-features">
        <div className="unlock-feature">
          <PencilSimple size={28} />
          <span>Edit your sheets</span>
        </div>
        <div className="unlock-feature">
          <DownloadSimple size={28} />
          <span>Download as MIDI, MusicXML, LilyPond &amp; more</span>
        </div>
        <div className="unlock-feature">
          <MusicNote size={28} />
          <span>Transcribe up to 15 minutes at once</span>
        </div>
      </div>
    </div>
  );
}
