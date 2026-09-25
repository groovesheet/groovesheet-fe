# Player islands: the P1 contract

For P2 (`/explore/:songId`), P3 (`/`, `/stem-splitter`, `/midi-converter`),
P4 (`/transcription-history/:workflowId`) and P5 (`/preview1`, `/video1`,
`/video2for*`). Code against the three entry modules below and nothing else
under `components/player/`.

```
@/components/player          components (index.ts, 'use client')
@/components/player/engine   transport, engines, sync maps (engine.ts)
@/components/player/types    prop and engine types (also re-exported by both)
```

Everything else under `components/player/` is the CRA player ported
verbatim as `.js` (brief section 0, rule 4). Do not import those files
directly and do not edit them; if one needs a change, report it to P1.

## 1. Rules

- **Every component from `@/components/player` is safe in any tree.** The
  browser-only ones load through `clientOnly` (next/dynamic, `ssr: false`), so
  OSMD, Web Audio, canvas and soundfont code never runs on the server. The
  server HTML holds a `SkeletonPanel` placeholder (420px for a viewer, 560px
  for a whole panel; nothing for the video frames).
- A Server Component may render them, but **function props can only come
  from a Client Component**. In practice: the video pages (no props) render
  straight from a Server Component page; everything else sits inside your
  own `'use client'` component.
- **`@/components/player/engine` is for Client Components, called from
  effects or handlers**, never during render. Importing it on the server does
  not crash (nothing touches `window` at import time), but `createMidiEngine`
  pulls osmd-extended (1.48MB raw, 375KB gzip) into whatever chunk imports it.
  If you only need it after a click, `await import('@/components/player/engine')`.
- Tier B rule (brief 5.9) is unaffected: none of these components read the
  session on the server. `TranscriptionResultView` and `PreviewPanel` call
  `useAuth()` in the browser only.
- CSS: each island imports its own stylesheet. `song/Song.css` (the `gs-*`
  classes for the song page, 1,358 lines) lives here because
  `TranscriptionResultView` needs it. **P2: import it from
  `@/components/player/song/Song.css` in SongDetail; do not copy it.**

## 2. Components (`@/components/player`)

Props are the interfaces in `types.ts`; the tables name the required ones.

### Panels

| Export | Props type | Required | Used by (CRA) | Route |
|---|---|---|---|---|
| `TranscriptionResultView` | `TranscriptionResultViewProps` | `workflowId` | `Hero.js`, `StemSplitter.js`, `MidiConverter.js`, `TranscriptionDetail.js` | `/`, `/stem-splitter`, `/midi-converter` (P3), `/transcription-history/:workflowId` (P4) |
| `PreviewPanel` | `PreviewPanelProps` | `workflowId`, `selectedInstrument` | `PreviewDemo.js` | `/preview1` (P5) |
| `VisualizationPanel` | `VisualizationPanelProps` | `jobId`, `selectedInstrument`, `getToken` | nothing (dead in CRA) | none |

`TranscriptionResultView` in the CRA call sites: the upload surfaces pass
`workflowId, fileName, selectedInstrument, prefetchedFiles, files,
onDownloadTranscription, onDownloadStem, onDownloadMidi, onDownloadPdf,
onReset, downloadError, isSignedIn, onUpgradeToFull, onSignUpToUnlock,
title` (MidiConverter adds `defaultView="midi"` and `statusLabel`); the
history page passes `variant="page"`, `title`, `subtitle`, `durationHint`,
`defaultView`, `onReset={null}` and `prefetchedFiles={null}`. Same props
here, unchanged. It reads auth and theme itself (`useAuth`, `useUser`,
`useTheme`); the locale layout already provides both.

`PreviewPanel` demo mode (what `/preview1` does): pass `workflowId="demo"`,
`selectedInstrument="piano"`, `prefetchedFiles={{}}`, `preloadedMusicXml`,
`preloadedMidiBuffer` and `preloadedSyncMap` (parse it with `parseSyncMap`
from `engine`). It loads the 3D piano from `/3d-piano-player/index.html`.

### Song viewers (P2, SongDetail)

| Export | Props type | Notes |
|---|---|---|
| `SheetMusicView` | `SheetMusicViewProps` | `osmdRef: RefObject<OSMDViewerHandle \| null>` receives the OSMD handle |
| `PianoRollView` | `PianoRollViewProps` | `ghosts`: other instruments drawn faint |
| `StemsView` | `StemsViewProps` | `stems: StemRow[]`, `stemState: StemStateMap` |
| `SpectrogramView` | `SpectrogramViewProps` | needs the live `stemEngine` |
| `DrumGridView` | `DrumGridViewProps` | |
| `FretboardView` | `FretboardViewProps` | `kind`: `'guitar'` or `'bass'` |
| `FallingKeysView` | `FallingKeysViewProps` | |
| `PlaybackBar` | `PlaybackBarProps` | pure markup, server-renders (not an island) |
| `InstrumentDropdown` | `InstrumentDropdownProps` | pure markup, server-renders (not an island) |
| `Icon` | `Record<IconName, ComponentType<SVGProps<SVGSVGElement>>>` | `Icon.Play`, `Icon.Sheet`, ... Client Components only: a Server Component gets a client reference, not the object |

