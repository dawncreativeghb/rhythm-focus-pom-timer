// Stable per-device ID so realtime echoes from the same device can be ignored.
const KEY = 'pomodoro-device-id';

export function getDeviceId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
