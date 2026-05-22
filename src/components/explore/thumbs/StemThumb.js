import React, { useMemo } from 'react';
import { mulberry32, hashStr } from './thumbUtils';
import { ROLL_COLORS } from '../../../mocks/exploreData';

function StemThumb({ song, width = 320, height = 192 }) {
  const seed = useMemo(() => hashStr(song.id + '_stem'), [song.id]);
  const rand = useMemo(() => mulberry32(seed), [seed]);
  const W = width;
  const H = height;
  const padX = 12;
  const padY = 12;
  const stems = song.parts.slice(0, 4);
  const gap = 6;
  const rowH = (H - padY * 2 - gap * (stems.length - 1)) / stems.length;

  const labelAreaW = 76;

  const renderWave = (yMid, color, kind) => {
    const samples = 48;
    const bars = [];
    for (let i = 0; i < samples; i++) {
      const t = i / samples;
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
      amp = Math.max(0.06, amp);
      bars.push(amp);
    }
    const barW = (W - padX * 2 - labelAreaW) / samples;
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
