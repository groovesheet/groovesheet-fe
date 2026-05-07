import React, { useEffect, useRef, useState } from 'react';
import { downloadWorkflowFile } from '../../utils/api';
import config from '../../config';

const API_BASE_URL = config.apiBaseUrl;

// MIDI file key mapping per instrument
const MIDI_KEY_MAP = {
  drums: 'adtof_drums_midi',
  piano: 'transkun_v2_piano_midi',
  bass: 'fcpe_bass_midi',
  jazz_bass: 'bassunet_jazz_bass_midi',
};

export default function MidiEditorView({ jobId, selectedInstrument, getToken }) {
  const iframeRef = useRef(null);
  const midiBlobUrlRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadMidi = async () => {
      const fileKey = MIDI_KEY_MAP[selectedInstrument];
      if (!fileKey) {
        setError('MIDI editor is not available for this instrument type.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const result = await downloadWorkflowFile(API_BASE_URL, jobId, fileKey, getToken);
        if (!result) {
          throw new Error('MIDI file not found. It may not have been generated yet.');
        }

        if (cancelled) return;

        // Create blob URL for the MIDI file
        if (midiBlobUrlRef.current) {
          URL.revokeObjectURL(midiBlobUrlRef.current);
        }
        midiBlobUrlRef.current = URL.createObjectURL(result.blob);

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('MIDI load error:', err);
          setError(err.message || 'Failed to load MIDI file.');
          setLoading(false);
        }
      }
    };

    loadMidi();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, selectedInstrument]);

  // Send MIDI data to iframe when it loads
  const handleIframeLoad = () => {
    if (iframeRef.current && midiBlobUrlRef.current) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'loadMidi', url: midiBlobUrlRef.current },
        window.location.origin
      );
    }
  };

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (midiBlobUrlRef.current) {
        URL.revokeObjectURL(midiBlobUrlRef.current);
      }
    };
  }, []);

  if (error) {
    return (
      <div className="viz-content-area viz-dark-bg">
        <div className="viz-error"><p>{error}</p></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="viz-content-area viz-dark-bg">
        <div className="viz-loading"><p>Loading MIDI editor...</p></div>
      </div>
    );
  }

  return (
    <div className="viz-content-area viz-dark-bg">
      <iframe
        ref={iframeRef}
        src="/signal/edit.html"
        title="Signal - MIDI Editor"
        className="viz-iframe"
        onLoad={handleIframeLoad}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