The MIDI viewers share `{ midiBuffer: ArrayBuffer | null; transport:
Transport | null; loading?; error? }`. Call shapes are exactly the ones in
`src/components/song/SongDetail.js` lines 1197 to 1316.

`SongDetail.js` also imports `SongSidebar`, `Section`, `trackToCard` and
`explore/constants`. Those are not player code: `SongSidebar` is P2's to
port (MIGRATION-CONTRACTS.md section 3 lists it as unused; it is not, SongDetail
line 15 imports it).

### Video frames (P5)

| Export | CRA component | Route |
|---|---|---|
| `Video1` | `video/Video1.js` | `/video1` |
| `Video2Piano` | `video/Video2Tabs.js` (default export) | `/video2forpiano` |
| `Video2Drums` | `video/Video2Drums.js` | `/video2fordrums` |
| `Video2Guitar` | `video/Video2Instrument.js` `Video2Guitar` | `/video2forguitar` |
| `Video2Bass` | `video/Video2Instrument.js` `Video2Bass` | `/video2forbass` |

No props. They fetch `/transcription-samples/*`, `/sample-preview/*` and
`/video-assets/*` from `public/` (all present) plus `/api` for job lookups.
They are full-bleed recording frames: render them as the whole page body,
without Header/Footer, as `App.js` did.

## 3. Engines (`@/components/player/engine`)

```ts
createTransport(): Transport
useTransport(transport: Transport | null): TransportState      // hook
createStemEngine(opts: StemEngineOptions): StemEngine          // opts.assets: LibraryAsset[] (pass `track.assets ?? []`)
pickStemAssets(assets): Map<string, LibraryAsset>
createMidiEngine(opts: MidiEngineOptions): MidiEngine          // pulls osmd-extended
parseSyncMap(json: unknown): ParsedSyncMap                     // throws on bad input
createSheetSecMapper(opts?: SheetSecMapperOptions): SheetSecMapper
musicXmlHasVariableTempo(xml: string | null | undefined): boolean
mixBlobsToWav(blobs: Blob[]): Promise<{ blob: Blob; durationSec: number }>
blobDurationSec(blob: Blob): Promise<number>
fmtTime(seconds: number): string                               // mm:ss
```

The transport contract (engines attach, exactly one is active, MIDI seconds
are truth) is documented at the top of `core/transport.js`; `Transport`,
`TransportEngine`, `StemEngine` and `MidiEngine` in `types.ts` mirror it.
SongDetail's imports map one to one:

| CRA import | Now |
|---|---|
| `../../player/transport` `createTransport` | `@/components/player/engine` |
| `../../player/transport-react` `useTransport` | `@/components/player/engine` |
| `../../player/stemEngine` `createStemEngine, pickStemAssets` | `@/components/player/engine` |
| `../../player/midiEngine` `createMidiEngine` | `@/components/player/engine` |
| `../../player/syncMap` `parseSyncMap, createSheetSecMapper, musicXmlHasVariableTempo` | `@/components/player/engine` |
| `./SongViewers`, `./DrumGridView`, `./FretboardView`, `./FallingKeysView`, `./SpectrogramView`, `./InstrumentDropdown`, `./PlaybackBar`, `./icons` | `@/components/player` |
| `./Song.css` | `@/components/player/song/Song.css` |
| `PreviewDemo.js`: `../player/syncMap` `parseSyncMap` | `@/components/player/engine` |

## 4. Why the types are asserted

TypeScript infers every destructured prop of a JS component as a required
`any`, so no real props object satisfies the inferred type. `index.ts` takes
each JS component as its interface in one helper (`asComponent`), and
`engine.ts` assigns each JS function to an explicit signature (these ones
type-check against the JS without an assertion). The interfaces were
written from the JS bodies and the CRA call sites; if one is wrong, the JS is
right, and P1 fixes the interface.

## 5. Where the files came from

| CRA source | Here |
|---|---|
| `src/player/*.js` (7 modules) | `core/` |
| `src/components/visualization/*` | `visualization/` |
| `src/components/PreviewPanel/**` | `PreviewPanel/` (with `tabs/`) |
| `src/components/video/*` | `video/` |
| `src/components/TranscriptionResult/*` | `TranscriptionResult/` |
| `src/components/song/{SongViewers,DrumGridView,FretboardView,FallingKeysView,SpectrogramView,InstrumentDropdown,PlaybackBar,icons}.js`, `InstrumentDropdown.css`, `Song.css` | `song/` |
| `src/mocks/songDetailData.js` (for `fmtTime`) | `mocks/` |

Edits to the verbatim files, all mechanical: import paths (`@/lib/api`,
`@/lib/config`, `@/lib/auth`, `@/lib/theme`, `@/lib/musicXmlMetadata`,
`@/lib/hooks/useMediaQuery`, `@/components/ui/*`, `../core/*`), and the six
`process.env.PUBLIC_URL` prefixes dropped (brief 5.2). No env vars, router or
i18n call sites, or Tailwind classes existed in these files.

The three tests (`src/player/transport.test.js`, `src/player/syncMap.test.js`,
`src/components/PreviewPanel/osmdPlaybackClock.test.js`) are P8's. They pass
against `components/player/core/{transport,syncMap}.js` and
`components/player/PreviewPanel/osmdPlaybackClock.js` (transport needs
`jest.fn` to `vi.fn`).
