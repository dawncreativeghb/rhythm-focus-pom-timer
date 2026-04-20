// Rhythm Focus popup — local-only when signed out, synced via Supabase when signed in.
// Background.js owns the alarm + auto-advance; popup just reads/writes state.

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

function format(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function computeRemaining(state) {
  const total = durationFor(state);
  if (!state.isRunning) return state.remaining ?? total;
  const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
  return Math.max(0, (state.remaining ?? total) - elapsed);
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

function renderAccount() {
  if (currentUser) {
    accountEmail.textContent = currentUser.email ?? 'Signed in';
    accountEmail.style.display = '';
    accountAction.textContent = 'Sign out';
    signinPanel.classList.add('hidden');
  } else {
    accountEmail.style.display = 'none';
    accountAction.textContent = 'Sign in';
  }
}

// Apply state locally, push to cloud if signed in, and let background reschedule.
async function updateState(next) {
  await setLocalState(next);
  chrome.runtime.sendMessage({ type: 'state-changed' }).catch(() => {});
  render(next);
  if (currentUser) pushState(next);
}

toggleBtn.addEventListener('click', async () => {
  const s = await getLocalState();
  if (s.isRunning) {
    await updateState({ ...s, isRunning: false, remaining: computeRemaining(s), startedAt: null });
  } else {
    await updateState({ ...s, isRunning: true, startedAt: Date.now() });
  }
});

resetBtn.addEventListener('click', async () => {
  const s = await getLocalState();
  await updateState({ ...s, isRunning: false, remaining: durationFor(s), startedAt: null });
});

skipBtn.addEventListener('click', async () => {
  const s = await getLocalState();
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
  await updateState(next);
});

modeBtns.forEach((b) => {
  b.addEventListener('click', async () => {
    const s = await getLocalState();
    const mode = b.dataset.mode;
    if (mode === s.mode) return;
    const next = { ...s, mode, isRunning: false, startedAt: null };
    next.remaining = durationFor(next);
    await updateState(next);
  });
});

$('open-web').addEventListener('click', () => {
  chrome.tabs.create({ url: WEB_APP_URL });
});

// --- Auth UI ---

accountAction.addEventListener('click', async () => {
  if (currentUser) {
    await supabase.auth.signOut();
    currentUser = null;
    renderAccount();
  } else {
    signinPanel.classList.toggle('hidden');
    signinErr.textContent = '';
  }
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
    return;
  }
  // signed in — onAuthStateChange handler will refresh UI + hydrate.
}

signinSubmit.addEventListener('click', () => doAuth('signin'));
signinSignup.addEventListener('click', () => doAuth('signup'));
signinGoogle.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: EXTENSION_AUTH_URL });
});

// --- Live tick + auth wiring ---

let tickInterval;
function startTicking() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(async () => {
    const cur = await getLocalState();
    render(cur);
  }, 500);
}

window.addEventListener('unload', () => clearInterval(tickInterval));

// React to background updating chrome.storage (auto-advance, realtime sync, etc.).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.state) render(changes.state.newValue);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== 'extension-auth-updated') return;
  supabase.auth.getSession().then(async ({ data }) => {
    currentUser = data?.session?.user ?? null;
    renderAccount();
    if (currentUser) {
      await hydrateFromCloud();
      render(await getLocalState());
    }
  });
});

(async () => {
  deviceId = await getDeviceId();
  const { data } = await supabase.auth.getSession();
  currentUser = data?.session?.user ?? null;
  renderAccount();

  if (currentUser) {
    // Hydrate from cloud so popup shows the latest synced state immediately.
    await hydrateFromCloud();
    chrome.runtime.sendMessage({ type: 'auth-changed' }).catch(() => {});
  }

  render(await getLocalState());
  startTicking();
})();

supabase.auth.onAuthStateChange(async (_event, session) => {
  currentUser = session?.user ?? null;
  renderAccount();
  if (currentUser) await hydrateFromCloud();
  chrome.runtime.sendMessage({ type: 'auth-changed' }).catch(() => {});
  render(await getLocalState());
});
