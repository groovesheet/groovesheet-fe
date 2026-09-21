/**
 * API Utility - Authenticated API calls with Supabase JWT tokens
 *
 * The single source of truth for browser-side API calls. Every helper here
 * talks to a relative `/api` base (or the base the caller passes), which
 * next.config.ts rewrites to api.groovesheet.net in dev and vercel.json
 * rewrites in production. Server Components must not use these: they fetch
 * through lib/api-server.ts, which never carries a user's token.
 *
 * Ported from src/utils/api.js with the same 47 exports and signatures. The
 * two console.log lines that printed the bearer token were removed (brief 5.10).
 */

import type {
  AvailableOutputs,
  BillingCatalog,
  CampaignClaim,
  CampaignResponse,
  CheckoutSession,
  CheckoutSessionSummary,
  DownloadedFile,
  GetToken,
  HttpError,
  JsonObject,
  OwnCreatorProfile,
  PaymentMethod,
  SignOut,
  UsageHistoryResponse,
  UserSubscription,
  Workflow,
  WorkflowListResponse,
  WorkflowType,
} from '@/lib/types';

export type { GetToken, SignOut } from '@/lib/types';

/**
 * Sanitize a filename to be safe for HTTP headers (ASCII-only).
 * Normalizes Unicode (e.g. combining accents) and replaces non-ASCII chars.
 */
function sanitizeFilename(name: string): string {
  return name.normalize('NFC').replace(/[^\x20-\x7E]/g, '_');
}

function httpError(message: string, status: number): HttpError {
  const error: HttpError = new Error(message);
  error.status = status;
  return error;
}

async function errorDetail(response: Response): Promise<string | undefined> {
  const data: unknown = await response.json().catch(() => ({}));
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
  }
  return undefined;
}

/**
 * Custom error class for authentication-related errors
 */
