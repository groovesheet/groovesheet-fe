// The three synchronized viewers for the song detail page:
//   <SheetMusicView/>  — multi-page engraved notation, with measure cursor
//   <PianoRollView/>   — colored note blocks per stem, playhead, minimap
//   <StemsView/>       — stacked waveforms, per-stem mute/solo/volume
// Ported from the design pack (song-viewers.jsx).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { STEM_COLORS } from '../../mocks/songDetailData';

// ---------- Shared PRNG ----------
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

// =================================================================
// 1) Sheet Music
// =================================================================
const PAGE_W = 660;
const PAGE_H = 855;
const PAGE_PAD_X = 56;
const PAGE_PAD_TOP = 80;
const PAGE_PAD_BOTTOM = 66;
const SYSTEMS_PER_PAGE = 5;
const MEASURES_PER_SYSTEM = 4;

export function SheetMusicView({ song, currentBeat, measures, onSeekMeasure, transpose }) {
  const totalMeasures = measures;
  const measuresPerPage = SYSTEMS_PER_PAGE * MEASURES_PER_SYSTEM;
  const totalPages = Math.max(1, Math.ceil(totalMeasures / measuresPerPage));

  const beatsPerMeasure = 4;
  const liveBeat = currentBeat;
  const currentMeasure = Math.min(totalMeasures - 1, Math.max(0, Math.floor(liveBeat / beatsPerMeasure)));

  const containerRef = useRef(null);
  const pageRefs = useRef([]);
  const userScrollLock = useRef(0);
  useEffect(() => {
    const page = Math.floor(currentMeasure / measuresPerPage);
    const el = pageRefs.current[page];
    if (!el) return;
    if (Date.now() < userScrollLock.current) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentMeasure, measuresPerPage]);

  const onScrollUser = () => {
    userScrollLock.current = Date.now() + 1200;
  };

  const pages = [];
  for (let p = 0; p < totalPages; p++) pages.push(p);

  return (
    <div
      ref={containerRef}
      onWheel={onScrollUser}
      onTouchMove={onScrollUser}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
        height: 'min(78vh, 980px)',
        overflowY: 'auto',
        background: 'rgba(0,0,0,0.18)',
        padding: '24px 24px 48px',
      }}
      className="gs-sheet-scroll"
    >
      {pages.map((p) => (
        <div
          key={p}
          ref={(el) => (pageRefs.current[p] = el)}
          className="gs-sheet-page"
          data-page={`— ${p + 1} —`}
          style={{ width: PAGE_W, minHeight: PAGE_H }}
        >
          <SheetPage
            song={song}
            pageIndex={p}
            totalPages={totalPages}
            currentMeasure={currentMeasure}
            measuresPerPage={measuresPerPage}
            measuresPerSystem={MEASURES_PER_SYSTEM}
            systemsPerPage={SYSTEMS_PER_PAGE}
            totalMeasures={totalMeasures}
            transpose={transpose}
            onSeekMeasure={onSeekMeasure}
          />
        </div>
      ))}
    </div>
  );
}

