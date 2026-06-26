// Background service worker — owns the timer alarm, fires a Chrome
// notification when the timer ends and auto-advances, and paints the
// live minutes-remaining onto the toolbar icon as an always-visible badge.

const FOCUS_MIN = 25;
const SHORT_BREAK_MIN = 5;
const LONG_BREAK_MIN = 30;
const SESSIONS_BEFORE_LONG = 4;
const ALARM_NAME = 'pomodoro-end';
const BADGE_ALARM = 'badge-tick';

// Badge colors roughly match the app's focus (teal) and break (amber) accents.
const FOCUS_COLOR = '#14b8a6';
const BREAK_COLOR = '#f59e0b';

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

function computeRemaining(s) {
  const total = s.remaining ?? durationFor(s);
  if (!s.isRunning || !s.startedAt) return total;
  const elapsed = Math.floor((Date.now() - s.startedAt) / 1000);
  return Math.max(0, total - elapsed);
}

// Paint minutes-remaining onto the toolbar icon (e.g. "24"). Cleared when the
// timer isn't running so a stale number never lingers.
async function updateBadge() {
  const s = await getState();
  const remaining = computeRemaining(s);
  if (!s.isRunning || remaining <= 0) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  await chrome.action.setBadgeText({ text: String(Math.ceil(remaining / 60)) });
  await chrome.action.setBadgeBackgroundColor({
    color: s.mode === 'focus' ? FOCUS_COLOR : BREAK_COLOR,
  });
  if (chrome.action.setBadgeTextColor) {
    await chrome.action.setBadgeTextColor({ color: '#ffffff' });
  }
}

async function rescheduleAlarm() {
  await chrome.alarms.clear(ALARM_NAME);
  const s = await getState();
  if (!s.isRunning) {
    await chrome.alarms.clear(BADGE_ALARM);
    await updateBadge();
    return;
  }
  const elapsedMs = Date.now() - s.startedAt;
  const totalMs = (s.remaining ?? durationFor(s)) * 1000;
  const remainingMs = Math.max(1000, totalMs - elapsedMs);
  chrome.alarms.create(ALARM_NAME, { when: Date.now() + remainingMs });
  // Refresh the badge every minute while running (the service worker may sleep
  // between ticks, so a periodic alarm is what keeps the number current).
  chrome.alarms.create(BADGE_ALARM, { periodInMinutes: 1 });
  await updateBadge();
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'state-changed') rescheduleAlarm();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === BADGE_ALARM) {
    await updateBadge();
    return;
  }
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
  await chrome.alarms.clear(BADGE_ALARM);
  await updateBadge();
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
