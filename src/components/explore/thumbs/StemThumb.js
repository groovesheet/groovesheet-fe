import React, { useMemo } from 'react';
import { mulberry32, hashStr } from './thumbUtils';
import { ROLL_COLORS, capitalize } from '../constants';

const FALLBACK_PARTS = ['Vocals', 'Drums', 'Bass', 'Other'];
const SAMPLES = 48;

/**
 * Max-pool an array of 0..100 ints down to `bars` normalized (0..1) amplitudes.
 */
function maxPool(points, bars) {
  const n = points.length;
  if (!n) return [];
  const out = [];
  for (let i = 0; i < bars; i++) {
    const start = Math.floor((i * n) / bars);
    const end = Math.max(start + 1, Math.floor(((i + 1) * n) / bars));
    let m = 0;
    for (let j = start; j < end; j++) m = Math.max(m, points[j] || 0);
    out.push(Math.max(0.06, m / 100));
  }
  return out;
}

/**
 * Stem waveform thumbnail.
 *
 * When `peaks` (the API's thumb_data.stems object: stem name → 200 ints) is
 * provided, real bars are rendered by max-pooling each stem's points down to
 * the bar count. Without peaks, falls back to the procedural PRNG waves.
 */
function StemThumb({ song, peaks = null, width = 320, height = 192 }) {
  const seed = useMemo(() => hashStr(String(song.id) + '_stem'), [song.id]);
  const rand = useMemo(() => mulberry32(seed), [seed]);
  const W = width;
  const H = height;
  const padX = 12;
  const padY = 12;

  const hasPeaks = peaks && Object.keys(peaks).length > 0;
  const stems = hasPeaks
    ? Object.keys(peaks).slice(0, 4).map(capitalize)
    : ((song.parts && song.parts.length ? song.parts : FALLBACK_PARTS)).slice(0, 4);
  const gap = 6;
  const rowH = (H - padY * 2 - gap * (stems.length - 1)) / stems.length;

  const labelAreaW = 76;

  const proceduralBars = (kind) => {
    const bars = [];
    for (let i = 0; i < SAMPLES; i++) {
      const t = i / SAMPLES;
      let amp;
      if (kind === 'Drums') {
        amp = (rand() > 0.7 ? 0.85 : 0.18) * (0.6 + rand() * 0.4);
      } else if (kind === 'Bass') {
        amp = (0.4 + 0.6 * Math.abs(Math.sin(t * Math.PI * 2 + seed * 0.01))) * (0.5 + rand() * 0.3);
      } else if (kind === 'Vocals') {
        amp = (0.3 + 0.7 * Math.sin(t * Math.PI * 4) * Math.cos(t * Math.PI * 2)) * (0.55 + rand() * 0.35);
        amp = Math.abs(amp);
      } else {
        amp = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(t * Math.PI * 3 + seed * 0.02)) * (0.55 + rand() * 0.35);
      }
      bars.push(Math.max(0.06, amp));
    }
    return bars;
  };

  const renderWave = (yMid, color, kind) => {
    const stemKey = kind.toLowerCase();
    const bars =
      hasPeaks && Array.isArray(peaks[stemKey]) && peaks[stemKey].length > 0
        ? maxPool(peaks[stemKey], SAMPLES)
        : proceduralBars(kind);
    const barW = (W - padX * 2 - labelAreaW) / bars.length;
    const x0 = padX + labelAreaW;
    const maxAmp = rowH / 2 - 2;
    return (
      <g>
        <line x1={x0} x2={W - padX} y1={yMid} y2={yMid} stroke={color} strokeOpacity="0.25" strokeWidth="0.6" />
        {bars.map((a, i) => {
          const x = x0 + i * barW + 0.4;
          const h = maxAmp * a;
          return (
            <rect
              key={i}
              x={x}
              y={yMid - h}
              width={Math.max(barW - 0.8, 0.8)}
              height={h * 2}
              rx="0.8"
              fill={color}
              fillOpacity="0.85"
            />
          );
        })}
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`bg-${song.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1a1a" />
          <stop offset="100%" stopColor="#0e0e0e" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#bg-${song.id})`} />
      {stems.map((s, idx) => {
        const yTop = padY + idx * (rowH + gap);
        const yMid = yTop + rowH / 2;
        const color = ROLL_COLORS[s] || '#7CC4FF';
        return (
          <g key={idx}>
            <rect x={padX} y={yTop} width={W - padX * 2} height={rowH} rx="6" fill="rgba(255,255,255,0.025)" />
            <text
              x={padX + 6}
              y={yMid + 3.5}
              fontSize="10"
              fontWeight="700"
              fill={color}
              fontFamily="'Hubot Sans', sans-serif"
              letterSpacing="0.5"
            >
              {s.toUpperCase()}
            </text>
            {renderWave(yMid, color, s)}
          </g>
        );
      })}
    </svg>
  );
}

export default StemThumb;
