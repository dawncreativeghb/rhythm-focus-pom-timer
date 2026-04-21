// Background service worker — fires a Chrome notification when the timer ends,
// then auto-advances to the next mode.

const FOCUS_MIN = 25;
const SHORT_BREAK_MIN = 5;
const LONG_BREAK_MIN = 30;
const SESSIONS_BEFORE_LONG = 4;
const ALARM_NAME = 'pomodoro-end';

function durationFor(state) {
  if (state.mode === 'focus') return FOCUS_MIN * 60;
  return state.sessionsCompleted > 0 && state.sessionsCompleted % SESSIONS_BEFORE_LONG === 0
    ? LONG_BREAK_MIN * 60
    : SHORT_BREAK_MIN * 60;
}

async function getState() {
  const { state } = await chrome.storage.local.get('state');
  return (
    state ?? {
      mode: 'focus',
      isRunning: false,
      remaining: FOCUS_MIN * 60,
      startedAt: null,
      sessionsCompleted: 0,
    }
  );
}

async function rescheduleAlarm() {
  await chrome.alarms.clear(ALARM_NAME);
  const s = await getState();
  if (!s.isRunning) return;
  const elapsedMs = Date.now() - s.startedAt;
  const totalMs = (s.remaining ?? durationFor(s)) * 1000;
  const remainingMs = Math.max(1000, totalMs - elapsedMs);
  chrome.alarms.create(ALARM_NAME, { when: Date.now() + remainingMs });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'state-changed') rescheduleAlarm();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const s = await getState();
  const nextMode = s.mode === 'focus' ? 'break' : 'focus';
  const nextSessions = s.mode === 'focus' ? s.sessionsCompleted + 1 : s.sessionsCompleted;
  const next = {
    mode: nextMode,
    isRunning: false,
    sessionsCompleted: nextSessions,
    startedAt: null,
    remaining: 0,
  };
  next.remaining = durationFor(next);
  await chrome.storage.local.set({ state: next });
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon.png',
    title: s.mode === 'focus' ? 'Focus complete!' : 'Break over',
    message: s.mode === 'focus' ? 'Time for a break.' : 'Back to focus.',
    priority: 2,
  });
});

chrome.runtime.onStartup.addListener(rescheduleAlarm);
chrome.runtime.onInstalled.addListener(rescheduleAlarm);