export class AuthError extends Error {
  status: number;
  isAuthError = true as const;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

/**
 * Make an authenticated fetch request with Supabase JWT token
 * This function automatically handles token refresh and auth errors
 *
 * @param url - The API endpoint URL
 * @param options - Fetch options (method, body, headers, etc.)
 * @param getToken - auth getToken function from the app auth hook
 * @param signOut - Optional signOut function for auto-logout on auth errors
 * @throws {AuthError} for 401/403 responses, or when there is no token
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
  getToken: GetToken,
  signOut: SignOut | null = null
): Promise<Response> {
  // Get a fresh JWT token from Supabase session
  const token = await getToken();

  // Merge headers, adding Authorization if token exists
  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    console.warn('No authentication token available');
    throw new AuthError('Authentication required - no token available', 401);
  }

  // Make the fetch request with the token
  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Check for authentication errors
  if (response.status === 401 || response.status === 403) {
    console.error('Authentication error detected:', response.status);

    // Try to get error details from response
    let errorMessage = 'Authentication failed';
    try {
      const errorData: unknown = await response.clone().json();
      if (errorData && typeof errorData === 'object') {
        const { detail, message } = errorData as { detail?: unknown; message?: unknown };
        if (typeof detail === 'string' && detail) errorMessage = detail;
        else if (typeof message === 'string' && message) errorMessage = message;
      }
    } catch {
      // If parsing fails, use the status text
      errorMessage = response.statusText || errorMessage;
    }

    // Log user out if signOut function provided
    if (signOut) {
      try {
        await signOut();
      } catch (signOutError) {
        console.error('Error during sign out:', signOutError);
      }
    }

    // Throw custom auth error
    throw new AuthError(
      response.status === 401
        ? `Session expired: ${errorMessage}. Please sign in again.`
        : `Access denied: ${errorMessage}`,
      response.status
    );
  }

  return response;
}

/**
 * Upload a file to the backend with authentication
 * @param file - The file to upload
 * @param endpoint - The API endpoint (e.g., '/workflow/bs_roformer_separate')
 * @param getToken - auth getToken function from the app auth hook
 * @param baseUrl - Base URL for the API (default: '/api')
 * @param signOut - Optional signOut function for auto-logout on auth errors
 * @throws {AuthError} for 401/403 responses
 */
export async function uploadFileAuthenticated<T = JsonObject>(
  file: File,
  endpoint: string,
  getToken: GetToken,
  baseUrl: string = '/api',
  signOut: SignOut | null = null
): Promise<T> {
  const formData = new FormData();
  const safeName = sanitizeFilename(file.name);
  const safeFile = safeName !== file.name ? new File([file], safeName, { type: file.type }) : file;
  formData.append('file', safeFile);

  const response = await authenticatedFetch(
    `${baseUrl}${endpoint}`,
    {
      method: 'POST',
      body: formData,
    },
    getToken,
    signOut
  );

  if (!response.ok) {
    throw new Error((await errorDetail(response)) || `Upload failed: ${response.statusText}`);
  }

  // NOTE: no workflow_started event here. Nothing in the app calls this
  // helper - Hero, StemSplitter and MidiConverter each POST to /workflow/*
  // through authenticatedFetch directly, and that is where the event fires.
  // Emitting it here as well would be dead code today and a double count the
  // day someone starts using this helper.
  return response.json() as Promise<T>;
}

export interface WorkflowListParams {
  limit?: number | null;
  offset?: number | null;
}

/**
 * Fetch the list of user workflows from the backend
 * @param baseUrl - Base URL for the API
 * @param getToken - auth getToken function from the app auth hook
 * @param signOut - Optional signOut function for auto-logout on auth errors
 * @throws {AuthError} for 401/403 responses
 */
export async function fetchWorkflowList<T = WorkflowListResponse>(
  baseUrl: string,
  getToken: GetToken,
  signOut: SignOut | null = null,
  params: WorkflowListParams | null = null
): Promise<T> {
  // With { limit, offset } the backend returns enriched card items
  // ({ items, total }) so the Library page renders from one request;
  // without params it returns the legacy { workflow_ids } shape.
  const search = new URLSearchParams();
  if (params?.limit != null) search.set('limit', String(params.limit));
  if (params?.offset != null) search.set('offset', String(params.offset));
  const qs = search.toString();
  const response = await authenticatedFetch(
    `${baseUrl}/workflow/list${qs ? `?${qs}` : ''}`,
    {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    },
    getToken,
    signOut
  );

  if (!response.ok) {
    throw new Error((await errorDetail(response)) || `Failed to fetch workflows: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/** Endpoint prefix for an id: previews (PRV*) live under /preview, runs under /workflow. */
export const apiPrefixForId = (id: string | null | undefined): '/preview' | '/workflow' =>
  id && String(id).startsWith('PRV') ? '/preview' : '/workflow';

function filenameFromDisposition(res: Response): string | null {
  const cd = res.headers.get('content-disposition') || '';
  const match = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
  return match ? decodeURIComponent(match[1] || match[2]) : null;
}

async function optionalBearer(getToken: GetToken | null | undefined): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (getToken) {
    try {
      const token = await getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch {
      /* anonymous fallback */
    }
  }
  return headers;
}

/**
 * Download a workflow output file
 * @param baseUrl - Base URL for the API (e.g., '/api')
 * @param workflowId - The workflow/job ID
 * @param fileKey - The file key (e.g., 'drums', 'midi', 'transcription')
 * @param getToken - auth getToken function from the app auth hook
 * @returns null if file not found (404), otherwise { blob, filename }
 * @throws {Error} for non-404 download failures
 */
export async function downloadWorkflowFile(
  baseUrl: string,
  workflowId: string,
  fileKey: string,
  getToken: GetToken
): Promise<DownloadedFile | null> {
  // Preview previews carry IDs prefixed with `PRV` and live under /preview/...
  const isPreview = !!workflowId && workflowId.startsWith('PRV');
  const prefix = isPreview ? '/preview' : '/workflow';
  const url = `${baseUrl}${prefix}/download/${workflowId}/${fileKey}`;
  let res: Response;
  if (isPreview) {
    // Previews are anonymous-capable via the gs_anon cookie: attach the
    // bearer only when a session exists instead of throwing without one
    // (authenticatedFetch requires a token, which anonymous visitors lack).
    res = await fetch(url, { headers: await optionalBearer(getToken), credentials: 'include' });
    if (res.status === 401 || res.status === 403) {
      throw new AuthError('This preview belongs to a different session', res.status);
    }
  } else {
    res = await authenticatedFetch(url, {}, getToken);
  }
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Download failed: ${res.status}`);
  }
  const blob = await res.blob();
  return { blob, filename: filenameFromDisposition(res) };
}

// Instruments whose workflows engrave a score (everything else is separation
// only, and has no MusicXML or PDF to offer).
export const SCORE_INSTRUMENTS: string[] = ['drums', 'jazz_bass', 'bass', 'piano'];

/**
 * Fetch the transcription's score as a paginated, print-ready PDF.
 *
 * MusicXML needs an editor to open; the PDF is the copy you can print or put on
 * a stand, so it is downloaded alongside the MusicXML. The server engraves it
 * with Verovio. Returns null when this job has no score (a separation-only run).
 */
export async function downloadScorePdf(
  baseUrl: string,
  workflowId: string,
  getToken: GetToken
): Promise<DownloadedFile | null> {
  const isPreview = !!workflowId && workflowId.startsWith('PRV');
  const url = `${baseUrl}${isPreview ? '/preview' : '/workflow'}/score-pdf/${workflowId}`;
  let res: Response;
  if (isPreview) {
    res = await fetch(url, { headers: await optionalBearer(getToken), credentials: 'include' });
  } else {
    res = await authenticatedFetch(url, {}, getToken);
  }
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Score PDF failed: ${res.status}`);
  }
  const blob = await res.blob();
  return { blob, filename: filenameFromDisposition(res) };
}

/**
 * Fetch a workflow output as text (e.g. MusicXML).
 * Returns null on 404.
 */
export async function fetchMusicXmlText(
  baseUrl: string,
  workflowId: string,
  getToken: GetToken,
  fileKey: string = 'musicxml'
): Promise<string | null> {
  const result = await downloadWorkflowFile(baseUrl, workflowId, fileKey, getToken);
  if (!result) return null;
  return result.blob.text();
}

/**
 * Fetch a workflow output as ArrayBuffer (e.g. MIDI bytes).
 * Returns null on 404.
 */
export async function fetchMidiArrayBuffer(
  baseUrl: string,
  workflowId: string,
  midiKey: string,
  getToken: GetToken
): Promise<ArrayBuffer | null> {
  const result = await downloadWorkflowFile(baseUrl, workflowId, midiKey, getToken);
  if (!result) return null;
  return result.blob.arrayBuffer();
}

/**
 * Extract the filename portion from a value that may be a full file path.
 * Returns the original value if it doesn't look like a path.
 */
function extractBasename(value: unknown): unknown {
  if (!value || typeof value !== 'string') return value;
  // Strip any leading path (Unix or Windows-style)
  const base = (value.split('/').pop() || '').split('\\').pop();
  return base || value;
}

// Workflow name -> the instrument it transcribes. Mirrors the orchestrator's
// _INSTRUMENT_BY_WORKFLOW; used to label rows whose metadata never carried one.
const INSTRUMENT_BY_WORKFLOW: Record<string, string> = {
  separate_to_drumscore: 'drums',
  separate_to_drumscore_v2: 'drums',
  separate_to_drumscore_full: 'drums',
  separate_to_drumscore_v2_full: 'drums',
  adtof_transcribe: 'drums',
  adtof_plus_transcribe: 'drums',
  separate_to_piano_score: 'piano',
  separate_to_piano_score_full: 'piano',
  separate_to_bass_score: 'bass',
  separate_to_bass_score_full: 'bass',
  separate_to_jazz_bass_score: 'jazz_bass',
  separate_to_jazz_bass_score_full: 'jazz_bass',
  separate_to_guitar_stem: 'guitar',
};

const INSTRUMENT_DISPLAY: Record<string, string> = {
  drums: 'Drums',
  piano: 'Piano',
  bass: 'Bass',
  jazz_bass: 'Jazz bass',
  vocals: 'Vocals',
  guitar: 'Guitar',
  other: 'Other',
};

/** The instrument a workflow is about, from metadata or its workflow name. */
export function resolveInstrument(workflow: Workflow | null | undefined): string | null {
  if (!workflow) return null;
  return (
    workflow.metadata?.instrument
    || workflow.outputs?.metadata?.instrument
    || INSTRUMENT_BY_WORKFLOW[workflow.workflow_name || '']
    || null
  );
}

/** "Piano transcription" / "Stem separation": what the job produces. */
export function resolveWorkflowKind(workflow: Workflow | null | undefined): string {
  const name = workflow?.workflow_name || '';
  if (['bs_roformer_separate', 'demucs_separate', 'separate_to_guitar_stem'].includes(name)) {
    return 'Stem separation';
  }
  if (name === 'midi2score_quantize') return 'Score from MIDI';
  return `${INSTRUMENT_DISPLAY[resolveInstrument(workflow) || ''] || 'Audio'} transcription`;
}

const STEM_ONLY_WORKFLOWS = [
  'bs_roformer_separate',
  'demucs_separate',
  'separate_to_guitar_stem',
  'compress_stems',
];

const WORKFLOW_TYPES: Record<WorkflowType['id'], WorkflowType> = {
  stems: { id: 'stems', label: 'Stems', color: '#5EE7DF' },
  midi: { id: 'midi', label: 'MIDI', color: '#C9A0FF' },
  transcription: { id: 'transcription', label: 'Transcription', color: '#7AA2FF' },
  score: { id: 'score', label: 'Score from MIDI', color: '#84F2A6' },
};

/**
 * Which product made this job (Stem Splitter, MIDI Converter, or a full
 * transcription) as `{ id, label, color }` for the Library's type chip.
 *
 * The three surfaces run overlapping workflow chains (/midi-converter and the
 * home page both run `separate_to_*_score`), so the workflow name alone can't
 * tell them apart. New jobs carry `metadata.source`; rows from before that
 * shipped fall back to what the workflow produces, which still separates a
 * stem split from a transcription.
 */
export function resolveWorkflowType(workflow: Workflow | null | undefined): WorkflowType {
  const source = workflow?.metadata?.source || workflow?.outputs?.metadata?.source;
  if (source === 'stem_splitter') return WORKFLOW_TYPES.stems;
  if (source === 'midi_converter') return WORKFLOW_TYPES.midi;
  if (source === 'transcribe') return WORKFLOW_TYPES.transcription;

  const name = workflow?.workflow_name || '';
  if (STEM_ONLY_WORKFLOWS.includes(name)) return WORKFLOW_TYPES.stems;
  if (name === 'midi2score_quantize') return WORKFLOW_TYPES.score;
  return WORKFLOW_TYPES.transcription;
}

const fmtDurationShort = (secs: unknown): string | null => {
  const total = Number(secs);
  if (!Number.isFinite(total) || total <= 0) return null;
  return `${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, '0')}`;
};

/**
 * One line under the title: what the job is, how long, and the uploaded file.
 * The Library used to repeat the title here, so a row with no title showed two
 * blank lines.
 */
export function resolveDescription(workflow: Workflow | null | undefined): string {
  if (!workflow) return '';
  // The user's own "Edit details" description wins; then the server's generated
  // line; then one built here for backends that send neither.
  for (const candidate of [workflow.description, workflow.display_description]) {
    if (candidate && String(candidate).trim()) return String(candidate).trim();
  }
  const meta = workflow.metadata || {};
  const parts = [resolveWorkflowKind(workflow)];
  const dur = fmtDurationShort(meta.duration_seconds ?? workflow.duration_seconds);
  if (dur) parts.push(dur);
  const source = meta.original_filename || workflow.original_filename;
  const title = resolveDisplayName(workflow);
  if (source && source !== title) parts.push(source);
  return parts.join(' · ');
}

/**
 * Like resolveDisplayName, but shows the uploaded file as the user knows it:
 * "AdoMIRROR.mp3", not "AdoMIRROR". The server derives an auto title from the
 * filename stem; that is not a name anyone chose, so the filename wins over it.
 * A title the user actually set (Edit details, or a library track) still wins.
 */
export function resolveFileDisplayName(workflow: Workflow | null | undefined): string {
  if (!workflow) return 'Unknown';
  const meta = workflow.metadata || {};
  const outputsMeta = workflow.outputs?.metadata || {};
  const filename = workflow.original_filename || meta.original_filename || outputsMeta.original_filename;
  if (filename) {
    const stem = String(filename).replace(/\.[^.]+$/, '').trim();
    const title = (workflow.title || meta.title || outputsMeta.title || '').trim();
    if (!workflow.library_track_id && (!title || title === stem)) return String(filename).trim();
  }
  return resolveDisplayName(workflow);
}

/**
 * Resolve the best user-facing display name from a workflow status object.
 *
 * Checks every field the backend is known to populate, including
 * underscore variants (file_name) and path-bearing fields (input_file).
 * A raw workflow id is never a display name: a row with nothing else to go on
 * gets "<Instrument> transcription", not "WF_1a2b3c...".
 */
export function resolveDisplayName(workflow: Workflow | null | undefined): string {
  if (!workflow) return 'Unknown';

  const meta = workflow.metadata || {};
  const outputsMeta = workflow.outputs?.metadata || workflow.files?.metadata || {};

  // Ordered list of candidate values: first truthy string wins
  const candidates: unknown[] = [
    workflow.display_title, // server-computed, always human-readable
    workflow.title, // user-edited title from the linked library track
    workflow.original_filename,
    workflow.filename,
    workflow.file_name,
    meta.original_filename,
    meta.filename,
    meta.file_name,
    outputsMeta.original_filename,
    outputsMeta.filename,
    outputsMeta.file_name,
    workflow.input_filename,
    meta.input_filename,
    outputsMeta.input_filename,
    workflow.name,
    meta.name,
    outputsMeta.name,
    // Path-bearing fields: extract just the basename
    extractBasename(workflow.input_file),
    extractBasename(meta.input_file),
    extractBasename(outputsMeta.input_file),
    extractBasename(workflow.source_filename),
    extractBasename(meta.source_filename),
    extractBasename(outputsMeta.source_filename),
    extractBasename(workflow.source_file),
    extractBasename(meta.source_file),
    extractBasename(outputsMeta.source_file),
  ];

  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim()) return c.trim();
  }

  // Last resort: describe the job. Older backends send no display_title, and a
  // job started from R2 keys may carry no filename at all.
  const created = workflow.created_at || workflow.completed_at;
  const kind = resolveWorkflowKind(workflow);
  if (created) {
    const d = new Date(created);
    if (!Number.isNaN(d.getTime())) {
      return `${kind} \u2014 ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
  }
  return kind;
}

