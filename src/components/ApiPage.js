import React, { useState, useRef, useEffect } from 'react';
import * as PhosphorIcons from '@phosphor-icons/react';
import Header from './layout/Header';
import Footer from './layout/Footer';
import './ApiPage.css';

// Access gating. `true` => private-beta copy ("Request access"),
// `false` => self-serve copy ("Get your API key"). Mirrors the design's
// `gated` prop; flip when self-serve keys ship.
const GATED = true;

// ---- code snippets shown in the quickstart tabs ----
const SNIPPETS = {
  curl: {
    label: 'cURL',
    file: 'request.sh',
    code: `curl -X POST https://api.groovesheet.net/v1/jobs \\
  -H "Authorization: Bearer $GROOVESHEET_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "audio_url": "https://cdn.example.com/track.mp3",
    "workflow": "drums",
    "exports": ["midi", "musicxml"]
  }'`,
  },
  node: {
    label: 'Node.js',
    file: 'create-job.js',
    code: `import GrooveSheet from "@groovesheet/sdk";

const gs = new GrooveSheet(process.env.GROOVESHEET_API_KEY);

const job = await gs.jobs.create({
  audio_url: "https://cdn.example.com/track.mp3",
  workflow: "drums",
  exports: ["midi", "musicxml"],
});

console.log(job.id, job.status); // job_8f3c1a queued`,
  },
  python: {
    label: 'Python',
    file: 'create_job.py',
    code: `from groovesheet import GrooveSheet

gs = GrooveSheet(api_key=os.environ["GROOVESHEET_API_KEY"])

job = gs.jobs.create(
    audio_url="https://cdn.example.com/track.mp3",
    workflow="drums",
    exports=["midi", "musicxml"],
)

print(job.id, job.status)  # job_8f3c1a queued`,
  },
};