function SheetPage({ song, pageIndex, totalPages, currentMeasure, measuresPerPage, measuresPerSystem, systemsPerPage, totalMeasures, transpose, onSeekMeasure }) {
  const seed = useMemo(() => hashStr(song.id + ':' + pageIndex), [song.id, pageIndex]);
  const innerH = PAGE_H - PAGE_PAD_TOP - PAGE_PAD_BOTTOM;
  const systemH = innerH / systemsPerPage;
  const startMeasure = pageIndex * measuresPerPage;
  const innerW = PAGE_W - PAGE_PAD_X * 2;

  return (
    <svg viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} width={PAGE_W} height={PAGE_H} style={{ display: 'block' }}>
      {pageIndex === 0 && (
        <g>
          <text x={PAGE_W / 2} y={36} textAnchor="middle" fontFamily="serif" fontSize="22" fontWeight="500" fill="#111">
            {song.title}
          </text>
          <text x={PAGE_W / 2} y={56} textAnchor="middle" fontFamily="serif" fontSize="13" fontStyle="italic" fill="#444">
            {song.artist}
          </text>
          <text x={PAGE_W - PAGE_PAD_X} y={56} textAnchor="end" fontFamily="serif" fontSize="11" fill="#555">
            ♩ = {song.tempo}
          </text>
          <text x={PAGE_PAD_X} y={56} fontFamily="serif" fontSize="11" fontStyle="italic" fill="#555">
            Andante espressivo
          </text>
        </g>
      )}
      {pageIndex !== 0 && (
        <text x={PAGE_W - PAGE_PAD_X} y={42} textAnchor="end" fontFamily="serif" fontSize="11" fontStyle="italic" fill="#666">
          {song.title}
        </text>
      )}

      {Array.from({ length: systemsPerPage }).map((_, sysIdx) => {
        const sysMeasureStart = startMeasure + sysIdx * measuresPerSystem;
        if (sysMeasureStart >= totalMeasures) return null;
        const yTop = PAGE_PAD_TOP + sysIdx * systemH;
        return (
          <SheetSystem
            key={sysIdx}
            seed={seed + sysIdx * 1009}
            x0={PAGE_PAD_X}
            y0={yTop}
            width={innerW}
            height={systemH}
            measureStart={sysMeasureStart}
            measureCount={Math.min(measuresPerSystem, totalMeasures - sysMeasureStart)}
            isFirstSystem={sysIdx === 0 && pageIndex === 0}
            currentMeasure={currentMeasure}
            song={song}
            transpose={transpose}
            onSeekMeasure={onSeekMeasure}
          />
        );
      })}

      <text x={PAGE_W / 2} y={PAGE_H - 22} textAnchor="middle" fontFamily="serif" fontSize="11" fontStyle="italic" fill="#777">
        {pageIndex + 1} / {totalPages}
      </text>
    </svg>
  );
}

