// Rhythm Focus popup — reads/writes timer state from chrome.storage,
// background.js owns the alarm and authoritative ticking.

const FOCUS_MIN = 25;
const SHORT_BREAK_MIN = 5;
const LONG_BREAK_MIN = 30;
const SESSIONS_BEFORE_LONG = 4;
const WEB_APP_URL = 'https://rhythm-focus-pom-timer.lovable.app';

const $ = (id) => document.getElementById(id);
const timeEl = $('time');
const sessionEl = $('session');
const ringEl = $('ring');
const toggleBtn = $('toggle');
const resetBtn = $('reset');
const skipBtn = $('skip');
const modeBtns = document.querySelectorAll('#mode-switch button');

function durationFor(state) {
  if (state.mode === 'focus') return FOCUS_MIN * 60;
  return state.sessionsCompleted > 0 && state.sessionsCompleted % SESSIONS_BEFORE_LONG === 0
    ? LONG_BREAK_MIN * 60
    : SHORT_BREAK_MIN * 60;
}

function format(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function render(state) {
  const remaining = computeRemaining(state);
  timeEl.textContent = format(remaining);
  sessionEl.textContent =
    state.mode === 'focus' ? `Session ${state.sessionsCompleted + 1}` : 'Break time';
  ringEl.className = 'ring ' + state.mode;
  toggleBtn.textContent = state.isRunning ? 'Pause' : 'Start';
  toggleBtn.className = 'btn primary' + (state.mode === 'break' ? ' break' : '');
  modeBtns.forEach((b) => {
    const active = b.dataset.mode === state.mode;
    b.className = active ? 'active ' + state.mode : '';
  });
}

function computeRemaining(state) {
  const total = durationFor(state);
  if (!state.isRunning) return state.remaining ?? total;
  const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
  return Math.max(0, (state.remaining ?? total) - elapsed);
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

async function setState(next) {
  await chrome.storage.local.set({ state: next });
  chrome.runtime.sendMessage({ type: 'state-changed' }).catch(() => {});
  render(next);
}

toggleBtn.addEventListener('click', async () => {
  const s = await getState();
  if (s.isRunning) {
    await setState({ ...s, isRunning: false, remaining: computeRemaining(s), startedAt: null });
  } else {
    await setState({ ...s, isRunning: true, startedAt: Date.now() });
  }
});

resetBtn.addEventListener('click', async () => {
  const s = await getState();
  await setState({ ...s, isRunning: false, remaining: durationFor(s), startedAt: null });
});

skipBtn.addEventListener('click', async () => {
  const s = await getState();
  const nextMode = s.mode === 'focus' ? 'break' : 'focus';
  const nextSessions = s.mode === 'focus' ? s.sessionsCompleted + 1 : s.sessionsCompleted;
  const next = {
    mode: nextMode,
    isRunning: false,
    sessionsCompleted: nextSessions,
    remaining: 0,
    startedAt: null,
  };
  next.remaining = durationFor(next);
  await setState(next);
});

modeBtns.forEach((b) => {
  b.addEventListener('click', async () => {
    const s = await getState();
    const mode = b.dataset.mode;
    if (mode === s.mode) return;
    const next = { ...s, mode, isRunning: false, startedAt: null };
    next.remaining = durationFor(next);
    await setState(next);
  });
});

$('open-web').addEventListener('click', () => {
  chrome.tabs.create({ url: WEB_APP_URL });
});

// Live tick while popup is open
let tickInterval;
async function startTicking() {
  const s = await getState();
  render(s);
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(async () => {
    const cur = await getState();
    render(cur);
  }, 500);
}
startTicking();

window.addEventListener('unload', () => clearInterval(tickInterval));
