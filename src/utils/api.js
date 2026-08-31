/**
 * API Utility - Authenticated API calls with Supabase JWT tokens
 *
 * This utility provides helper functions for making authenticated API calls
 * to the backend with Bearer tokens from Supabase.
 */

/**
 * Sanitize a filename to be safe for HTTP headers (ASCII-only).
 * Normalizes Unicode (e.g. combining accents) and replaces non-ASCII chars.
 */
function sanitizeFilename(name) {
  return name.normalize('NFC').replace(/[^\x20-\x7E]/g, '_');
}

/**
 * Custom error class for authentication-related errors
 */
export class AuthError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.isAuthError = true;
  }
}

/**
 * Make an authenticated fetch request with Supabase JWT token
 * This function automatically handles token refresh and auth errors
 *
 * @param {string} url - The API endpoint URL
 * @param {Object} options - Fetch options (method, body, headers, etc.)
 * @param {Function} getToken - auth getToken function from the app auth hook
 * @param {Function} signOut - Optional signOut function for auto-logout on auth errors
 * @returns {Promise<Response>} - The fetch response
 * @throws {AuthError} - Throws AuthError for 401/403 responses
 */
export async function authenticatedFetch(url, options = {}, getToken, signOut = null) {
  // Get a fresh JWT token from Supabase session
  const token = await getToken();

  console.log('Token obtained:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');

  // Merge headers, adding Authorization if token exists
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    console.warn('No authentication token available');
    throw new AuthError('Authentication required - no token available', 401);
  }

  console.log('Request headers:', headers);

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
      const errorData = await response.clone().json();
      errorMessage = errorData.detail || errorData.message || errorMessage;
    } catch (e) {
      // If parsing fails, use the status text
      errorMessage = response.statusText || errorMessage;
    }

    // Log user out if signOut function provided
    if (signOut) {
      console.log('Token expired or invalid - signing out user');
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
 * @param {File} file - The file to upload
 * @param {string} endpoint - The API endpoint (e.g., '/workflow/bs_roformer_separate')
 * @param {Function} getToken - auth getToken function from the app auth hook
 * @param {string} baseUrl - Base URL for the API (default: '/api')
 * @param {Function} signOut - Optional signOut function for auto-logout on auth errors
 * @returns {Promise<Object>} - The JSON response from the server
 * @throws {AuthError} - Throws AuthError for 401/403 responses
 */
export async function uploadFileAuthenticated(
  file,
  endpoint,
  getToken,
  baseUrl = '/api',
  signOut = null
) {
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
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Upload failed: ${response.statusText}`);
  }

  // NOTE: no workflow_started event here. Nothing in the app calls this
  // helper - Hero, StemSplitter and MidiConverter each POST to /workflow/*
  // through authenticatedFetch directly, and that is where the event fires.
  // Emitting it here as well would be dead code today and a double count the
  // day someone starts using this helper.
  return response.json();
}

/**
 * Fetch the list of user workflows from the backend
 * @param {string} baseUrl - Base URL for the API
 * @param {Function} getToken - auth getToken function from the app auth hook
 * @param {Function} signOut - Optional signOut function for auto-logout on auth errors
 * @returns {Promise<Array>} - Array of workflow objects
 * @throws {AuthError} - Throws AuthError for 401/403 responses
 */
export async function fetchWorkflowList(baseUrl, getToken, signOut = null, params = null) {
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
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch workflows: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('API Response from /workflow/list:', data);
  console.log('Is array?', Array.isArray(data));
  console.log('Type:', typeof data);
  return data;
}

/**
 * Download a workflow output file
 * @param {string} baseUrl - Base URL for the API (e.g., '/api')
 * @param {string} workflowId - The workflow/job ID
 * @param {string} fileKey - The file key (e.g., 'drums', 'midi', 'transcription')
 * @param {Function} getToken - auth getToken function from the app auth hook
 * @returns {Promise<{blob: Blob, filename: string | null} | null>}
 *   Returns null if file not found (404), otherwise returns { blob, filename }
 * @throws {Error} - For non-404 download failures
 */
export async function downloadWorkflowFile(baseUrl, workflowId, fileKey, getToken) {
  // Preview previews carry IDs prefixed with `PRV` and live under /preview/...
  const isPreview = workflowId && workflowId.startsWith('PRV');
  const prefix = isPreview ? '/preview' : '/workflow';
  const url = `${baseUrl}${prefix}/download/${workflowId}/${fileKey}`;
  let res;
  if (isPreview) {
    // Previews are anonymous-capable via the gs_anon cookie — attach the
    // bearer only when a session exists instead of throwing without one
    // (authenticatedFetch requires a token, which anonymous visitors lack).
    const headers = {};
    if (getToken) {
      try {
        const token = await getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch {
        /* anonymous fallback */
      }
    }
    res = await fetch(url, { headers, credentials: 'include' });
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
  const cd = res.headers.get('content-disposition') || '';
  const match = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
  const filename = match ? decodeURIComponent(match[1] || match[2]) : null;
  return { blob, filename };
}

// Instruments whose workflows engrave a score (everything else is separation
// only, and has no MusicXML or PDF to offer).
export const SCORE_INSTRUMENTS = ['drums', 'jazz_bass', 'bass', 'piano'];

/**
 * Fetch the transcription's score as a paginated, print-ready PDF.
 *
 * MusicXML needs an editor to open; the PDF is the copy you can print or put on
 * a stand, so it is downloaded alongside the MusicXML. The server engraves it
 * with Verovio. Returns null when this job has no score (a separation-only run).
 */
export async function downloadScorePdf(baseUrl, workflowId, getToken) {
  const isPreview = workflowId && workflowId.startsWith('PRV');
  const url = `${baseUrl}${isPreview ? '/preview' : '/workflow'}/score-pdf/${workflowId}`;
  let res;
  if (isPreview) {
    const headers = {};
    if (getToken) {
      try {
        const token = await getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch {
        /* anonymous fallback */
      }
    }
    res = await fetch(url, { headers, credentials: 'include' });
  } else {
    res = await authenticatedFetch(url, {}, getToken);
  }
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Score PDF failed: ${res.status}`);
  }
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') || '';
  const match = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
  const filename = match ? decodeURIComponent(match[1] || match[2]) : null;
  return { blob, filename };
}

