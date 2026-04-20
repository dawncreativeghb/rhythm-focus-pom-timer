import {
  supabase,
  getLocalState,
  setLocalState,
  durationFor,
  hydrateFromCloud,
  pushState,
  fromRemoteRow,
  getDeviceId,
} from './sync.js';
import { getAudioSettings, hydrateAudioSettingsFromCloud } from './audio-settings.js';

const ALARM_NAME = 'pomodoro-end';
const LONG_BREAK_INTERVAL = 4;
const TRUSTED_WEB_ORIGINS = [
  'https://rhythm-focus-pom-timer.lovable.app',
  'https://id-preview--37956388-6962-4650-a7e8-68f572004607.lovable.app',
];

let realtimeChannel = null;
let myDeviceId = null;
let lastKnownState = null;
let offscreenCreationPromise = null;

function normalizeState(state) {
  const mode = state?.mode === 'break' ? 'break' : 'focus';
  const sessionsCompleted = Math.max(0, Number(state?.sessionsCompleted ?? 0));
  const total = durationFor({ mode, sessionsCompleted });
  const remaining = Number.isFinite(Number(state?.remaining)) ? Math.max(0, Number(state.remaining)) : total;
  const startedAt = state?.startedAt ? Number(state.startedAt) : null;
  return {
    mode,
    sessionsCompleted,
    remaining,
    isRunning: Boolean(state?.isRunning) && Boolean(startedAt),
    startedAt: startedAt || null,
  };
}

function isLongBreak(state) {
  return state.mode === 'break' && state.sessionsCompleted > 0 && state.sessionsCompleted % LONG_BREAK_INTERVAL === 0;
}

async function ensureOffscreenDocument() {
  const existing = await clients.matchAll();
  if (existing.some((client) => client.url.endsWith('/offscreen.html'))) return;
  if (offscreenCreationPromise) return offscreenCreationPromise;

  offscreenCreationPromise = chrome.offscreen
    .createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play timer music and chimes while the popup is closed.',
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('single offscreen document')) throw error;
    })
    .finally(() => {
      offscreenCreationPromise = null;
    });

  return offscreenCreationPromise;
}

async function sendAudioMessage(message) {
  try {
    await ensureOffscreenDocument();
    await chrome.runtime.sendMessage({ target: 'offscreen', ...message });
  } catch (error) {
    console.warn('[audio] message failed', error);
  }
}

async function syncAudioForState(next, prev) {
  const normalizedNext = normalizeState(next);
  const normalizedPrev = prev ? normalizeState(prev) : null;
  const settings = await getAudioSettings();

  if (!normalizedNext.isRunning) {
    await sendAudioMessage({ type: 'audio-stop' });
    return;
  }

  const modeChanged = normalizedPrev?.mode !== normalizedNext.mode;
  const restarted = !normalizedPrev?.isRunning || normalizedPrev?.startedAt !== normalizedNext.startedAt;
  if (!modeChanged && !restarted) return;

  if (normalizedNext.mode === 'break') {
    await sendAudioMessage({
      type: 'audio-play-break',
      settings,
      isLongBreak: isLongBreak(normalizedNext),
    });
    return;
  }

  await sendAudioMessage({
    type: 'audio-play-focus',
    settings,
    transitionedFromBreak: normalizedPrev?.mode === 'break',
  });
}

async function rescheduleAlarm() {
  await chrome.alarms.clear(ALARM_NAME);
  const s = normalizeState(await getLocalState());
  if (!s.isRunning || !s.startedAt) return;
  const elapsedMs = Date.now() - s.startedAt;
  const totalMs = s.remaining * 1000;
  const remainingMs = Math.max(1000, totalMs - elapsedMs);
  chrome.alarms.create(ALARM_NAME, { when: Date.now() + remainingMs });
}

async function setupRealtime() {
  if (realtimeChannel) {
    try {
      await supabase.removeChannel(realtimeChannel);
    } catch {
      /* ignore */
    }
    realtimeChannel = null;
  }

  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user;
  if (!user) return;

  if (!myDeviceId) myDeviceId = await getDeviceId();

  realtimeChannel = supabase
    .channel(`timer_state:${user.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'timer_state',
        filter: `user_id=eq.${user.id}`,
      },
      async (payload) => {
        const row = payload.new;
        if (!row || row.device_id === myDeviceId) return;
        const previous = lastKnownState ?? normalizeState(await getLocalState());
        const next = normalizeState(fromRemoteRow(row));
        await setLocalState(next);
        lastKnownState = next;
        await rescheduleAlarm();
        await syncAudioForState(next, previous);
      }
    )
    .subscribe();
}

async function applyExternalSession(session) {
  const { error } = await supabase.auth.setSession(session);
  if (error) {
    return { ok: false, error: error.message };
  }

  await hydrateFromCloud();
  await hydrateAudioSettingsFromCloud();
  lastKnownState = normalizeState(await getLocalState());
  await setupRealtime();
  await rescheduleAlarm();
  await chrome.runtime.sendMessage({ type: 'extension-auth-updated' });
  return { ok: true };
}

async function handleStateChanged(nextState) {
  const previous = lastKnownState ?? normalizeState(await getLocalState());
  const next = normalizeState(nextState ?? (await getLocalState()));
  lastKnownState = next;
  await rescheduleAlarm();
  await syncAudioForState(next, previous);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'state-changed') {
    void handleStateChanged(msg.state);
    return false;
  }
  if (msg?.type === 'auth-changed') {
    void setupRealtime();
    return false;
  }
  return false;
});

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  const isTrustedSender = TRUSTED_WEB_ORIGINS.some((origin) => sender.url?.startsWith(origin));
  if (msg?.type !== 'extension-auth-session' || !isTrustedSender) {
    return false;
  }

  applyExternalSession(msg.session)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to apply session.',
      });
    });

  return true;
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const previous = normalizeState(await getLocalState());
  const nextMode = previous.mode === 'focus' ? 'break' : 'focus';
  const nextSessions = previous.mode === 'focus' ? previous.sessionsCompleted + 1 : previous.sessionsCompleted;
  const next = normalizeState({
    mode: nextMode,
    isRunning: true,
    sessionsCompleted: nextSessions,
    startedAt: Date.now(),
    remaining: durationFor({ mode: nextMode, sessionsCompleted: nextSessions }),
  });

  await setLocalState(next);
  lastKnownState = next;

  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) await pushState(next);

  await syncAudioForState(next, previous);

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon.png',
    title: previous.mode === 'focus' ? 'Focus complete!' : 'Break over',
    message: previous.mode === 'focus' ? 'Time for a break.' : 'Back to focus.',
    priority: 2,
  });
});

async function bootstrap() {
  myDeviceId = await getDeviceId();
  lastKnownState = normalizeState(await getLocalState());

  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) {
    await hydrateFromCloud();
    await hydrateAudioSettingsFromCloud();
    await setupRealtime();
    lastKnownState = normalizeState(await getLocalState());
  }

  await rescheduleAlarm();
  await syncAudioForState(lastKnownState, null);
}

chrome.runtime.onStartup.addListener(bootstrap);
chrome.runtime.onInstalled.addListener(bootstrap);

bootstrap();
