import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  ArrowClockwise,
  CheckCircle,
  Warning,
  XCircle,
  Wrench,
} from '@phosphor-icons/react';
import { fetchServiceStatus } from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import StatusMessage from './ui/StatusMessage';

/**
 * /service-status — public system-status page.
 *
 * Live-wired port of the "Service Status" design. The overall banner, per-service
 * chips, health strip and processing-health tiles are driven from the orchestrator's
 * GET /service-status (worker /health + Redis queue lag/consumer-idle + 24h workflow
 * counts). The 90-day uptime history and incident feed in the source design are not
 * emitted by that API, so the health strip reflects each service's *current* status
 * and the incident section shows an honest empty state.
 */

const REFRESH_MS = 15000;
const MONO = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Monaco, monospace";
const SANS = 'var(--font-family-sans)';

// Friendly labels for the orchestrator's internal service names.
const LABELS = {
  bs_roformer: 'Audio separation (BS-Roformer)',
  demucs: 'Audio separation (Demucs)',
  adtof: 'Drum transcription (ADTOF)',
  bassunet: 'Bass transcription (BassUNet)',
  fcpe: 'Bass pitch estimation (FCPE)',
  'transkun-v2': 'Piano transcription (Transkun)',
  midi2score: 'Score conversion (MIDI → MusicXML)',
  compress: 'Compression',
};

const STATUS = {
  operational: { color: '#22c55e', tint: 'rgba(34,197,94,0.15)', icon: CheckCircle, label: 'Operational' },
  degraded: { color: '#f5a524', tint: 'rgba(245,165,36,0.16)', icon: Warning, label: 'Degraded' },
  down: { color: '#ff6b6b', tint: 'rgba(255,107,107,0.16)', icon: XCircle, label: 'Down' },
  maintenance: { color: '#5b8def', tint: 'rgba(91,141,239,0.18)', icon: Wrench, label: 'Maintenance' },
};

const OVERALL = {
  operational: { key: 'operational', title: 'All systems operational' },
  degraded: { key: 'degraded', title: 'Some systems degraded' },
  down: { key: 'down', title: 'Major outage' },
};

const fmtAge = (ms) => {
  if (ms == null) return null;
  const s = ms / 1000;
  if (s < 90) return `${Math.round(s)}s`;
  if (s < 5400) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
};

// Derive a per-service status + human note from the raw health record.
function deriveService(s, degradedNames) {
  if (!s.up) {
    return {
      status: 'down',
      note: 'Service is not responding. New jobs will queue and retry automatically once it recovers.',
    };
  }
  const idle = s.min_consumer_idle_ms;
  const notes = [];
  let status = 'operational';
  if (!s.consumers) {
    status = 'degraded';
    notes.push('No workers currently consuming.');
  }
  if ((s.lag || 0) > 0) {
    status = 'degraded';
    notes.push(`Queue lag of ${s.lag} — jobs still complete, just slower than usual.`);
  }
  if (idle != null && idle > 60000) {
    status = 'degraded';
    notes.push(`Consumer idle for ${fmtAge(idle)}.`);
  }
  if (Array.isArray(degradedNames) && degradedNames.includes(s.name) && status === 'operational') {
    status = 'degraded';
  }
  const h = s.health;
  if (h && h.processing && h.current_job) {
    notes.push(
      `Processing ${h.current_job}${h.processing_age_s ? ` (${fmtAge(h.processing_age_s * 1000)})` : ''}.`,
    );
  }
  return { status, note: notes.join(' ') };
}

function StatusIcon({ status, size, weight = 'regular', style }) {
  const Icon = STATUS[status].icon;
  return <Icon size={size} weight={weight} color={STATUS[status].color} style={style} />;
}

function Chip({ status }) {
  const m = STATUS[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 12px 5px 10px',
        borderRadius: 120,
        background: m.tint,
      }}
    >
      <StatusIcon status={status} size={15} />
      <span
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: m.color,
          fontFamily: SANS,
          letterSpacing: '-0.1px',
          whiteSpace: 'nowrap',
        }}
      >
        {m.label}
      </span>
    </span>
  );
}

// Health strip: 60 bars colored by the service's current status (no history from the API).
function HealthStrip({ status }) {
  const color = status === 'operational' ? 'rgba(34,197,94,0.45)' : STATUS[status].color;
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'stretch', height: 30 }}>
      {Array.from({ length: 60 }).map((_, i) => (
        <div key={i} style={{ flex: 1, borderRadius: 2, background: color }} />
      ))}
    </div>
  );
}

