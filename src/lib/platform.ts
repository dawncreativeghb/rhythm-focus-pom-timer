import { Capacitor } from '@capacitor/core';

/**
 * YouTube playback only works reliably on desktop browsers.
 * iOS Safari + native apps block background audio for embedded YouTube,
 * so we hide the option entirely on those platforms.
 */
export function isYouTubeSupported(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Native iOS/Android blocks background audio for embedded YouTube.
    if (Capacitor.isNativePlatform()) return false;
  } catch {
    // Capacitor not available — treat as web
  }
  // Allow on any web browser (desktop + mobile web). Embedded YouTube
  // works fine in mobile Safari/Chrome as long as the iframe is visible.
  return true;
}

/** Extract a YouTube video ID from any common URL form, or return the input if it already looks like an ID. */
export function parseYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Bare 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  // youtu.be/ID
  const short = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (short) return short[1];
  // youtube.com/watch?v=ID
  const watch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watch) return watch[1];
  // youtube.com/embed/ID or /live/ID or /shorts/ID
  const path = trimmed.match(/youtube\.com\/(?:embed|live|shorts)\/([a-zA-Z0-9_-]{11})/);
  if (path) return path[1];
  return null;
}

/** Extract a YouTube playlist ID, if present. */
export function parseYouTubePlaylistId(input: string): string | null {
  const m = input.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}
