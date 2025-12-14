import React from 'react';
import { ArrowDown } from '@phosphor-icons/react';
import './TranscriptionCard.css';

export const TranscriptionCard = ({
  date,
  time,
  fileName,
  instrument = 'drums',
  onDownloadInstrument,
  onDownloadTranscription,
  onDownloadMIDI,
}) => {
  // Split filename into name and extension
  const getFileNameParts = (fullName) => {
    const lastDotIndex = fullName.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return { name: fullName, extension: '' };
    }
    return {
      name: fullName.substring(0, lastDotIndex),
      extension: fullName.substring(lastDotIndex),
    };
  };

  const { name, extension } = getFileNameParts(fileName);

  // Capitalize first letter of instrument
  const instrumentLabel = instrument.charAt(0).toUpperCase() + instrument.slice(1);

  return (
    <div className="transcription-card">
      <div className="card-header">
        <div className="card-metadata">
          <span className="card-date">{date}</span>
          <div className="metadata-divider" />
          <span className="card-time">{time}</span>
        </div>
        <div className="card-filename">
          <span className="filename-name">{name}</span>
          <span className="filename-extension">{extension}</span>
        </div>
      </div>

      <div className="card-downloads">
        <button
          className="download-button"
          onClick={onDownloadInstrument}
          aria-label={`Download ${instrumentLabel} track`}
        >
          <span>{instrumentLabel} Track</span>
          <ArrowDown size={28} weight="regular" />
        </button>

        <button
          className="download-button"
          onClick={onDownloadTranscription}
          aria-label="Download transcription"
        >
          <span>Transcription</span>
          <ArrowDown size={28} weight="regular" />
        </button>

        <button className="download-button" onClick={onDownloadMIDI} aria-label="Download MIDI">
          <span>MIDI</span>
          <ArrowDown size={28} weight="regular" />
        </button>
      </div>
    </div>
  );
};

export default TranscriptionCard;
