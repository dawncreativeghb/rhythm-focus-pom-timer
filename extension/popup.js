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
import {
  getSpotifyAuth,
  clearSpotifyAuth,
  getSpotifyProfile,
  connectSpotifyViaIdentity,
  getSpotifyRedirectUri,
  primeSpotifyLogin,
} from './spotify-auth.js';
import {
  getAudioSettings,
  updateAudioSettings,
  pushAudioSettings,
} from './audio-settings.js';

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
let spotifyConnectReady = false;

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
   const updatedAt = Number.isFinite(Number(state?.updatedAt)) ? Number(state.updatedAt) : startedAt ?? Date.now();
  const isRunning = Boolean(state?.isRunning) && Boolean(startedAt);

  return {
    mode,
    isRunning,
    remaining,
    startedAt: isRunning ? startedAt : null,
    sessionsCompleted,
    updatedAt,
  };
}

function computeRemaining(state) {
  const total = durationFor(state);
  const stored = Math.max(0, Number(state?.remaining ?? total));
  if (!state?.isRunning) return stored || total;
  const anchorAt = Number(state?.updatedAt ?? state?.startedAt ?? Date.now());
  const elapsed = Math.max(0, Math.floor((Date.now() - anchorAt) / 1000));
  return Math.max(0, stored - elapsed);
}

function render(state) {
  const remaining = computeRemaining(state);
  const total = durationFor(state);
  const progress = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  timeEl.textContent = format(remaining);
  sessionEl.textContent = state.mode === 'focus' ? `Session ${state.sessionsCompleted + 1}` : 'Break time';
  ringEl.className = 'ring ' + state.mode;
  ringEl.style.setProperty('--progress', progress.toFixed(4));
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
    const response = await chrome.runtime.sendMessage(message);
    if (response?.ok === false) {
      throw new Error(response.error || 'Background sync failed.');
    }
    return response;
  } catch (error) {
    console.warn('[popup] background message failed', message?.type, error);
    return { ok: false, error: error instanceof Error ? error.message : 'Background message failed.' };
  }
}

async function syncBackgroundAuthSession() {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  await notifyBackground({
    type: 'auth-session',
    session: session
      ? {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        }
      : null,
  });
}

async function applyState(next) {
  popupState = normalizeState(next);
  await setLocalState(popupState);
  render(popupState);
   const backgroundResult = await notifyBackground({ type: 'state-changed', state: popupState });
   if (backgroundResult?.ok === false) {
    popupState = normalizeState(await getLocalState());
    render(popupState);
    return;
   }
  if (currentUser) void pushState(popupState);
}

function getWorkingState() {
  return popupState ? { ...popupState } : normalizeState(null);
}

toggleBtn.addEventListener('click', async () => {
  const s = getWorkingState();
  if (s.isRunning) {
    await applyState({ ...s, isRunning: false, remaining: computeRemaining(s), startedAt: null, updatedAt: Date.now() });
    return;
  }

  const total = durationFor(s);
  const remaining = computeRemaining(s) > 0 ? computeRemaining(s) : total;
  const now = Date.now();
  await applyState({ ...s, isRunning: true, remaining, startedAt: now, updatedAt: now });
});