const RESPONSE_CODE = `{
  "job_id": "job_8f3c1a",
  "status": "queued",
  "workflow": "drums",
  "estimate_sec": 12
}`;

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// lightweight syntax highlighting for the request snippet
function hlCode(code) {
  const sp = (c, t) => `<span style="color:${c}">${t}</span>`;
  const re =
    /(\/\/[^\n]*|#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(\d+(?:\.\d+)?)\b|\b(curl|import|from|const|let|await|new|print|def|return|true|false|null|None)\b/g;
  return esc(code).replace(re, (m, com, str, num, key) => {
    if (com) return sp('#7d7c7e', com);
    if (str) return sp('#6ce5a3', str);
    if (num) return sp('#ffb86c', num);
    if (key) return sp('#c084fc', key);
    return m;
  });
}

// highlighting for the JSON response block
function hlJson(code) {
  const sp = (c, t) => `<span style="color:${c}">${t}</span>`;
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(\d+(?:\.\d+)?)\b|\b(true|false|null)\b/g;
  return esc(code).replace(re, (m, str, colon, num, kw) => {
    if (str) return sp(colon ? '#c084fc' : '#6ce5a3', str) + (colon || '');
    if (num) return sp('#ffb86c', num);
    if (kw) return sp('#c084fc', kw);
    return m;
  });
}

// ---------- shared style fragments ----------
const monoLabel = {
  fontFamily: 'var(--font-family-mono)',
  fontSize: '12px',
  letterSpacing: '.16em',
  textTransform: 'uppercase',
  color: 'var(--color-muted-foreground)',
  margin: '0 0 12px',
};
const sectionTitle = {
  fontSize: '34px',
  letterSpacing: '-.6px',
  fontWeight: 400,
  margin: '0 0 36px',
  maxWidth: '620px',
};
const card = {
  background: 'var(--color-panel2)',
  borderRadius: '16px',
  padding: '26px',
};
const codeChip = {
  fontFamily: 'var(--font-family-mono)',
  fontSize: '12px',
  color: 'var(--color-muted-foreground)',
  background: '#1b191c',
  borderRadius: '7px',
  padding: '9px 12px',
};

function ApiPage({ onLoginClick }) {
  const [lang, setLang] = useState('curl');
  const [copied, setCopied] = useState(false);
  const [jobStage, setJobStage] = useState(0); // 0 ready, 1 queued, 2 processing, 3 done
  const copyTimer = useRef(null);
  const t1 = useRef(null);
  const t2 = useRef(null);

  useEffect(
    () => () => {
      clearTimeout(copyTimer.current);
      clearTimeout(t1.current);
      clearTimeout(t2.current);
    },
    []
  );

  const setLangTab = (l) => {
    setLang(l);
    setCopied(false);
  };

  const copyCode = () => {
    const txt = SNIPPETS[lang].code;
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(txt);
    } catch (e) {
      /* clipboard unavailable */
    }
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1800);
  };

  const runJob = () => {
    if (jobStage > 0 && jobStage < 3) return;
    clearTimeout(t1.current);
    clearTimeout(t2.current);
    setJobStage(1);
    t1.current = setTimeout(() => setJobStage(2), 1000);
    t2.current = setTimeout(() => setJobStage(3), 2600);
  };

  const gated = GATED;
  const active = SNIPPETS[lang];

  // timeline node fills by stage
  const f1 = jobStage >= 2 ? '#22c55e' : jobStage >= 1 ? '#012fa7' : '#3d3b3e';
  const f2 = jobStage >= 3 ? '#22c55e' : jobStage >= 2 ? '#012fa7' : '#3d3b3e';
  const f3 = jobStage >= 3 ? '#22c55e' : '#3d3b3e';

  const node = (fill, pulse) => ({
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
  const lbl = (on) => ({
    fontFamily: 'var(--font-family-sans)',
    fontSize: '11px',
    fontWeight: 500,
    letterSpacing: '.02em',
    color: on ? 'var(--color-text)' : 'var(--color-muted-foreground)',
  });
  const tab = (on) => ({
    padding: '7px 14px',
    borderRadius: '7px',
    border: 0,
    cursor: 'pointer',
    fontFamily: 'var(--font-family-sans)',
    fontWeight: 500,
    fontSize: '13px',
    transition: 'all .2s ease',
    background: on ? 'var(--color-panel1)' : 'transparent',
    color: on ? 'var(--color-text)' : 'var(--color-muted-foreground)',
  });

  const statusText =
    jobStage === 0
      ? 'ready'
      : jobStage === 1
      ? 'queued'
      : jobStage === 2
      ? 'processing'
      : 'completed';
  const statusPill = {
    marginLeft: 'auto',
    padding: '4px 11px',
    borderRadius: '120px',
    fontFamily: 'var(--font-family-mono)',
    fontSize: '11px',
    letterSpacing: '.06em',
    background:
      jobStage === 2
        ? '#012fa7'
        : jobStage === 3
        ? 'rgba(34,197,94,.16)'
        : 'var(--color-surface-light)',
    color:
      jobStage === 2 ? '#fff' : jobStage === 3 ? '#22c55e' : 'var(--color-muted-foreground)',
  };

  const primaryBtn = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 26px',
    borderRadius: '120px',
    background: 'var(--color-primary)',
    color: '#fff',
    fontWeight: 500,
    fontSize: '15px',
    boxShadow: '0 4px 12px rgba(1,47,167,.3)',
  };
  const ghostBtn = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 24px',
    borderRadius: '120px',
    background: 'transparent',
    color: 'var(--color-foreground)',
    border: '1px solid var(--color-border-lighter)',
    fontWeight: 500,
    fontSize: '15px',
  };

  return (
    <div className="api-page">
      <div className="api-dot-grid" />
      <Header onLoginClick={onLoginClick} />

      <div className="api-content">
        {/* ============ HERO ============ */}
        <section
          className="api-hero"
          style={{
            maxWidth: '1190px',
            margin: '0 auto',
            padding: '56px 24px 64px',
            display: 'grid',
            gridTemplateColumns: '1.05fr 1fr',
            gap: '56px',
            alignItems: 'center',
          }}
        >
          <div style={{ maxWidth: '560px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '120px',
                background: 'var(--color-panel2)',
                marginBottom: '22px',
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: 'var(--color-primary)',
                  boxShadow: '0 0 8px rgba(1,47,167,.8)',
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-family-mono)',
                  fontSize: '11px',
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  color: 'var(--color-foreground)',
                }}
              >
                {gated ? 'Private beta' : 'Now in beta'}
              </span>
            </div>

            <h1
              style={{
                fontSize: '58px',
                lineHeight: 1.04,
                letterSpacing: '-1.2px',
                fontWeight: 400,
                margin: '0 0 20px',
              }}
            >
              GrooveSheet API
            </h1>
            <p
              style={{
                fontSize: '21px',
                lineHeight: 1.5,
                color: 'var(--color-muted-foreground)',
                margin: '0 0 32px',
              }}
            >
              Transcribe audio to MIDI, MusicXML, and stems — programmatically. The engine
              behind the app, exposed as a simple async job API.
            </p>

            <div
              style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}
            >
              <a href="#request" className="api-btn-primary" style={primaryBtn}>
                {gated ? 'Request API access' : 'Get your API key'}
              </a>
              <a href="#docs" className="api-btn-ghost" style={ghostBtn}>
                Read the docs
              </a>
            </div>

            <div
              style={{
                marginTop: '22px',
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
              }}
            >
              <PhosphorIcons.Info size={15} color="var(--color-muted-foreground)" />
              <span
                style={{ fontSize: '13.5px', color: 'var(--color-muted-foreground)' }}
              >
                {gated
                  ? 'Self-serve keys are coming. Join the waitlist for early access.'
                  : 'Free during beta — usage metered in the same minutes as the app.'}
              </span>
            </div>
          </div>

          {/* Hero terminal / live job demo */}
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
                  <span style={{ color: '#c084fc' }}>POST</span>{' '}
                  <span style={{ color: '#7aa3ff' }}>/v1/jobs</span>
                </div>
                <div style={{ color: '#7d7c7e' }}>
                  workflow: <span style={{ color: '#6ce5a3' }}>"drums"</span> · exports:{' '}
                  <span style={{ color: '#6ce5a3' }}>["midi","musicxml"]</span>
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
                  <PhosphorIcons.Play size={13} weight="fill" />
                  {jobStage === 0
                    ? 'Run sample job'
                    : jobStage < 3
                    ? 'Running…'
                    : 'Run again'}
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
                    <PhosphorIcons.WebhooksLogo size={14} weight="fill" color="#22c55e" />
                    <span
                      style={{
                        fontFamily: 'var(--font-family-mono)',
                        fontSize: '11.5px',
                        color: '#22c55e',
                      }}
                    >
                      webhook delivered · transcription.completed
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {[
                      { Icon: PhosphorIcons.FilePdf, name: 'score.pdf' },
                      { Icon: PhosphorIcons.MusicNotes, name: 'drums.mid' },
                      { Icon: PhosphorIcons.FileCode, name: 'drums.musicxml' },
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
        </section>

        {/* ============ WHAT YOU CAN DO ============ */}
        <section style={{ maxWidth: '1190px', margin: '0 auto', padding: '64px 24px' }}>
          <p style={monoLabel}>What you can do</p>
          <h2 style={sectionTitle}>Everything the app does, callable from your stack.</h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(248px,1fr))',
              gap: '18px',
            }}
          >
            {[
              {
                title: 'Separate stems',
                body: 'Split any track into isolated drums, bass, piano, and vocal stems.',
                svg: (
                  <>
                    <path d="M2 12h6l2.5-5 4 11 3-8 2.5 4H36" />
                    <path d="M2 27h7l2.5-4 4 7 3-9 2.5 5H35" opacity=".45" />
                  </>
                ),
              },
              {
                title: 'Transcribe parts',
                body: 'Turn drums, piano, or bass into clean, quantized notation with tempo and time signature.',
                svg: (
                  <>
                    <path d="M3 10h32M3 18h32M3 26h32" opacity=".35" />
                    <circle cx="12" cy="26" r="3.4" />
                    <path d="M15.4 26V9l9 2.4v3" />
                  </>
                ),
              },
              {
                title: 'MIDI → score',
                body: 'Convert detected MIDI into engraved MusicXML and a print-ready PDF score.',
                svg: (
                  <>
                    <rect x="3" y="9" width="5" height="3.4" rx="1" />
                    <rect x="3" y="17" width="9" height="3.4" rx="1" />
                    <rect x="3" y="25" width="6" height="3.4" rx="1" />
                    <path d="M17 19h11m0 0-4-4m4 4-4 4" />
                    <path d="M33 12v15" />
                    <circle cx="30.5" cy="27" r="2.6" />
                  </>
                ),
              },
              {
                title: 'Async jobs + webhooks',
                body: "Fire a job, get a webhook the moment it's done. No long-polling required.",
                svg: (
                  <>
                    <path d="M9 13a12 12 0 1 1-2.5 9.5" />
                    <path d="M6.5 22.5 4 27l5.5-1" />
                    <circle cx="28" cy="11" r="3.2" />
                  </>
                ),
              },
            ].map((f) => (
              <div key={f.title} style={card}>
                <div style={{ color: 'var(--color-foreground)', marginBottom: '20px' }}>
                  <svg
                    width="38"
                    height="38"
                    viewBox="0 0 38 38"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {f.svg}
                  </svg>
                </div>
                <h3
                  style={{
                    fontSize: '18px',
                    fontWeight: 500,
                    margin: '0 0 9px',
                    color: 'var(--color-foreground)',
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    fontSize: '14.5px',
                    lineHeight: 1.55,
                    color: 'var(--color-muted-foreground)',
                    margin: 0,
                  }}
                >
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ============ HOW IT WORKS ============ */}
        <section style={{ maxWidth: '1190px', margin: '0 auto', padding: '48px 24px 64px' }}>
          <p style={monoLabel}>How it works</p>
          <h2 style={sectionTitle}>Three calls from audio to score.</h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
              gap: '18px',
            }}
          >
            {[
              {
                n: '01',
                title: 'POST a job',
                body: (
                  <>
                    Send an audio URL and a workflow. The job is queued and returns a{' '}
                    <code
                      style={{
                        fontFamily: 'var(--font-family-mono)',
                        fontSize: '12.5px',
                        background: 'var(--color-surface-light)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        color: 'var(--color-foreground)',
                      }}
                    >
                      job_id
                    </code>{' '}
                    instantly.
                  </>
                ),
                chip: (
                  <>
                    <span style={{ color: '#c084fc' }}>POST</span>{' '}
                    <span style={{ color: '#7aa3ff' }}>/v1/jobs</span>
                  </>
                ),
              },
              {
                n: '02',
                title: 'Poll or get a webhook',
                body: "Check status when you like, or register a webhook and we'll call you on completion.",
                chip: (
                  <>
                    <span style={{ color: '#7d7c7e' }}>event:</span>{' '}
                    <span style={{ color: '#6ce5a3' }}>transcription.completed</span>
                  </>
                ),
              },
              {
                n: '03',
                title: 'Download assets',
                body: 'Pull MIDI, MusicXML, isolated stems, and the engraved PDF score from signed URLs.',
                chip: (
                  <>
                    <span style={{ color: '#c084fc' }}>GET</span>{' '}
                    <span style={{ color: '#7aa3ff' }}>/v1/jobs/{'{id}'}</span>
                  </>
                ),
              },
            ].map((s) => (
              <div key={s.n} style={{ ...card, padding: '28px' }}>
                <div
                  style={{
                    fontSize: '40px',
                    fontWeight: 300,
                    color: 'var(--color-surface-muted)',
                    lineHeight: 1,
                    marginBottom: '18px',
                  }}
                >
                  {s.n}
                </div>
                <h3
                  style={{
                    fontSize: '19px',
                    fontWeight: 500,
                    margin: '0 0 10px',
                    color: 'var(--color-foreground)',
                  }}
                >
                  {s.title}
                </h3>
                <p
                  style={{
                    fontSize: '14.5px',
                    lineHeight: 1.55,
                    color: 'var(--color-muted-foreground)',
                    margin: '0 0 16px',
                  }}
                >
                  {s.body}
                </p>
                <div style={codeChip}>{s.chip}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ============ QUICKSTART ============ */}
        <section style={{ maxWidth: '1190px', margin: '0 auto', padding: '48px 24px 64px' }}>
          <div
            className="api-quickstart-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: '0.85fr 1.15fr',
              gap: '48px',
              alignItems: 'start',
            }}
          >
            <div style={{ paddingTop: '8px' }}>
              <p style={monoLabel}>Quickstart</p>
              <h2 style={{ ...sectionTitle, margin: '0 0 16px' }}>
                One request to your first score.
              </h2>
              <p
                style={{
                  fontSize: '16px',
                  lineHeight: 1.6,
                  color: 'var(--color-muted-foreground)',
                  margin: '0 0 22px',
                }}
              >
                Authenticate with a bearer token, point us at a track, and pick a workflow.
                Everything else is async.
              </p>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'var(--color-panel2)',
                }}
              >
                <PhosphorIcons.WarningCircle size={15} color="var(--color-muted-foreground)" />
                <span
                  style={{ fontSize: '12.5px', color: 'var(--color-muted-foreground)' }}
                >
                  Endpoints shown are illustrative placeholders.
                </span>
              </div>
            </div>

            <div>
              {/* request block */}
              <div
                style={{
                  background: '#1b191c',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(0,0,0,.37)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px 9px 14px',
                    background: 'rgba(255,255,255,.02)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: '5px',
                      background: 'var(--color-panel2)',
                      padding: '4px',
                      borderRadius: '9px',
                    }}
                  >
                    <button type="button" onClick={() => setLangTab('curl')} style={tab(lang === 'curl')}>
                      cURL
                    </button>
                    <button type="button" onClick={() => setLangTab('node')} style={tab(lang === 'node')}>
                      Node.js
                    </button>
                    <button type="button" onClick={() => setLangTab('python')} style={tab(lang === 'python')}>
                      Python
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={copyCode}
                    className="api-copy-btn"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'transparent',
                      border: 0,
                      color: 'var(--color-muted-foreground)',
                      fontFamily: 'var(--font-family-sans)',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      padding: '6px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    {copied ? (
                      <PhosphorIcons.Check size={13} />
                    ) : (
                      <PhosphorIcons.Copy size={13} />
                    )}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div
                  style={{
                    padding: '6px 16px 4px',
                    fontFamily: 'var(--font-family-mono)',
                    fontSize: '11px',
                    color: 'var(--color-muted-foreground)',
                  }}
                >
                  {active.file}
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: '8px 18px 18px',
                    fontFamily: 'var(--font-family-mono)',
                    fontSize: '12.5px',
                    lineHeight: 1.65,
                    color: 'var(--color-foreground)',
                    overflowX: 'auto',
                    whiteSpace: 'pre',
                  }}
                  dangerouslySetInnerHTML={{ __html: hlCode(active.code) }}
                />
              </div>

              {/* response block */}
              <div
                style={{
                  marginTop: '14px',
                  background: '#1b191c',
                  borderRadius: '10px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    background: 'rgba(255,255,255,.02)',
                  }}
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: '#22c55e',
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'var(--font-family-mono)',
                      fontSize: '11.5px',
                      color: 'var(--color-muted-foreground)',
                    }}
                  >
                    200 · response
                  </span>
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: '14px 18px 18px',
                    fontFamily: 'var(--font-family-mono)',
                    fontSize: '12.5px',
                    lineHeight: 1.65,
                    color: 'var(--color-foreground)',
                    overflowX: 'auto',
                    whiteSpace: 'pre',
                  }}
                  dangerouslySetInnerHTML={{ __html: hlJson(RESPONSE_CODE) }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ============ PRICING / LIMITS ============ */}
        <section
          id="pricing"
          style={{ maxWidth: '1190px', margin: '0 auto', padding: '48px 24px 64px' }}
        >
          <p style={monoLabel}>Pricing &amp; limits</p>
          <h2 style={sectionTitle}>Metered in minutes — the same currency as the app.</h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(248px,1fr))',
              gap: '18px',
            }}
          >
            {[
              {
                Icon: PhosphorIcons.Timer,
                label: 'Minutes',
                value: '1 min = 1 credit',
                body: 'API jobs draw from the same monthly minute allowance as your account.',
              },
              {
                Icon: PhosphorIcons.Gauge,
                label: 'Rate limits',
                value: '60 req / min',
                body: 'Beta default. Bursts above the limit queue automatically rather than failing.',
              },
              {
                Icon: PhosphorIcons.Stack,
                label: 'Concurrency',
                value: '5 parallel jobs',
                body: 'Higher queue tiers lift the cap and add priority processing on Pro plans.',
              },
            ].map(({ Icon, label, value, body }) => (
              <div key={label} style={{ ...card, padding: '28px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '14px',
                  }}
                >
                  <Icon size={20} color="var(--color-foreground)" />
                  <span
                    style={{
                      fontSize: '13px',
                      textTransform: 'uppercase',
                      letterSpacing: '.1em',
                      color: 'var(--color-muted-foreground)',
                    }}
                  >
                    {label}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: '32px',
                    fontWeight: 300,
                    margin: '0 0 8px',
                    color: 'var(--color-text)',
                  }}
                >
                  {value}
                </p>
                <p
                  style={{
                    fontSize: '14px',
                    lineHeight: 1.55,
                    color: 'var(--color-muted-foreground)',
                    margin: 0,
                  }}
                >
                  {body}
                </p>
              </div>
            ))}
          </div>
          <a
            href="#pricing"
            className="api-link-arrow"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              marginTop: '24px',
              fontSize: '15px',
              color: 'var(--color-foreground)',
              fontWeight: 500,
            }}
          >
            See full pricing <PhosphorIcons.ArrowRight size={15} />
          </a>
        </section>

        {/* ============ ACCESS ============ */}
        <section
          id="request"
          style={{ maxWidth: '1190px', margin: '0 auto', padding: '40px 24px 96px' }}
        >
          <div
            style={{
              background: 'var(--color-panel2)',
              borderRadius: '20px',
              padding: '64px 40px',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage:
                  'radial-gradient(circle, var(--color-dot-pattern) 1.5px, transparent 1.5px)',
                backgroundSize: '38px 38px',
                opacity: 0.3,
                pointerEvents: 'none',
              }}
            />
            <div style={{ position: 'relative' }}>
              <h2
                style={{
                  fontSize: '38px',
                  letterSpacing: '-.8px',
                  fontWeight: 400,
                  margin: '0 0 14px',
                }}
              >
                Building with GrooveSheet?
              </h2>
              <p
                style={{
                  fontSize: '17px',
                  lineHeight: 1.55,
                  color: 'var(--color-muted-foreground)',
                  margin: '0 auto 30px',
                  maxWidth: '480px',
                }}
              >
                {gated
                  ? "We're onboarding teams in batches during the private beta. Tell us what you're building and we'll get you a key."
                  : "Generate a key and make your first call in minutes. Usage draws from your plan's minutes."}
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '14px',
                  flexWrap: 'wrap',
                }}
              >
                <a href="#" className="api-btn-primary" style={{ ...primaryBtn, padding: '15px 30px' }}>
                  {gated ? 'Request access' : 'Create an API key'}
                </a>
                <a href="#" className="api-btn-ghost" style={{ ...ghostBtn, padding: '15px 28px' }}>
                  Talk to us
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}

export default ApiPage;