function Skeleton() {
  const bar = (w, h, r = 8) => (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background:
          'linear-gradient(90deg,var(--color-panel2) 25%,var(--color-surface-light) 37%,var(--color-panel2) 63%)',
        backgroundSize: '800px 100%',
        animation: 'gsShimmer 1.4s linear infinite',
      }}
    />
  );
  const row = (i) => (
    <div
      key={i}
      style={{
        background: 'var(--color-panel2)',
        borderRadius: 13,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {bar(170, 16)}
        {bar(104, 26, 120)}
      </div>
      {bar('100%', 30, 4)}
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div
        style={{
          background: 'var(--color-panel1)',
          borderRadius: 16,
          padding: '26px 28px',
          display: 'flex',
          gap: 22,
          alignItems: 'center',
        }}
      >
        {bar(64, 64, '50%')}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {bar(250, 26)}
          {bar('70%', 16)}
          {bar(180, 12)}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1, 2, 3].map(row)}</div>
    </div>
  );
}

export default function ServiceStatus() {
  const { isDarkMode } = useTheme();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchServiceStatus();
      if (!res || typeof res !== 'object') throw new Error('Empty response from status API');
      setData(res);
      setError(null);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer.current);
  }, [load]);

  const services = (data?.services || []).map((s) => ({ raw: s, ...deriveService(s, data?.degraded) }));

  // Overall state = worst service status.
  let overallKey = 'operational';
  if (services.some((s) => s.status === 'down')) overallKey = 'down';
  else if (services.some((s) => s.status === 'degraded')) overallKey = 'degraded';
  const overall = OVERALL[overallKey];

  const downNames = services.filter((s) => s.status === 'down').map((s) => LABELS[s.raw.name] || s.raw.name);
  const degradedNames = services
    .filter((s) => s.status === 'degraded')
    .map((s) => LABELS[s.raw.name] || s.raw.name);
  const overallSub =
    overallKey === 'down'
      ? `${downNames.join(', ')} unavailable. Jobs will queue and retry automatically.`
      : overallKey === 'degraded'
        ? `${degradedNames.join(', ')} slower than usual. Transcriptions are still completing.`
        : `All ${services.length} services are running normally.`;

  // Processing-health tiles from live 24h counts + queue depth.
  const completed = data?.recent?.completed_24h;
  const failed = data?.recent?.failed_24h;
  const totalQueue = services.reduce((n, s) => n + (s.raw.queue_len || 0), 0);
  const successRate =
    completed != null && failed != null && completed + failed > 0
      ? `${((completed / (completed + failed)) * 100).toFixed(1)}%`
      : '—';
  const tiles = [
    { label: 'Jobs in queue', value: data ? String(totalQueue) : '—', sub: 'waiting to start' },
    { label: 'Completed', value: completed != null ? String(completed) : '—', sub: 'last 24 hours' },
    { label: 'Success rate', value: successRate, sub: 'last 24 hours' },
  ];

  const ready = !!data;

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: 'var(--color-background)',
        fontFamily: SANS,
        color: 'var(--color-text)',
        WebkitFontSmoothing: 'antialiased',
        paddingBottom: 96,
      }}
    >
      <style>{`
        @keyframes gsPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .3; transform: scale(.6); } }
        @keyframes gsShimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
      `}</style>

      {/* dotted backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, var(--color-dot-pattern) 1.5px, transparent 1.5px)',
          backgroundSize: '43px 43px',
          opacity: 0.35,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 10, maxWidth: 788, margin: '0 auto', padding: '0 20px' }}>
        {/* header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '30px 0 28px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}>
            <img
              src={isDarkMode ? '/images/Logo_White.png' : '/images/Logo_Dark.png'}
              alt="GrooveSheet"
              style={{ height: 26, display: 'block' }}
            />
            <span style={{ fontSize: 14, color: 'var(--color-muted-foreground)', whiteSpace: 'nowrap' }}>
              System status
            </span>
          </div>
          <a
            href="/help"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              border: '1px solid var(--color-border-lighter)',
              borderRadius: 120,
              background: 'transparent',
              color: 'var(--color-foreground)',
              fontFamily: SANS,
              fontSize: 14,
              fontWeight: 500,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <Bell size={15} weight="fill" />
            Subscribe to updates
          </a>
        </div>

        {loading && !data && <Skeleton />}

        {error && !data && (
          <StatusMessage variant="error" title="Couldn’t reach the status API" style={{ marginTop: 16 }}>
            {error}
          </StatusMessage>
        )}

        {ready && (
          <>
            {/* overall summary */}
            <div
              style={{
                background: 'var(--color-panel1)',
                borderRadius: 16,
                padding: '26px 28px',
                display: 'flex',
                alignItems: 'center',
                gap: 22,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: STATUS[overall.key].tint,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: '0 0 auto',
                }}
              >
                <StatusIcon status={overall.key} size={33} weight="fill" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1
                  style={{
                    fontSize: 29,
                    fontWeight: 400,
                    letterSpacing: '-0.6px',
                    lineHeight: 1.15,
                    margin: 0,
                    color: 'var(--color-text)',
                  }}
                >
                  {overall.title}
                </h1>
                <p
                  style={{
                    margin: '7px 0 0',
                    fontSize: 16,
                    lineHeight: '22px',
                    color: 'var(--color-muted-foreground)',
                    textWrap: 'pretty',
                  }}
                >
                  {overallSub}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 13 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: '#22c55e',
                      display: 'inline-block',
                      animation: 'gsPulse 1.6s ease-in-out infinite',
                      flex: '0 0 auto',
                    }}
                  />
                  <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--color-muted-foreground)' }}>
                    {updatedAt ? `Live · last checked ${updatedAt.toLocaleTimeString()}` : 'Live'}
                    {data.redis_connected === false ? ' · Redis unreachable' : ''}
                  </span>
                </div>
              </div>
              <button
                onClick={load}
                style={{
                  flex: '0 0 auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '9px 16px',
                  border: '1px solid var(--color-border-lighter)',
                  borderRadius: 120,
                  background: 'transparent',
                  color: 'var(--color-foreground)',
                  fontFamily: SANS,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <ArrowClockwise size={14} weight="fill" />
                Refresh
              </button>
            </div>

            {/* processing health */}
            <div style={{ margin: '34px 0 14px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 20, fontWeight: 500, color: 'var(--color-text)' }}>Processing health</span>
              <span style={{ fontSize: 13, color: 'var(--color-muted-foreground)' }}>live</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {tiles.map((q) => (
                <div key={q.label} style={{ background: 'var(--color-panel2)', borderRadius: 13, padding: '18px 20px' }}>
                  <div style={{ fontSize: 13, color: 'var(--color-muted-foreground)' }}>{q.label}</div>
                  <div style={{ fontSize: 34, fontWeight: 300, lineHeight: 1.1, marginTop: 8, color: 'var(--color-text)' }}>
                    {q.value}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 12, color: 'var(--color-muted-foreground)', marginTop: 6 }}>
                    {q.sub}
                  </div>
                </div>
              ))}
            </div>

            {/* components */}
            <div
              style={{
                margin: '34px 0 14px',
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 20, fontWeight: 500, color: 'var(--color-text)' }}>Components</span>
              <span style={{ fontSize: 13, color: 'var(--color-muted-foreground)' }}>
                {services.length} service{services.length === 1 ? '' : 's'}
              </span>
              <div
                style={{
                  marginLeft: 'auto',
                  alignSelf: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  flexWrap: 'wrap',
                }}
              >
                {['operational', 'degraded', 'down', 'maintenance'].map((k) => (
                  <span
                    key={k}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 13,
                      color: 'var(--color-muted-foreground)',
                    }}
                  >
                    <StatusIcon status={k} size={16} />
                    {STATUS[k].label}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {services.map((s) => (
                <div
                  key={s.raw.name}
                  style={{ background: 'var(--color-panel2)', borderRadius: 13, padding: '18px 20px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 17,
                          fontWeight: 500,
                          color: 'var(--color-foreground)',
                          letterSpacing: '-0.2px',
                        }}
                      >
                        {LABELS[s.raw.name] || s.raw.name}
                      </div>
                      {s.note && (
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 14,
                            lineHeight: '19px',
                            color: 'var(--color-muted-foreground)',
                            textWrap: 'pretty',
                          }}
                        >
                          {s.note}
                        </div>
                      )}
                    </div>
                    <div style={{ flex: '0 0 auto' }}>
                      <Chip status={s.status} />
                    </div>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <HealthStrip status={s.status} />
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 7,
                        fontFamily: MONO,
                        fontSize: 11,
                        color: 'var(--color-muted-foreground)',
                      }}
                    >
                      <span>
                        {s.raw.consumers ?? 0} worker{s.raw.consumers === 1 ? '' : 's'}
                      </span>
                      <span style={{ color: 'var(--color-foreground)' }}>
                        queue {s.raw.queue_len ?? 0} · lag {s.raw.lag ?? 0}
                      </span>
                      <span>{STATUS[s.status].label}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* incident history */}
            <div style={{ margin: '34px 0 14px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 20, fontWeight: 500, color: 'var(--color-text)' }}>Incident history</span>
              <span style={{ fontSize: 13, color: 'var(--color-muted-foreground)' }}>recent</span>
            </div>
            <div
              style={{
                background: 'var(--color-panel2)',
                borderRadius: 13,
                padding: '24px 26px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <CheckCircle size={22} weight="fill" color="#22c55e" />
              <span style={{ fontSize: 15, color: 'var(--color-muted-foreground)' }}>
                No incidents reported recently.
              </span>
            </div>
          </>
        )}

        {/* footer */}
        <div style={{ marginTop: 32, paddingTop: 26, textAlign: 'center' }}>
          <span style={{ fontSize: 15, color: 'var(--color-muted-foreground)' }}>
            Having trouble?{' '}
            <a
              href="/help"
              style={{
                color: 'var(--color-foreground)',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
                textDecorationThickness: 1,
              }}
            >
              Contact us
            </a>
          </span>
          <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 12, color: 'var(--color-surface-muted)' }}>
            © {new Date().getFullYear()} GrooveSheet · status checked every {REFRESH_MS / 1000} seconds
          </div>
        </div>
      </div>
    </div>
  );
}