resetBtn.addEventListener('click', async () => {
  await applyState({
    mode: 'focus',
    isRunning: false,
    remaining: durationFor({ mode: 'focus', sessionsCompleted: 0 }),
    startedAt: null,
    sessionsCompleted: 0,
    updatedAt: Date.now(),
  });
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
    updatedAt: Date.now(),
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
      updatedAt: Date.now(),
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

async function persistAudioPatch(patch) {
  const next = await updateAudioSettings(patch);
  if (currentUser) await pushAudioSettings(next);
  return next;
}

const SPOTIFY_FIELDS = [
  { uriId: 'spotify-focus-uri', toggleId: 'spotify-focus-enabled', uriKey: 'spotifyFocusUri', enabledKey: 'useSpotifyForFocus' },
  { uriId: 'spotify-break-uri', toggleId: 'spotify-break-enabled', uriKey: 'spotifyBreakUri', enabledKey: 'useSpotifyForBreak' },
  { uriId: 'spotify-long-break-uri', toggleId: 'spotify-long-break-enabled', uriKey: 'spotifyLongBreakUri', enabledKey: 'useSpotifyForLongBreak' },
];

async function renderSpotify() {
  const auth = await getSpotifyAuth();
  const settings = await getAudioSettings();
  const statusEl = $('spotify-status');
  const metaEl = $('spotify-meta');
  const errEl = $('spotify-error');
  const connectBtn = $('spotify-connect');
  const disconnectBtn = $('spotify-disconnect');

  for (const field of SPOTIFY_FIELDS) {
    const uriInput = $(field.uriId);
    const toggle = $(field.toggleId);
    if (uriInput) {
      uriInput.value = settings[field.uriKey] || '';
      uriInput.disabled = !auth;
    }
    if (toggle) {
      toggle.checked = Boolean(settings[field.enabledKey]);
      toggle.disabled = !auth;
    }
  }

  if (!auth) {
    if (statusEl) statusEl.textContent = 'Not connected';
    if (metaEl) metaEl.textContent = 'Use your Spotify playlists for focus and break sessions.';
    if (errEl && spotifyConnectReady && /still preparing/i.test(errEl.textContent)) errEl.textContent = '';
    if (connectBtn) connectBtn.disabled = !spotifyConnectReady;
    connectBtn?.classList.remove('hidden');
    disconnectBtn?.classList.add('hidden');
    return;
  }

  connectBtn?.classList.add('hidden');
  disconnectBtn?.classList.remove('hidden');
  if (statusEl) statusEl.textContent = 'Connected';
  if (metaEl) metaEl.textContent = 'Loading account…';

  const profile = await getSpotifyProfile();
  if (profile) {
    if (statusEl) statusEl.textContent = profile.display_name;
    if (metaEl) {
      metaEl.textContent =
        profile.product === 'premium'
          ? 'Spotify Premium — full playback control.'
          : 'Spotify Free — playback requires a Premium account.';
    }
  } else if (metaEl) {
    metaEl.textContent = 'Connected, but profile lookup failed.';
  }
}

function wireSpotify() {
  const connectBtn = $('spotify-connect');
  const disconnectBtn = $('spotify-disconnect');
  const errEl = $('spotify-error');

  connectBtn?.addEventListener('click', async () => {
    if (errEl) errEl.textContent = '';
    if (!spotifyConnectReady) {
      if (errEl) {
        errEl.textContent = `Spotify sign-in is still preparing. If this keeps happening, confirm this redirect URI is added in Spotify: ${getSpotifyRedirectUri()}`;
      }
      return;
    }
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting…';
    const result = await connectSpotifyViaIdentity();
    connectBtn.disabled = false;
    connectBtn.textContent = 'Connect';
    if (!result.ok) {
      console.warn('[spotify] connect failed', result.error);
      if (errEl) errEl.textContent = result.error || 'Spotify connection failed.';
    } else if (errEl) {
      errEl.textContent = '';
    }
    if (result.ok) await renderSpotify();
  });

  disconnectBtn?.addEventListener('click', async () => {
    await clearSpotifyAuth();
    await renderSpotify();
  });

  for (const field of SPOTIFY_FIELDS) {
    const uriInput = $(field.uriId);
    const toggle = $(field.toggleId);

    if (uriInput) {
      uriInput.addEventListener('change', async (event) => {
        await persistAudioPatch({ [field.uriKey]: String(event.currentTarget.value || '').trim() });
      });
    }

    if (toggle) {
      toggle.addEventListener('change', async (event) => {
        await persistAudioPatch({ [field.enabledKey]: Boolean(event.currentTarget.checked) });
      });
    }
  }
}

(async () => {
  // Render the timer immediately from local storage so it never appears frozen.
  popupState = normalizeState(await getLocalState());
  render(popupState);
  startTicking();

  audioUi = initPopupAudio({
    isSignedIn: () => Boolean(currentUser),
  });
  wireSpotify();
  await renderSpotify();
  const connectBtn = $('spotify-connect');
  if (connectBtn) {
    connectBtn.disabled = true;
    connectBtn.textContent = 'Preparing…';
  }
  void primeSpotifyLogin()
    .then(async () => {
      spotifyConnectReady = true;
      if (connectBtn) {
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect';
      }
      await renderSpotify();
    })
    .catch((error) => {
      console.warn('[spotify] preflight failed', error);
      if ($('spotify-error')) {
        $('spotify-error').textContent =
          error instanceof Error ? error.message : 'Spotify sign-in setup failed.';
      }
      if (connectBtn) {
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect';
      }
    });

  try {
    deviceId = await getDeviceId();
    const { data } = await supabase.auth.getSession();
    currentUser = data?.session?.user ?? null;
    renderAccount();

    if (currentUser) {
      await syncBackgroundAuthSession();
      await hydrateFromCloud();
      await audioUi.hydrateSignedIn();
      await renderSpotify();
      await notifyBackground({ type: 'auth-changed' });
    } else {
      await audioUi.refresh();
    }

    popupState = normalizeState(await getLocalState());
    render(popupState);
  } catch (error) {
    console.warn('[popup] init error', error);
    signinErr.textContent = error instanceof Error ? error.message : 'Extension startup failed.';
  }
})();

supabase.auth.onAuthStateChange(async (_event, session) => {
  currentUser = session?.user ?? null;
  renderAccount();
  await syncBackgroundAuthSession();
  if (currentUser) {
    await hydrateFromCloud();
    await audioUi?.hydrateSignedIn();
  }
  await notifyBackground({ type: 'auth-changed' });
  popupState = normalizeState(await getLocalState());
  render(popupState);
});
