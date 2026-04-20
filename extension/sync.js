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

const STATE_STORAGE_KEY = 'state';

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
    updatedAt: 0,
  };
}

function normalizeStoredState(state) {
  const mode = state?.mode === 'break' ? 'break' : 'focus';
  const sessionsCompleted = Math.max(0, Number(state?.sessionsCompleted ?? 0));
  const total = durationFor({ mode, sessionsCompleted });
  const remaining = Number.isFinite(Number(state?.remaining)) ? Math.max(0, Number(state.remaining)) : total;
  const startedAt = Number.isFinite(Number(state?.startedAt)) ? Number(state.startedAt) : null;
  const isRunning = Boolean(state?.isRunning) && Boolean(startedAt);
  const updatedAt = Number.isFinite(Number(state?.updatedAt)) ? Math.max(0, Number(state.updatedAt)) : 0;

  return {
    mode,
    isRunning,
    remaining,
    startedAt: isRunning ? startedAt : null,
    sessionsCompleted,
    updatedAt,
  };
}

function isExpiredRunningState(state) {
  return Boolean(
    state?.isRunning &&
      state?.startedAt &&
      state.remaining > 0 &&
      Date.now() - Number(state.startedAt) >= Number(state.remaining) * 1000
  );
}

export async function getLocalState() {
  const { [STATE_STORAGE_KEY]: state } = await chrome.storage.local.get(STATE_STORAGE_KEY);
  return normalizeStoredState(state ?? defaultState());
}

export async function setLocalState(next) {
  const normalized = normalizeStoredState({
    ...next,
    updatedAt: Number.isFinite(Number(next?.updatedAt)) ? Number(next.updatedAt) : Date.now(),
  });
  await chrome.storage.local.set({ [STATE_STORAGE_KEY]: normalized });
  return normalized;
}

function toRemoteRow(state, userId, deviceId) {
  const normalized = normalizeStoredState(state);
  return {
    user_id: userId,
    mode: normalized.mode,
    is_running: normalized.isRunning,
    started_at: normalized.isRunning && normalized.startedAt ? new Date(normalized.startedAt).toISOString() : null,
    remaining_seconds: normalized.remaining,
    sessions_completed: normalized.sessionsCompleted,
    device_id: deviceId,
    updated_at: new Date(normalized.updatedAt || Date.now()).toISOString(),
  };
}

export function fromRemoteRow(row) {
  return normalizeStoredState({
    mode: row.mode === 'break' ? 'break' : 'focus',
    isRunning: !!row.is_running,
    remaining: Math.max(0, Number(row.remaining_seconds ?? 0)),
    startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
    sessionsCompleted: Number(row.sessions_completed ?? 0),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : 0,
  });
}

export async function pushState(state) {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return;
  const deviceId = await getDeviceId();
  const row = toRemoteRow(
    {
      ...state,
      updatedAt: Number.isFinite(Number(state?.updatedAt)) ? Number(state.updatedAt) : Date.now(),
    },
    user.id,
    deviceId
  );
  const { error } = await supabase.from('timer_state').upsert(row, { onConflict: 'user_id' });
  if (error) console.warn('[sync] push failed', error.message);
}

export async function hydrateFromCloud() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return null;

  const local = await getLocalState();
  const { data, error } = await supabase
    .from('timer_state')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.warn('[sync] hydrate failed', error.message);
    return null;
  }

  if (!data) {
    if (local.updatedAt > 0) await pushState(local);
    return null;
  }

  const remote = fromRemoteRow(data);
  const shouldKeepLocal =
    local.updatedAt > 0 && (local.updatedAt > remote.updatedAt || isExpiredRunningState(remote));

  if (shouldKeepLocal) {
    await pushState(local);
    return local;
  }

  await setLocalState(remote);
  return remote;
}