function SheetSystem({ seed, x0, y0, width, measureStart, measureCount, isFirstSystem, currentMeasure, transpose, onSeekMeasure }) {
  const rand = useMemo(() => mulberry32(seed), [seed]);
  const lineGap = 6;
  const trebleY = y0 + 20;
  const bassY = y0 + 70;

  const clefSpace = 44;
  const bodyX0 = x0 + clefSpace;
  const bodyW = width - clefSpace;
  const measureW = bodyW / measureCount;

  const renderStaff = (sy) =>
    Array.from({ length: 5 }).map((_, i) => (
      <line key={i} x1={x0} x2={x0 + width} y1={sy + i * lineGap} y2={sy + i * lineGap} stroke="#1a1a1a" strokeWidth="0.7" />
    ));

  const activeIdx = currentMeasure - measureStart;
  const showActive = activeIdx >= 0 && activeIdx < measureCount;

  const renderMeasure = (mi) => {
    const mx0 = bodyX0 + mi * measureW;

    const notesForStaff = (sy, range, center) => {
      const out = [];
      const subdiv = rand() > 0.5 ? 8 : 4;
      const events = subdiv;
      let pair = [];
      for (let n = 0; n < events; n++) {
        const x = mx0 + 12 + (n + 0.5) * ((measureW - 16) / events);
        const step = Math.round((rand() - 0.5) * 2 * range) + center;
        const noteY = sy + 2 * lineGap - step * (lineGap / 2);
        const isEighth = subdiv === 8;
        const isRest = !isEighth && rand() > 0.85;
        out.push({ x, y: noteY, step, isEighth, isRest });
        if (isEighth) {
          pair.push({ x, y: noteY });
          if (pair.length === 2) {
            out.push({ beam: true, a: pair[0], b: pair[1], staffY: sy });
            pair = [];
          }
        } else {
          pair = [];
        }
      }
      return out;
    };

    const treble = notesForStaff(trebleY, 4, 2 + (transpose | 0) / 3);
    const bass = notesForStaff(bassY, 3, -1 - (transpose | 0) / 4);
    const all = [...treble, ...bass];

    return (
      <g key={mi} style={{ cursor: 'pointer' }} onClick={() => onSeekMeasure && onSeekMeasure(measureStart + mi)}>
        <rect x={mx0} y={trebleY - 6} width={measureW} height={bassY - trebleY + 5 * lineGap + 12} fill="transparent" />
        {all.map((n, ni) => {
          if (n.beam) {
            const beamY = Math.min(n.a.y, n.b.y) - 22;
            return (
              <g key={ni}>
                <line x1={n.a.x + 2.5} y1={n.a.y} x2={n.a.x + 2.5} y2={beamY} stroke="#111" strokeWidth="0.9" />
                <line x1={n.b.x + 2.5} y1={n.b.y} x2={n.b.x + 2.5} y2={beamY} stroke="#111" strokeWidth="0.9" />
                <line x1={n.a.x + 2.3} y1={beamY} x2={n.b.x + 2.7} y2={beamY} stroke="#111" strokeWidth="2.4" strokeLinecap="round" />
              </g>
            );
          }
          if (n.isRest) {
            return (
              <g key={ni}>
                <rect x={n.x - 4} y={n.y - 2} width="8" height="4" fill="#111" />
              </g>
            );
          }
          const stemUp = n.step <= 1;
          const stemX = n.x + (stemUp ? 2.6 : -2.6);
          const stemY = stemUp ? n.y - 22 : n.y + 22;
          return (
            <g key={ni}>
              <ellipse cx={n.x} cy={n.y} rx="3.4" ry="2.4" transform={`rotate(-22 ${n.x} ${n.y})`} fill="#111" />
              <line x1={stemX} y1={n.y} x2={stemX} y2={stemY} stroke="#111" strokeWidth="0.95" />
            </g>
          );
        })}
      </g>
    );
  };

  const bracketX = x0 - 4;

  return (
    <g>
      <line x1={bracketX} x2={bracketX} y1={trebleY - 1} y2={bassY + 4 * lineGap + 1} stroke="#111" strokeWidth="1.6" />
      <path d={`M ${bracketX - 6} ${trebleY - 3} Q ${bracketX - 12} ${(trebleY + bassY + 2 * lineGap) / 2} ${bracketX - 6} ${bassY + 4 * lineGap + 3}`} stroke="#111" strokeWidth="1.6" fill="none" />

      {renderStaff(trebleY)}
      {renderStaff(bassY)}

      <g transform={`translate(${x0 + 2}, ${trebleY + 2 * lineGap}) scale(0.85)`} fill="#111">
        <path d="M0 0 C 6 -8, 6 -22, 0 -22 C -7 -22, -7 -10, 2 -2 L 8 24 C 10 32, 4 36, 0 32 C -4 28, -2 22, 4 24" fill="none" stroke="#111" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="2" cy="24" r="2.2" fill="#111" />
      </g>
      <g transform={`translate(${x0 + 4}, ${bassY + 1 * lineGap}) scale(0.9)`} fill="#111">
        <path d="M0 0 C 6 -8, 16 -6, 16 4 C 16 14, 6 18, 0 14" fill="none" stroke="#111" strokeWidth="2" />
        <circle cx="20" cy="-1" r="1.4" fill="#111" />
        <circle cx="20" cy="7" r="1.4" fill="#111" />
      </g>

      <g fontFamily="serif" fontSize="12" fill="#111">
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <text x={x0 + 18 + i * 4} y={trebleY + 2 * lineGap + (i % 2 === 0 ? 2 : -2)}>♭</text>
            <text x={x0 + 18 + i * 4} y={bassY + 3 * lineGap + (i % 2 === 0 ? 2 : -2)}>♭</text>
          </g>
        ))}
      </g>

      {isFirstSystem && (
        <g fontFamily="serif" fontWeight="700" fontSize="14" fill="#111">
          <text x={x0 + 40} y={trebleY + 1.6 * lineGap} textAnchor="middle">4</text>
          <text x={x0 + 40} y={trebleY + 4 * lineGap} textAnchor="middle">4</text>
          <text x={x0 + 40} y={bassY + 1.6 * lineGap} textAnchor="middle">4</text>
          <text x={x0 + 40} y={bassY + 4 * lineGap} textAnchor="middle">4</text>
        </g>
      )}

      {isFirstSystem && (
        <text x={bodyX0 + 4} y={(trebleY + bassY + 4 * lineGap) / 2 + 6} fontFamily="serif" fontStyle="italic" fontSize="13" fontWeight="700" fill="#111">
          p
        </text>
      )}

      {Array.from({ length: measureCount + 1 }).map((_, i) => {
        const bx = bodyX0 + i * measureW;
        return <line key={i} x1={bx} x2={bx} y1={trebleY} y2={bassY + 4 * lineGap} stroke="#111" strokeWidth={0.8} />;
      })}

      {showActive && (
        <rect
          x={bodyX0 + activeIdx * measureW}
          y={trebleY - 4}
          width={measureW}
          height={bassY - trebleY + 4 * lineGap + 8}
          fill="#012FA7"
          fillOpacity="0.10"
          stroke="#012FA7"
          strokeOpacity="0.55"
          strokeWidth="1.2"
          rx="2"
        />
      )}

      {Array.from({ length: measureCount }).map((_, mi) => renderMeasure(mi))}

      <text x={bodyX0 + 2} y={trebleY - 6} fontFamily="serif" fontSize="9" fill="#888">
        {measureStart + 1}
      </text>
    </g>
  );
}

