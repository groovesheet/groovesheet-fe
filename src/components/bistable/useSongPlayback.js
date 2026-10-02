import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Midi } from '@tonejs/midi';
import { fetchLibraryTrack, fetchLibraryTracks } from '../../utils/libraryApi';
import { createTransport } from '../../player/transport';
import { createStemEngine, pickStemAssets } from '../../player/stemEngine';
import { createNoteScheduler } from './fallingNotes';

/**
 * Plays a library track underneath the /bistable keyboard: the band as real
 * separated stems, the piano part as falling notes on the keys.
 *
 * ## One clock, not two
 * The stem engine is attached to the shared transport (src/player/transport.js)
 * and made the ACTIVE engine, so `transport.getPosition()` is literally the
 * stem engine's AudioContext offset. The draw loop reads that same number to
 * place the falling notes. Visuals and audio therefore cannot drift — they are
 * not synchronised, they are the same clock read twice.
 *
 * ## Why the piano stem starts muted
 * The falling notes come from the piano TRANSCRIPTION, and they trigger the
 * soundfont as they land. Leaving the recording's piano stem up as well would
 * double the part and — where the transcription disagrees with the recording —
 * phase against itself. Muted by default, what you hear as piano is exactly
 * what you see falling. Unmute it in the mixer to compare against the original.
 *
 * ## Stems load on first play
 * `createStemEngine` fetches as soon as it is constructed, so construction is
 * deferred to the first play(): the page and the live MIDI keyboard stay
 * instant, and visitors who never press play never pay for ~4 minutes of audio
 * across six stems. It also lands the fetch inside a user gesture, which is
 * what the autoplay policy wants anyway.
 */

// Green Day — Last Night on Earth. Overridable via ?track=<uuid|slug>.
export const DEFAULT_TRACK_ID = '170fb2cc-ff6d-417b-9e97-a552b459411f';

// Shared with SongDetail's mixer so the two pages colour stems identically.
export const STEM_META = {
  vocals: { label: 'Vocals', color: '#7CC4FF' },
  drums: { label: 'Drums', color: '#FF7BA9' },
  bass: { label: 'Bass', color: '#FFC857' },
  guitar: { label: 'Guitar', color: '#84F2A6' },
  piano: { label: 'Piano', color: '#7AA2FF' },
  other: { label: 'Other', color: '#C9A0FF' },
};
const STEM_ORDER = ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other'];

// The falling notes need a PITCHED part. Piano is the point of this page;
// bass is a usable stand-in for tracks transcribed without one. Drums are
// deliberately absent — percussion numbers are not pitches and would scatter
// nonsense across the keyboard.
const ROLL_STEM_PREFERENCE = ['piano', 'bass'];

/** Pick the MIDI asset the falling-note roll should be built from. */
function pickRollMidi(assets) {
  const midis = (assets || []).filter(
    (a) => a && a.asset_type === 'midi' && a.stream_url,
  );
  for (const name of ROLL_STEM_PREFERENCE) {
    const hit = midis.find((a) => a.stem_name === name);
    if (hit) return hit;
  }
  return null;
}

/** Fetch an asset body, refetching the track once if the presigned URL expired. */
async function fetchAssetBuffer(asset, trackId) {
  const grab = async (a) => {
    const res = await fetch(a.stream_url);
    if (!res.ok) throw new Error(`asset request failed (HTTP ${res.status})`);
    return res.arrayBuffer();
  };
  try {
    return await grab(asset);
  } catch (first) {
    const fresh = await fetchLibraryTrack(trackId);
    const again = (fresh.assets || []).find((a) => a.id === asset.id);
    if (!again) throw first;
    return grab(again);
  }
}

