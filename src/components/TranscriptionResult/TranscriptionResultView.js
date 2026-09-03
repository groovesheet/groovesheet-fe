// Full-screen transcription result — shown inside the Hero upload card once a
// job completes. Mirrors the /explore/:songId viewer stack (PlaybackBar +
// Sheet / Piano roll / Stems tabs on one shared transport) but is fed from
// workflow/preview outputs instead of library assets.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, DownloadSimple, File, X } from '@phosphor-icons/react';
import { Drum } from 'lucide-react';
import { useAuth, useUser } from '../../auth';
import { useTheme } from '../../context/ThemeContext';
import config from '../../config';
import { downloadWorkflowFile, fetchMidiArrayBuffer, fetchMusicXmlText } from '../../utils/api';
import {
  MIDI_KEY_BY_INSTRUMENT,
  musicXmlKeysFor,
  truncateMidiToSeconds,
  truncateMusicXmlToMeasures,
} from '../PreviewPanel/previewUtils';
import { SheetMusicView, PianoRollView, StemsView } from '../song/SongViewers';
import FretboardView from '../song/FretboardView';
import SpectrogramView from '../song/SpectrogramView';
import DrumKitView from './DrumKitView';
import PlaybackBar from '../song/PlaybackBar';
import { Icon } from '../song/icons';
import StatusMessage from '../ui/StatusMessage';
import { createTransport } from '../../player/transport';
import { useTransport } from '../../player/transport-react';
import { createStemEngine } from '../../player/stemEngine';
import { createMidiEngine } from '../../player/midiEngine';
import { createSheetSecMapper, parseSyncMap, musicXmlHasVariableTempo } from '../../player/syncMap';
import { applyMusicXmlMetadata, titleFromFilename } from '../../utils/musicXmlMetadata';
import '../song/Song.css';
import './TranscriptionResult.css';

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// Drums viewer outputs — the beat-tracked ADToF+ chain. The engraved score
// carries per-bar hidden tempo marks that OSMD ignores, so cursor sync runs
// through the sync map below; the quantized MIDI is aligned to the real audio.
// TODO: consolidate into api.js key maps
const DRUMS_MIDI_KEY = 'adtof_plus_drums_quantized_midi';
const DRUMS_SYNC_MAP_KEY = 'adtof_plus_drums_sync_map';

// Hero instrument value → BS-Roformer stem download key.
const STEM_KEY_BY_INSTRUMENT = {
  drums: 'bs_roformer_drums_stem',
  piano: 'bs_roformer_piano_stem',
  bass: 'bs_roformer_bass_stem',
  jazz_bass: 'bs_roformer_bass_stem',
  bass_separation: 'bs_roformer_bass_stem',
  vocals: 'bs_roformer_vocals_stem',
  guitar: 'bs_roformer_guitar_stem',
  other: 'bs_roformer_other_stem',
};

// Hero instrument value → stem_name + display meta (Explore palette).
const STEM_DISPLAY = {
  drums: { name: 'drums', label: 'Drums', color: '#FF7BA9', sub: 'kit · percussion' },
  piano: { name: 'piano', label: 'Piano', color: '#7AA2FF', sub: 'keys · harmonic' },
  bass: { name: 'bass', label: 'Bass', color: '#FFC857', sub: 'sub · low end' },
  jazz_bass: { name: 'bass', label: 'Bass', color: '#FFC857', sub: 'sub · low end' },
  bass_separation: { name: 'bass', label: 'Bass', color: '#FFC857', sub: 'sub · low end' },
  vocals: { name: 'vocals', label: 'Vocals', color: '#7CC4FF', sub: 'lead · voice' },
  guitar: { name: 'guitar', label: 'Guitar', color: '#84F2A6', sub: 'strings · plucked' },
  other: { name: 'other', label: 'Other', color: '#C9A0FF', sub: 'texture · residual' },
};

