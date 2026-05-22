import React, { forwardRef } from 'react';
import OSMDViewer from '../OSMDViewer';

const MusicSheetTab = forwardRef(function MusicSheetTab(
  { musicXmlText, theme, zoom, isLoading, error, onPlayNote, onPlaybackStateChange },
  ref
) {
  return (
    <div className={`music-sheet-tab theme-${theme}`}>
      {isLoading && <div className="preview-loading">Loading score…</div>}
      {error && <div className="preview-error">{error}</div>}
      {musicXmlText && (
        <OSMDViewer
          ref={ref}
          xmlString={musicXmlText}
          theme={theme}
          zoom={zoom}
          onPlayNote={onPlayNote}
          onPlaybackStateChange={onPlaybackStateChange}
        />
      )}
    </div>
  );
});

export default MusicSheetTab;
