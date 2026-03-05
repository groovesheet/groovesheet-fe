/**
 * API Utility - Authenticated API calls with Clerk JWT tokens
 *
 * This utility provides helper functions for making authenticated API calls
 * to the backend with Bearer tokens from Clerk.
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
 * Make an authenticated fetch request with Clerk JWT token
 * This function automatically handles token refresh and auth errors
 *
 * @param {string} url - The API endpoint URL
 * @param {Object} options - Fetch options (method, body, headers, etc.)
 * @param {Function} getToken - Clerk's getToken function from useAuth hook
 * @param {Function} signOut - Optional Clerk's signOut function for auto-logout on auth errors
 * @returns {Promise<Response>} - The fetch response
 * @throws {AuthError} - Throws AuthError for 401/403 responses
 */
export async function authenticatedFetch(url, options = {}, getToken, signOut = null) {
  // Get a fresh JWT token from Clerk (this automatically refreshes if needed)
  const token = await getToken({
    // Skip cache to always get a fresh token
    skipCache: false,
    // Template can be specified if using custom JWT templates
    // template: 'default'
  });

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
 * @param {string} endpoint - The API endpoint (e.g., '/workflow/demucs_separate')
 * @param {Function} getToken - Clerk's getToken function from useAuth hook
 * @param {string} baseUrl - Base URL for the API (default: '/api')
 * @param {Function} signOut - Optional Clerk's signOut function for auto-logout on auth errors
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
 * @param {Function} getToken - Clerk's getToken function from useAuth hook
 * @param {Function} signOut - Optional Clerk's signOut function for auto-logout on auth errors
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
 * @param {Function} getToken - Clerk's getToken function from useAuth hook
 * @returns {Promise<{blob: Blob, filename: string | null} | null>}
 *   Returns null if file not found (404), otherwise returns { blob, filename }
 * @throws {Error} - For non-404 download failures
 */
export async function downloadWorkflowFile(baseUrl, workflowId, fileKey, getToken) {
  const url = `${baseUrl}/workflow/download/${workflowId}/${fileKey}`;
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
 * Fetch detailed status for a specific workflow
 * @param {string} baseUrl - Base URL for the API
 * @param {string} workflowId - The workflow ID
 * @param {Function} getToken - Clerk's getToken function from useAuth hook
 * @param {Function} signOut - Optional Clerk's signOut function for auto-logout on auth errors
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