// =================================================================
// 2) Piano Roll
// =================================================================
export function PianoRollView({ song, currentBeat, measures, onSeek }) {
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 460 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const cr = e.contentRect;
        setSize({ w: Math.max(640, cr.width - 0), h: 460 });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const notes = useMemo(() => buildRollNotes(song, measures), [song, measures]);

  const totalBeatsLocal = measures * 4;
  const PITCH_MIN = 28;
  const PITCH_MAX = 96;
  const pitchSpan = PITCH_MAX - PITCH_MIN;
  const KEYBOARD_W = 56;
  const HEADER_H = 28;
  const MINIMAP_H = 60;
  const RULER_H = 26;
  const padR = 16;
  const padB = 12;
  const padT = 8;

  const contentW = Math.max(800, size.w - KEYBOARD_W - padR);
  const beatW = contentW / Math.min(totalBeatsLocal, 64);
  const fullW = beatW * totalBeatsLocal;

  const scrollerRef = useRef(null);
  const userLock = useRef(0);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (Date.now() < userLock.current) return;
    const px = currentBeat * beatW;
    const target = px - el.clientWidth / 2;
    el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [currentBeat, beatW]);

  const rollH = size.h - HEADER_H - MINIMAP_H - RULER_H - padT - padB;
  const pitchH = rollH / pitchSpan;

  const octaves = [];
  for (let p = Math.ceil(PITCH_MIN / 12) * 12; p <= PITCH_MAX; p += 12) octaves.push(p);

  return (
    <div ref={wrapRef} className="gs-pianoroll" style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '10px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        {song.stems.map((s) => (
          <div key={s.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
            <span style={{ fontSize: 12, color: 'var(--color-foreground)', fontWeight: 500 }}>{s.name}</span>
            <span style={{ fontSize: 11, color: 'var(--color-muted-foreground)' }}>· {s.detected}%</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-family-mono)' }}>
          Bar {Math.floor(currentBeat / 4) + 1} / {measures} · Beat {((currentBeat % 4) + 1).toFixed(0)}/4
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `${KEYBOARD_W}px 1fr`, height: rollH + RULER_H }}>
        <div style={{ background: '#0a0d24', borderRight: '1px solid rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ height: RULER_H, background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }} />
          <svg viewBox={`0 0 ${KEYBOARD_W} ${rollH}`} width={KEYBOARD_W} height={rollH} preserveAspectRatio="none">
            {Array.from({ length: pitchSpan }).map((_, i) => {
              const pitch = PITCH_MAX - i;
              const y = i * pitchH;
              const isBlack = [1, 3, 6, 8, 10].includes(pitch % 12);
              return <rect key={i} x={0} y={y} width={KEYBOARD_W} height={pitchH + 0.4} fill={isBlack ? '#0a0d24' : '#15193a'} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />;
            })}
            {octaves.map((p) => {
              const y = (PITCH_MAX - p) * pitchH;
              return (
                <g key={p}>
                  <line x1={0} x2={KEYBOARD_W} y1={y} y2={y} stroke="rgba(255,255,255,0.16)" strokeWidth="0.6" />
                  <text x={KEYBOARD_W - 4} y={y - 3} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.55)" fontFamily="var(--font-family-mono)">
                    C{Math.floor(p / 12) - 1}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div
          ref={scrollerRef}
          onWheel={() => {
            userLock.current = Date.now() + 1500;
          }}
          style={{ overflowX: 'auto', overflowY: 'hidden', position: 'relative', background: '#08091a' }}
          className="gs-row-scroll"
        >
          <svg width={fullW} height={rollH + RULER_H} style={{ display: 'block' }}>
            <rect x={0} y={0} width={fullW} height={RULER_H} fill="rgba(255,255,255,0.03)" />
            <line x1={0} x2={fullW} y1={RULER_H} y2={RULER_H} stroke="rgba(255,255,255,0.1)" />
            {Array.from({ length: measures }).map((_, m) => {
              const x = m * 4 * beatW;
              return (
                <g key={m}>
                  <line x1={x} x2={x} y1={0} y2={RULER_H + rollH} stroke={m % 4 === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)'} strokeWidth="0.6" />
                  {m % 2 === 0 && (
                    <text x={x + 4} y={RULER_H - 8} fontSize="10" fill="rgba(255,255,255,0.55)" fontFamily="var(--font-family-mono)">
                      {m + 1}
                    </text>
                  )}
                </g>
              );
            })}
            {Array.from({ length: measures * 4 }).map((_, b) => {
              if (b % 4 === 0) return null;
              const x = b * beatW;
              return <line key={'b' + b} x1={x} x2={x} y1={RULER_H} y2={RULER_H + rollH} stroke="rgba(255,255,255,0.05)" strokeWidth="0.4" />;
            })}

            {octaves.map((p) => {
              const y = RULER_H + (PITCH_MAX - p) * pitchH;
              return <line key={'oct' + p} x1={0} x2={fullW} y1={y} y2={y} stroke="rgba(255,255,255,0.10)" strokeWidth="0.5" />;
            })}

            {notes.map((n, i) => {
              const x = n.startBeat * beatW;
              const w = Math.max(2, n.lenBeat * beatW - 1);
              const y = RULER_H + (PITCH_MAX - n.pitch) * pitchH;
              const h = Math.max(3, pitchH * 1.1);
              return <rect key={i} x={x} y={y} width={w} height={h} rx={1.2} fill={n.color} fillOpacity={n.dim ? 0.45 : 0.88} stroke={n.color} strokeOpacity={0.95} strokeWidth="0.4" />;
            })}

            <line x1={currentBeat * beatW} x2={currentBeat * beatW} y1={0} y2={RULER_H + rollH} stroke="#fff" strokeWidth="1.2" />
            <polygon points={`${currentBeat * beatW - 5},0 ${currentBeat * beatW + 5},0 ${currentBeat * beatW},6`} fill="#fff" />

            <rect
              x={0}
              y={0}
              width={fullW}
              height={RULER_H + rollH}
              fill="transparent"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - r.left + (scrollerRef.current?.scrollLeft || 0) - 0;
                onSeek && onSeek(x / beatW / (measures * 4));
              }}
            />
          </svg>
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', height: MINIMAP_H, position: 'relative' }}>
        <Minimap notes={notes} totalBeats={totalBeatsLocal} progress={currentBeat / totalBeatsLocal} onSeek={onSeek} />
      </div>
    </div>
  );
}

function Minimap({ notes, totalBeats, progress, onSeek }) {
  const ref = useRef(null);
  const onClick = (e) => {
    const r = ref.current.getBoundingClientRect();
    const x = e.clientX - r.left;
    onSeek && onSeek(x / r.width);
  };
  return (
    <div ref={ref} style={{ width: '100%', height: '100%', position: 'relative', cursor: 'pointer' }} onClick={onClick}>
      <svg viewBox={`0 0 ${totalBeats} 44`} preserveAspectRatio="none" width="100%" height="100%">
        {notes.map((n, i) => (
          <rect key={i} x={n.startBeat} y={2 + (96 - n.pitch) * 0.5} width={Math.max(0.5, n.lenBeat)} height={1.1} fill={n.color} fillOpacity={0.85} />
        ))}
        <line x1={progress * totalBeats} x2={progress * totalBeats} y1={0} y2={44} stroke="#fff" strokeWidth="0.5" />
        <rect x={progress * totalBeats - 1} y={0} width={2} height={44} fill="#fff" fillOpacity="0.85" />
      </svg>
    </div>
  );
}

function buildRollNotes(song, measures) {
  const rand = mulberry32(hashStr(song.id + ':roll'));
  const totalBeats = measures * 4;
  const out = [];
  const profile = {
    Piano: { center: 60, range: 20, density: 0.65 },
    Strings: { center: 64, range: 12, density: 0.35 },
    Bass: { center: 36, range: 8, density: 0.45 },
    Pads: { center: 56, range: 14, density: 0.18 },
    Drums: { center: 44, range: 6, density: 0.85 },
    Vocals: { center: 68, range: 10, density: 0.3 },
  };
  song.stems.forEach((stem) => {
    const p = profile[stem.name] || { center: 60, range: 12, density: 0.4 };
    const stepBeats = 0.5;
    for (let b = 0; b < totalBeats; b += stepBeats) {
      if (rand() < p.density) {
        let len;
        if (stem.name === 'Bass') len = 0.5 + Math.floor(rand() * 4) * 0.5;
        else if (stem.name === 'Pads' || stem.name === 'Strings') len = 4 + rand() * 8;
        else len = 0.25 + rand() * 1.5;
        const pitch = Math.round(p.center + (rand() - 0.5) * 2 * p.range);
        out.push({
          startBeat: b,
          lenBeat: Math.min(len, totalBeats - b),
          pitch: Math.max(20, Math.min(100, pitch)),
          color: stem.color,
          dim: rand() < 0.15,
        });
      }
    }
  });
  return out;
}

// =================================================================
// 3) Stems
// =================================================================
export function StemsView({ song, currentBeat, totalBeats, stemState, onStemChange, onSeek }) {
  return (
    <div className="gs-stems-list" style={{ padding: '10px' }}>
      {song.stems.map((s) => (
        <StemRow
          key={s.name}
          stem={s}
          state={stemState[s.name]}
          onChange={(patch) => onStemChange(s.name, patch)}
          progress={currentBeat / totalBeats}
          onSeek={onSeek}
          anyMuted={Object.values(stemState).some((x) => x.solo)}
        />
      ))}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 6,
          padding: '14px 16px',
          borderRadius: 10,
          background: 'var(--color-surface-light)',
          border: '1px dashed var(--color-border-light)',
          fontSize: 12,
          color: 'var(--color-muted-foreground)',
        }}
      >
        <span>
          Sources: {song.stems.length} stems · 44.1 kHz / 24-bit · separated by{' '}
          <strong style={{ color: 'var(--color-text)' }}>GrooveSheet Demucs-v4</strong>.
        </span>
        <span>
          Total <strong style={{ color: 'var(--color-text)' }}>—5.8 dB</strong> headroom
        </span>
      </div>
    </div>
  );
}