type KeySpec = string | string[];

// Maps instrument to the file keys for each output type
const STEM_KEYS: Record<string, string> = {
  drums: 'bs_roformer_drums_stem',
  piano: 'bs_roformer_piano_stem',
  bass: 'bs_roformer_bass_stem',
  jazz_bass: 'bs_roformer_bass_stem',
  vocals: 'bs_roformer_vocals_stem',
  guitar: 'bs_roformer_guitar_stem',
  other: 'bs_roformer_other_stem',
};

const MIDI_KEYS: Record<string, KeySpec> = {
  // Prefer the ADToF+ quantized MIDI: it matches the displayed beat-tracked score.
  drums: ['adtof_plus_drums_quantized_midi', 'adtof_plus_drums_midi', 'adtof_drums_midi'],
  piano: 'transkun_v2_piano_midi',
  bass: 'fcpe_bass_midi',
  jazz_bass: 'bassunet_jazz_bass_midi',
};

const TRANSCRIPTION_KEYS: Record<string, KeySpec> = {
  drums: ['adtof_plus_drums_musicxml', 'adtof_drums_musicxml'],
  piano: 'transkun_v2_piano_musicxml',
  bass: 'fcpe_bass_musicxml',
  jazz_bass: 'bassunet_jazz_bass_musicxml',
};

