/**
 * API Utility - Authenticated API calls with Clerk JWT tokens
 *
 * This utility provides helper functions for making authenticated API calls
 * to the backend with Bearer tokens from Clerk.
 */

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
  formData.append('file', file);

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
 * Download a workflow output file and trigger a browser save dialog
 * @param {string} baseUrl - Base URL for the API (default: '/api')
 * @param {string} id - The workflow ID
 * @param {string} fileKey - The file key (e.g. 'transcription', 'midi', 'bd_audio')
 * @param {string} defaultExtension - Fallback file extension (e.g. '.wav', '.mid')
 * @param {string} labelForFilename - Label used to construct the fallback filename
 * @param {Function} getToken - Clerk's getToken function from useAuth hook
 * @param {File|null} file - The original uploaded file (used to derive a friendly filename)
 * @param {Function|null} setError - Callback to surface errors to the component UI
 */
export async function downloadWorkflowFile(
  baseUrl = '/api',
  id,
  fileKey,
  defaultExtension,
  labelForFilename,
  getToken,
  file = null,
  setError = null
) {
  const url = `${baseUrl}/workflow/download/${id}/${fileKey}`;
  try {
    const res = await authenticatedFetch(url, {}, getToken);
    if (!res.ok) {
      if (res.status === 404) {
        if (setError) setError('File not available for download.');
        return;
      }
      throw new Error(`Download failed ${res.status}`);
    }
    const blob = await res.blob();
    const cd = res.headers.get('content-disposition') || '';
    let filename = file?.name
      ? file.name.replace(/\.[^.]+$/, `_${labelForFilename}${defaultExtension}`)
      : `${labelForFilename}_${id}${defaultExtension}`;
    const match = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
    if (match) filename = decodeURIComponent(match[1] || match[2]);

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch (err) {
    console.error('Download error:', err);
    if (setError) setError(err.message || 'Failed to download file.');
  }
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