function StemRow({ stem, state, onChange, progress, onSeek, anyMuted }) {
  const ref = useRef(null);
  const onClickWave = (e) => {
    const r = ref.current.getBoundingClientRect();
    const x = e.clientX - r.left;
    onSeek && onSeek(x / r.width);
  };

  const effectivelyMuted = state.mute || (anyMuted && !state.solo);

  return (
    <div className={`gs-stem-row ${effectivelyMuted ? 'muted' : ''} ${state.solo ? 'soloed' : ''}`} style={{ height: '168px' }}>
      <div className="gs-stem-head">
        <div style={{ minWidth: 0 }}>
          <div className="gs-stem-name" style={{ color: stem.color }}>
            {stem.name}
          </div>
          <div className="gs-stem-sub">{stem.sub}</div>
        </div>
      </div>

      <div className="gs-stem-wave-wrap" ref={ref} onClick={onClickWave} style={{ cursor: 'pointer' }}>
        <StemWaveform stem={stem} progress={progress} muted={effectivelyMuted} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
        <button className={`gs-ms-btn m ${state.mute ? 'on' : ''}`} onClick={() => onChange({ mute: !state.mute })} title="Mute">
          M
        </button>
        <button className={`gs-ms-btn s ${state.solo ? 'on' : ''}`} onClick={() => onChange({ solo: !state.solo })} title="Solo">
          S
        </button>
        <input
          className="gs-slider"
          type="range"
          min="0"
          max="100"
          step="1"
          value={state.volume}
          onChange={(e) => onChange({ volume: parseInt(e.target.value, 10) })}
          style={{ width: 90, '--fill': state.volume + '%' }}
          title={`Volume ${state.volume}%`}
        />
        <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 11, color: 'var(--color-muted-foreground)', width: 28, textAlign: 'right' }}>
          {state.volume}
        </span>
      </div>
    </div>
  );
}

