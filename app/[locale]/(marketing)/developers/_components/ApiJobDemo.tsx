'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { FileCode, FilePdf, MusicNotes, Play, WebhooksLogo } from '@phosphor-icons/react';

/** 0 ready, 1 queued, 2 processing, 3 done */
type JobStage = 0 | 1 | 2 | 3;

const node = (fill: string, pulse: boolean): CSSProperties => ({
  width: '13px',
  height: '13px',
  borderRadius: '50%',
  position: 'relative',
  zIndex: 1,
  background: fill,
  border: '2px solid var(--color-panel2)',
  transition: 'background .3s ease',
  animation: pulse ? 'gsPulse 1.4s ease-in-out infinite' : 'none',
});

const lbl = (on: boolean): CSSProperties => ({
  fontFamily: 'var(--font-family-sans)',
  fontSize: '11px',
  fontWeight: 500,
  letterSpacing: '.02em',
  color: on ? 'var(--color-text)' : 'var(--color-muted-foreground)',
});

/** The hero's terminal card: a canned job that walks queued, transcribing, completed. */
export default function ApiJobDemo() {
  const [jobStage, setJobStage] = useState<JobStage>(0);
  const t1 = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const t2 = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      clearTimeout(t1.current);
      clearTimeout(t2.current);
    },
    []
  );

  const runJob = () => {
    if (jobStage > 0 && jobStage < 3) return;
    clearTimeout(t1.current);
    clearTimeout(t2.current);
    setJobStage(1);
    t1.current = setTimeout(() => setJobStage(2), 1000);
    t2.current = setTimeout(() => setJobStage(3), 2600);
  };

  // timeline node fills by stage
  const f1 = jobStage >= 2 ? '#22c55e' : jobStage >= 1 ? '#012fa7' : '#3d3b3e';
  const f2 = jobStage >= 3 ? '#22c55e' : jobStage >= 2 ? '#012fa7' : '#3d3b3e';
  const f3 = jobStage >= 3 ? '#22c55e' : '#3d3b3e';

  const statusText = jobStage === 0 ? 'ready' : jobStage === 1 ? 'queued' : jobStage === 2 ? 'processing' : 'completed';
  const statusPill: CSSProperties = {
    marginLeft: 'auto',
    padding: '4px 11px',
    borderRadius: '120px',
    fontFamily: 'var(--font-family-mono)',
    fontSize: '11px',
    letterSpacing: '.06em',
    background: jobStage === 2 ? '#012fa7' : jobStage === 3 ? 'rgba(34,197,94,.16)' : 'var(--color-surface-light)',
    color: jobStage === 2 ? '#fff' : jobStage === 3 ? '#22c55e' : 'var(--color-muted-foreground)',
  };

  return (
    <div
      style={{
        background: 'var(--color-panel2)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,.37)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '13px 16px',
          background: 'var(--color-panel3)',
        }}
      >
        <span style={{ display: 'flex', gap: '6px' }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: '11px',
                height: '11px',
                borderRadius: '50%',
                background: '#3d3b3e',
              }}
            />
          ))}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-family-mono)',
            fontSize: '12px',
            color: 'var(--color-muted-foreground)',
            marginLeft: '4px',
          }}
        >
          api.groovesheet.net
        </span>
        <span style={statusPill}>{statusText}</span>
      </div>

      <div style={{ padding: '20px' }}>
        <div
          style={{
            background: '#1b191c',
            borderRadius: '8px',
            padding: '14px 16px',
            fontFamily: 'var(--font-family-mono)',
            fontSize: '12.5px',
            lineHeight: 1.7,
          }}
        >
          <div>
            <span style={{ color: '#c084fc' }}>POST</span> <span style={{ color: '#7aa3ff' }}>/v1/jobs</span>
          </div>
          <div style={{ color: '#7d7c7e' }}>
            workflow: <span style={{ color: '#6ce5a3' }}>&quot;drums&quot;</span> {'·'} exports:{' '}
            <span style={{ color: '#6ce5a3' }}>[&quot;midi&quot;,&quot;musicxml&quot;]</span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            margin: '18px 0 6px',
          }}
        >
          <button
            type="button"
            onClick={runJob}
            disabled={jobStage > 0 && jobStage < 3}
            className="api-btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '11px 20px',
              border: 0,
              borderRadius: '120px',
              background: 'var(--color-primary)',
              color: '#fff',
              fontFamily: 'var(--font-family-sans)',
              fontWeight: 500,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(1,47,167,.3)',
            }}
          >
            <Play size={13} weight="fill" />
            {jobStage === 0 ? 'Run sample job' : jobStage < 3 ? 'Running…' : 'Run again'}
          </button>
          {jobStage > 0 && (
            <span
              onClick={runJob}
              className="api-link-muted"
              style={{
                fontSize: '13px',
                color: 'var(--color-muted-foreground)',
                cursor: 'pointer',
              }}
            >
              reset
            </span>
          )}
        </div>

        {/* mini timeline */}
        <div style={{ marginTop: '18px', padding: '0 6px' }}>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '7px',
                right: '7px',
                top: '50%',
                height: '2px',
                background: 'var(--color-border-lighter)',
                transform: 'translateY(-50%)',
              }}
            />
            <span style={node(f1, false)} />
            <span style={node(f2, jobStage === 2)} />
            <span style={node(f3, false)} />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '10px',
            }}
          >
            <span style={lbl(jobStage >= 1)}>Queued</span>
            <span style={lbl(jobStage >= 2)}>Transcribing</span>
            <span style={lbl(jobStage >= 3)}>Completed</span>
          </div>
        </div>

        {/* result assets */}
        {jobStage >= 3 && (
          <div
            style={{
              marginTop: '20px',
              background: 'var(--color-panel3)',
              borderRadius: '10px',
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              <WebhooksLogo size={14} weight="fill" color="#22c55e" />
              <span
                style={{
                  fontFamily: 'var(--font-family-mono)',
                  fontSize: '11.5px',
                  color: '#22c55e',
                }}
              >
                webhook delivered {'·'} transcription.completed
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[
                { Icon: FilePdf, name: 'score.pdf' },
                { Icon: MusicNotes, name: 'drums.mid' },
                { Icon: FileCode, name: 'drums.musicxml' },
              ].map(({ Icon, name }) => (
                <span
                  key={name}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    background: 'var(--color-surface-light)',
                    fontFamily: 'var(--font-family-mono)',
                    fontSize: '12px',
                    color: 'var(--color-foreground)',
                  }}
                >
                  <Icon size={13} />
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