// The midi2score step names its output per-instrument for drums, but emits a
// bare `musicxml` for piano/bass/jazz_bass. Listing the real key first matters:
// when the instrument-specific name never resolves, selectOutputKey reports the
// score as unavailable and callers silently fall back to TRANSCRIPTION_KEYS,
// the raw, un-quantized model output, which for piano is a treble-only single
// staff with no left hand. (Verified against production outputs 2026-09-02:
// piano/bass/jazz_bass workflows only ever produce `musicxml`.)
const SCORE_KEYS: Record<string, KeySpec> = {
  drums: ['midi2score_drums_v2_musicxml', 'midi2score_drums_musicxml', 'musicxml'],
  piano: ['musicxml', 'midi2score_piano_musicxml'],
  bass: ['musicxml', 'midi2score_bass_musicxml'],
  jazz_bass: ['musicxml', 'midi2score_jazz_bass_musicxml'],
};

const asKeyList = (value: KeySpec | undefined): string[] =>
  (Array.isArray(value) ? value : [value]).filter((k): k is string => !!k);

/**
 * Every MusicXML key an instrument's chain can write, best first: the
 * quantized midi2score output, then the raw model score.
 *
 * Callers must walk the list rather than assume one name. Drums never produce
 * a bare `musicxml`; asking for it returned
 * "File 'musicxml' not found. Available: [... adtof_plus_drums_musicxml ...]".
 */
export function scoreKeysFor(instrument: string): string[] {
  const keys = [...asKeyList(SCORE_KEYS[instrument]), ...asKeyList(TRANSCRIPTION_KEYS[instrument])];
  return keys.filter((k, i) => keys.indexOf(k) === i);
}

const selectOutputKey = (
  keyMap: Record<string, KeySpec>,
  instrument: string,
  outputs: Record<string, unknown> | null,
  workflowName = ''
): string => {
  const fallback = keyMap[instrument] || keyMap.drums;
  const keys = asKeyList(fallback);
  if (outputs && typeof outputs === 'object') {
    return keys.find((key) => outputs[key]) || keys[0];
  }
  if (instrument === 'drums' && !workflowName.includes('_v2')) {
    // Legacy v1 drum workflows (no outputs metadata) predate the ADToF+ keys.
    return keys.find((key) => !key.includes('_plus') && !key.includes('_v2')) || keys[0];
  }
  return keys[0];
};

