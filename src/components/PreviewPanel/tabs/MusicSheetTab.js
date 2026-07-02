import React, { forwardRef } from 'react';
import OSMDViewer from '../OSMDViewer';
import StatusMessage from '../../ui/StatusMessage';
import SkeletonPanel from '../../ui/SkeletonPanel';

const MusicSheetTab = forwardRef(function MusicSheetTab(
  { musicXmlText, theme, zoom, isLoading, error, onPlayNote, onPlaybackStateChange },
  ref
) {
  return (
    <div className={`music-sheet-tab theme-${theme}`}>
      {isLoading && <div className="preview-loading"><SkeletonPanel count={1} height={200} /></div>}
      {error && <StatusMessage variant="error">{error}</StatusMessage>}
      {musicXmlText && (
        <OSMDViewer
          ref={ref}
          xmlString={musicXmlText}
          theme={theme}
          zoom={zoom}
          drawMetronomeMarks={false}
          onPlayNote={onPlayNote}
          onPlaybackStateChange={onPlaybackStateChange}
        />
      )}
    </div>
  );
});

export default MusicSheetTab;
