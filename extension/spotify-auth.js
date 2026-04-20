import { supabase } from './sync.js';

const STORAGE_KEY = 'spotifyAuth';
const REFRESH_BUFFER_MS = 60_000;

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