// Tab 2's view follows the transcribed stem, mirroring SongDetail's
// viewForStem: drums -> kit view, guitar/bass -> fretboard, everything
// else -> piano roll.
const viewForStem = (name) =>
  name === 'drums' ? 'drums' : name === 'guitar' || name === 'bass' ? 'fretboard' : 'roll';

// Lucide instrument icon sized to match the inline tab icons.
const DrumKitTabIcon = (p) => <Drum size={14} strokeWidth={2} aria-hidden="true" {...p} />;

function ViewerToolbar({ view, onView, available, midiLabel, midiIcon, showSheet = true, showMidi = true, stemsLabel = null }) {
  const tab = (key, IconCmp, label, kbd) => {
    const enabled = Boolean(available[key]);
    return (
      <button
        className={view === key ? 'on' : ''}
        onClick={() => enabled && onView(key)}
        disabled={!enabled}
        title={enabled ? undefined : 'Not available for this result'}
        style={enabled ? undefined : { opacity: 0.4, cursor: 'not-allowed' }}
      >
        <IconCmp />
        <span>{label}</span>
        <span className="gs-seg-kbd">{kbd}</span>
      </button>
    );
  };
  return (
    <div className="gs-viewer-toolbar">
      <div className="gs-seg" role="tablist">
        {showSheet && tab('sheet', Icon.Sheet, 'Sheet music', '1')}
        {showMidi && tab('midi', midiIcon || Icon.Midi, midiLabel, '2')}
        {tab('stems', Icon.Stems, available.stems && stemsLabel ? stemsLabel : 'Stem', '3')}
        {available.spectrum && tab('spectrum', Icon.Spectrum, 'Spectrum', '4')}
      </div>
    </div>
  );
}

