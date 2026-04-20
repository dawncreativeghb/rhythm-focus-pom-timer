import {
  supabase,
  getLocalState,
  setLocalState,
  durationFor,
  hydrateFromCloud,
  pushState,
  getDeviceId,
} from './sync.js';
import { initPopupAudio } from './popup-audio.js';

const WEB_APP_URL = 'https://rhythm-focus-pom-timer.lovable.app';
const EXTENSION_AUTH_URL = `${WEB_APP_URL}/extension-auth?extensionId=${chrome.runtime.id}`;

const $ = (id) => document.getElementById(id);
const timeEl = $('time');
const sessionEl = $('session');
const ringEl = $('ring');
const toggleBtn = $('toggle');
const resetBtn = $('reset');
const skipBtn = $('skip');
const modeBtns = document.querySelectorAll('#mode-switch button');

const accountEl = $('account');
const accountEmail = $('account-email');
const accountAction = $('account-action');
const signinPanel = $('signin');
const signinErr = $('signin-err');
const signinSubmit = $('signin-submit');
const signinSignup = $('signin-signup');
const signinGoogle = $('signin-google');
const emailInput = $('email');
const passwordInput = $('password');

let currentUser = null;
let deviceId = null;
let popupState = null;
let tickInterval = null;
let audioUi = null;

function format(sec) {
  const safe = Math.max(0, Number(sec) || 0);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function normalizeState(state) {
  const mode = state?.mode === 'break' ? 'break' : 'focus';
  const sessionsCompleted = Math.max(0, Number(state?.sessionsCompleted ?? 0));
  const seeded = { mode, sessionsCompleted };
  const total = durationFor(seeded);
  const remaining = Number.isFinite(Number(state?.remaining)) ? Math.max(0, Number(state.remaining)) : total;
  const startedAt = state?.startedAt ? Number(state.startedAt) : null;
  const isRunning = Boolean(state?.isRunning) && Boolean(startedAt);

  return {
    mode,
    isRunning,
    remaining,
    startedAt: isRunning ? startedAt : null,
    sessionsCompleted,
  };
}

function computeRemaining(state) {
  const total = durationFor(state);
  const stored = Math.max(0, Number(state?.remaining ?? total));
  if (!state?.isRunning || !state?.startedAt) return stored || total;
  const elapsed = Math.max(0, Math.floor((Date.now() - Number(state.startedAt)) / 1000));
  return Math.max(0, stored - elapsed);
}

function render(state) {
  const remaining = computeRemaining(state);
  timeEl.textContent = format(remaining);
  sessionEl.textContent = state.mode === 'focus' ? `Session ${state.sessionsCompleted + 1}` : 'Break time';
  ringEl.className = 'ring ' + state.mode;
  toggleBtn.textContent = state.isRunning ? 'Pause' : 'Start';
  toggleBtn.className = 'btn primary' + (state.mode === 'break' ? ' break' : '');
  modeBtns.forEach((b) => {
    const active = b.dataset.mode === state.mode;
    b.className = active ? 'active ' + state.mode : '';
  });
}

function renderAccount() {
  if (currentUser) {
    accountEmail.textContent = currentUser.email ?? 'Signed in';
    accountAction.textContent = 'Sign out';
    accountEl.classList.remove('signed-out');
    signinPanel.classList.add('hidden');
  } else {
    accountEmail.textContent = '';
    accountAction.textContent = 'Sign in';
    accountEl.classList.add('signed-out');
  }
}

async function notifyBackground(message) {
  try {
    await chrome.runtime.sendMessage(message);
  } catch {
    /* ignore */
  }
}

async function applyState(next) {
  popupState = normalizeState(next);
  await setLocalState(popupState);
  render(popupState);
  await notifyBackground({ type: 'state-changed', state: popupState });
  if (currentUser) void pushState(popupState);
}

function getWorkingState() {
  return popupState ? { ...popupState } : normalizeState(null);
}

toggleBtn.addEventListener('click', async () => {
  const s = getWorkingState();
  if (s.isRunning) {
    await applyState({ ...s, isRunning: false, remaining: computeRemaining(s), startedAt: null });
    return;
  }

  const total = durationFor(s);
  const remaining = computeRemaining(s) > 0 ? computeRemaining(s) : total;
  await applyState({ ...s, isRunning: true, remaining, startedAt: Date.now() });
});

resetBtn.addEventListener('click', async () => {
  const s = getWorkingState();
  await applyState({ ...s, isRunning: false, remaining: durationFor(s), startedAt: null });
});

skipBtn.addEventListener('click', async () => {
  const s = getWorkingState();
  const nextMode = s.mode === 'focus' ? 'break' : 'focus';
  const nextSessions = s.mode === 'focus' ? s.sessionsCompleted + 1 : s.sessionsCompleted;
  const next = normalizeState({
    mode: nextMode,
    isRunning: false,
    sessionsCompleted: nextSessions,
    remaining: durationFor({ mode: nextMode, sessionsCompleted: nextSessions }),
    startedAt: null,
  });
  await applyState(next);
});

modeBtns.forEach((b) => {
  b.addEventListener('click', async () => {
    const s = getWorkingState();
    const mode = b.dataset.mode === 'break' ? 'break' : 'focus';
    if (mode === s.mode) return;
    const next = normalizeState({
      ...s,
      mode,
      isRunning: false,
      startedAt: null,
      remaining: durationFor({ mode, sessionsCompleted: s.sessionsCompleted }),
    });
    await applyState(next);
  });
});

$('open-web').addEventListener('click', () => {
  chrome.tabs.create({ url: WEB_APP_URL, active: true });
});

accountAction.addEventListener('click', async () => {
  if (currentUser) {
    await supabase.auth.signOut();
    currentUser = null;
    renderAccount();
    return;
  }

  signinPanel.classList.toggle('hidden');
  signinErr.textContent = '';
});

async function doAuth(method) {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) {
    signinErr.textContent = 'Email and password required.';
    return;
  }

  signinErr.textContent = '';
  const { data, error } =
    method === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

  if (error) {
    signinErr.textContent = error.message;
    return;
  }

  if (method === 'signup' && !data.session) {
    signinErr.textContent = 'Check your email to confirm your account, then sign in.';
  }
}

