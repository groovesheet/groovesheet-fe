import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useClerk } from '@clerk/clerk-react';
import { ArrowLeft, MagnifyingGlass } from '@phosphor-icons/react';
import Header from './layout/Header';
import Footer from './layout/Footer';
import TranscriptionCard from './TranscriptionCard';
import TranscriptionCardSkeleton from './TranscriptionCardSkeleton';
import { fetchWorkflowList, fetchWorkflowStatus } from '../utils/api';
import config from '../config';
import './TranscriptionHistory.css';

export const TranscriptionHistory = () => {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const [searchQuery, setSearchQuery] = useState('');
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch workflows on component mount
  useEffect(() => {
    const loadWorkflows = async () => {
      try {
        setLoading(true);

        // Step 1: Get list of workflow IDs
        const listData = await fetchWorkflowList(config.apiBaseUrl, getToken, signOut);
        console.log('List data received:', listData);

        // Extract workflow IDs from the response
        let workflowIds = [];
        if (listData && Array.isArray(listData.workflow_ids)) {
          workflowIds = listData.workflow_ids;
          console.log('Extracted workflow IDs:', workflowIds);
        } else if (Array.isArray(listData)) {
          workflowIds = listData;
          console.log('Data is already an array:', workflowIds);
        } else {
          console.warn('Unexpected data format:', listData);
        }

        // Step 2: Fetch detailed status for each workflow ID
        if (workflowIds.length > 0) {
          console.log('Fetching detailed status for', workflowIds.length, 'workflows...');
          const statusPromises = workflowIds.map((id) =>
            fetchWorkflowStatus(config.apiBaseUrl, id, getToken, signOut).catch((err) => {
              console.error(`Failed to fetch status for ${id}:`, err);
              // Don't propagate auth errors from individual status fetches
              if (err.isAuthError) {
                throw err;
              }
              return null;
            })
          );
          const statuses = await Promise.all(statusPromises);
          const validStatuses = statuses.filter((s) => s !== null);
          console.log('Fetched statuses:', validStatuses);
          setWorkflows(validStatuses);
        } else {
          console.log('No workflow IDs found');
          setWorkflows([]);
        }

        setError(null);
      } catch (err) {
        console.error('Error fetching workflows:', err);

        // Handle auth errors specifically
        if (err.isAuthError) {
          setError('Your session has expired. You have been logged out.');
          // User is already logged out by the API utility
          // Optionally redirect to home after a delay
          setTimeout(() => {
            navigate('/');
          }, 2000);
        } else {
          setError(err.message);
        }
        setWorkflows([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    };

    loadWorkflows();
  }, [getToken, signOut, navigate]);

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

  // Format date from ISO string
  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Format time from ISO string
  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    });
  };

  // Filter workflows by search query
  const filteredWorkflows = Array.isArray(workflows)
    ? workflows.filter((workflow) => {
        const filename = workflow.filename || workflow.workflow_id || '';
        return filename.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : [];

  // Group workflows by status
  const processingItems = filteredWorkflows.filter(
    (w) => w.status === 'processing' || w.status === 'pending' || w.status === 'running'
  );

  // Group completed workflows by year
  const completedWorkflows = filteredWorkflows.filter(
    (w) => w.status === 'completed' || w.status === 'success'
  );

  const workflowsByYear = completedWorkflows.reduce((acc, workflow) => {
    // Use created_at or completed_at for grouping by year
    const dateStr = workflow.created_at || workflow.completed_at;
    const year = dateStr ? new Date(dateStr).getFullYear() : new Date().getFullYear();
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(workflow);
    return acc;
  }, {});

  // Sort years in descending order
  const sortedYears = Object.keys(workflowsByYear).sort((a, b) => b - a);

  const stemKeyMap = {
    drums: 'demucs_drums_stem',
    piano: 'demucs_other_stem',
    bass: 'demucs_bass_stem',
    jazz_bass: 'demucs_bass_stem',
    vocals: 'demucs_vocals_stem',
    other: 'demucs_other_stem',
  };

  const midiKeyMap = {
    drums: 'adtof_drums_midi',
    jazz_bass: 'bassunet_jazz_bass_midi',
    bass: 'fcpe_bass_midi',
    piano: 'transkun_v2_piano_midi',
  };

  const handleDownloadInstrument = async (workflowId, instrument) => {
    try {
      const token = await getToken();
      const fileKey = stemKeyMap[instrument] || instrument;
      const url = `${config.apiBaseUrl}/workflow/download/${workflowId}/${fileKey}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Check for auth errors
      if (response.status === 401 || response.status === 403) {
        console.error('Authentication error during download');
        setError('Your session has expired. Please sign in again.');
        await signOut();
        navigate('/');
        return;
      }

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${instrument}_${workflowId}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download file');
    }
  };

  const handleDownloadTranscription = async (workflowId, instrument) => {
    try {
      const token = await getToken();
      const fileKey = midiKeyMap[instrument] || 'adtof_drums_midi';
      const url = `${config.apiBaseUrl}/workflow/download/${workflowId}/${fileKey}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Check for auth errors
      if (response.status === 401 || response.status === 403) {
        console.error('Authentication error during download');
        setError('Your session has expired. Please sign in again.');
        await signOut();
        navigate('/');
        return;
      }

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `transcription_${workflowId}.mid`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download transcription');
    }
  };

  const handleDownloadMIDI = async (workflowId, instrument) => {
    try {
      const token = await getToken();
      const fileKey = midiKeyMap[instrument] || 'adtof_drums_midi';
      const url = `${config.apiBaseUrl}/workflow/download/${workflowId}/${fileKey}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Check for auth errors
      if (response.status === 401 || response.status === 403) {
        console.error('Authentication error during download');
        setError('Your session has expired. Please sign in again.');
        await signOut();
        navigate('/');
        return;
      }

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `midi_${workflowId}.mid`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download MIDI');
    }
  };

  const handleDownloadScore = async (workflowId) => {
    try {
      const token = await getToken();
      const url = `${config.apiBaseUrl}/workflow/download/${workflowId}/musicxml`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Check for auth errors
      if (response.status === 401 || response.status === 403) {
        console.error('Authentication error during download');
        setError('Your session has expired. Please sign in again.');
        await signOut();
        navigate('/');
        return;
      }

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `score_${workflowId}.musicxml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download score');
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className="transcription-history-page">
      <Header />

      <div className="history-container">
        <div className="history-content">
          {/* Back button */}
          <button className="back-button" onClick={handleBack}>
            <ArrowLeft size={35} weight="regular" />
            <span>Back</span>
          </button>

          <div className="history-main">
            {/* Header section */}
            <div className="history-header">
              <div className="history-title-section">
                <h1 className="history-title">Transcription History</h1>
              </div>
              <div className="history-info">
                <p>We store your files for 1 year, after which they're automatically deleted.</p>
              </div>
            </div>

            {/* Content section */}
            <div className="history-sections">
              {/* Search bar */}
              <div className="search-bar">
                <MagnifyingGlass size={32} weight="regular" />
                <input
                  type="text"
                  placeholder="Search by audio name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Loading state */}
              {loading && (
                <div className="history-section">
                  <h2 className="section-title">Loading</h2>
                  <div className="cards-grid">
                    <TranscriptionCardSkeleton />
                    <TranscriptionCardSkeleton />
                  </div>
                </div>
              )}

              {/* Error state */}
              {error && (
                <div className="history-section">
                  <p style={{ color: 'red' }}>Error: {error}</p>
                </div>
              )}

              {/* No results */}
              {!loading && !error && filteredWorkflows.length === 0 && (
                <div className="history-section">
                  <p>No transcriptions found.</p>
                </div>
              )}

              {/* Processing section */}
              {!loading && !error && processingItems.length > 0 && (
                <div className="history-section">
                  <h2 className="section-title">Processing</h2>
                  {processingItems.map((item) => {
                    const filename = item.filename || item.workflow_id || 'Unknown';
                    const { name, extension } = getFileNameParts(filename);
                    const progress = item.progress || 0;
                    const dateStr =
                      item.created_at || item.completed_at || new Date().toISOString();
                    return (
                      <div key={item.workflow_id} className="processing-card">
                        <div className="processing-header">
                          <div className="card-metadata">
                            <span className="card-date">{formatDate(dateStr)}</span>
                            <div className="metadata-divider" />
                            <span className="card-time">{formatTime(dateStr)}</span>
                          </div>
                          <div className="processing-filename">
                            <span className="filename-name">{name}</span>
                            <span className="filename-extension">{extension}</span>
                          </div>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${progress}%` }}>
                            <span className="progress-text">{progress}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Completed workflows grouped by year */}
              {!loading &&
                !error &&
                sortedYears.map((year) => (
                  <div key={year} className="history-section">
                    <h2 className="section-title">{year}</h2>
                    <div className="cards-grid">
                      {workflowsByYear[year].map((item) => {
                        const dateStr =
                          item.created_at || item.completed_at || new Date().toISOString();
                        const filename = item.filename || item.workflow_id || 'Unknown';
                        // Get instrument from metadata, default to 'drums'
                        const instrument = item.metadata?.instrument || 'drums';
                        const isFullWorkflow = (item.workflow_name || '').includes('_full');
                        return (
                          <TranscriptionCard
                            key={item.workflow_id}
                            date={formatDate(dateStr)}
                            time={formatTime(dateStr)}
                            fileName={filename}
                            instrument={instrument}
                            onDownloadInstrument={() =>
                              handleDownloadInstrument(item.workflow_id, instrument)
                            }
                            onDownloadTranscription={() =>
                              handleDownloadTranscription(item.workflow_id, instrument)
                            }
                            onDownloadMIDI={() => handleDownloadMIDI(item.workflow_id, instrument)}
                            onDownloadScore={
                              isFullWorkflow
                                ? () => handleDownloadScore(item.workflow_id)
                                : undefined
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default TranscriptionHistory;
