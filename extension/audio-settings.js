import { supabase, getDeviceId } from './sync.js';

const STORAGE_KEY = 'audioSettings';
const AUDIO_FILE_KEYS = ['focusMusic', 'breakChime', 'breakMusic', 'longBreakMusic'];

export const DEFAULT_AUDIO_SETTINGS = {
  focusMusic: null,
  breakChime: null,
  breakMusic: null,
  longBreakMusic: null,
  focusMusicEnabled: true,
  breakChimeEnabled: true,
  breakWarningEnabled: true,
  breakEndChimeEnabled: true,
  breakMusicEnabled: true,
  longBreakMusicEnabled: true,
  volume: 0.7,
  spotifyFocusUri: '',
  spotifyBreakUri: '',
  spotifyLongBreakUri: '',
  useSpotifyForFocus: false,
  useSpotifyForBreak: false,
  useSpotifyForLongBreak: false,
};

function normalizeAudioFile(file) {
  if (!file?.name) return null;
  return {
    name: file.name,
    url: typeof file.url === 'string' ? file.url : '',
    type: typeof file.type === 'string' ? file.type : 'audio/*',
  };
}

function mergeAudioSettings(base, incoming = {}) {
  const merged = { ...DEFAULT_AUDIO_SETTINGS, ...base, ...incoming };

  for (const key of AUDIO_FILE_KEYS) {
    const nextFile = normalizeAudioFile(incoming[key]);
    const existingFile = normalizeAudioFile(base[key]);
    if (nextFile && !nextFile.url && existingFile?.url) {
      merged[key] = existingFile;
    } else {
      merged[key] = nextFile;
    }
  }

  merged.volume = Math.max(0, Math.min(1, Number(merged.volume ?? DEFAULT_AUDIO_SETTINGS.volume)));
  return merged;
}

export async function getAudioSettings() {
  const { [STORAGE_KEY]: stored } = await chrome.storage.local.get(STORAGE_KEY);
  return mergeAudioSettings({}, stored);
}

export async function setAudioSettings(next) {
  const normalized = mergeAudioSettings({}, next);
  await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
  return normalized;
}

export async function updateAudioSettings(patch) {
  const current = await getAudioSettings();
  const next = mergeAudioSettings(current, patch);
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export async function setAudioFile(key, file) {
  const current = await getAudioSettings();
  const next = { ...current, [key]: file ? await fileToAudioFile(file) : null };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export async function hydrateAudioSettingsFromCloud() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from('audio_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data?.settings) {
    if (error) console.warn('[audio] hydrate failed', error.message);
    return null;
  }

  const current = await getAudioSettings();
  const next = mergeAudioSettings(current, data.settings);
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export async function pushAudioSettings(settings) {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return;

  const deviceId = await getDeviceId();
  const { error } = await supabase.from('audio_settings').upsert(
    {
      user_id: user.id,
      settings: stripHeavyFields(settings),
      device_id: deviceId,
    },
    { onConflict: 'user_id' }
  );

  if (error) console.warn('[audio] push failed', error.message);
}

function stripHeavyFields(settings) {
  return {
    ...settings,
    focusMusic: stripFileUrl(settings.focusMusic),
    breakChime: stripFileUrl(settings.breakChime),
    breakMusic: stripFileUrl(settings.breakMusic),
    longBreakMusic: stripFileUrl(settings.longBreakMusic),
  };
}

function stripFileUrl(file) {
  if (!file) return null;
  return {
    name: file.name,
    url: '',
    type: file.type,
  };
}

function fileToAudioFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file.name,
        url: String(reader.result || ''),
        type: file.type || 'audio/*',
      });
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read audio file.'));
    reader.readAsDataURL(file);
  });
}
