import React, { useMemo } from 'react';
import { DENSITY, mulberry32, hashStr } from './thumbUtils';

function SheetThumb({ song, width = 320, height = 192 }) {
  const seed = useMemo(() => hashStr(String(song.id)), [song.id]);
  const rand = useMemo(() => mulberry32(seed), [seed]);

  const W = width;
  const H = height;
  const padX = 10;
  const padY = 18;

  const sysGap = 14;
  const systemHeight = (H - padY * 2 - sysGap) / 2;
  const lineGap = systemHeight / 6;

  const renderStaff = (yTop) => {
    const lines = [];
    for (let i = 0; i < 5; i++) {
      const y = yTop + lineGap * (i + 0.5);
      lines.push(
        <line key={'l' + i} x1={padX} x2={W - padX} y1={y} y2={y} stroke="#111" strokeWidth="0.6" />,
      );
    }
    return lines;
  };

  const innerX0 = padX + 40;
  const barCount = 4;
  const barW = (W - padX - innerX0) / barCount;
  const bars = [];
  for (let i = 1; i < barCount; i++) {
    bars.push({ x: innerX0 + barW * i });
  }

  const dens = DENSITY[song.difficulty] || 0.85;
  const trebleY = padY;
  const bassY = padY + systemHeight + sysGap;

  const stepToY = (yTop, step) => yTop + lineGap * 2.5 - step * (lineGap / 2);

  const buildNotes = (yTop, range, beamy) => {
    const els = [];
    for (let b = 0; b < barCount; b++) {
      const bx0 = innerX0 + barW * b + 6;
      const bx1 = innerX0 + barW * (b + 1) - 4;
      const beats = Math.round(2 + dens * 4);
      let pair = [];
      for (let n = 0; n < beats; n++) {
        const step = Math.round((rand() - 0.5) * 2 * range);
        const x = bx0 + (n / beats) * (bx1 - bx0);
        const y = stepToY(yTop, step);
        const isEighth = beamy && rand() > 0.35;
        els.push({ x, y, step, eighth: isEighth, yTop });
        if (isEighth) {
          pair.push({ x, y, step, yTop });
          if (pair.length === 2) {
            els.push({ beam: true, a: pair[0], b: pair[1] });
            pair = [];
          }
        } else {
          pair = [];
        }
      }
    }
    return els;
  };

  const trebleNotes = buildNotes(trebleY, 4, true);
  const bassNotes = buildNotes(bassY, 3, song.difficulty !== 'Beginner');

  const renderNotes = (notes) =>
    notes.map((n, i) => {
      if (n.beam) {
        const y = Math.min(n.a.y, n.b.y) - 18;
        return (
          <g key={'bm' + i}>
            <line x1={n.a.x + 2.6} y1={n.a.y} x2={n.a.x + 2.6} y2={y} stroke="#111" strokeWidth="0.8" />
            <line x1={n.b.x + 2.6} y1={n.b.y} x2={n.b.x + 2.6} y2={y} stroke="#111" strokeWidth="0.8" />
            <line x1={n.a.x + 2.4} y1={y} x2={n.b.x + 2.8} y2={y} stroke="#111" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        );
      }
      const stemUp = n.step <= 0;
      const stemX = n.x + (stemUp ? 2.6 : -2.6);
      const stemY = stemUp ? n.y - 18 : n.y + 18;
      return (
        <g key={'n' + i}>
          <ellipse cx={n.x} cy={n.y} rx="3.2" ry="2.3" transform={`rotate(-22 ${n.x} ${n.y})`} fill="#111" />
          <line x1={stemX} y1={n.y} x2={stemX} y2={stemY} stroke="#111" strokeWidth="0.9" />
        </g>
      );
    });

  const trebleClef = (
    <g
      transform={`translate(${padX + 3}, ${trebleY + lineGap * 1.4}) scale(0.6)`}
      fill="none"
      stroke="#111"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M 8 -10 C 14 -4, 14 8, 4 12 C -4 16, -4 4, 6 -2 C 16 -8, 14 -22, 8 -26 C 2 -30, -2 -22, 2 -16 L 6 24" />
      <circle cx="6" cy="24" r="2.4" fill="#111" stroke="none" />
    </g>
  );
  const bassClef = (
    <g
      transform={`translate(${padX + 4}, ${bassY + lineGap * 1.4}) scale(0.55)`}
      fill="none"
      stroke="#111"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M -4 -4 C 2 -10, 14 -8, 14 0 C 14 10, 4 14, -2 12" />
      <circle cx="18" cy="-5" r="1.6" fill="#111" stroke="none" />
      <circle cx="18" cy="3" r="1.6" fill="#111" stroke="none" />
    </g>
  );

  const sig = (yTop) => (
    <g transform={`translate(${padX + 24}, ${yTop + lineGap * 2.5})`} fill="#111" fontFamily="serif" fontWeight="700">
      <text x="0" y="-1" fontSize={lineGap * 1.5} textAnchor="middle">4</text>
      <text x="0" y={lineGap * 1.4} fontSize={lineGap * 1.5} textAnchor="middle">4</text>
    </g>
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`paper-${song.id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#fbfaf4" />
          <stop offset="100%" stopColor="#f0eee3" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#paper-${song.id})`} />
      {renderStaff(trebleY)}
      {renderStaff(bassY)}
      <line
        x1={padX}
        x2={padX}
        y1={trebleY + 0.6}
        y2={bassY + systemHeight - lineGap * 0.5}
        stroke="#111"
        strokeWidth="1.4"
      />
      {trebleClef}
      {bassClef}
      {sig(trebleY)}
      {sig(bassY)}
      {bars.map((b, i) => (
        <line
          key={'bar' + i}
          x1={b.x}
          x2={b.x}
          y1={trebleY + lineGap * 0.5}
          y2={bassY + systemHeight - lineGap * 0.5}
          stroke="#111"
          strokeWidth="0.6"
        />
      ))}
      <line
        x1={W - padX - 1}
        x2={W - padX - 1}
        y1={trebleY + lineGap * 0.5}
        y2={bassY + systemHeight - lineGap * 0.5}
        stroke="#111"
        strokeWidth="0.6"
      />
      <line
        x1={W - padX - 4}
        x2={W - padX - 4}
        y1={trebleY + lineGap * 0.5}
        y2={bassY + systemHeight - lineGap * 0.5}
        stroke="#111"
        strokeWidth="1.6"
      />
      {renderNotes(trebleNotes)}
      {renderNotes(bassNotes)}
    </svg>
  );
}

export default SheetThumb;
