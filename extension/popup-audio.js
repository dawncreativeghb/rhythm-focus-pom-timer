import {
  getAudioSettings,
  setAudioFile,
  updateAudioSettings,
  pushAudioSettings,
  hydrateAudioSettingsFromCloud,
} from './audio-settings.js';

const AUDIO_ROWS = [
  { key: 'focusMusic', enabledKey: 'focusMusicEnabled', fileInputId: 'audio-focus-file', toggleId: 'audio-focus-enabled', nameId: 'audio-focus-name', clearId: 'audio-focus-clear' },
  { key: 'breakMusic', enabledKey: 'breakMusicEnabled', fileInputId: 'audio-break-file', toggleId: 'audio-break-enabled', nameId: 'audio-break-name', clearId: 'audio-break-clear' },
  { key: 'longBreakMusic', enabledKey: 'longBreakMusicEnabled', fileInputId: 'audio-long-break-file', toggleId: 'audio-long-break-enabled', nameId: 'audio-long-break-name', clearId: 'audio-long-break-clear' },
];

function $(id) {
  return document.getElementById(id);
}

export function initPopupAudio(options) {
  const volumeInput = $('audio-volume');
  const volumeValue = $('audio-volume-value');
  const panel = $('audio-panel');

  async function persist(next) {
    if (options.isSignedIn()) {
      await pushAudioSettings(next);
    }
  }

  async function render() {
    const settings = await getAudioSettings();
    if (volumeInput) volumeInput.value = String(Math.round(settings.volume * 100));
    if (volumeValue) volumeValue.textContent = `${Math.round(settings.volume * 100)}%`;

    for (const row of AUDIO_ROWS) {
      const toggle = $(row.toggleId);
      const name = $(row.nameId);
      const clear = $(row.clearId);
      if (toggle) toggle.checked = Boolean(settings[row.enabledKey]);
      if (name) name.textContent = settings[row.key]?.name || 'No file selected';
      if (clear) clear.disabled = !settings[row.key];
    }
  }

  if (volumeInput) {
    volumeInput.addEventListener('input', async (event) => {
      const target = event.currentTarget;
      const volume = Number(target.value) / 100;
      const next = await updateAudioSettings({ volume });
      if (volumeValue) volumeValue.textContent = `${Math.round(next.volume * 100)}%`;
      await persist(next);
    });
  }

  for (const row of AUDIO_ROWS) {
    const toggle = $(row.toggleId);
    const input = $(row.fileInputId);
    const clear = $(row.clearId);

    if (toggle) {
      toggle.addEventListener('change', async (event) => {
        const next = await updateAudioSettings({ [row.enabledKey]: Boolean(event.currentTarget.checked) });
        await persist(next);
        await render();
      });
    }

    if (input) {
      input.addEventListener('change', async (event) => {
        const file = event.currentTarget.files?.[0] ?? null;
        const next = await setAudioFile(row.key, file);
        await persist(next);
        await render();
      });
    }

    if (clear) {
      clear.addEventListener('click', async () => {
        const next = await setAudioFile(row.key, null);
        const inputEl = $(row.fileInputId);
        if (inputEl) inputEl.value = '';
        await persist(next);
        await render();
      });
    }
  }

  return {
    open() {
      panel?.setAttribute('open', 'open');
    },
    async refresh() {
      await render();
    },
    async hydrateSignedIn() {
      await hydrateAudioSettingsFromCloud();
      await render();
    },
  };
}
