import React from 'react';
import { DownloadSimple, CheckCircle, File } from '@phosphor-icons/react';

export default function DownloadSection({
  fileName,
  selectedInstrument,
  onDownloadTranscription,
  onDownloadStem,
  onDownloadMidi,
  onReset,
  downloadError,
}) {
  const isTranscriptionInstrument = ['drums', 'piano', 'jazz_bass', 'bass'].includes(selectedInstrument);

  // Derive stem label from instrument
  const stemLabelMap = {
    drums: 'Drums Stem',
    piano: 'Piano Stem',
    bass: 'Bass Stem',
    jazz_bass: 'Bass Stem',
    vocals: 'Vocals Stem',
    other: 'Other Stem',
    bass_separation: 'Bass Stem',
  };
  const stemLabel = stemLabelMap[selectedInstrument] || 'Stem';

  return (
    <div className="viz-download-section">
      <button className="viz-close-btn" onClick={onReset} aria-label="Close">
        <svg width="24" height="24" viewBox="0 0 36 36" fill="none">
          <path d="M27 9L9 27M9 9L27 27" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <div className="viz-download-header">
        <CheckCircle size={64} weight="fill" color="white" />
        <h2 className="viz-download-title">Transcription Succeeded!</h2>
        <div className="viz-filename">
          <File size={20} color="#8d8c8d" />
          <span>{fileName || 'Unknown file'}</span>
        </div>
      </div>

      <div className="viz-download-buttons">
        <button className="viz-download-btn viz-download-primary" onClick={onDownloadTranscription}>
          <span>Transcription</span>
          <DownloadSimple size={24} weight="bold" />
        </button>
        <div className="viz-download-row">
          <button className="viz-download-btn viz-download-secondary" onClick={onDownloadStem}>
            <span>{stemLabel}</span>
            <DownloadSimple size={24} weight="bold" />
          </button>
          {isTranscriptionInstrument && (
            <button className="viz-download-btn viz-download-secondary" onClick={onDownloadMidi}>
              <span>MIDI</span>
              <DownloadSimple size={24} weight="bold" />
            </button>
          )}
        </div>
      </div>

      {downloadError && (
        <p className="viz-download-error">{downloadError}</p>
      )}
    </div>
  );
}
