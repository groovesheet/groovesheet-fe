import React, { useEffect, useRef, useState } from 'react';
import { downloadWorkflowFile } from '../../utils/api';
import config from '../../config';
import StatusMessage from '../ui/StatusMessage';
import SkeletonPanel from '../ui/SkeletonPanel';

const API_BASE_URL = config.apiBaseUrl;

// MusicXML file key mapping per instrument
const MUSICXML_KEY_MAP = {
  drums: 'midi2score_drums_musicxml',
  piano: 'midi2score_piano_musicxml',
  bass: 'midi2score_bass_musicxml',
  jazz_bass: 'midi2score_jazz_bass_musicxml',
};

export default function MusicSheetView({ jobId, selectedInstrument, getToken, zoom }) {
  const containerRef = useRef(null);
  const osmdRef = useRef(null);
  const xmlDataRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch MusicXML and render with OSMD
  useEffect(() => {
    let cancelled = false;

    const loadAndRender = async () => {
      if (!jobId || !containerRef.current) return;

      const fileKey = MUSICXML_KEY_MAP[selectedInstrument];
      if (!fileKey) {
        setError('Sheet music is not available for this instrument type.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch MusicXML if not already cached
        if (!xmlDataRef.current) {
          const result = await downloadWorkflowFile(API_BASE_URL, jobId, fileKey, getToken);
          if (!result) {
            throw new Error('MusicXML file not found. It may not have been generated yet.');
          }
          xmlDataRef.current = await result.blob.text();
        }

        if (cancelled) return;

        // Dynamically import OSMD to avoid bundling issues
        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay');

        if (cancelled) return;

        // Destroy previous instance
        if (osmdRef.current) {
          osmdRef.current.clear();
        }

        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
          drawTitle: true,
          drawComposer: true,
          drawCredits: true,
          drawPartNames: true,
          drawPartAbbreviations: false,
          backend: 'svg',
        });

        osmdRef.current = osmd;
        await osmd.load(xmlDataRef.current);

        if (cancelled) return;

        osmd.zoom = zoom || 1.0;
        osmd.render();
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('OSMD load error:', err);
          setError(err.message || 'Failed to load sheet music.');
          setLoading(false);
        }
      }
    };

    loadAndRender();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, selectedInstrument]);

  // Handle zoom changes
  useEffect(() => {
    if (osmdRef.current && zoom) {
      osmdRef.current.zoom = zoom;
      osmdRef.current.render();
    }
  }, [zoom]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (osmdRef.current) {
        osmdRef.current.clear();
        osmdRef.current = null;
      }
    };
  }, []);

  return (
    <div className="viz-content-area viz-sheet-bg">
      {loading && (
        <div className="viz-loading">
          <SkeletonPanel count={1} height={260} />
        </div>
      )}
      {error && (
        <div className="viz-error">
          <StatusMessage variant="error">{error}</StatusMessage>
        </div>
      )}
      <div
        ref={containerRef}
        className="viz-osmd-container"
        style={{ display: loading || error ? 'none' : 'block' }}
      />
    </div>
  );
}
