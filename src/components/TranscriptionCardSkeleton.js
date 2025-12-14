import React from 'react';
import './TranscriptionCardSkeleton.css';

export const TranscriptionCardSkeleton = () => {
  return (
    <div className="transcription-card-skeleton">
      <div className="skeleton-header">
        <div className="skeleton-metadata">
          <div className="skeleton-date" />
          <div className="skeleton-divider" />
          <div className="skeleton-time" />
        </div>
        <div className="skeleton-filename" />
      </div>

      <div className="skeleton-downloads">
        <div className="skeleton-button" />
        <div className="skeleton-button" />
        <div className="skeleton-button" />
      </div>
    </div>
  );
};

export default TranscriptionCardSkeleton;
