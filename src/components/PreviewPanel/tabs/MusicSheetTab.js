import React, { forwardRef, useMemo } from 'react';
import OSMDViewer from '../OSMDViewer';
import UnlockCallout from '../UnlockCallout';
import { truncateMusicXmlToMeasures } from '../previewUtils';

const MusicSheetTab = forwardRef(function MusicSheetTab(
  { musicXmlText, theme, zoom, isLoading, error },
  ref
) {
  const truncated = useMemo(
    () => (musicXmlText ? truncateMusicXmlToMeasures(musicXmlText, 12) : null),
    [musicXmlText]
  );

  return (
    <div className={`music-sheet-tab theme-${theme}`}>
      {isLoading && <div className="preview-loading">Loading score…</div>}
      {error && <div className="preview-error">{error}</div>}
      {truncated && <OSMDViewer ref={ref} xmlString={truncated} theme={theme} zoom={zoom} />}
      {truncated && <UnlockCallout />}
    </div>
  );
});

export default MusicSheetTab;
