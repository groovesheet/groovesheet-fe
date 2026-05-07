import React, { useState, useRef, useCallback } from 'react';
import { useTheme } from '../../context/ThemeContext';
import DownloadSection from './DownloadSection';
import VisualizationTabs from './VisualizationTabs';
import MusicSheetView from './MusicSheetView';
import PianoRollView from './PianoRollView';
import MidiEditorView from './MidiEditorView';
import './VisualizationPanel.css';

export default function VisualizationPanel({
  jobId,
  selectedInstrument,
  fileName,
  getToken,
  onDownloadTranscription,
  onDownloadStem,
  onDownloadMidi,
  onReset,
  downloadError,
}) {
  const [activeTab, setActiveTab] = useState('sheet');
  const [zoom, setZoom] = useState(1.0);
  const panelRef = useRef(null);
  const { toggleTheme } = useTheme();

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.2, 3.0));
  }, []);

  const handleFullscreen = useCallback(() => {
    if (!panelRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      panelRef.current.requestFullscreen().catch(() => {});
    }
  }, []);

  const isTranscriptionInstrument = ['drums', 'piano', 'jazz_bass', 'bass'].includes(selectedInstrument);

  return (
    <div className="viz-panel" ref={panelRef}>
      <DownloadSection
        fileName={fileName}
        selectedInstrument={selectedInstrument}
        onDownloadTranscription={onDownloadTranscription}
        onDownloadStem={onDownloadStem}
        onDownloadMidi={onDownloadMidi}
        onReset={onReset}
        downloadError={downloadError}
      />

      {isTranscriptionInstrument && (
        <div className="viz-viewer-section">
          <VisualizationTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onToggleTheme={toggleTheme}
            onZoomIn={handleZoomIn}
            onFullscreen={handleFullscreen}
          />

          <div className="viz-viewer-content">
            {activeTab === 'sheet' && (
              <MusicSheetView
                jobId={jobId}
                selectedInstrument={selectedInstrument}
                getToken={getToken}
                zoom={zoom}
              />
            )}
            {activeTab === 'pianoroll' && (
              <PianoRollView
                jobId={jobId}
                selectedInstrument={selectedInstrument}
                getToken={getToken}
              />
            )}
            {activeTab === 'editor' && (
              <MidiEditorView
                jobId={jobId}
                selectedInstrument={selectedInstrument}
                getToken={getToken}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
