import React, { useMemo } from 'react';
import { DENSITY, mulberry32, hashStr } from './thumbUtils';
import { ROLL_COLORS } from '../constants';

const FALLBACK_PARTS = ['Piano', 'Bass', 'Drums', 'Other'];

function MidiThumb({ song, width = 320, height = 192 }) {
  const seed = useMemo(() => hashStr(String(song.id) + '_midi'), [song.id]);
  const rand = useMemo(() => mulberry32(seed), [seed]);
  const W = width;
  const H = height;
  const padX = 10;
  const padY = 10;

  const lanes = (song.parts && song.parts.length ? song.parts : FALLBACK_PARTS).slice(0, 4);
  const laneH = (H - padY * 2 - 4 * (lanes.length - 1)) / lanes.length;

  const cols = 16;
  const labelAreaW = 56;
  const bodyX0 = padX + labelAreaW;
  const bodyX1 = W - padX - 4;
  const colW = (bodyX1 - bodyX0) / cols;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
      <rect width={W} height={H} fill="#0c1226" />
      <defs>
        <pattern id={`stripe-${song.id}`} width="2" height="2" patternUnits="userSpaceOnUse">
          <rect width="2" height="2" fill="#0c1226" />
          <line x1="0" y1="0" x2="0" y2="2" stroke="#11183a" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#stripe-${song.id})`} />
      {Array.from({ length: cols + 1 }).map((_, i) => {
        const x = bodyX0 + i * colW;
        const isBar = i % 4 === 0;
        return (
          <line
            key={'g' + i}
            x1={x}
            x2={x}
            y1={padY}
            y2={H - padY}
            stroke={isBar ? '#1f2851' : '#161e3e'}
            strokeWidth="0.6"
          />
        );
      })}
      {lanes.map((part, idx) => {
        const yTop = padY + idx * (laneH + 4);
        const color = ROLL_COLORS[part] || '#7CC4FF';
        const dens = DENSITY[song.difficulty] || 0.85;
        const events = Math.round(6 + dens * 8 + rand() * 2);
        const notes = [];
        for (let n = 0; n < events; n++) {
          const startCol = Math.floor(rand() * (cols - 1));
          const lenCol = Math.max(1, Math.round(rand() * 3 + (part === 'Drums' ? 0.2 : 0.8)));
          const rowsInLane = 6;
          const row = Math.floor(rand() * rowsInLane);
          const noteH = (laneH - 6) / rowsInLane;
          const x = bodyX0 + startCol * colW + 1;
          const w = Math.min(lenCol * colW - 2, bodyX1 - x - 1);
          const y = yTop + 3 + row * noteH;
          if (w > 1) notes.push({ x, y, w, h: noteH - 1, color });
        }
        return (
          <g key={'lane' + idx}>
            <rect x={bodyX0} y={yTop} width={bodyX1 - bodyX0} height={laneH} fill="rgba(255,255,255,0.025)" />
            <text
              x={padX + labelAreaW / 2}
              y={yTop + laneH / 2 + 3.2}
              fontSize="9"
              fontWeight="700"
              fill={color}
              textAnchor="middle"
              fontFamily="'Hubot Sans', sans-serif"
              letterSpacing="0.4"
            >
              {part.toUpperCase()}
            </text>
            {notes.map((nt, i) => (
              <rect key={i} x={nt.x} y={nt.y} width={nt.w} height={nt.h} rx="1.2" fill={nt.color} fillOpacity="0.85" />
            ))}
          </g>
        );
      })}
      <line
        x1={bodyX0 + colW * 4.5}
        x2={bodyX0 + colW * 4.5}
        y1={padY - 2}
        y2={H - padY + 2}
        stroke="#ffffff"
        strokeOpacity="0.55"
        strokeWidth="1"
      />
      <polygon
        points={`${bodyX0 + colW * 4.5 - 3},${padY - 3} ${bodyX0 + colW * 4.5 + 3},${padY - 3} ${
          bodyX0 + colW * 4.5
        },${padY + 1}`}
        fill="#fff"
        fillOpacity="0.7"
      />
    </svg>
  );
}

export default MidiThumb;
