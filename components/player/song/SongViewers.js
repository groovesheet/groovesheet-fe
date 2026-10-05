// The three synchronized viewers for the song detail page:
//   <SheetMusicView/>  — real OSMD engraving (musicxml asset), cursor follows transport
//   <PianoRollView/>   — canvas piano roll from the parsed MIDI asset, playhead from transport
//   <StemsView/>       — real waveforms from thumb_data.stems, per-stem mute/solo/volume
// All views read the shared transport (src/player/transport.js) for time; none
// of them keeps its own clock.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Midi } from '@tonejs/midi';
import { useTranslations } from 'next-intl';
import OSMDViewer from '../PreviewPanel/OSMDViewer';
import SkeletonPanel from '@/components/ui/SkeletonPanel';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import StatusMessage from '@/components/ui/StatusMessage';

// =================================================================
// 1) Sheet Music — OSMD
// =================================================================
// `footer` renders under the engraved page, inside the same scroll container —
// used by the preview result view to continue the page into a blurred teaser.
export function SheetMusicView({ musicXmlText, loading, error, osmdRef, onPlaybackStateChange, onSeekRequest, footer }) {
  const tv = useTranslations('song.viewers');
  // A score with no sounding notes (e.g. piano transcription of a track that
  // has no piano) makes OSMD's cursor init throw inside render() — never
  // mount the viewer for one, show an explanatory empty state instead.
  const hasNotes = useMemo(
    () => !musicXmlText || /<pitch[\s>]|<unpitched[\s>]/.test(musicXmlText),
    [musicXmlText]
  );

  // Phones render the score into a ~330px column. At the desktop zoom of 0.8
  // OSMD fits barely a measure per system, so the page becomes a ~10,000px
  // scroll and the title/composer credits collide on top of each other.
  // Scale the zoom (and claw back the side padding) with the viewport.
  const isNarrow = useMediaQuery('(max-width: 768px)');
  const isTiny = useMediaQuery('(max-width: 480px)');
  const sheetZoom = isTiny ? 0.5 : isNarrow ? 0.62 : 0.8;
  const sheetPad = isTiny ? '8px 6px 24px' : isNarrow ? '12px 10px 32px' : '24px 24px 48px';

  return (
    <div
      className="gs-sheet-scroll"
      style={{
        height: isNarrow ? 'min(72dvh, 980px)' : 'min(78vh, 980px)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        background: 'rgba(0,0,0,0.18)',
        padding: sheetPad,
      }}
    >
      {loading && (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-muted-foreground)', fontSize: 13 }}>
          {tv('loadingScore')}
        </div>
      )}
      {error && (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-muted-foreground)', fontSize: 13 }}>
          {error}
        </div>
      )}
      {!loading && !error && musicXmlText && !hasNotes && (
        <div style={{ maxWidth: 560, margin: '48px auto 0' }}>
          <StatusMessage variant="info" title={tv('noNotesTitle')}>
            {tv('noNotesBody')}
          </StatusMessage>
        </div>
      )}
      {!loading && !error && musicXmlText && hasNotes && (
        <div className="gs-sheet-page" style={{ maxWidth: 860, margin: '0 auto' }}>
          <OSMDViewer
            ref={osmdRef}
            xmlString={musicXmlText}
            theme="light"
            zoom={sheetZoom}
            drawTitle
            drawComposer={!isNarrow}
            drawLyricist={!isNarrow}
            drawCredits={!isNarrow}
            drawMetronomeMarks={false}
            onPlaybackStateChange={onPlaybackStateChange}
            onSeekRequest={onSeekRequest}
            containerStyle={{ minHeight: 600, padding: 0 }}
          />
        </div>
      )}
      {!loading && !error && musicXmlText && hasNotes && footer}
    </div>
  );
}

