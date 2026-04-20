import { supabase } from './sync.js';

const STORAGE_KEY = 'spotifyAuth';
const REFRESH_BUFFER_MS = 60_000;
const SPOTIFY_CLIENT_ID = '980fe05b9d3d4d49b5f703a9e05252ea';
const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ');

export function getSpotifyRedirectUri() {
  // chrome.identity gives us a stable https://<extension-id>.chromiumapp.org/* URL
  // that Spotify will accept as a redirect URI (must be added in the Spotify dashboard).
  return chrome.identity.getRedirectURL('spotify');
}

export async function connectSpotifyViaIdentity() {
  const redirectUri = getSpotifyRedirectUri();
  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', SPOTIFY_CLIENT_ID);
  authUrl.searchParams.set('scope', SPOTIFY_SCOPES);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', crypto.randomUUID());
  authUrl.searchParams.set('show_dialog', 'true');

  let redirectResponseUrl;
  try {
    redirectResponseUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl.toString(), interactive: true },
        (responseUrl) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (!responseUrl) return reject(new Error('Spotify sign-in was cancelled.'));
          resolve(responseUrl);
        }
      );
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Spotify sign-in failed.' };
  }

  let code;
  try {
    const url = new URL(redirectResponseUrl);
    code = url.searchParams.get('code');
    const errParam = url.searchParams.get('error');
    if (errParam) return { ok: false, error: errParam };
  } catch {
    return { ok: false, error: 'Could not parse Spotify response.' };
  }

  if (!code) return { ok: false, error: 'Spotify did not return an authorization code.' };

  const { data: exchangeData, error: exchangeError } = await supabase.functions.invoke('spotify-auth', {
    body: { action: 'exchange', code, redirect_uri: redirectUri },
  });

  if (exchangeError || !exchangeData?.access_token || !exchangeData?.refresh_token) {
    return {
      ok: false,
      error: exchangeError?.message || exchangeData?.error || 'Spotify token exchange failed.',
    };
  }

  await setSpotifyAuth({
    access_token: exchangeData.access_token,
    refresh_token: exchangeData.refresh_token,
    expires_at: Date.now() + Number(exchangeData.expires_in ?? 3600) * 1000,
  });

  return { ok: true };
}

function normalizeAuth(auth) {
  if (!auth?.access_token || !auth?.refresh_token) return null;
  const expiresAt = Number(auth.expires_at ?? 0);
  return {
    access_token: String(auth.access_token),
    refresh_token: String(auth.refresh_token),
    expires_at: Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : Date.now() + 3600_000,
  };
}

export function normalizeSpotifyUri(input) {
  const trimmed = String(input ?? '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('spotify:')) return trimmed;

  const match = trimmed.match(
    /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(playlist|album|track|artist|episode|show)\/([a-zA-Z0-9]+)/
  );

  if (match) return `spotify:${match[1]}:${match[2]}`;
  return trimmed;
}

export async function getSpotifyAuth() {
  const { [STORAGE_KEY]: stored } = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeAuth(stored);
}

export async function setSpotifyAuth(auth) {
  const normalized = normalizeAuth(auth);
  if (!normalized) throw new Error('Invalid Spotify session payload.');
  await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
  return normalized;
}

export async function clearSpotifyAuth() {
  await chrome.storage.local.remove(STORAGE_KEY);
}

export async function getValidSpotifyToken() {
  const current = await getSpotifyAuth();
  if (!current) return null;

  if (current.expires_at - Date.now() > REFRESH_BUFFER_MS) {
    return current.access_token;
  }

  const { data, error } = await supabase.functions.invoke('spotify-auth', {
    body: { action: 'refresh', refresh_token: current.refresh_token },
  });

  if (error || !data?.access_token) {
    console.warn('[spotify] refresh failed', error?.message || data?.error || 'Unknown error');
    await clearSpotifyAuth();
    return null;
  }

  const next = await setSpotifyAuth({
    access_token: data.access_token,
    refresh_token: data.refresh_token || current.refresh_token,
    expires_at: Date.now() + Number(data.expires_in ?? 3600) * 1000,
  });

  return next.access_token;
}

export async function getSpotifyProfile() {
  const token = await getValidSpotifyToken();
  if (!token) return null;

  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) return null;
  const data = await response.json();
  return {
    display_name: data.display_name || 'Spotify connected',
    product: data.product || 'free',
  };
}

async function getAvailableSpotifyDevice(token) {
  const response = await fetch('https://api.spotify.com/v1/me/player/devices', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { deviceId: null, error: `Spotify devices failed (${response.status})` };
  }

  const data = await response.json();
  const devices = Array.isArray(data?.devices) ? data.devices : [];
  const preferred = devices.find((device) => device?.is_active) || devices.find((device) => !device?.is_restricted) || devices[0];

  if (!preferred?.id) {
    return { deviceId: null, error: 'Open Spotify on your phone or desktop first.' };
  }

  return { deviceId: preferred.id, error: null };
}

async function transferSpotifyPlayback(token, deviceId) {
  const response = await fetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ device_ids: [deviceId], play: false }),
  });

  return response.ok || response.status === 204;
}

export async function playSpotifyUri(uri) {
  const contextUri = normalizeSpotifyUri(uri);
  if (!contextUri) return { ok: false, error: 'Missing Spotify playlist link.' };

  const token = await getValidSpotifyToken();
  if (!token) return { ok: false, error: 'Connect Spotify first.' };

  const { deviceId, error: deviceError } = await getAvailableSpotifyDevice(token);
  if (!deviceId) return { ok: false, error: deviceError };

  await transferSpotifyPlayback(token, deviceId);
  await new Promise((resolve) => setTimeout(resolve, 350));

  const body = contextUri.includes(':track:') ? { uris: [contextUri] } : { context_uri: contextUri };
  const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (response.ok || response.status === 204) {
    return { ok: true };
  }

  const text = await response.text();
  let message = `Spotify playback failed (${response.status})`;
  try {
    const parsed = JSON.parse(text);
    if (parsed?.error?.message) message = parsed.error.message;
  } catch {
    if (text) message = text;
  }

  return { ok: false, error: message };
}

export async function pauseSpotifyPlayback() {
  const token = await getValidSpotifyToken();
  if (!token) return { ok: false, error: 'Spotify not connected.' };

  const response = await fetch('https://api.spotify.com/v1/me/player/pause', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.ok || response.status === 204 || response.status === 404) {
    return { ok: true };
  }

  const text = await response.text();
  return { ok: false, error: text || `Spotify pause failed (${response.status})` };
}