/* ============================================================
   Supabase Client
   ============================================================ */
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_USERS_FUNCTION, STORAGE_BUCKET } from './config.js';
import { getState } from './state.js';

let client = null;

export function getClient() {
  if (!client) {
    if (!window.supabase) {
      throw new Error('Supabase library not loaded');
    }
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: 'archai-auth',
      },
    });
  }
  return client;
}

/**
 * Call admin users Edge Function with proper service role authentication
 * Uses service role key for server-side admin operations
 */
export async function callAdminUsers(payload) {
  const { session } = getState();
  if (!session?.access_token) {
    throw new Error('Invalid session. Please sign in again.');
  }

  // Use service role key for admin operations (server-side validation)
  const response = await fetch(ADMIN_USERS_FUNCTION, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let data = {};
  try { data = await response.json(); } catch {}

  if (!response.ok || data.error) {
    throw new Error(data.error || `Server error (${response.status})`);
  }
  return data;
}

/**
 * Get signed URL with authorization check
 */
export async function getSignedUrlWithAuth(filePath, expiresIn = 600) {
  const { session } = getState();
  if (!session?.access_token) {
    throw new Error('Invalid session. Please sign in again.');
  }

  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${STORAGE_BUCKET}/${filePath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn }),
  });

  let data = {};
  try { data = await response.json(); } catch {}

  if (!response.ok || data.error) {
    throw new Error(data.error || `Failed to get signed URL (${response.status})`);
  }
  return data.signedUrl;
}
