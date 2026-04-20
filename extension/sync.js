// Shared sync layer for the Rhythm Focus extension.
// Wraps the Supabase client + chrome.storage.local so both popup and background
// can read/write the same timer_state row when the user is signed in, and fall
// back to local-only state when they are not.

import { createClient } from './vendor/supabase.js';

export const SUPABASE_URL = 'https://yuwkjkyzzlcgsqojizfl.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1d2tqa3l6emxjZ3Nxb2ppemZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNjQyNzAsImV4cCI6MjA4NTY0MDI3MH0.xFzGI6zqF_qwoUKZfioM2WKeYTT1TG3R7wmbV9z1ogQ';

export const FOCUS_MIN = 25;
export const SHORT_BREAK_MIN = 5;
export const LONG_BREAK_MIN = 30;
export const SESSIONS_BEFORE_LONG = 4;

// chrome.storage adapter so Supabase auth tokens persist across popup opens
// and survive the service worker shutting down.
const chromeStorageAdapter = {
  getItem: async (key) => {
    const out = await chrome.storage.local.get(key);
    return out[key] ?? null;
  },
  setItem: async (key, value) => {
    await chrome.storage.local.set({ [key]: value });
  },
  removeItem: async (key) => {
    await chrome.storage.local.remove(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: chromeStorageAdapter,
    persistSession: true,
    autoRefreshToken: true,
    // Extension popups have no URL hash to detect, so disable.
    detectSessionInUrl: false,
  },
});

// Stable per-install ID so we can ignore realtime echoes from ourselves.
export async function getDeviceId() {
  const { deviceId } = await chrome.storage.local.get('deviceId');
  if (deviceId) return deviceId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ deviceId: id });
  return id;
}

export function durationFor(state) {
  if (state.mode === 'focus') return FOCUS_MIN * 60;
  return state.sessionsCompleted > 0 && state.sessionsCompleted % SESSIONS_BEFORE_LONG === 0
    ? LONG_BREAK_MIN * 60
    : SHORT_BREAK_MIN * 60;
}

export function defaultState() {
  return {
    mode: 'focus',
    isRunning: false,
    remaining: FOCUS_MIN * 60,
    startedAt: null,
    sessionsCompleted: 0,
  };
}

export async function getLocalState() {
  const { state } = await chrome.storage.local.get('state');
  return state ?? defaultState();
}

export async function setLocalState(next) {
  await chrome.storage.local.set({ state: next });
}

// Convert local extension state -> timer_state row.
function toRemoteRow(state, userId, deviceId) {
  return {
    user_id: userId,
    mode: state.mode,
    is_running: state.isRunning,
    started_at: state.isRunning && state.startedAt ? new Date(state.startedAt).toISOString() : null,
    remaining_seconds: state.remaining,
    sessions_completed: state.sessionsCompleted,
    device_id: deviceId,
  };
}

// Convert a remote row -> local extension state shape.
export function fromRemoteRow(row) {
  return {
    mode: row.mode === 'break' ? 'break' : 'focus',
    isRunning: !!row.is_running,
    remaining: Math.max(0, Number(row.remaining_seconds ?? 0)),
    startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
    sessionsCompleted: Number(row.sessions_completed ?? 0),
  };
}

// Push the current local state to the cloud for the signed-in user.
export async function pushState(state) {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return;
  const deviceId = await getDeviceId();
  const row = toRemoteRow(state, user.id, deviceId);
  const { error } = await supabase.from('timer_state').upsert(row, { onConflict: 'user_id' });
  if (error) console.warn('[sync] push failed', error.message);
}

// One-time hydrate from the cloud (called on popup open + service worker startup).
export async function hydrateFromCloud() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return null;
  const { data, error } = await supabase
    .from('timer_state')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) {
    console.warn('[sync] hydrate failed', error.message);
    return null;
  }
  if (!data) return null;
  const next = fromRemoteRow(data);
  await setLocalState(next);
  return next;
}