function StemWaveform({ stem, progress, muted }) {
  const seed = useMemo(() => hashStr('w:' + stem.name), [stem.name]);
  const bars = useMemo(() => {
    const rand = mulberry32(seed);
    const N = 220;
    const out = [];
    for (let i = 0; i < N; i++) {
      const t = i / N;
      let amp;
      if (stem.name === 'Drums') amp = (rand() > 0.7 ? 0.85 : 0.18) * (0.6 + rand() * 0.4);
      else if (stem.name === 'Bass') amp = (0.4 + 0.6 * Math.abs(Math.sin(t * Math.PI * 2.3))) * (0.5 + rand() * 0.3);
      else if (stem.name === 'Vocals') amp = Math.abs(0.3 + 0.7 * Math.sin(t * Math.PI * 4) * Math.cos(t * Math.PI * 2)) * (0.5 + rand() * 0.4);
      else if (stem.name === 'Strings' || stem.name === 'Pads') amp = (0.45 + 0.55 * Math.abs(Math.sin(t * Math.PI * 1.6 + i * 0.03))) * (0.6 + rand() * 0.3);
      else amp = (0.25 + 0.65 * (0.5 + 0.5 * Math.sin(t * Math.PI * 3 + i * 0.02))) * (0.55 + rand() * 0.35);
      out.push(Math.max(0.06, amp));
    }
    return out;
  }, [seed, stem.name]);

  return (
    <svg viewBox="0 0 220 52" preserveAspectRatio="none" width="100%" height="100%" style={{ display: 'block', height: '126px' }} className="gs-stem-wave">
      <line x1={0} x2={220} y1={26} y2={26} stroke={stem.color} strokeOpacity={0.18} strokeWidth="0.5" />
      {bars.map((a, i) => {
        const x = i + 0.1;
        const h = 23 * a;
        const past = i / bars.length <= progress;
        return <rect key={i} x={x} y={26 - h} width={0.85} height={h * 2} rx="0.4" fill={stem.color} fillOpacity={muted ? 0.18 : past ? 0.95 : 0.45} />;
      })}
      <line x1={progress * 220} x2={progress * 220} y1={0} y2={52} stroke="#fff" strokeWidth="0.5" />
      <rect x={progress * 220 - 0.6} y={0} width={1.2} height={52} fill="#fff" fillOpacity={0.85} />
    </svg>
  );
}

// Re-export STEM_COLORS for any consumer convenience.
export { STEM_COLORS };