/**
 * Derive which download buttons should be shown for a workflow.
 *
 * If the workflow status payload includes an `outputs` object (keyed by file key),
 * availability is determined by checking whether the relevant key exists there.
 * Otherwise, we fall back to inference from workflow_name + instrument.
 *
 * Each entry is either { available: true, fileKey } or { available: false }.
 */
export function resolveAvailableOutputs(workflow: Workflow): AvailableOutputs {
  const instrument = workflow.metadata?.instrument || 'drums';
  // The status payload nests file keys under outputs.files (outputs also
  // carries a metadata block); older payloads used a flat files map.
  const outputs = workflow.outputs?.files || workflow.files || null;
  const workflowName = workflow.workflow_name || '';

  const stemKey = STEM_KEYS[instrument] || STEM_KEYS.drums;
  const midiKey = selectOutputKey(MIDI_KEYS, instrument, outputs, workflowName);
  const transcriptionKey = selectOutputKey(TRANSCRIPTION_KEYS, instrument, outputs, workflowName);
  const scoreKey = selectOutputKey(SCORE_KEYS, instrument, outputs, workflowName);

  if (outputs && typeof outputs === 'object') {
    // Backend explicitly lists available output keys
    return {
      instrument: outputs[stemKey]
        ? { available: true, fileKey: stemKey }
        : { available: false },
      transcription: outputs[transcriptionKey]
        ? { available: true, fileKey: transcriptionKey }
        : { available: false },
      midi: outputs[midiKey]
        ? { available: true, fileKey: midiKey }
        : { available: false },
      score: outputs[scoreKey]
        ? { available: true, fileKey: scoreKey }
        : { available: false },
    };
  }

  // Fallback: infer from workflow_name when no explicit outputs metadata
  const stemOnlyWorkflows = new Set(STEM_ONLY_WORKFLOWS);
  const isStemOnlyWorkflow = stemOnlyWorkflows.has(workflowName);
  const isTranscriptionInstrument = ['drums', 'jazz_bass', 'bass', 'piano'].includes(instrument);
  const isFullWorkflow = workflowName.includes('_full');

  return {
    instrument: { available: true, fileKey: stemKey },
    transcription: isTranscriptionInstrument && !isStemOnlyWorkflow
      ? { available: true, fileKey: transcriptionKey }
      : { available: false },
    midi: isTranscriptionInstrument && !isStemOnlyWorkflow
      ? { available: true, fileKey: midiKey }
      : { available: false },
    score: isFullWorkflow
      ? { available: true, fileKey: scoreKey }
      : { available: false },
  };
}

/**
 * Fetch detailed status for a specific workflow
 * @param baseUrl - Base URL for the API
 * @param workflowId - The workflow ID
 * @param getToken - auth getToken function from the app auth hook
 * @param signOut - Optional signOut function for auto-logout on auth errors
 * @throws {AuthError} for 401/403 responses
 */