signinSubmit.addEventListener('click', () => void doAuth('signin'));
signinSignup.addEventListener('click', () => void doAuth('signup'));
signinGoogle.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: EXTENSION_AUTH_URL, active: true });
  window.close();
});

function startTicking() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(() => {
    if (popupState) render(popupState);
  }, 500);
}

window.addEventListener('unload', () => {
  if (tickInterval) clearInterval(tickInterval);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  if (changes.state?.newValue) {
    popupState = normalizeState(changes.state.newValue);
    render(popupState);
  }

  if (changes.audioSettings?.newValue) {
    void audioUi?.refresh();
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== 'extension-auth-updated') return;
  supabase.auth.getSession().then(async ({ data }) => {
    currentUser = data?.session?.user ?? null;
    renderAccount();
    if (currentUser) {
      await hydrateFromCloud();
      popupState = normalizeState(await getLocalState());
      await audioUi?.hydrateSignedIn();
      render(popupState);
    }
  });
});

(async () => {
  audioUi = initPopupAudio({
    isSignedIn: () => Boolean(currentUser),
  });

  deviceId = await getDeviceId();
  const { data } = await supabase.auth.getSession();
  currentUser = data?.session?.user ?? null;
  renderAccount();

  if (currentUser) {
    await hydrateFromCloud();
    await audioUi.hydrateSignedIn();
    await notifyBackground({ type: 'auth-changed' });
  } else {
    await audioUi.refresh();
  }

  popupState = normalizeState(await getLocalState());
  render(popupState);
  startTicking();
})();

supabase.auth.onAuthStateChange(async (_event, session) => {
  currentUser = session?.user ?? null;
  renderAccount();
  if (currentUser) {
    await hydrateFromCloud();
    await audioUi?.hydrateSignedIn();
  }
  await notifyBackground({ type: 'auth-changed' });
  popupState = normalizeState(await getLocalState());
  render(popupState);
});
