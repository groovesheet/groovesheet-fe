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
export async function fetchWorkflowList(baseUrl, getToken, signOut = null) {
  const response = await authenticatedFetch(
    `${baseUrl}/workflow/list`,
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
  const prefix = workflowId && workflowId.startsWith('PRV') ? '/preview' : '/workflow';
  const url = `${baseUrl}${prefix}/download/${workflowId}/${fileKey}`;
  const res = await authenticatedFetch(url, {}, getToken);
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

/**
 * Resolve the best user-facing display name from a workflow status object.
 *
 * Checks every field the backend is known to populate, including
 * underscore variants (file_name) and path-bearing fields (input_file).
 * Falls back to workflow_id only as a true last resort.
 */
export function resolveDisplayName(workflow) {
  if (!workflow) return 'Unknown';

  const meta = workflow.metadata || {};
  const outputsMeta = workflow.outputs?.metadata || workflow.files?.metadata || {};

  // Ordered list of candidate values – first truthy string wins
  const candidates = [
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
    // True last resort
    workflow.workflow_id,
  ];

  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim()) return c.trim();
  }

  return 'Unknown';
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
  drums: 'adtof_drums_midi',
  piano: 'transkun_v2_piano_midi',
  bass: 'fcpe_bass_midi',
  jazz_bass: 'bassunet_jazz_bass_midi',
};

const TRANSCRIPTION_KEYS = {
  drums: 'adtof_drums_musicxml',
  piano: 'transkun_v2_piano_musicxml',
  bass: 'fcpe_bass_musicxml',
  jazz_bass: 'bassunet_jazz_bass_musicxml',
};

const SCORE_KEYS = {
  drums: 'midi2score_drums_musicxml',
  piano: 'midi2score_piano_musicxml',
  bass: 'midi2score_bass_musicxml',
  jazz_bass: 'midi2score_jazz_bass_musicxml',
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
  const outputs = workflow.outputs || workflow.files || null;

  const stemKey = STEM_KEYS[instrument] || STEM_KEYS.drums;
  const midiKey = MIDI_KEYS[instrument] || MIDI_KEYS.drums;
  const transcriptionKey = TRANSCRIPTION_KEYS[instrument] || TRANSCRIPTION_KEYS.drums;
  const scoreKey = SCORE_KEYS[instrument] || SCORE_KEYS.drums;

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
  const workflowName = workflow.workflow_name || '';
  const isSeparationOnly = workflowName.includes('separate') && !workflowName.includes('full');
  const isFullWorkflow = workflowName.includes('_full');

  return {
    instrument: { available: true, fileKey: stemKey },
    transcription: isSeparationOnly
      ? { available: false }
      : { available: true, fileKey: transcriptionKey },
    midi: isSeparationOnly
      ? { available: false }
      : { available: true, fileKey: midiKey },
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
export async function createCheckoutSession(baseUrl, plan, getToken, signOut = null) {
  const response = await authenticatedFetch(
    `${baseUrl}/billing/create-checkout-session`,
    {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ plan }),
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