// =================================================================
// 2) Piano Roll — canvas, real MIDI notes
// =================================================================
// Same rendering approach as PreviewPanel/tabs/PianoRollTab.js (parse with
// @tonejs/midi, draw in a rAF loop, read transport.getPosition() each frame)
// but laid out horizontally: time → x, pitch → y, playhead fixed at 25%.
const ROLL_TRACK_COLORS = ['#7AA2FF', '#FF7BA9', '#FFC857', '#84F2A6', '#C9A0FF', '#5EE7DF'];
const ROLL_WINDOW_SEC = 12; // visible time span
const ROLL_PLAYHEAD_FRAC = 0.25; // playhead position within the window
const ROLL_RULER_H = 24;
const ROLL_GUTTER_W = 46;
// Vertical fit. A whole part routinely spans six octaves (a piano part from
// A0 to A7) while any 12-second window uses two, so a part-wide scale leaves
// the notes on screen as thin dashes in one band of an empty grid. The pitch
// range follows the notes around the playhead instead: the lowest to highest
// note from the window's left edge to a little past its right edge (so the
// range opens before a note scrolls in), padded, never under two octaves, and
// eased so the grid glides rather than jumps.
const ROLL_FIT_LOOKAHEAD_SEC = 3;
const ROLL_FIT_PAD = 3; // semitones above and below the outermost notes
const ROLL_FIT_MIN_SPAN = 24; // never zoom tighter than two octaves
const ROLL_FIT_EASE_SEC = 0.35; // time constant of the range glide
// Drum rows never grow taller than this; a three-piece part stays compact and
// is centred in the canvas instead of turning into three huge bands.
const ROLL_DRUM_ROW_MAX_H = 56;

// General MIDI percussion → kit piece, listed top to bottom in the order a
// drum roll reads (cymbals over hats over toms over snare over kick). Toms get
// one row per pitch, numbered from the highest, so a fill stays readable.
const DRUM_PIECES = [
  { key: 'crash', midis: [49, 57] },
  { key: 'china', midis: [52] },
  { key: 'splash', midis: [55] },
  { key: 'ride', midis: [51, 59] },
  { key: 'rideBell', midis: [53] },
  { key: 'cowbell', midis: [56] },
  { key: 'tambourine', midis: [54] },
  { key: 'openHat', midis: [46] },
  { key: 'closedHat', midis: [42] },
  { key: 'pedalHat', midis: [44] },
  { key: 'tom', midis: [50, 48, 47, 45, 43, 41], perPitch: true },
  { key: 'clap', midis: [39] },
  { key: 'sideStick', midis: [37] },
  { key: 'snare', midis: [38, 40] },
  { key: 'kick', midis: [35, 36] },
];
const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const pitchName = (p) => `${PITCH_NAMES[p % 12]}${Math.floor(p / 12) - 1}`;

/**
 * Rows for a percussion part: only pieces that actually occur, labelled with
 * the kit piece. Pitches outside the GM map keep a row of their own, labelled
 * by pitch name, above the kit. Returns { rows: [{ label }], rowOf: Map }.
 */
function drumRowsFor(notes, label) {
  const used = new Set(notes.map((n) => n.midi));
  const rows = [];
  const rowOf = new Map();
  const mapped = new Set();
  DRUM_PIECES.forEach((piece) => piece.midis.forEach((m) => mapped.add(m)));
  [...used].filter((m) => !mapped.has(m)).sort((a, b) => b - a).forEach((m) => {
    rowOf.set(m, rows.length);
    rows.push({ label: pitchName(m) });
  });
  DRUM_PIECES.forEach((piece) => {
    const present = piece.midis.filter((m) => used.has(m));
    if (!present.length) return;
    if (piece.perPitch) {
      present.forEach((m, i) => {
        rowOf.set(m, rows.length);
        rows.push({ label: present.length > 1 ? `${label(piece.key)} ${i + 1}` : label(piece.key) });
      });
      return;
    }
    present.forEach((m) => rowOf.set(m, rows.length));
    rows.push({ label: label(piece.key) });
  });
  return { rows, rowOf };
}

