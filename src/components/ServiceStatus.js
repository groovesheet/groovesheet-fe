import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchServiceStatus } from '../utils/api';

/**
 * /service-status — at-a-glance health of the audio workers.
 *
 * Reads the orchestrator's GET /service-status (worker /health + Redis queue
 * lag/consumer-idle + recent workflow counts) and renders one card per service,
 * auto-refreshing. Built after a worker consume-loop silently wedged for 37 days
 * with nothing surfacing it — this is the surface.
 */

const REFRESH_MS = 15000;

const LABELS = {
  bs_roformer: 'Separation · BS-Roformer',
  demucs: 'Separation · Demucs',
  adtof: 'Drums · ADTOF',
  bassunet: 'Bass · BassUNet',
  fcpe: 'Bass pitch · FCPE',
  'transkun-v2': 'Piano · Transkun',
  midi2score: 'MIDI → MusicXML',
  compress: 'Compress',
};

const fmtAge = (ms) => {
  if (ms == null) return '—';
  const s = ms / 1000;
  if (s < 90) return `${Math.round(s)}s`;
  if (s < 5400) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
};

export default function ServiceStatus() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchServiceStatus();
      setData(res);
      setError(null);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e.message || 'failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer.current);
  }, [load]);

  const services = data?.services || [];
  const allOk = data?.all_ok;
  const degraded = data?.degraded || [];

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={S.headerRow}>
          <h1 style={S.h1}>Service Status</h1>
          <button onClick={load} style={S.refreshBtn} title="refresh now">↻</button>
        </div>

        {/* overall banner */}
        {data && (
          <div style={{ ...S.banner, ...(allOk ? S.bannerOk : S.bannerBad) }}>
            <span style={{ ...S.dot, background: allOk ? '#34d399' : '#f87171' }} />
            {allOk
              ? 'All systems operational'
              : `${degraded.length} service${degraded.length === 1 ? '' : 's'} degraded: ${degraded
                  .map((n) => LABELS[n] || n)
                  .join(', ')}`}
            {data.redis_connected === false && <span style={S.redisBad}>• Redis unreachable</span>}
          </div>
        )}

        {error && <div style={S.errorBox}>Couldn’t reach the status API: {error}</div>}
        {loading && !data && <div style={S.muted}>Loading…</div>}

        {/* recent counts */}
        {data?.recent && (
          <div style={S.recentRow}>
            <span style={S.recentItem}>✓ {data.recent.completed_24h ?? '—'} completed (24h)</span>
            <span style={S.recentItem}>✕ {data.recent.failed_24h ?? '—'} failed (24h)</span>
          </div>
        )}

        {/* service grid */}
        <div style={S.grid}>
          {services.map((s) => {
            const h = s.health;
            const idle = s.min_consumer_idle_ms;
            return (
              <div key={s.name} style={{ ...S.card, borderColor: s.up ? '#214a2e' : '#5b1f1f' }}>
                <div style={S.cardHead}>
                  <span style={{ ...S.dot, background: s.up ? '#34d399' : '#f87171' }} />
                  <span style={S.cardTitle}>{LABELS[s.name] || s.name}</span>
                  <span style={{ ...S.pill, ...(s.up ? S.pillUp : S.pillDown) }}>
                    {s.up ? 'up' : 'down'}
                  </span>
                </div>
                <div style={S.metrics}>
                  <Metric label="queue" value={s.queue_len ?? '—'} />
                  <Metric label="lag" value={s.lag ?? '—'} warn={(s.lag || 0) > 0} />
                  <Metric label="pending" value={s.pending ?? '—'} />
                  <Metric label="workers" value={s.consumers ?? 0} warn={!s.consumers} />
                  <Metric label="idle" value={fmtAge(idle)} warn={idle != null && idle > 60000} />
                  {h && <Metric label="done" value={h.jobs_ok ?? 0} />}
                  {h && <Metric label="failed" value={h.jobs_failed ?? 0} warn={(h.jobs_failed || 0) > 0} />}
                </div>
                {h?.processing && (
                  <div style={S.proc}>● processing {h.current_job} ({fmtAge((h.processing_age_s || 0) * 1000)})</div>
                )}
              </div>
            );
          })}
        </div>

        <div style={S.footer}>
          {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()} · auto-refresh ${REFRESH_MS / 1000}s` : ''}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, warn }) {
  return (
    <div style={S.metric}>
      <div style={{ ...S.metricVal, color: warn ? '#fbbf24' : '#fff' }}>{value}</div>
      <div style={S.metricLabel}>{label}</div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#171717',
    color: '#fff',
    fontFamily: 'Hubot Sans, Inter, system-ui, sans-serif',
    padding: '40px 20px',
  },
  wrap: { maxWidth: 980, margin: '0 auto' },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontSize: 32, fontWeight: 600, margin: 0 },
  refreshBtn: {
    background: '#232226', color: '#fff', border: '1px solid #3d3b3e',
    borderRadius: 8, width: 38, height: 38, fontSize: 16, cursor: 'pointer',
  },
  banner: {
    marginTop: 20, padding: '14px 18px', borderRadius: 12, fontSize: 15,
    display: 'flex', alignItems: 'center', gap: 10, border: '1px solid',
  },
  bannerOk: { background: 'rgba(52,211,153,0.08)', borderColor: '#214a2e', color: '#d1fae5' },
  bannerBad: { background: 'rgba(248,113,113,0.08)', borderColor: '#5b1f1f', color: '#fee2e2' },
  redisBad: { marginLeft: 8, color: '#fca5a5' },
  dot: { width: 10, height: 10, borderRadius: 9999, display: 'inline-block', flexShrink: 0 },
  errorBox: {
    marginTop: 16, padding: '12px 16px', borderRadius: 10,
    background: 'rgba(248,113,113,0.08)', border: '1px solid #5b1f1f', color: '#fecaca', fontSize: 14,
  },
  muted: { marginTop: 16, color: '#8d8c8d' },
  recentRow: { marginTop: 16, display: 'flex', gap: 18, color: '#a3a3a3', fontSize: 14 },
  recentItem: {},
  grid: {
    marginTop: 22, display: 'grid', gap: 14,
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  },
  card: { background: '#1f1e21', border: '1px solid', borderRadius: 14, padding: 18 },
  cardHead: { display: 'flex', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: 500, flex: 1 },
  pill: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999, textTransform: 'uppercase' },
  pillUp: { background: 'rgba(52,211,153,0.15)', color: '#34d399' },
  pillDown: { background: 'rgba(248,113,113,0.15)', color: '#f87171' },
  metrics: { marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 14 },
  metric: { minWidth: 48 },
  metricVal: { fontSize: 18, fontWeight: 600 },
  metricLabel: { fontSize: 11, color: '#8d8c8d', textTransform: 'uppercase', letterSpacing: 0.3 },
  proc: { marginTop: 12, fontSize: 13, color: '#60a5fa' },
  footer: { marginTop: 26, color: '#6b6b6b', fontSize: 13, textAlign: 'center' },
};