export default function TranscriptionResultView({
  workflowId,
  fileName,
  selectedInstrument,
  prefetchedFiles,
  onDownloadTranscription,
  onDownloadStem,
  onDownloadMidi,
  onDownloadPdf,
  onReset,
  downloadError,
  isSignedIn,
  onUpgradeToFull,
  onSignUpToUnlock,
  // 'overlay' (default) is the just-finished card inside an upload area;
  // 'page' is the standalone /transcription-history/:id route, where the job
  // is old news and the heading belongs to the song, not to the event.
  variant = 'overlay',
  title,
  subtitle,
  headerExtra,
  // Output file map from the status payload ({ key: r2path }). When present,
  // every separated stem in it is loaded — not only the one that was asked
  // for — so a vocals split plays vocals against the rest of the mix.
  files = null,
}) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const { isDarkMode, toggleTheme } = useTheme();
  const containerRef = useRef(null);

  const isPreview = Boolean(workflowId && workflowId.startsWith('PRV'));
  const isPage = variant === 'page';
  // Drums route to the beat-tracked ADToF+ outputs; every drums-specific
  // branch below gates on this flag so the default (piano/bass/…) path is
  // untouched.
  const isDrums = selectedInstrument === 'drums';
  const midiKey = isDrums ? DRUMS_MIDI_KEY : MIDI_KEY_BY_INSTRUMENT[selectedInstrument];
  const musicXmlKeys = musicXmlKeysFor(selectedInstrument);
  const musicXmlKey = musicXmlKeys[0];
  const stemKey = STEM_KEY_BY_INSTRUMENT[selectedInstrument];
  const stemMeta = STEM_DISPLAY[selectedInstrument] || STEM_DISPLAY.other;
  // Every `bs_roformer_<name>_stem` the job produced, the requested one first.
  // Falls back to the single requested stem when no file map is available
  // (the upload surfaces pass prefetched blobs instead).
  const stemEntries = useMemo(() => {
    const keys = Object.keys(files || prefetchedFiles || {});
    const found = keys
      .map((k) => { const m = /^bs_roformer_(\w+)_stem$/.exec(k); return m ? { key: k, name: m[1] } : null; })
      .filter(Boolean);
    const list = found.length ? found : (stemKey ? [{ key: stemKey, name: stemMeta.name }] : []);
    return list.sort((a, b) => (a.name === stemMeta.name ? -1 : b.name === stemMeta.name ? 1 : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, prefetchedFiles, stemKey, stemMeta.name]);
  const stemEntriesKey = stemEntries.map((e) => e.key).join(',');
  const scoreTitle = title || titleFromFilename(fileName);
  const scoreArtist = 'Transcribed by GrooveSheet';
  const authName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
  const safeAccountName = user?.name && !user.name.includes('@') ? user.name.trim() : '';
  const scoreSourceCredit = `Uploaded by ${safeAccountName || authName || (isSignedIn ? 'GrooveSheet user' : 'Guest')}`;
  // Same label rule as SongDetail; drums keep the roll (and its label) here
  // until the kit grid is wired into the result view.
  const noteView = viewForStem(stemMeta.name);
  const midiTabLabel = isDrums ? 'Drum Kit' : noteView === 'fretboard' ? 'Fretboard Notes' : 'Piano roll';

  const [upgrading, setUpgrading] = useState(false);

  // --- shared transport ------------------------------------------------------
  const transportRef = useRef(null);
  if (!transportRef.current) transportRef.current = createTransport();
  const transport = transportRef.current;
  const tState = useTransport(transport);
  useEffect(() => () => transportRef.current.pause(), []);

  // --- volume (master gain across engines) ------------------------------------
  const [volume, setVolume] = useState(78);
  const [muted, setMuted] = useState(false);
  const masterVolRef = useRef(0.78);
  const stemEngineRef = useRef(null);
  const midiEngineRef = useRef(null);
  useEffect(() => {
    const v = muted ? 0 : volume / 100;
    masterVolRef.current = v;
    if (stemEngineRef.current) stemEngineRef.current.setMasterVolume(v);
    if (midiEngineRef.current) midiEngineRef.current.setMasterVolume(v);
  }, [volume, muted]);

  // --- MusicXML ---------------------------------------------------------------
  const [musicXmlText, setMusicXmlText] = useState(null);
  const [xmlLoading, setXmlLoading] = useState(true);
  const [xmlError, setXmlError] = useState(null);
  const scoreHasOwnTimingRef = useRef(false);

  useEffect(() => {
    if (!workflowId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        setXmlLoading(true);
        setXmlError(null);
        const prefetched = prefetchedFiles?.[musicXmlKey] || prefetchedFiles?.musicxml;
        let text = null;
        if (prefetched?.blob) {
          text = await prefetched.blob.text();
        } else {
          // Walk the preference list; older and newer chains name this file
          // differently and only one of them exists for any given workflow.
          for (const key of musicXmlKeys) {
            text = await fetchMusicXmlText(config.apiBaseUrl, workflowId, getToken, key);
            if (text) break;
          }
          if (!text) {
            text = await fetchMusicXmlText(config.apiBaseUrl, workflowId, getToken);
          }
        }
        // Previews show a teaser: cap the engraved score alongside the
        // 10-second MIDI cap so every tab tells the same story.
        if (text && isPreview) text = truncateMusicXmlToMeasures(text);
        if (text) {
          text = applyMusicXmlMetadata(text, {
            title: scoreTitle,
            artist: scoreArtist,
            sourceCredit: scoreSourceCredit,
          });
        }
        if (!cancelled) {
          scoreHasOwnTimingRef.current = musicXmlHasVariableTempo(text);
          setMusicXmlText(text);
        }
      } catch (err) {
        if (!cancelled) setXmlError(err.message || 'Failed to load score');
      } finally {
        if (!cancelled) setXmlLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [workflowId, musicXmlKey, musicXmlKeys, prefetchedFiles, getToken, isPreview, scoreTitle, scoreArtist, scoreSourceCredit]);

  // --- MIDI (buffer + soundfont engine) ----------------------------------------
  const [midiBuffer, setMidiBuffer] = useState(null);
  const [midiLoading, setMidiLoading] = useState(Boolean(midiKey));
  const [midiError, setMidiError] = useState(null);

  useEffect(() => {
    if (!workflowId || !midiKey) return undefined;
    let cancelled = false;
    (async () => {
      try {
        setMidiLoading(true);
        setMidiError(null);
        const prefetched = prefetchedFiles?.[midiKey];
        let buffer;
        if (prefetched?.blob) {
          buffer = await prefetched.blob.arrayBuffer();
        } else {
          buffer = await fetchMidiArrayBuffer(config.apiBaseUrl, workflowId, midiKey, getToken);
        }
        if (cancelled || !buffer) return;
        // Preview outputs are already 10s server-side; the client cap is a
        // safety net for previews only — full workflows show the whole song.
        setMidiBuffer(isPreview ? truncateMidiToSeconds(buffer, 10) || buffer : buffer);
      } catch (err) {
        if (!cancelled) setMidiError(err.message || 'Failed to load MIDI');
      } finally {
        if (!cancelled) setMidiLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [workflowId, midiKey, prefetchedFiles, getToken, isPreview]);

  useEffect(() => {
    if (!midiBuffer) return undefined;
    const t = transportRef.current;
    const engine = createMidiEngine({
      midiBuffer,
      onError: (err) => setMidiError(err.message || 'Failed to parse MIDI'),
    });
    engine.setMasterVolume(masterVolRef.current);
    midiEngineRef.current = engine;
    t.attachEngine(engine);
    // MIDI duration is the transport's source of truth for this result.
    const dur = engine.getDuration();
    if (dur > 0) t.setDuration(dur);
    if (t.getActiveEngineId() === 'midi') {
      const st = t.getState();
      if (st.isPlaying) engine.play(st.positionSec);
      else engine.seek(st.positionSec);
    }
    return () => {
      t.detachEngine('midi');
      engine.dispose();
      if (midiEngineRef.current === engine) midiEngineRef.current = null;
    };
  }, [midiBuffer]);

  // --- Stem audio (every separated stem → one Web Audio engine) -----------------
  const [stemStatus, setStemStatus] = useState(stemEntries.length ? 'loading' : 'missing');
  const [stemError, setStemError] = useState(null);
  const [stemEngine, setStemEngine] = useState(null); // for the spectrum view

  useEffect(() => {
    if (!workflowId || !stemEntries.length) return undefined;
    let cancelled = false;
    let engine = null;
    const objectUrls = [];
    const t = transportRef.current;
    setStemStatus('loading');
    setStemError(null);
    (async () => {
      try {
        const results = await Promise.all(stemEntries.map(async (e) => {
          const prefetched = prefetchedFiles?.[e.key];
          const result = prefetched?.blob
            ? prefetched
            : await downloadWorkflowFile(config.apiBaseUrl, workflowId, e.key, getToken);
          return result?.blob ? { name: e.name, blob: result.blob } : null;
        }));
        if (cancelled) return;
        const loaded = results.filter(Boolean);
        if (!loaded.length) {
          setStemStatus('missing');
          return;
        }
        const assets = loaded.map(({ name, blob }) => {
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          return { asset_type: 'stem', stem_name: name, format: 'wav', stream_url: url };
        });
        engine = createStemEngine({
          assets,
          onError: (err) => {
            setStemError(err.message || 'Failed to load stem audio');
            setStemStatus('error');
          },
        });
        engine.setMasterVolume(masterVolRef.current);
        stemEngineRef.current = engine;
        setStemEngine(engine);
        t.attachEngine(engine);
        setStemStatus('ready');
      } catch (err) {
        if (!cancelled) {
          setStemError(err.message || 'Failed to load stem audio');
          setStemStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
      t.detachEngine('stems');
      if (engine) engine.dispose();
      if (stemEngineRef.current === engine) stemEngineRef.current = null;
      setStemEngine(null);
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId, stemEntriesKey]);

  const stems = useMemo(
    () => stemEntries.map((e) => {
      const d = STEM_DISPLAY[e.name] || { name: e.name, label: e.name.charAt(0).toUpperCase() + e.name.slice(1), color: '#C9A0FF', sub: '' };
      return { name: e.name, label: d.label, color: d.color, sub: d.sub, wave: null };
    }),
    [stemEntries]
  );
  const [stemState, setStemState] = useState({});
  useEffect(() => {
    setStemState(Object.fromEntries(stems.map((st) => [st.name, { mute: false, solo: false, volume: 75 }])));
  }, [stems]);
  useEffect(() => {
    const eng = stemEngineRef.current;
    if (!eng) return;
    Object.entries(stemState).forEach(([name, s]) => {
      if (!s) return;
      eng.setStemGain(name, s.volume / 100);
      eng.setStemMuted(name, s.mute);
    });
  }, [stemState, stemStatus]);
  const onStemChange = useCallback(
    (name, patch) => setStemState((s) => ({ ...s, [name]: { ...(s[name] || {}), ...patch } })),
    []
  );

  // --- OSMD (sheet) engine — same wiring as SongDetail/PreviewPanel -------------
  const osmdRef = useRef(null);
  const osmdSyncRef = useRef({ time: 0, playing: false, duration: 0, ready: false });
  const mapperRef = useRef(createSheetSecMapper({}));
  const syncPairsRef = useRef(null);
  const sheetDurRef = useRef(0);
  const pendingOsmdSyncRef = useRef(false);
  const osmdExpectRef = useRef(null); // { sheetSec, until } | null

  const rebuildMapper = useCallback(() => {
    // pairs stay null unless a drums sync map loaded, in which case the mapper
    // composes midi-sec ↔ score-qn with the sheet's own clock (same wiring as
    // SongDetail). Null pairs → identity, the pre-drums behavior.
    mapperRef.current = createSheetSecMapper({
      pairs: syncPairsRef.current,
      sheetDurationSec: sheetDurRef.current,
      preferIdentity: scoreHasOwnTimingRef.current,
    });
  }, []);

  useEffect(() => {
    rebuildMapper();
  }, [musicXmlText, rebuildMapper]);

  // Legacy drums sheet↔audio sync map. New ADToF+ scores carry their varying
  // beat-tracked tempi directly, so rebuildMapper deliberately keeps those on
  // identity timing and avoids applying the same warp twice. Previews skip it:
  // the sheet is truncated client-side, which would break the full-song map's
  // qn → sheet-seconds scale.
  useEffect(() => {
    if (!workflowId || !isDrums || isPreview) return undefined;
    let cancelled = false;
    syncPairsRef.current = null; // drop any previous workflow's map while fetching
    rebuildMapper();
    (async () => {
      try {
        const prefetched = prefetchedFiles?.[DRUMS_SYNC_MAP_KEY];
        const result = prefetched?.blob
          ? prefetched
          : await downloadWorkflowFile(config.apiBaseUrl, workflowId, DRUMS_SYNC_MAP_KEY, getToken);
        if (cancelled || !result?.blob) return;
        const pairs = parseSyncMap(await result.blob.text()).pairs;
        if (cancelled) return;
        syncPairsRef.current = pairs;
        rebuildMapper();
      } catch (e) {
        if (!cancelled) {
          syncPairsRef.current = null; // absent/bad sync map → identity mapping
          rebuildMapper();
        }
      }
    })();
    return () => { cancelled = true; };
  }, [workflowId, isDrums, isPreview, prefetchedFiles, getToken, rebuildMapper]);

  // OSMD's playFromMs awaits pause() internally; serialize seek/play commands.
  const osmdCmdQueueRef = useRef(Promise.resolve());
  const commandOsmd = useCallback((sheetSec, andPlay) => {
    if (!osmdRef.current) return;
    osmdExpectRef.current = { sheetSec, until: nowMs() + 4000 };
    osmdCmdQueueRef.current = osmdCmdQueueRef.current
      .then(async () => {
        const osmd = osmdRef.current;
        if (!osmd) return;
        try { await osmd.seekMs?.(sheetSec * 1000); } catch (e) { /* ignore */ }
        const t = transportRef.current;
        if (andPlay && t.getState().isPlaying && t.getActiveEngineId() === 'osmd') {
          try { await osmd.play?.(); } catch (e) { /* ignore */ }
        }
        const expect = osmdExpectRef.current;
        if (expect && expect.sheetSec === sheetSec) {
          osmdExpectRef.current = { sheetSec, until: nowMs() + 1500 };
        }
      })
      .catch(() => {});
  }, []);

  const hasSheet = Boolean(musicXmlText);

  useEffect(() => {
    if (!hasSheet) return undefined;
    const t = transportRef.current;
    t.attachEngine({
      id: 'osmd',
      play: (atSec) => {
        if (!osmdRef.current || !osmdSyncRef.current.ready) {
          pendingOsmdSyncRef.current = true;
          return;
        }
        commandOsmd(mapperRef.current.midiSecToSheetSec(atSec), true);
      },
      pause: () => {
        try { osmdRef.current?.pause?.(); } catch (e) { /* ignore */ }
      },
      seek: (sec) => {
        if (!osmdRef.current || !osmdSyncRef.current.ready) {
          pendingOsmdSyncRef.current = true;
          return;
        }
        commandOsmd(mapperRef.current.midiSecToSheetSec(sec), false);
      },
      readTime: () => {
        const s = osmdSyncRef.current;
        if (!s.ready) return null;
        const eff = s.time;
        const expect = osmdExpectRef.current;
        if (expect) {
          const settled = Math.abs(eff - expect.sheetSec) <= 0.75;
          if (!settled && nowMs() < expect.until) return null; // stale — self-advance
          if (!settled) return null;
          osmdExpectRef.current = null;
        }
        return mapperRef.current.sheetSecToMidiSec(eff);
      },
    });
    return () => {
      t.detachEngine('osmd');
    };
  }, [hasSheet, commandOsmd]);

  const handleOsmdStateChange = useCallback(
    (s) => {
      const t = transportRef.current;
      osmdSyncRef.current = { time: s.currentTime, playing: s.isPlaying, duration: s.duration, ready: true };
      if (s.duration > 0 && sheetDurRef.current !== s.duration) {
        sheetDurRef.current = s.duration;
        rebuildMapper();
        // No MIDI duration yet? Use the sheet's so the scrubber works.
        if (!(transportRef.current.getState().durationSec > 0)) {
          t.setDuration(mapperRef.current.sheetSecToMidiSec(s.duration));
        }
      }
      if (pendingOsmdSyncRef.current && osmdRef.current && t.getActiveEngineId() === 'osmd') {
        pendingOsmdSyncRef.current = false;
        const st = t.getState();
        commandOsmd(mapperRef.current.midiSecToSheetSec(st.positionSec), st.isPlaying);
      }
      // Reconcile: OSMD pauses itself at the end of the sheet.
      if (t.getActiveEngineId() === 'osmd') {
        const st = t.getState();
        if (
          st.isPlaying && !s.isPlaying && s.duration > 0 &&
          s.currentTime >= s.duration - 0.05 && st.positionSec > 0.5
        ) {
          t.pause();
        }
      }
    },
    [rebuildMapper, commandOsmd]
  );

  // Cursor-follow while another engine drives the clock.
  useEffect(() => {
    if (!hasSheet) return undefined;
    const t = transportRef.current;
    return t.subscribe((st) => {
      if (t.getActiveEngineId() === 'osmd') return;
      const osmd = osmdRef.current;
      if (!osmd) return;
      try { osmd.syncCursorToTime?.(mapperRef.current.midiSecToSheetSec(st.positionSec)); } catch (e) { /* ignore */ }
    });
  }, [hasSheet]);

  // --- tabs ----------------------------------------------------------------------
  const available = useMemo(
    () => ({
      sheet: xmlLoading || Boolean(musicXmlText),
      midi: midiLoading || Boolean(midiBuffer),
      stems: stemStatus === 'loading' || stemStatus === 'ready',
      // Overlaid stem spectrograms — same audio and mixer state as Stems.
      spectrum: stemStatus === 'ready' && Boolean(stemEngine),
    }),
    [xmlLoading, musicXmlText, midiLoading, midiBuffer, stemStatus, stemEngine]
  );
  // A separation-only job has no score and no MIDI to wait for; don't offer
  // tabs that can never light up.
  const showSheet = Boolean(musicXmlKey || musicXmlText);
  const showMidi = Boolean(midiKey || midiBuffer);
  const [view, setView] = useState(showSheet ? 'sheet' : 'stems');
  useEffect(() => {
    if (!available[view]) {
      const first = ['sheet', 'midi', 'stems', 'spectrum'].find((v) => available[v]);
      if (first) setView(first);
    }
  }, [available, view]);

  // Active engine follows the visible tab.
  useEffect(() => {
    const t = transportRef.current;
    if (view === 'sheet') {
      osmdSyncRef.current = { ...osmdSyncRef.current, ready: false };
      pendingOsmdSyncRef.current = true;
      t.setActiveEngine('osmd');
    } else if (view === 'midi') {
      t.setActiveEngine('midi');
    } else if (view === 'stems') {
      t.setActiveEngine('stems');
    }
  }, [view]);

  // --- playback handlers -----------------------------------------------------------
  const handlePlayPause = useCallback(() => {
    const t = transportRef.current;
    const st = t.getState();
    if (st.isPlaying) t.pause();
    else {
      if (st.durationSec > 0 && st.positionSec >= st.durationSec) t.seek(0);
      t.play();
    }
  }, []);

  const onSeekFraction = useCallback((f) => {
    const t = transportRef.current;
    const dur = t.getState().durationSec;
    if (dur > 0) t.seek(Math.max(0, Math.min(1, f)) * dur);
  }, []);

  // Keyboard shortcuts (space = play/pause, 1/2/3 = tabs).
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && /(input|textarea|select)/i.test(e.target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      }
      if (e.key === '1' && available.sheet) setView('sheet');
      if (e.key === '2' && available.midi) setView('midi');
      if (e.key === '3' && available.stems) setView('stems');
      if (e.key === '4' && available.spectrum) setView('spectrum');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlePlayPause, available]);

  const handleUpgradeClick = useCallback(async () => {
    if (!onUpgradeToFull || upgrading) return;
    setUpgrading(true);
    try {
      await onUpgradeToFull();
    } finally {
      setUpgrading(false);
    }
  }, [onUpgradeToFull, upgrading]);

  return (
    <div ref={containerRef} className={`gs-song-page tr-result${isPage ? ' tr-result-page' : ''}`}>
      {/* Header: status + downloads + preview CTA */}
      <div className="tr-header">
        <div className="tr-header-info">
          {!isPage && <CheckCircle size={32} weight="fill" className="tr-check" />}
          <div className="tr-header-text">
            <h2 className="tr-title">{isPage ? (title || fileName || 'Transcription') : 'Transcription complete'}</h2>
            <div className="tr-filename">
              <File size={16} />
              <span>{(isPage ? subtitle : null) || fileName || 'Unknown file'}</span>
              {isPreview && <span className="tr-preview-badge">10-second preview</span>}
            </div>
          </div>
        </div>
        <div className="tr-header-actions">
          {isPreview && (
            isSignedIn ? (
              <button className="tr-btn tr-btn-primary" onClick={handleUpgradeClick} disabled={upgrading}>
                {upgrading ? 'Starting…' : (showSheet ? 'Transcribe the full song' : 'Separate the full song')}
              </button>
            ) : (
              <button className="tr-btn tr-btn-primary" onClick={onSignUpToUnlock}>
                Sign up to unlock the full song
              </button>
            )
          )}
          {/* Separation-only jobs (stem splitter) have no score to offer. */}
          {onDownloadTranscription && (musicXmlKey || musicXmlText) && (
            <button className="tr-btn" onClick={onDownloadTranscription}>
              <DownloadSimple size={18} weight="bold" />
              <span>Score</span>
            </button>
          )}
          {/* The printable engraving — the same file that auto-downloads with
              the MusicXML when a transcription finishes. */}
          {onDownloadPdf && (musicXmlKey || musicXmlText) && (
            <button className="tr-btn" onClick={onDownloadPdf}>
              <DownloadSimple size={18} weight="bold" />
              <span>PDF</span>
            </button>
          )}
          {midiKey && onDownloadMidi && (
            <button className="tr-btn" onClick={onDownloadMidi}>
              <DownloadSimple size={18} weight="bold" />
              <span>MIDI</span>
            </button>
          )}
          {stemKey && onDownloadStem && (
            <button className="tr-btn" onClick={onDownloadStem}>
              <DownloadSimple size={18} weight="bold" />
              <span>{isPreview ? 'Download preview' : 'Stem'}</span>
            </button>
          )}
          {headerExtra}
          {onReset && (
            <button className="tr-close" onClick={onReset} aria-label={isPage ? 'Back' : 'Close and start over'}>
              <X size={22} weight="bold" />
            </button>
          )}
        </div>
      </div>

      {downloadError && <StatusMessage variant="error">{downloadError}</StatusMessage>}

      {/* Sticky transport + tab switcher, same stack as /explore/:songId */}
      <div className="tr-sticky">
        <PlaybackBar
          isPlaying={tState.isPlaying}
          onPlayPause={handlePlayPause}
          currentSec={tState.positionSec}
          totalSec={tState.durationSec}
          tempo={100}
          onTempo={() => {}}
          transpose={0}
          onTranspose={() => {}}
          loopMode="off"
          onLoopMode={() => {}}
          loopRegion={null}
          volume={volume}
          onVolume={setVolume}
          muted={muted}
          onMute={() => setMuted((m) => !m)}
          metronome={false}
          onMetronome={() => {}}
          dark={isDarkMode}
          onToggleTheme={toggleTheme}
          onFullscreen={() => {
            if (document.fullscreenElement) document.exitFullscreen();
            else containerRef.current?.requestFullscreen?.();
          }}
          onSeekFraction={onSeekFraction}
          totalBeats={0}
          disabledControls={{ tempo: true, transpose: true, metronome: true, loop: true }}
        />
        <ViewerToolbar
          view={view}
          onView={setView}
          available={available}
          midiLabel={midiTabLabel}
          midiIcon={isDrums ? DrumKitTabIcon : undefined} showSheet={showSheet} showMidi={showMidi} stemsLabel={stems.length > 1 ? 'Stems' : 'Stem'} />
      </div>

      {/* Viewer */}
      <div className="gs-viewer">
        {view === 'sheet' && (
          <SheetMusicView
            musicXmlText={musicXmlText}
            loading={xmlLoading}
            error={xmlError}
            osmdRef={osmdRef}
            onPlaybackStateChange={handleOsmdStateChange}
          />
        )}
        {view === 'midi' && (
          isDrums ? (
            <DrumKitView
              midiBuffer={midiBuffer}
              transport={transport}
              syncPairsRef={syncPairsRef}
              loading={midiLoading}
              error={midiError}
            />
          ) : noteView === 'fretboard' ? (
            <FretboardView
              midiBuffer={midiBuffer}
              transport={transport}
              loading={midiLoading}
              error={midiError}
              kind={stemMeta.name}
            />
          ) : (
            <PianoRollView
              midiBuffer={midiBuffer}
              transport={transport}
              loading={midiLoading}
              error={midiError}
            />
          )
        )}
        {view === 'stems' && (
          <StemsView
            stems={stems}
            stemState={stemState}
            onStemChange={onStemChange}
            onSeek={onSeekFraction}
            transport={transport}
            statusText={stemError || (stemStatus === 'loading' ? (stems.length > 1 ? 'Loading stems…' : 'Loading stem…') : null)}
          />
        )}
        {view === 'spectrum' && available.spectrum && (
          <SpectrogramView
            stems={stems}
            stemState={stemState}
            onStemChange={onStemChange}
            onSeek={onSeekFraction}
            transport={transport}
            stemEngine={stemEngine}
            trackId={workflowId}
            statusText={stemError}
          />
        )}
      </div>
    </div>
  );
}