function fmtClock(s) {
  const m = Math.floor(s / 60);
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  return `${m}:${ss}`;
}

// `ghosts` — other pitched instruments' MIDI, rendered faint behind the
// selected one so switching instruments keeps musical context:
//   [{ name, color, buffer: ArrayBuffer }]
// `percussion`: the part is a drum kit (General MIDI channel 10): rows are
// kit pieces instead of pitches. Files that put every note on channel 10 are
// detected without it.
export function PianoRollView({ midiBuffer, transport, loading, error, ghosts, percussion = false }) {
  const tv = useTranslations('song.viewers');
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const transportRef = useRef(transport);
  const parsedRef = useRef(null); // { notes, ghostNotes, drums, boundLo, boundHi, firstTime, gutterW }
  const [parseError, setParseError] = useState(null);
  // Start time of the first note while it is still beyond the visible window
  // (a long intro would otherwise show an empty grid), else null.
  const [laterStart, setLaterStart] = useState(null);

  useEffect(() => { transportRef.current = transport; }, [transport]);

  useEffect(() => {
    if (!midiBuffer || !canvasRef.current) return undefined;
    let midi;
    try {
      midi = new Midi(midiBuffer);
    } catch (e) {
      setParseError(tv('midiParseError'));
      return undefined;
    }
    setParseError(null);

    const tracks = midi.tracks.filter((t) => t.notes && t.notes.length);
    const notes = tracks
      .flatMap((t, ti) =>
        t.notes.map((n) => ({
          time: n.time,
          duration: n.duration,
          midi: n.midi,
          color: ROLL_TRACK_COLORS[ti % ROLL_TRACK_COLORS.length],
        }))
      )
      .sort((a, b) => a.time - b.time);
    const isDrums = percussion || (tracks.length > 0 && tracks.every((t) => t.channel === 9));
    // Non-selected instruments' notes, drawn first at very low opacity. They
    // never widen the pitch range: off-range ghosts are simply clipped.
    const ghostNotes = [];
    if (!isDrums) {
      (ghosts || []).forEach((g) => {
        if (!g || !g.buffer) return;
        let gm;
        try {
          gm = new Midi(g.buffer);
        } catch (e) {
          return; // a bad ghost file never blocks the main roll
        }
        gm.tracks.forEach((t) => {
          (t.notes || []).forEach((n) => {
            ghostNotes.push({ time: n.time, duration: n.duration, midi: n.midi, color: g.color || '#8d8c8d' });
          });
        });
      });
    }
    let partMin = 127;
    let partMax = 0;
    notes.forEach((n) => {
      if (n.midi < partMin) partMin = n.midi;
      if (n.midi > partMax) partMax = n.midi;
    });
    if (!notes.length) { partMin = 48; partMax = 72; }
    // The furthest the fitted range may reach: the part's own notes, padded,
    // widened to the minimum span and kept inside MIDI 0..127.
    let boundLo = partMin - ROLL_FIT_PAD;
    let boundHi = partMax + ROLL_FIT_PAD;
    const short = ROLL_FIT_MIN_SPAN - (boundHi - boundLo);
    if (short > 0) {
      boundLo -= short / 2;
      boundHi += short / 2;
    }
    if (boundLo < 0) { boundHi -= boundLo; boundLo = 0; }
    if (boundHi > 127) { boundLo -= boundHi - 127; boundHi = 127; }
    const drums = isDrums ? drumRowsFor(notes, (key) => tv(`drumPieces.${key}`)) : null;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let gutterW = ROLL_GUTTER_W;
    if (drums) {
      ctx.font = '11px sans-serif';
      drums.rows.forEach((r) => {
        gutterW = Math.max(gutterW, Math.ceil(ctx.measureText(r.label).width) + 16);
      });
    }
    parsedRef.current = {
      notes,
      ghostNotes,
      drums,
      boundLo,
      boundHi,
      firstTime: notes.length ? notes[0].time : 0,
      gutterW,
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    // Pitch range target for the window [from, to]: outermost notes, padded,
    // at least ROLL_FIT_MIN_SPAN wide, kept inside the part's own range.
    const fitRange = (parsed, from, to) => {
      let lo = 128;
      let hi = -1;
      for (let i = 0; i < parsed.notes.length; i += 1) {
        const n = parsed.notes[i];
        if (n.time > to) break; // sorted by start time
        if (n.time + n.duration < from) continue;
        if (n.midi < lo) lo = n.midi;
        if (n.midi > hi) hi = n.midi;
      }
      if (hi < 0) return null;
      lo -= ROLL_FIT_PAD;
      hi += ROLL_FIT_PAD;
      const grow = ROLL_FIT_MIN_SPAN - (hi - lo);
      if (grow > 0) {
        lo -= grow / 2;
        hi += grow / 2;
      }
      // Slide (not squeeze) back inside the part's own padded range.
      const { boundLo, boundHi } = parsed;
      if (lo < boundLo) { hi += boundLo - lo; lo = boundLo; }
      if (hi > boundHi) { lo -= hi - boundHi; hi = boundHi; }
      return { lo: Math.max(boundLo, lo), hi };
    };

    let view = null; // eased { lo, hi } pitch range, fractional
    let lastFrame = 0;
    let shownLater = null;

    const render = (now) => {
      const parsed = parsedRef.current;
      const t = transportRef.current;
      const pos = t ? t.getPosition() : 0;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // background
      ctx.fillStyle = '#151515';
      ctx.fillRect(0, 0, w, h);

      const gw = parsed.gutterW;
      const rollX = gw;
      const rollW = w - gw;
      const rollY = ROLL_RULER_H;
      const rollH = h - ROLL_RULER_H;
      const leftTime = pos - ROLL_WINDOW_SEC * ROLL_PLAYHEAD_FRAC;
      const rightTime = leftTime + ROLL_WINDOW_SEC;
      const pxPerSec = rollW / ROLL_WINDOW_SEC;

      // Long intro: point at where the notes begin instead of an empty grid.
      const later = parsed.notes.length && parsed.firstTime > rightTime ? parsed.firstTime : null;
      if (later !== shownLater) {
        shownLater = later;
        setLaterStart(later);
      }

      // Row geometry. yOf(note) is the top edge of the note's row.
      let rowH;
      let yOf;
      let rowsTop = rollY;
      if (parsed.drums) {
        const n = Math.max(1, parsed.drums.rows.length);
        rowH = Math.min(rollH / n, ROLL_DRUM_ROW_MAX_H);
        rowsTop = rollY + (rollH - rowH * n) / 2;
        yOf = (midi) => rowsTop + parsed.drums.rowOf.get(midi) * rowH;
      } else {
        const target =
          fitRange(parsed, leftTime, rightTime + ROLL_FIT_LOOKAHEAD_SEC) ||
          (view ? null : fitRange(parsed, parsed.firstTime, parsed.firstTime + ROLL_WINDOW_SEC)) ||
          view || { lo: parsed.boundLo, hi: parsed.boundHi };
        if (!view) {
          view = { ...target };
        } else {
          const dt = Math.min(0.25, Math.max(0, (now - lastFrame) / 1000));
          const k = 1 - Math.exp(-dt / ROLL_FIT_EASE_SEC);
          view.lo += (target.lo - view.lo) * k;
          view.hi += (target.hi - view.hi) * k;
        }
        rowH = rollH / (view.hi - view.lo + 1);
        const top = view.hi;
        yOf = (midi) => rollY + (top - midi) * rowH;
      }
      lastFrame = now;

      // Everything below the ruler is clipped to the roll's own band, so a
      // row half-scrolled out of range never paints over the time ruler.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, rollY, w, rollH);
      ctx.clip();

      // pitch rows + keyboard gutter
      ctx.fillStyle = '#1f1f1f';
      ctx.fillRect(0, 0, gw, h);
      if (parsed.drums) {
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        parsed.drums.rows.forEach((r, i) => {
          const y = rowsTop + i * rowH;
          if (i % 2 === 1) {
            ctx.fillStyle = 'rgba(255,255,255,0.025)';
            ctx.fillRect(rollX, y, rollW, rowH);
          }
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.beginPath();
          ctx.moveTo(0, y + rowH);
          ctx.lineTo(w, y + rowH);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillText(r.label, gw - 8, y + rowH / 2);
        });
        ctx.textBaseline = 'alphabetic';
      } else {
        for (let p = Math.floor(view.lo) - 1; p <= Math.ceil(view.hi) + 1; p += 1) {
          if (p < 0 || p > 127) continue;
          const y = yOf(p);
          const isBlack = [1, 3, 6, 8, 10].includes(p % 12);
          if (isBlack) {
            ctx.fillStyle = 'rgba(255,255,255,0.025)';
            ctx.fillRect(rollX, y, rollW, rowH);
          }
          if (p % 12 === 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.beginPath();
            ctx.moveTo(0, y + rowH);
            ctx.lineTo(w, y + rowH);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.font = '9px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`C${Math.floor(p / 12) - 1}`, gw - 5, y + rowH - 2);
          }
        }
      }
      ctx.restore();

      // time ruler + second gridlines
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(rollX, 0, rollW, ROLL_RULER_H);
      const firstSec = Math.max(0, Math.floor(leftTime));
      for (let s = firstSec; s <= rightTime + 1; s += 1) {
        const x = rollX + (s - leftTime) * pxPerSec;
        if (x < rollX || x > w) continue;
        const major = s % 5 === 0;
        ctx.strokeStyle = major ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.moveTo(x, major ? 0 : ROLL_RULER_H);
        ctx.lineTo(x, h);
        ctx.stroke();
        if (major) {
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.font = '10px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(fmtClock(s), x + 4, 15);
        }
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(rollX, rollY, rollW, rollH);
      ctx.clip();

      // ghost notes — other instruments, faint, under the selected one
      (parsed.ghostNotes || []).forEach((n) => {
        if (n.time + n.duration < leftTime || n.time > rightTime) return;
        const x = rollX + (n.time - leftTime) * pxPerSec;
        const nw = Math.max(2, n.duration * pxPerSec - 1);
        const y = yOf(n.midi);
        const nh = Math.max(3, rowH - 1);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = 0.09;
        ctx.fillRect(Math.max(rollX, x), y, nw - Math.max(0, rollX - x), nh);
        ctx.globalAlpha = 1;
      });

      // notes. Drum hits are centred bars in their piece's row; pitched notes
      // fill their semitone row.
      const drumH = Math.max(3, Math.min(rowH - 6, 16));
      parsed.notes.forEach((n) => {
        if (n.time + n.duration < leftTime || n.time > rightTime) return;
        const x = rollX + (n.time - leftTime) * pxPerSec;
        const nw = Math.max(parsed.drums ? 4 : 2, n.duration * pxPerSec - 1);
        const y = parsed.drums ? yOf(n.midi) + (rowH - drumH) / 2 : yOf(n.midi);
        const nh = parsed.drums ? drumH : Math.max(3, rowH - 1);
        const isPast = n.time + n.duration < pos;
        ctx.fillStyle = n.color;
        ctx.globalAlpha = isPast ? 0.4 : 0.88;
        ctx.fillRect(Math.max(rollX, x), y, nw - Math.max(0, rollX - x), nh);
        ctx.globalAlpha = 1;
      });
      ctx.restore();

      // playhead
      const phX = rollX + (pos - leftTime) * pxPerSec;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(phX, 0);
      ctx.lineTo(phX, h);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(phX - 5, 0);
      ctx.lineTo(phX + 5, 0);
      ctx.lineTo(phX, 7);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 1;

      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [midiBuffer, ghosts, percussion]);

  const onClickSeek = useCallback((e) => {
    const t = transportRef.current;
    const parsed = parsedRef.current;
    const canvas = canvasRef.current;
    if (!t || !parsed || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < parsed.gutterW) return;
    const rollW = rect.width - parsed.gutterW;
    const pos = t.getPosition();
    const leftTime = pos - ROLL_WINDOW_SEC * ROLL_PLAYHEAD_FRAC;
    const target = leftTime + ((x - parsed.gutterW) / rollW) * ROLL_WINDOW_SEC;
    t.seek(Math.max(0, target));
  }, []);

  // Seek to a second before the first note so it scrolls in right after the
  // playhead.
  const jumpToFirstNote = useCallback(() => {
    const t = transportRef.current;
    if (t && laterStart != null) t.seek(Math.max(0, laterStart - 1));
  }, [laterStart]);

  return (
    <div className="gs-pianoroll" style={{ position: 'relative' }}>
      {loading && (
        <div style={{ padding: 24 }}>
          <SkeletonPanel count={1} height={200} />
        </div>
      )}
      {(error || parseError) && !loading && (
        <div style={{ padding: 24 }}>
          <StatusMessage variant="error">{error || parseError}</StatusMessage>
        </div>
      )}
      {!loading && !error && midiBuffer && (
        <canvas
          ref={canvasRef}
          onClick={onClickSeek}
          style={{ display: 'block', width: '100%', height: 460, cursor: 'pointer' }}
        />
      )}
      {!loading && !error && midiBuffer && laterStart != null && (
        <button
          type="button"
          className="gs-roll-later"
          onClick={jumpToFirstNote}
          title={tv('jumpToFirstNote')}
        >
          {tv('notesStartAt', { time: fmtClock(laterStart) })}
        </button>
      )}
    </div>
  );
}

// =================================================================
// 3) Stems — real waveforms from thumb_data.stems
// =================================================================
// `stems` rows: [{ name, label, color, sub, wave: number[] /* 0-100 */ }]
// The playhead/progress is driven imperatively: one rAF loop writes a CSS
// variable (--gs-prog, a percentage) on the list element, and each row's
// bright-waveform clip + playhead line are pure CSS off that variable — no
// React re-render per frame.
export function StemsView({
  stems,
  stemState,
  onStemChange,
  onSeek,
  transport,
  statusText,
  separatorName = 'GrooveSheet AI',
  // Stem audio is still downloading: rows exist but have no waveform yet.
  // Without this the empty-wave placeholder reads as a real, silent stem.
  loading = false,
}) {
  const tv = useTranslations('song.viewers');
  const listRef = useRef(null);

  useEffect(() => {
    if (!transport) return undefined;
    let raf;
    const tick = () => {
      const el = listRef.current;
      if (el) {
        const st = transport.getState();
        const p = st.durationSec > 0 ? Math.max(0, Math.min(1, st.positionSec / st.durationSec)) : 0;
        el.style.setProperty('--gs-prog', `${(p * 100).toFixed(3)}%`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [transport]);

  const anySolo = Object.values(stemState).some((x) => x && x.solo);

  return (
    <div className="gs-stems-list" ref={listRef} style={{ padding: '10px' }}>
      {stems.map((s) => (
        <StemRow
          key={s.name}
          stem={s}
          state={stemState[s.name] || { mute: false, solo: false, volume: 75 }}
          onChange={(patch) => onStemChange(s.name, patch)}
          onSeek={onSeek}
          anySolo={anySolo}
          loading={loading}
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
          {tv('stemSources', { count: stems.length, separator: separatorName })}
        </span>
        {statusText && <span>{statusText}</span>}
      </div>
    </div>
  );
}

function StemRow({ stem, state, onChange, onSeek, anySolo, loading }) {
  const tv = useTranslations('song.viewers');
  const tp = useTranslations('song.playback');
  const ref = useRef(null);
  const onClickWave = (e) => {
    const r = ref.current.getBoundingClientRect();
    const x = e.clientX - r.left;
    onSeek && onSeek(Math.max(0, Math.min(1, x / r.width)));
  };

  const effectivelyMuted = state.mute || (anySolo && !state.solo);

  return (
    <div className={`gs-stem-row ${effectivelyMuted ? 'muted' : ''} ${state.solo ? 'soloed' : ''}`} style={{ height: '168px' }}>
      <div className="gs-stem-head">
        <div style={{ minWidth: 0 }}>
          <div className="gs-stem-name" style={{ color: stem.color }}>
            {stem.label}
          </div>
          {stem.sub && <div className="gs-stem-sub">{stem.sub}</div>}
        </div>
      </div>

      <div
        className="gs-stem-wave-wrap"
        ref={ref}
        onClick={onClickWave}
        style={{ cursor: 'pointer', position: 'relative' }}
      >
        <StemWaveform stem={stem} muted={effectivelyMuted} loading={loading} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
        <button className={`gs-ms-btn m ${state.mute ? 'on' : ''}`} onClick={() => onChange({ mute: !state.mute })} title={tp('mute')}>
          M
        </button>
        <button className={`gs-ms-btn s ${state.solo ? 'on' : ''}`} onClick={() => onChange({ solo: !state.solo })} title={tv('solo')}>
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
          title={tv('volume', { value: state.volume })}
        />
        <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 11, color: 'var(--color-muted-foreground)', width: 28, textAlign: 'right' }}>
          {state.volume}
        </span>
      </div>
    </div>
  );
}

function StemWaveform({ stem, muted, loading }) {
  // Real waveform: `stem.wave` is thumb_data.stems[name] — 0..100 ints.
  const hasWave = Array.isArray(stem.wave) && stem.wave.length > 0;
  const bars = useMemo(() => {
    const src = Array.isArray(stem.wave) && stem.wave.length ? stem.wave : [];
    if (!src.length) return new Array(200).fill(0.08); // no thumb → flat baseline
    return src.map((v) => Math.max(0.04, Math.min(1, (Number(v) || 0) / 100)));
  }, [stem.wave]);

  // Still fetching: the flat baseline would otherwise pass for a real reading
  // of a silent stem. Breathe it instead, the way SkeletonPanel does.
  const pending = loading && !hasWave;

  const N = bars.length;
  const barW = 220 / N;

  const renderBars = (opacity) =>
    bars.map((a, i) => {
      const x = i * barW + barW * 0.1;
      const h = 23 * a;
      return <rect key={i} x={x} y={26 - h} width={barW * 0.8} height={h * 2} rx="0.4" fill={stem.color} fillOpacity={opacity} />;
    });

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '126px' }}
      className={pending ? 'gs-stem-wave-pending' : undefined}
      aria-busy={pending || undefined}
    >
      {/* dim (unplayed) layer */}
      <svg
        viewBox="0 0 220 52"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        style={{ display: 'block' }}
        className="gs-stem-wave"
      >
        <line x1={0} x2={220} y1={26} y2={26} stroke={stem.color} strokeOpacity={0.18} strokeWidth="0.5" />
        {renderBars(muted ? 0.18 : 0.45)}
      </svg>
      {/* bright (played) layer, clipped at the playhead via --gs-prog */}
      <svg
        viewBox="0 0 220 52"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        className="gs-stem-wave"
        style={{
          display: 'block',
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          clipPath: 'inset(0 calc(100% - var(--gs-prog, 0%)) 0 0)',
        }}
      >
        {renderBars(muted ? 0.18 : 0.95)}
      </svg>
      {/* playhead */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 'var(--gs-prog, 0%)',
          width: 1.5,
          background: '#fff',
          opacity: 0.85,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
