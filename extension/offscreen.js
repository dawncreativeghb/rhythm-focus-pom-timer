let ambientAudio = null;
let sequenceId = 0;
let sharedCtx = null;

function getAudioContext() {
  if (sharedCtx && sharedCtx.state !== 'closed') return sharedCtx;
  const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctor) return null;
  sharedCtx = new Ctor();
  return sharedCtx;
}

async function ensureAudioContextRunning() {
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      return ctx;
    }
  }
  return ctx;
}

function playTone(ctx, masterVolume, { freq, startAt, duration, volume, type = 'sine' }) {
  const t0 = ctx.currentTime + startAt;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  const peak = Math.max(0, Math.min(1, masterVolume * volume));
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playBuiltInChime(kind, volume) {
  const ctx = await ensureAudioContextRunning();
  if (!ctx) return;

  if (kind === 'start') {
    playTone(ctx, volume, { freq: 659.25, startAt: 0, duration: 1.0, volume: 0.45 });
    playTone(ctx, volume, { freq: 880.0, startAt: 0.18, duration: 1.2, volume: 0.4 });
    await wait(1400);
    return;
  }

  if (kind === 'warning') {
    playTone(ctx, volume, { freq: 783.99, startAt: 0, duration: 0.55, volume: 0.4 });
    playTone(ctx, volume, { freq: 783.99, startAt: 0.28, duration: 0.55, volume: 0.32 });
    await wait(900);
    return;
  }

  playTone(ctx, volume, { freq: 523.25, startAt: 0.0, duration: 0.5, volume: 0.4 });
  playTone(ctx, volume, { freq: 659.25, startAt: 0.16, duration: 0.5, volume: 0.4 });
  playTone(ctx, volume, { freq: 783.99, startAt: 0.32, duration: 0.9, volume: 0.45 });
  await wait(1300);
}

function stopAmbientAudio() {
  if (!ambientAudio) return;
  ambientAudio.pause();
  ambientAudio.currentTime = 0;
  ambientAudio.src = '';
  ambientAudio = null;
}

async function playAudioFile(url, { loop = false, volume = 0.7 } = {}) {
  if (!url) return false;
  stopAmbientAudio();
  const audio = new Audio(url);
  audio.loop = loop;
  audio.volume = Math.max(0, Math.min(1, volume));
  ambientAudio = audio;
  try {
    await audio.play();
    return true;
  } catch (error) {
    console.warn('[offscreen] audio playback failed', error);
    if (ambientAudio === audio) ambientAudio = null;
    return false;
  }
}

async function playChime(settings, kind) {
  const volume = settings?.volume ?? 0.7;

  if (kind === 'start') {
    if (settings?.breakChimeEnabled === false) return;
    if (settings?.breakChime?.url) {
      const played = await playAudioFile(settings.breakChime.url, { loop: false, volume });
      if (played) {
        await wait(1400);
        if (ambientAudio && !ambientAudio.loop) stopAmbientAudio();
        return;
      }
    }
  }

  if (kind === 'end' && settings?.breakEndChimeEnabled === false) return;
  if (kind === 'warning' && settings?.breakWarningEnabled === false) return;
  await playBuiltInChime(kind, volume);
}

async function playBreakSequence(settings, isLongBreak) {
  const currentSequence = ++sequenceId;
  stopAmbientAudio();
  await playChime(settings, 'start');
  if (currentSequence !== sequenceId) return;

  const musicEnabled = isLongBreak ? settings?.longBreakMusicEnabled : settings?.breakMusicEnabled;
  const musicFile = isLongBreak ? settings?.longBreakMusic : settings?.breakMusic;
  if (musicEnabled && musicFile?.url) {
    await playAudioFile(musicFile.url, { loop: true, volume: settings?.volume ?? 0.7 });
  }
}

async function playFocusSequence(settings, transitionedFromBreak) {
  const currentSequence = ++sequenceId;
  stopAmbientAudio();
  if (transitionedFromBreak) {
    await playChime(settings, 'end');
    if (currentSequence !== sequenceId) return;
  }

  if (settings?.focusMusicEnabled && settings?.focusMusic?.url) {
    await playAudioFile(settings.focusMusic.url, { loop: true, volume: settings?.volume ?? 0.7 });
  }
}

async function handleMessage(message) {
  switch (message?.type) {
    case 'audio-stop':
      sequenceId += 1;
      stopAmbientAudio();
      return { ok: true };
    case 'audio-play-focus':
      await playFocusSequence(message.settings || {}, Boolean(message.transitionedFromBreak));
      return { ok: true };
    case 'audio-play-break':
      await playBreakSequence(message.settings || {}, Boolean(message.isLongBreak));
      return { ok: true };
    case 'audio-play-end':
      sequenceId += 1;
      stopAmbientAudio();
      await playChime(message.settings || {}, 'end');
      return { ok: true };
    case 'audio-play-warning':
      await playChime(message.settings || {}, 'warning');
      return { ok: true };
    default:
      return { ok: false, error: 'Unknown audio message.' };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.target || message.target !== 'offscreen') return false;
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Audio action failed.' });
    });
  return true;
});
