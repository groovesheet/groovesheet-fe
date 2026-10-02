import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Stop, MagnifyingGlass, SpeakerHigh } from '@phosphor-icons/react';
import { useTransport } from '../../player/transport-react';
import { searchLibrary } from './useSongPlayback';
import './SongTransport.css';

/**
 * Transport + stem mixer + song picker for /bistable.
 *
 * Purely presentational over the handles `useSongPlayback` returns; it owns no
 * playback state of its own except the picker's search box. Time comes from
 * `useTransport`, which re-renders this bar per frame while playing — cheap,
 * because the canvas reads the transport directly and never re-renders.
 *
 * Hidden entirely in projection mode; the Space / arrow-key shortcuts in
 * Bistable.js are the transport there.
 */

const fmt = (sec) => {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function SongPicker({ track, onPick }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const boxRef = useRef(null);

  // Debounced search; an empty box shows the library's default page.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setBusy(true);
    setErr(null);
    const id = setTimeout(() => {
      searchLibrary(q.trim())
        .then((list) => { if (!cancelled) setResults(list); })
        .catch((e) => { if (!cancelled) setErr(e.message || 'Search failed.'); })
        .finally(() => { if (!cancelled) setBusy(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(id); };
  }, [q, open]);

  // Click-away closes the dropdown.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  return (
    <div className="bistable-song__picker" ref={boxRef}>
      <button
        type="button"
        className="bistable-song__picker-button"
        onClick={() => setOpen((v) => !v)}
        title="Choose a song"
      >
        <span className="bistable-song__picker-title">{track?.title || 'Loading…'}</span>
        <span className="bistable-song__picker-artist">{track?.artist || ''}</span>
      </button>

      {open && (
        <div className="bistable-song__menu">
          <label className="bistable-song__search">
            <MagnifyingGlass size={14} weight="bold" />
            <input
              type="text"
              value={q}
              autoFocus
              placeholder="Search the library"
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          {busy && <p className="bistable-song__menu-note">Searching…</p>}
          {err && <p className="bistable-song__menu-note">{err}</p>}
          {!busy && !err && results.length === 0 && (
            <p className="bistable-song__menu-note">No songs matched.</p>
          )}
          <ul className="bistable-song__results">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={`bistable-song__result ${r.id === track?.id ? 'is-current' : ''}`}
                  onClick={() => { onPick(r.id); setOpen(false); }}
                >
                  <span className="bistable-song__result-title">{r.title}</span>
                  <span className="bistable-song__result-artist">{r.artist}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function SongTransport({
  transport,
  track,
  loadingTrack,
  trackError,
  rollStem,
  rollError,
  stems,
  mixer,
  setStem,
  stemProgress,
  stemError,
  hasStems,
  toggle,
  seek,
  stop,
  setMasterVolume,
  onPickTrack,
}) {
  const { positionSec, isPlaying, durationSec } = useTransport(transport);
  const [scrub, setScrub] = useState(null); // non-null while dragging
  const [volume, setVolume] = useState(85);

  const onVolume = useCallback((v) => {
    setVolume(v);
    setMasterVolume(v / 100);
  }, [setMasterVolume]);

  const duration = durationSec || Number(track?.duration_sec) || 0;
  const shown = scrub != null ? scrub : positionSec;

  const loading = stemProgress && stemProgress.loaded < stemProgress.total;
  const anySolo = Object.values(mixer).some((s) => s && s.solo);

  return (
    <div className="bistable-song">
      <div className="bistable-song__row">
        <button
          type="button"
          className="bistable-song__play"
          onClick={toggle}
          disabled={!!trackError || loadingTrack}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying
            ? <Pause size={18} weight="fill" />
            : <Play size={18} weight="fill" />}
        </button>
        <button
          type="button"
          className="bistable-song__stop"
          onClick={stop}
          disabled={!!trackError || loadingTrack}
          title="Back to start"
        >
          <Stop size={14} weight="fill" />
        </button>

        <SongPicker track={track} onPick={onPickTrack} />

        <span className="bistable-song__time">{fmt(shown)}</span>
        <input
          className="bistable-song__seek"
          type="range"
          min={0}
          max={Math.max(1, duration)}
          step={0.01}
          value={Math.min(shown, Math.max(1, duration))}
          onChange={(e) => setScrub(Number(e.target.value))}
          onPointerUp={() => { if (scrub != null) { seek(scrub); setScrub(null); } }}
          onKeyUp={() => { if (scrub != null) { seek(scrub); setScrub(null); } }}
          aria-label="Seek"
        />
        <span className="bistable-song__time bistable-song__time--total">{fmt(duration)}</span>

        <label className="bistable-song__volume" title="Master volume">
          <SpeakerHigh size={15} />
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            aria-label="Master volume"
          />
        </label>
      </div>

      {loading && (
        <p className="bistable-song__note">
          Loading stems — {stemProgress.loaded} of {stemProgress.total}
          {stemProgress.phase === 'decode' ? ' (decoding)' : ''}…
        </p>
      )}
      {trackError && <p className="bistable-song__note bistable-song__note--warn">{trackError}</p>}
      {stemError && <p className="bistable-song__note bistable-song__note--warn">{stemError}</p>}
      {rollError && <p className="bistable-song__note bistable-song__note--warn">{rollError}</p>}
      {!hasStems && !loadingTrack && !trackError && (
        <p className="bistable-song__note bistable-song__note--warn">
          This track has no separated stems, so only the falling keys will play.
        </p>
      )}

      {stems.length > 0 && (
        <div className="bistable-song__mixer">
          {stems.map((s) => {
            const m = mixer[s.name] || { volume: 75, mute: false, solo: false };
            const dimmed = m.mute || (anySolo && !m.solo);
            return (
              <div
                key={s.name}
                className={`bistable-song__stem ${dimmed ? 'is-dimmed' : ''}`}
              >
                <span className="bistable-song__stem-name">
                  <i style={{ background: s.color }} />
                  {s.label}
                  {s.name === rollStem && (
                    <em title="Shown as falling keys and played by the soundfont">keys</em>
                  )}
                </span>
                <div className="bistable-song__stem-buttons">
                  <button
                    type="button"
                    className={m.mute ? 'is-on' : ''}
                    onClick={() => setStem(s.name, { mute: !m.mute })}
                    title="Mute"
                  >
                    M
                  </button>
                  <button
                    type="button"
                    className={m.solo ? 'is-on' : ''}
                    onClick={() => setStem(s.name, { solo: !m.solo })}
                    title="Solo"
                  >
                    S
                  </button>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={m.volume}
                  onChange={(e) => setStem(s.name, { volume: Number(e.target.value) })}
                  aria-label={`${s.label} volume`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