export async function fetchWorkflowStatus<T = Workflow>(
  baseUrl: string,
  workflowId: string,
  getToken: GetToken,
  signOut: SignOut | null = null
): Promise<T> {
  const url = `${baseUrl}${apiPrefixForId(workflowId)}/status/${workflowId}`;
  let response: Response;
  if (apiPrefixForId(workflowId) === '/preview') {
    // Previews are owned by either the anonymous cookie session or, once
    // signed in, the user: attach the bearer when there is one and always
    // send the cookie, mirroring downloadWorkflowFile. The Library lists a
    // signed-in user's previews, so this path is now taken from there too.
    const headers = { accept: 'application/json', ...(await optionalBearer(getToken)) };
    response = await fetch(url, { method: 'GET', headers, credentials: 'include', cache: 'no-store' });
  } else {
    response = await authenticatedFetch(
      url,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      },
      getToken,
      signOut
    );
  }

  if (!response.ok) {
    throw new Error((await errorDetail(response)) || `Failed to fetch workflow status: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function getJsonAuthed<T>(
  url: string,
  getToken: GetToken,
  signOut: SignOut | null,
  failure: string
): Promise<T> {
  const response = await authenticatedFetch(
    url,
    {
      method: 'GET',
      headers: { accept: 'application/json' },
    },
    getToken,
    signOut
  );
  if (!response.ok) {
    throw new Error((await errorDetail(response)) || `${failure}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

async function sendJsonAuthed<T>(
  url: string,
  method: string,
  body: unknown,
  getToken: GetToken,
  signOut: SignOut | null,
  failure: string
): Promise<T> {
  const init: RequestInit =
    body === undefined
      ? { method, headers: { accept: 'application/json' } }
      : {
          method,
          headers: { accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify(body),
        };
  const response = await authenticatedFetch(url, init, getToken, signOut);
  if (!response.ok) {
    throw new Error((await errorDetail(response)) || `${failure}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

/**
 * Fetch the signed-in user's account summary (credits balance, plan, topups, etc.)
 * @param baseUrl - Base URL for the API
 * @param getToken - auth getToken function from the app auth hook
 * @param signOut - Optional signOut function for auto-logout on auth errors
 * @returns AccountSummaryResponse
 */
export async function fetchAccountSummary<T = JsonObject>(
  baseUrl: string,
  getToken: GetToken,
  signOut: SignOut | null = null
): Promise<T> {
  return getJsonAuthed<T>(`${baseUrl}/user/account`, getToken, signOut, 'Failed to fetch account summary');
}

export interface UsageHistoryParams {
  limit?: number | null;
  offset?: number | null;
}

/**
 * Fetch the signed-in user's credit transaction history.
 * @param baseUrl - Base URL for the API
 * @param getToken - auth getToken function from the app auth hook
 * @param params - { limit, offset }
 * @param signOut - Optional signOut function for auto-logout on auth errors
 */
export async function fetchAccountUsageHistory<T = UsageHistoryResponse>(
  baseUrl: string,
  getToken: GetToken,
  params: UsageHistoryParams = {},
  signOut: SignOut | null = null
): Promise<T> {
  const search = new URLSearchParams();
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.offset != null) search.set('offset', String(params.offset));
  const qs = search.toString();
  const url = `${baseUrl}/user/transactions${qs ? `?${qs}` : ''}`;
  return getJsonAuthed<T>(url, getToken, signOut, 'Failed to fetch usage history');
}

/**
 * Fetch the signed-in user's account settings (profile, security, prefs).
 * @returns AccountSettingsResponse
 */
export async function fetchAccountSettings<T = JsonObject>(
  baseUrl: string,
  getToken: GetToken,
  signOut: SignOut | null = null
): Promise<T> {
  return getJsonAuthed<T>(`${baseUrl}/account/settings`, getToken, signOut, 'Failed to fetch account settings');
}

/**
 * Fetch the public service-status snapshot (worker health + queue lag + recent
 * workflow counts). No auth required.
 * @param baseUrl - Base URL for the API (default: '/api')
 */
export async function fetchServiceStatus<T = JsonObject>(baseUrl: string = '/api'): Promise<T> {
  const response = await fetch(`${baseUrl}/service-status`, {
    method: 'GET',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch service status: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

/**
 * Fetch the public catalog of plans + top-ups. No auth required. This is the
 * SINGLE SOURCE OF TRUTH for pricing numbers: render prices/minutes from here,
 * not hardcoded values.
 * @param baseUrl - Base URL for the API (default: '/api')
 */
export async function fetchBillingPlans<T = BillingCatalog>(baseUrl: string = '/api'): Promise<T> {
  const response = await fetch(`${baseUrl}/billing/plans`, {
    method: 'GET',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch billing plans: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

/**
 * Fetch the signed-in user's subscription + minutes balance.
 */
export async function fetchUserSubscription<T = UserSubscription>(
  baseUrl: string,
  getToken: GetToken,
  signOut: SignOut | null = null
): Promise<T> {
  return getJsonAuthed<T>(`${baseUrl}/user/subscription`, getToken, signOut, 'Failed to fetch subscription');
}

/**
 * Read back what a Checkout Session actually charged.
 *
 * The success page needs a real amount to report as the conversion value, and
 * it cannot compute one: the total depends on presentment currency and any
 * discount, and anything carried in the redirect URL is caller-controlled.
 * The backend re-reads it from Stripe and refuses sessions owned by anyone
 * else.
 */
export async function fetchCheckoutSession<T = CheckoutSessionSummary>(
  baseUrl: string,
  sessionId: string,
  getToken: GetToken,
  signOut: SignOut | null = null
): Promise<T> {
  const response = await authenticatedFetch(
    `${baseUrl}/billing/checkout-session/${encodeURIComponent(sessionId)}`,
    { method: 'GET', headers: { accept: 'application/json' } },
    getToken,
    signOut
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch checkout session: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

/** Google Ads click ids from lib/attribution getClickIds(). */
export type ClickIds = Partial<Record<'gclid' | 'gbraid' | 'wbraid' | 'fbclid' | 'ttclid' | 'msclkid', string>>;

/**
 * Create a Stripe Checkout session for a plan or top-up and return the hosted URL.
 * @param plan - one of: tier2, tier2_annual, tier3, tier3_annual, topup-30, topup-60, topup-120
 * @param clickIds - Google Ads click ids ({gclid}/{gbraid}/{wbraid}) from
 *   lib/attribution. Passed in rather than read here so this module stays a
 *   pure transport helper with no dependencies of its own.
 */
export async function createCheckoutSession<T = CheckoutSession>(
  baseUrl: string,
  plan: string,
  getToken: GetToken,
  signOut: SignOut | null = null,
  currency: string | null = null,
  clickIds: ClickIds | null = null
): Promise<T> {
  // `currency` echoes back what the user was quoted (see /billing/plans),
  // so the Stripe Checkout total matches the price they clicked. Omitted,
  // the backend re-derives it from the caller's country.
  //
  // The click ids ride along so the webhook can record which ad click
  // earned this payment. Absent for every organic visitor, which is the
  // normal case and simply means the purchase is unattributed.
  return sendJsonAuthed<T>(
    `${baseUrl}/billing/create-checkout-session`,
    'POST',
    {
      plan,
      ...(currency ? { currency } : {}),
      ...(clickIds || {}),
    },
    getToken,
    signOut,
    'Failed to create checkout session'
  );
}

/**
 * Create a Stripe Billing Portal session so the user can manage/cancel their
 * subscription, and return the hosted portal URL.
 */
export async function createBillingPortalSession<T = { url: string }>(
  baseUrl: string,
  getToken: GetToken,
  signOut: SignOut | null = null
): Promise<T> {
  return sendJsonAuthed<T>(
    `${baseUrl}/billing/create-portal-session`,
    'POST',
    undefined,
    getToken,
    signOut,
    'Failed to open billing portal'
  );
}

/**
 * Cancel the signed-in user's subscription (Airwallex in-app cancel path;
 * Airwallex has no hosted billing portal). Stripe users cancel via the portal.
 */
export async function cancelSubscription<T = { status: string }>(
  baseUrl: string,
  getToken: GetToken,
  signOut: SignOut | null = null
): Promise<T> {
  return sendJsonAuthed<T>(
    `${baseUrl}/billing/cancel-subscription`,
    'POST',
    undefined,
    getToken,
    signOut,
    'Failed to cancel subscription'
  );
}

/* ------------------------------------------------------------------ *
 * Account / Profile  (several of these hit endpoints the backend
 * does not implement yet, see docs/BACKEND_GAPS.md). Handlers call
 * them best-effort and surface a friendly error until BE ships.
 * ------------------------------------------------------------------ */

/**
 * Fetch the signed-in user's public creator profile (username, display name,
 * bio, external links, avatar). NEW endpoint.
 */
export async function fetchCreatorProfile<T = OwnCreatorProfile>(
  baseUrl: string,
  getToken: GetToken,
  signOut: SignOut | null = null
): Promise<T> {
  return getJsonAuthed<T>(`${baseUrl}/account/profile`, getToken, signOut, 'Failed to fetch profile');
}

/**
 * Update the public creator profile. NEW endpoint.
 */
export async function updateCreatorProfile<T = OwnCreatorProfile>(
  baseUrl: string,
  patch: Partial<OwnCreatorProfile>,
  getToken: GetToken,
  signOut: SignOut | null = null
): Promise<T> {
  return sendJsonAuthed<T>(`${baseUrl}/account/profile`, 'PUT', patch, getToken, signOut, 'Failed to update profile');
}

/**
 * Check whether a username is available. NEW endpoint.
 */
export async function checkUsernameAvailability<T = { available: boolean }>(
  baseUrl: string,
  username: string,
  getToken: GetToken,
  signOut: SignOut | null = null
): Promise<T> {
  const response = await authenticatedFetch(
    `${baseUrl}/account/profile/username-available?username=${encodeURIComponent(username)}`,
    { method: 'GET', headers: { accept: 'application/json' } },
    getToken,
    signOut
  );
  if (!response.ok) {
    throw new Error((await errorDetail(response)) || `Username check failed: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

/**
 * Upload a new avatar image. NEW endpoint.
 */
export async function uploadAvatar<T = OwnCreatorProfile>(
  baseUrl: string,
  file: File,
  getToken: GetToken,
  signOut: SignOut | null = null
): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  const response = await authenticatedFetch(
    `${baseUrl}/account/profile/avatar`,
    { method: 'POST', body: form },
    getToken,
    signOut
  );
  if (!response.ok) {
    throw new Error((await errorDetail(response)) || `Avatar upload failed: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

/**
 * Update the user's private legal name. NEW endpoint.
 */
export async function updateAccountName<T = JsonObject>(
  baseUrl: string,
  patch: { first_name?: string; last_name?: string },
  getToken: GetToken,
  signOut: SignOut | null = null
): Promise<T> {
  return sendJsonAuthed<T>(`${baseUrl}/user/account`, 'PATCH', patch, getToken, signOut, 'Failed to update name');
}

/**
 * Request an email-address change (sends a confirmation email). NEW endpoint.
 * Note: Supabase can also do this client-side via supabase.auth.updateUser;
 * this server route is the preferred path so the BE can keep its mirror in sync.
 */
export async function updateUserEmail<T = JsonObject>(
  baseUrl: string,
  newEmail: string,
  getToken: GetToken,
  signOut: SignOut | null = null
): Promise<T> {
  return sendJsonAuthed<T>(
    `${baseUrl}/account/email`,
    'POST',
    { email: newEmail },
    getToken,
    signOut,
    'Failed to change email'
  );
}

/**
 * Permanently delete the signed-in user's account. NEW endpoint.
 */
export async function deleteAccount<T = JsonObject>(
  baseUrl: string,
  getToken: GetToken,
  signOut: SignOut | null = null
): Promise<T> {
  const response = await authenticatedFetch(
    `${baseUrl}/account`,
    { method: 'DELETE', headers: { accept: 'application/json' } },
    getToken,
    signOut
  );
  if (!response.ok) {
    throw new Error((await errorDetail(response)) || `Failed to delete account: ${response.statusText}`);
  }
  return (response.json() as Promise<T>).catch(() => ({}) as T);
}

/**
 * Fetch the default Stripe payment method (brand / last4 / exp) for display.
 * NEW endpoint (currently only the Stripe portal exposes this).
 */
export async function fetchPaymentMethod<T = PaymentMethod>(
  baseUrl: string,
  getToken: GetToken,
  signOut: SignOut | null = null
): Promise<T> {
  return getJsonAuthed<T>(`${baseUrl}/billing/payment-method`, getToken, signOut, 'Failed to fetch payment method');
}

/* ------------------------------------------------------------------ *
 * Library publish / edit / delete  (NEW endpoints, see gap doc)
 * ------------------------------------------------------------------ */

export type WorkflowVisibility = 'public' | 'unlisted' | 'private';

/**
 * Set a transcription's publish visibility. NEW endpoint.
 */
export async function updateWorkflowVisibility<T = JsonObject>(
  baseUrl: string,
  workflowId: string,
  visibility: WorkflowVisibility,
  getToken: GetToken,
  signOut: SignOut | null = null
): Promise<T> {
  return sendJsonAuthed<T>(
    `${baseUrl}/workflow/${workflowId}/visibility`,
    'POST',
    { visibility },
    getToken,
    signOut,
    'Failed to update visibility'
  );
}

/**
 * Edit a transcription's metadata (title, original artist, tags, description).
 * NEW endpoint.
 */
export async function updateWorkflowMetadata<T = JsonObject>(
  baseUrl: string,
  workflowId: string,
  patch: JsonObject,
  getToken: GetToken,
  signOut: SignOut | null = null
): Promise<T> {
  return sendJsonAuthed<T>(
    `${baseUrl}/workflow/${workflowId}`,
    'PATCH',
    patch,
    getToken,
    signOut,
    'Failed to update transcription'
  );
}

/**
 * Permanently delete a transcription and its files.
 * @param opts - deleteTrack: true also removes a published track from Explore;
 *   omitted/false keeps it live (server default).
 */
export async function deleteWorkflow<T = JsonObject>(
  baseUrl: string,
  workflowId: string,
  getToken: GetToken,
  signOut: SignOut | null = null,
  opts: { deleteTrack?: boolean } = {}
): Promise<T> {
  const qs = opts.deleteTrack ? '?delete_track=true' : '';
  const response = await authenticatedFetch(
    `${baseUrl}/workflow/${workflowId}${qs}`,
    { method: 'DELETE', headers: { accept: 'application/json' } },
    getToken,
    signOut
  );
  if (!response.ok) {
    throw new Error((await errorDetail(response)) || `Failed to delete transcription: ${response.statusText}`);
  }
  return (response.json() as Promise<T>).catch(() => ({}) as T);
}

/**
 * Download a JSON export of everything stored about the signed-in user
 * (GDPR portability pair to deleteAccount).
 */
export async function exportAccountData(
  baseUrl: string,
  getToken: GetToken,
  signOut: SignOut | null = null
): Promise<Blob> {
  const response = await authenticatedFetch(
    `${baseUrl}/account/export`,
    { method: 'GET', headers: { accept: 'application/json' } },
    getToken,
    signOut
  );
  if (!response.ok) {
    throw new Error((await errorDetail(response)) || `Export failed: ${response.statusText}`);
  }
  return response.blob();
}

/* ---------------------------------------------------------------------------
 * Campaign signup codes (/signup/:code)
 *
 * The pending-code handoff mirrors previewApi's pending-preview handoff: OAuth
 * bounces the browser out to Google/Apple/Facebook and back through
 * /sso-callback, so the code the visitor arrived with has to survive in
 * localStorage across that round trip. Without it, everyone who signs up with
 * a social button lands back on the site with no credit.
 * ------------------------------------------------------------------------- */

const PENDING_CAMPAIGN_CODE_KEY = 'gs_pending_campaign_code';

export function setPendingCampaignCode(code: string | null | undefined): void {
  try {
    if (code) localStorage.setItem(PENDING_CAMPAIGN_CODE_KEY, code);
  } catch {
    // Private mode / storage disabled. The in-page email flow still works
    // because the code never leaves the URL there.
  }
}

export function getPendingCampaignCode(): string | null {
  try {
    return localStorage.getItem(PENDING_CAMPAIGN_CODE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingCampaignCode(): void {
  try {
    localStorage.removeItem(PENDING_CAMPAIGN_CODE_KEY);
  } catch {
    /* storage disabled */
  }
}

/**
 * Fetch a campaign so the signup page can pick its state. Auth is optional:
 * pass getToken when signed in and the response also reports whether this
 * account may still claim. Never throws on an unknown code: the backend
 * answers `{status: 'invalid'}` so the page can render its soft landing.
 * @param baseUrl - Base URL for the API (default: '/api')
 */
export async function fetchCampaign<T = CampaignResponse>(
  baseUrl: string = '/api',
  code: string,
  getToken: GetToken | null = null
): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  try {
    if (getToken) {
      const token = await getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // No session: the lookup is still valid anonymously.
  }
  const response = await fetch(`${baseUrl}/campaign/${encodeURIComponent(code)}`, { headers });
  if (!response.ok) {
    throw httpError(`Failed to fetch campaign: ${response.status}`, response.status);
  }
  return response.json() as Promise<T>;
}

/**
 * Grant a campaign's minutes to the signed-in account. Idempotent: a repeat
 * call returns `already_claimed` rather than granting twice.
 */
export async function claimCampaign<T = CampaignClaim>(
  baseUrl: string,
  code: string,
  getToken: GetToken,
  signOut: SignOut | null = null
): Promise<T> {
  const response = await authenticatedFetch(
    `${baseUrl}/campaign/${encodeURIComponent(code)}/claim`,
    { method: 'POST', headers: { accept: 'application/json' } },
    getToken,
    signOut
  );
  if (!response.ok) {
    throw httpError((await errorDetail(response)) || `Claim failed: ${response.statusText}`, response.status);
  }
  return response.json() as Promise<T>;
}

/**
 * Claim whatever campaign the visitor arrived with, if any. Called once after
 * sign-in completes, from anywhere in the app: the OAuth callback does not
 * necessarily return to the campaign page, and the grant must not depend on
 * where the visitor lands. Clears the pending code on any terminal outcome so
 * a stale code can't retry forever.
 */
export async function claimPendingCampaignIfAny(
  baseUrl: string,
  getToken: GetToken
): Promise<(CampaignClaim & { code: string }) | null> {
  const code = getPendingCampaignCode();
  if (!code) return null;
  try {
    const result = await claimCampaign<CampaignClaim>(baseUrl, code, getToken);
    clearPendingCampaignCode();
    return { ...result, code };
  } catch (err) {
    // 404 unknown, 409 ineligible, 410 ended: none get better on a retry.
    const status = (err as HttpError).status;
    if (status !== undefined && [404, 409, 410].includes(status)) clearPendingCampaignCode();
    throw err;
  }
}