export default function useSongPlayback({ trackId = DEFAULT_TRACK_ID } = {}) {
  const [track, setTrack] = useState(null);
  const [trackError, setTrackError] = useState(null);
  const [loadingTrack, setLoadingTrack] = useState(true);

  const [scheduler, setScheduler] = useState(null);
  const [rollStem, setRollStem] = useState(null); // which part the notes came from
  const [rollError, setRollError] = useState(null);

  const [stemProgress, setStemProgress] = useState(null); // { loaded, total, phase }
  const [stemError, setStemError] = useState(null);
  const [stemsRequested, setStemsRequested] = useState(false);
  const [mixer, setMixer] = useState({}); // name -> { volume, mute, solo }

  const transportRef = useRef(null);
  if (transportRef.current == null) transportRef.current = createTransport();
  const stemEngineRef = useRef(null);
  const masterVolRef = useRef(0.85);

  // Pause, never dispose: the transport is created during render, and React
  // StrictMode's dev double-invoke runs this cleanup once before the real
  // mount. Disposing would leave the ref holding a permanently dead transport
  // (refs survive the simulated unmount), and every later play() a no-op.
  // SongDetail carries the same note for the same reason.
  useEffect(() => () => {
    stemEngineRef.current?.dispose();
    stemEngineRef.current = null;
    transportRef.current?.pause();
  }, []);

  // ---- track ---------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setLoadingTrack(true);
    setTrackError(null);
    setScheduler(null);
    setRollStem(null);
    setRollError(null);
    setStemError(null);
    setStemProgress(null);
    setStemsRequested(false);

    // A track switch must not leave the previous song's audio running.
    const t = transportRef.current;
    if (stemEngineRef.current) {
      t.detachEngine('stems');
      stemEngineRef.current.dispose();
      stemEngineRef.current = null;
    }
    t.pause();
    t.seek(0);

    (async () => {
      try {
        const data = await fetchLibraryTrack(trackId);
        if (cancelled) return;
        setTrack(data);
        t.setDuration(Number(data.duration_sec) || 0);
      } catch (err) {
        if (!cancelled) setTrackError(err.message || 'Could not load the track.');
      } finally {
        if (!cancelled) setLoadingTrack(false);
      }
    })();

    return () => { cancelled = true; };
  }, [trackId]);

  // ---- falling-note roll (piano MIDI) --------------------------------------
  useEffect(() => {
    if (!track) return undefined;
    let cancelled = false;
    const asset = pickRollMidi(track.assets);
    if (!asset) {
      setRollError('This track has no transcribed piano or bass part, so there are no falling keys.');
      return undefined;
    }
    (async () => {
      try {
        const buf = await fetchAssetBuffer(asset, track.id);
        if (cancelled) return;
        const midi = new Midi(buf);
        const notes = midi.tracks.flatMap((tr) => tr.notes);
        setScheduler(createNoteScheduler(notes));
        setRollStem(asset.stem_name);
        setRollError(null);
      } catch (err) {
        if (!cancelled) setRollError(err.message || 'Could not load the falling keys.');
      }
    })();
    return () => { cancelled = true; };
  }, [track]);

  // ---- stems ---------------------------------------------------------------
  const stems = useMemo(() => {
    const names = Array.from(pickStemAssets(track?.assets).keys());
    const ordered = STEM_ORDER.filter((n) => names.includes(n))
      .concat(names.filter((n) => !STEM_ORDER.includes(n)));
    return ordered.map((name) => ({
      name,
      label: STEM_META[name]?.label || name.charAt(0).toUpperCase() + name.slice(1),
      color: STEM_META[name]?.color || '#8d8c8d',
    }));
  }, [track]);

  const hasStems = stems.length > 0;

  // Seed the mix per track: everything up, the roll's own stem muted so the
  // soundfont is the only voice for the part shown on the keys.
  useEffect(() => {
    if (!stems.length) { setMixer({}); return; }
    const silenced = rollStem || 'piano';
    setMixer(() => {
      const next = {};
      stems.forEach((s) => {
        next[s.name] = { volume: 75, mute: s.name === silenced, solo: false };
      });
      return next;
    });
  }, [stems, rollStem]);

  /** Build the engine on demand — see the "load on first play" note above. */
  const ensureStemEngine = useCallback(() => {
    if (stemEngineRef.current || !track || !hasStems) return stemEngineRef.current;
    setStemsRequested(true);
    setStemError(null);
    const engine = createStemEngine({
      assets: track.assets,
      onProgress: (p) => setStemProgress(p),
      onError: (err) => setStemError(err.message || 'Could not load the stems.'),
      refreshAssets: async () => (await fetchLibraryTrack(track.id)).assets,
    });
    engine.setMasterVolume(masterVolRef.current);
    stemEngineRef.current = engine;
    const t = transportRef.current;
    t.attachEngine(engine);
    t.setActiveEngine('stems'); // stems become the master clock
    return engine;
  }, [track, hasStems]);

  // Push mixer state into the engine. Multi-solo UI semantics collapse into
  // per-stem mutes, matching how SongDetail drives the same engine.
  useEffect(() => {
    const eng = stemEngineRef.current;
    if (!eng) return;
    const anySolo = Object.values(mixer).some((s) => s && s.solo);
    Object.entries(mixer).forEach(([name, s]) => {
      if (!s) return;
      eng.setStemGain(name, s.volume / 100);
      eng.setStemMuted(name, s.mute || (anySolo && !s.solo));
    });
  }, [mixer, stemsRequested]);

  // ---- transport controls ---------------------------------------------------
  const play = useCallback(() => {
    ensureStemEngine();
    transportRef.current.play();
  }, [ensureStemEngine]);

  const pause = useCallback(() => transportRef.current.pause(), []);

  const toggle = useCallback(() => {
    if (transportRef.current.getState().isPlaying) transportRef.current.pause();
    else play();
  }, [play]);

  const seek = useCallback((sec) => transportRef.current.seek(sec), []);

  const seekBy = useCallback((delta) => {
    const t = transportRef.current;
    t.seek(Math.max(0, t.getPosition() + delta));
  }, []);

  const stop = useCallback(() => {
    const t = transportRef.current;
    t.pause();
    t.seek(0);
  }, []);

  const setMasterVolume = useCallback((v01) => {
    masterVolRef.current = Math.max(0, Math.min(1, v01));
    stemEngineRef.current?.setMasterVolume(masterVolRef.current);
  }, []);

  const setStem = useCallback((name, patch) => {
    setMixer((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }));
  }, []);

  return {
    transport: transportRef.current,
    track,
    trackError,
    loadingTrack,
    scheduler,
    rollStem,
    rollError,
    stems,
    hasStems,
    mixer,
    setStem,
    stemProgress,
    stemError,
    stemsRequested,
    play,
    pause,
    toggle,
    seek,
    seekBy,
    stop,
    setMasterVolume,
  };
}

/** Search the public library for the song picker. */
export async function searchLibrary(q) {
  const data = await fetchLibraryTracks({ q, limit: 12 });
  return data.tracks || [];
}