/**
 * Fetch a workflow output as text (e.g. MusicXML).
 * Returns null on 404.
 */
export async function fetchMusicXmlText(baseUrl, workflowId, getToken, fileKey = 'musicxml') {
  const result = await downloadWorkflowFile(baseUrl, workflowId, fileKey, getToken);
  if (!result) return null;
  const text = await result.blob.text();
  return text;
}

/**
 * Fetch a workflow output as ArrayBuffer (e.g. MIDI bytes).
 * Returns null on 404.
 */
export async function fetchMidiArrayBuffer(baseUrl, workflowId, midiKey, getToken) {
  const result = await downloadWorkflowFile(baseUrl, workflowId, midiKey, getToken);
  if (!result) return null;
  const buffer = await result.blob.arrayBuffer();
  return buffer;
}

/**
 * Extract the filename portion from a value that may be a full file path.
 * Returns the original value if it doesn't look like a path.
 */
function extractBasename(value) {
  if (!value || typeof value !== 'string') return value;
  // Strip any leading path (Unix or Windows-style)
  const base = value.split('/').pop().split('\\').pop();
  return base || value;
}

// Workflow name -> the instrument it transcribes. Mirrors the orchestrator's
// _INSTRUMENT_BY_WORKFLOW; used to label rows whose metadata never carried one.
const INSTRUMENT_BY_WORKFLOW = {
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

const INSTRUMENT_DISPLAY = {
  drums: 'Drums',
  piano: 'Piano',
  bass: 'Bass',
  jazz_bass: 'Jazz bass',
  vocals: 'Vocals',
  guitar: 'Guitar',
  other: 'Other',
};

/** The instrument a workflow is about, from metadata or its workflow name. */
export function resolveInstrument(workflow) {
  if (!workflow) return null;
  return (
    workflow.metadata?.instrument
    || workflow.outputs?.metadata?.instrument
    || INSTRUMENT_BY_WORKFLOW[workflow.workflow_name]
    || null
  );
}

/** "Piano transcription" / "Stem separation" — what the job produces. */
export function resolveWorkflowKind(workflow) {
  const name = workflow?.workflow_name || '';
  if (['bs_roformer_separate', 'demucs_separate', 'separate_to_guitar_stem'].includes(name)) {
    return 'Stem separation';
  }
  if (name === 'midi2score_quantize') return 'Score from MIDI';
  return `${INSTRUMENT_DISPLAY[resolveInstrument(workflow)] || 'Audio'} transcription`;
}

const fmtDurationShort = (secs) => {
  const total = Number(secs);
  if (!Number.isFinite(total) || total <= 0) return null;
  return `${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, '0')}`;
};

/**
 * One line under the title: what the job is, how long, and the uploaded file.
 * The Library used to repeat the title here, so a row with no title showed two
 * blank lines.
 */
export function resolveDescription(workflow) {
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
 * Resolve the best user-facing display name from a workflow status object.
 *
 * Checks every field the backend is known to populate, including
 * underscore variants (file_name) and path-bearing fields (input_file).
 * A raw workflow id is never a display name — a row with nothing else to go on
 * gets "<Instrument> transcription", not "WF_1a2b3c…".
 */
export function resolveDisplayName(workflow) {
  if (!workflow) return 'Unknown';

  const meta = workflow.metadata || {};
  const outputsMeta = workflow.outputs?.metadata || workflow.files?.metadata || {};

  // Ordered list of candidate values – first truthy string wins
  const candidates = [
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
      return `${kind} — ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
  }
  return kind;
}

// Maps instrument to the file keys for each output type
const STEM_KEYS = {
  drums: 'bs_roformer_drums_stem',
  piano: 'bs_roformer_piano_stem',
  bass: 'bs_roformer_bass_stem',
  jazz_bass: 'bs_roformer_bass_stem',
  vocals: 'bs_roformer_vocals_stem',
  guitar: 'bs_roformer_guitar_stem',
  other: 'bs_roformer_other_stem',
};

const MIDI_KEYS = {
  // Prefer the ADToF+ quantized MIDI: it matches the displayed beat-tracked score.
  drums: ['adtof_plus_drums_quantized_midi', 'adtof_plus_drums_midi', 'adtof_drums_midi'],
  piano: 'transkun_v2_piano_midi',
  bass: 'fcpe_bass_midi',
  jazz_bass: 'bassunet_jazz_bass_midi',
};

const TRANSCRIPTION_KEYS = {
  drums: ['adtof_plus_drums_musicxml', 'adtof_drums_musicxml'],
  piano: 'transkun_v2_piano_musicxml',
  bass: 'fcpe_bass_musicxml',
  jazz_bass: 'bassunet_jazz_bass_musicxml',
};

const SCORE_KEYS = {
  drums: ['midi2score_drums_v2_musicxml', 'midi2score_drums_musicxml'],
  piano: 'midi2score_piano_musicxml',
  bass: 'midi2score_bass_musicxml',
  jazz_bass: 'midi2score_jazz_bass_musicxml',
};

const asKeyList = (value) => (Array.isArray(value) ? value : [value]).filter(Boolean);

const selectOutputKey = (keyMap, instrument, outputs, workflowName = '') => {
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
 * Returns: { instrument, transcription, midi, score }
 *   Each is either { available: true, fileKey } or { available: false }.
 */
export function resolveAvailableOutputs(workflow) {
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
  const stemOnlyWorkflows = new Set([
    'bs_roformer_separate',
    'demucs_separate',
    'separate_to_guitar_stem',
    'compress_stems',
  ]);
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
 * @param {string} baseUrl - Base URL for the API
 * @param {string} workflowId - The workflow ID
 * @param {Function} getToken - auth getToken function from the app auth hook
 * @param {Function} signOut - Optional signOut function for auto-logout on auth errors
 * @returns {Promise<Object>} - Workflow status object
 * @throws {AuthError} - Throws AuthError for 401/403 responses
 */
export async function fetchWorkflowStatus(baseUrl, workflowId, getToken, signOut = null) {
  const response = await authenticatedFetch(
    `${baseUrl}/workflow/status/${workflowId}`,
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
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch workflow status: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch the signed-in user's account summary (credits balance, plan, topups, etc.)
 * @param {string} baseUrl - Base URL for the API
 * @param {Function} getToken - auth getToken function from the app auth hook
 * @param {Function} signOut - Optional signOut function for auto-logout on auth errors
 * @returns {Promise<Object>} - AccountSummaryResponse
 */
export async function fetchAccountSummary(baseUrl, getToken, signOut = null) {
  const response = await authenticatedFetch(
    `${baseUrl}/user/account`,
    {
      method: 'GET',
      headers: { accept: 'application/json' },
    },
    getToken,
    signOut
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch account summary: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch the signed-in user's credit transaction history.
 * @param {string} baseUrl - Base URL for the API
 * @param {Function} getToken - auth getToken function from the app auth hook
 * @param {{ limit?: number, offset?: number }} [params]
 * @param {Function} signOut - Optional signOut function for auto-logout on auth errors
 * @returns {Promise<Object>} - { transactions: Array<{ id, amount, amount_minutes, balance_after, transaction_type, description, created_at, workflow_id }>, total }
 */
export async function fetchAccountUsageHistory(baseUrl, getToken, params = {}, signOut = null) {
  const search = new URLSearchParams();
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.offset != null) search.set('offset', String(params.offset));
  const qs = search.toString();
  const url = `${baseUrl}/user/transactions${qs ? `?${qs}` : ''}`;

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
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch usage history: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch the signed-in user's account settings (profile, security, prefs).
 * @param {string} baseUrl - Base URL for the API
 * @param {Function} getToken - auth getToken function from the app auth hook
 * @param {Function} signOut - Optional signOut function for auto-logout on auth errors
 * @returns {Promise<Object>} - AccountSettingsResponse
 */
export async function fetchAccountSettings(baseUrl, getToken, signOut = null) {
  const response = await authenticatedFetch(
    `${baseUrl}/account/settings`,
    {
      method: 'GET',
      headers: { accept: 'application/json' },
    },
    getToken,
    signOut
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch account settings: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch the public service-status snapshot (worker health + queue lag + recent
 * workflow counts). No auth required.
 * @param {string} baseUrl - Base URL for the API (default: '/api')
 */
export async function fetchServiceStatus(baseUrl = '/api') {
  const response = await fetch(`${baseUrl}/service-status`, {
    method: 'GET',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch service status: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch the public catalog of plans + top-ups. No auth required. This is the
 * SINGLE SOURCE OF TRUTH for pricing numbers — render prices/minutes from here,
 * not hardcoded values.
 * @param {string} baseUrl - Base URL for the API (default: '/api')
 * @returns {Promise<{ plans: Array<{ id, display_name, credits_per_month, minutes_per_month, price_monthly_usd, price_annual_usd, max_rollover }>, topups: Array<{ id, display_name, credits, minutes, price_usd, priority_queue }> }>}
 */
export async function fetchBillingPlans(baseUrl = '/api') {
  const response = await fetch(`${baseUrl}/billing/plans`, {
    method: 'GET',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch billing plans: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch the signed-in user's subscription + minutes balance.
 * @returns {Promise<{ user_id, tier, credits_balance, balance_seconds, balance_minutes, is_active, next_recharge_at, subscription_id, customer_id }>}
 */
export async function fetchUserSubscription(baseUrl, getToken, signOut = null) {
  const response = await authenticatedFetch(
    `${baseUrl}/user/subscription`,
    { method: 'GET', headers: { accept: 'application/json' } },
    getToken,
    signOut
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch subscription: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Create a Stripe Checkout session for a plan or top-up and return the hosted URL.
 * @param {string} baseUrl
 * @param {string} plan - one of: tier2, tier2_annual, tier3, tier3_annual, topup-30, topup-60, topup-120
 * @param {Function} getToken
 * @param {Function} [signOut]
 * @returns {Promise<{ session_id: string, url: string }>}
 */
export async function createCheckoutSession(
  baseUrl,
  plan,
  getToken,
  signOut = null,
  currency = null
) {
  const response = await authenticatedFetch(
    `${baseUrl}/billing/create-checkout-session`,
    {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      // `currency` echoes back what the user was quoted (see /billing/plans),
      // so the Stripe Checkout total matches the price they clicked. Omitted,
      // the backend re-derives it from the caller's country.
      body: JSON.stringify(currency ? { plan, currency } : { plan }),
    },
    getToken,
    signOut
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to create checkout session: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Create a Stripe Billing Portal session so the user can manage/cancel their
 * subscription, and return the hosted portal URL.
 * @returns {Promise<{ url: string }>}
 */
export async function createBillingPortalSession(baseUrl, getToken, signOut = null) {
  const response = await authenticatedFetch(
    `${baseUrl}/billing/create-portal-session`,
    { method: 'POST', headers: { accept: 'application/json' } },
    getToken,
    signOut
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to open billing portal: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Cancel the signed-in user's subscription (Airwallex in-app cancel path;
 * Airwallex has no hosted billing portal). Stripe users cancel via the portal.
 * @returns {Promise<{ status: string }>}
 */
export async function cancelSubscription(baseUrl, getToken, signOut = null) {
  const response = await authenticatedFetch(
    `${baseUrl}/billing/cancel-subscription`,
    { method: 'POST', headers: { accept: 'application/json' } },
    getToken,
    signOut
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to cancel subscription: ${response.statusText}`);
  }
  return response.json();
}

/* ------------------------------------------------------------------ *
 * Account / Profile  (⚠ several of these hit endpoints the backend
 * does not implement yet — see docs/BACKEND_GAPS.md). Handlers call
 * them best-effort and surface a friendly error until BE ships.
 * ------------------------------------------------------------------ */

/**
 * Fetch the signed-in user's public creator profile (username, display name,
 * bio, external links, avatar). ⚠ NEW endpoint.
 * @returns {Promise<{ username, display_name, bio, avatar_url, links:Array<{platform,url}>, member_since }>}
 */
export async function fetchCreatorProfile(baseUrl, getToken, signOut = null) {
  const response = await authenticatedFetch(
    `${baseUrl}/account/profile`,
    { method: 'GET', headers: { accept: 'application/json' } },
    getToken,
    signOut
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch profile: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Update the public creator profile. ⚠ NEW endpoint.
 * @param {{ username?, display_name?, bio?, links? }} patch
 */
export async function updateCreatorProfile(baseUrl, patch, getToken, signOut = null) {
  const response = await authenticatedFetch(
    `${baseUrl}/account/profile`,
    {
      method: 'PUT',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    },
    getToken,
    signOut
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to update profile: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Check whether a username is available. ⚠ NEW endpoint.
 * @returns {Promise<{ available: boolean }>}
 */
export async function checkUsernameAvailability(baseUrl, username, getToken, signOut = null) {
  const response = await authenticatedFetch(
    `${baseUrl}/account/profile/username-available?username=${encodeURIComponent(username)}`,
    { method: 'GET', headers: { accept: 'application/json' } },
    getToken,
    signOut
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Username check failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Upload a new avatar image. ⚠ NEW endpoint.
 * @param {File} file
 */
export async function uploadAvatar(baseUrl, file, getToken, signOut = null) {
  const form = new FormData();
  form.append('file', file);
  const response = await authenticatedFetch(
    `${baseUrl}/account/profile/avatar`,
    { method: 'POST', body: form },
    getToken,
    signOut
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Avatar upload failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Update the user's private legal name. ⚠ NEW endpoint.
 * @param {{ first_name, last_name }} patch
 */
export async function updateAccountName(baseUrl, patch, getToken, signOut = null) {
  const response = await authenticatedFetch(
    `${baseUrl}/user/account`,
    {
      method: 'PATCH',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    },
    getToken,
    signOut
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to update name: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Request an email-address change (sends a confirmation email). ⚠ NEW endpoint.
 * Note: Supabase can also do this client-side via supabase.auth.updateUser —
 * this server route is the preferred path so the BE can keep its mirror in sync.
 */
export async function updateUserEmail(baseUrl, newEmail, getToken, signOut = null) {
  const response = await authenticatedFetch(
    `${baseUrl}/account/email`,
    {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ email: newEmail }),
    },
    getToken,
    signOut
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to change email: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Permanently delete the signed-in user's account. ⚠ NEW endpoint.
 */
export async function deleteAccount(baseUrl, getToken, signOut = null) {
  const response = await authenticatedFetch(
    `${baseUrl}/account`,
    { method: 'DELETE', headers: { accept: 'application/json' } },
    getToken,
    signOut
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to delete account: ${response.statusText}`);
  }
  return response.json().catch(() => ({}));
}

/**
 * Fetch the default Stripe payment method (brand / last4 / exp) for display.
 * ⚠ NEW endpoint (currently only the Stripe portal exposes this).
 * @returns {Promise<{ brand, last4, exp }>}
 */
export async function fetchPaymentMethod(baseUrl, getToken, signOut = null) {
  const response = await authenticatedFetch(
    `${baseUrl}/billing/payment-method`,
    { method: 'GET', headers: { accept: 'application/json' } },
    getToken,
    signOut
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch payment method: ${response.statusText}`);
  }
  return response.json();
}

/* ------------------------------------------------------------------ *
 * Library publish / edit / delete  (⚠ NEW endpoints — see gap doc)
 * ------------------------------------------------------------------ */

/**
 * Set a transcription's publish visibility. ⚠ NEW endpoint.
 * @param {'public'|'unlisted'|'private'} visibility
 */
export async function updateWorkflowVisibility(baseUrl, workflowId, visibility, getToken, signOut = null) {
  const response = await authenticatedFetch(
    `${baseUrl}/workflow/${workflowId}/visibility`,
    {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ visibility }),
    },
    getToken,
    signOut
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to update visibility: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Edit a transcription's metadata (title, original artist, tags, description).
 * ⚠ NEW endpoint.
 */
export async function updateWorkflowMetadata(baseUrl, workflowId, patch, getToken, signOut = null) {
  const response = await authenticatedFetch(
    `${baseUrl}/workflow/${workflowId}`,
    {
      method: 'PATCH',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    },
    getToken,
    signOut
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to update transcription: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Permanently delete a transcription and its files.
 * @param {{ deleteTrack?: boolean }} [opts] - deleteTrack: true also removes a
 *   published track from Explore; omitted/false keeps it live (server default).
 */
export async function deleteWorkflow(baseUrl, workflowId, getToken, signOut = null, opts = {}) {
  const qs = opts.deleteTrack ? '?delete_track=true' : '';
  const response = await authenticatedFetch(
    `${baseUrl}/workflow/${workflowId}${qs}`,
    { method: 'DELETE', headers: { accept: 'application/json' } },
    getToken,
    signOut
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to delete transcription: ${response.statusText}`);
  }
  return response.json().catch(() => ({}));
}

/**
 * Download a JSON export of everything stored about the signed-in user
 * (GDPR portability pair to deleteAccount).
 * @returns {Promise<Blob>}
 */
export async function exportAccountData(baseUrl, getToken, signOut = null) {
  const response = await authenticatedFetch(
    `${baseUrl}/account/export`,
    { method: 'GET', headers: { accept: 'application/json' } },
    getToken,
    signOut
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Export failed: ${response.statusText}`);
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

export function setPendingCampaignCode(code) {
  try {
    if (code) localStorage.setItem(PENDING_CAMPAIGN_CODE_KEY, code);
  } catch (_) {
    // Private mode / storage disabled. The in-page email flow still works
    // because the code never leaves the URL there.
  }
}

export function getPendingCampaignCode() {
  try {
    return localStorage.getItem(PENDING_CAMPAIGN_CODE_KEY);
  } catch (_) {
    return null;
  }
}

export function clearPendingCampaignCode() {
  try {
    localStorage.removeItem(PENDING_CAMPAIGN_CODE_KEY);
  } catch (_) {}
}

/**
 * Fetch a campaign so the signup page can pick its state. Auth is optional:
 * pass getToken when signed in and the response also reports whether this
 * account may still claim. Never throws on an unknown code — the backend
 * answers `{status: 'invalid'}` so the page can render its soft landing.
 * @param {string} baseUrl - Base URL for the API (default: '/api')
 * @returns {Promise<{ status: 'default'|'invalid'|'expired'|'signed_in'|'signed_in_ineligible'|'redeemed', code: string, campaign: object|null, balance_seconds?: number }>}
 */
export async function fetchCampaign(baseUrl = '/api', code, getToken = null) {
  const headers = { accept: 'application/json' };
  try {
    if (getToken) {
      const token = await getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (_) {
    // No session — the lookup is still valid anonymously.
  }
  const response = await fetch(`${baseUrl}/campaign/${encodeURIComponent(code)}`, { headers });
  if (!response.ok) {
    const error = new Error(`Failed to fetch campaign: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

/**
 * Grant a campaign's minutes to the signed-in account. Idempotent: a repeat
 * call returns `already_claimed` rather than granting twice.
 * @returns {Promise<{ status: 'granted'|'already_claimed', credits_granted: number, balance_seconds: number }>}
 */
export async function claimCampaign(baseUrl, code, getToken, signOut = null) {
  const response = await authenticatedFetch(
    `${baseUrl}/campaign/${encodeURIComponent(code)}/claim`,
    { method: 'POST', headers: { accept: 'application/json' } },
    getToken,
    signOut
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.detail || `Claim failed: ${response.statusText}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

/**
 * Claim whatever campaign the visitor arrived with, if any. Called once after
 * sign-in completes, from anywhere in the app — the OAuth callback does not
 * necessarily return to the campaign page, and the grant must not depend on
 * where the visitor lands. Clears the pending code on any terminal outcome so
 * a stale code can't retry forever.
 */
export async function claimPendingCampaignIfAny(baseUrl, getToken) {
  const code = getPendingCampaignCode();
  if (!code) return null;
  try {
    const result = await claimCampaign(baseUrl, code, getToken);
    clearPendingCampaignCode();
    return { ...result, code };
  } catch (err) {
    // 404 unknown, 409 ineligible, 410 ended — none get better on a retry.
    if ([404, 409, 410].includes(err.status)) clearPendingCampaignCode();
    throw err;
  }
}
