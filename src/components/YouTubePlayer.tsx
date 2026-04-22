import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { parseYouTubeId, parseYouTubePlaylistId } from '@/lib/platform';

// Minimal YT types we use
type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo?: () => void;
  setVolume: (v: number) => void;
  cueVideoById: (id: string) => void;
  loadVideoById: (id: string) => void;
  cuePlaylist: (opts: { list: string; listType: string }) => void;
  loadPlaylist: (opts: { list: string; listType: string }) => void;
  destroy: () => void;
  getPlayerState?: () => number;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: Record<string, unknown>
      ) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; CUED: number; BUFFERING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiLoadingPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (apiLoadingPromise) return apiLoadingPromise;

  apiLoadingPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => {
      console.error('[YouTubePlayer] failed to load IFrame API');
    };
    document.head.appendChild(tag);
  });
  return apiLoadingPromise;
}

interface YouTubePlayerProps {
  url: string;
  shouldPlay: boolean;
  volume: number; // 0..1
  visible: boolean;
}

/**
 * Small YouTube player (visibility required by YouTube ToS).
 *
 * Stability strategy (different from previous unmount-on-mode-switch approach):
 *   • Player instance is created ONCE on first mount and kept alive for the
 *     lifetime of the component — we never destroy it on mode switches.
 *   • Visibility is controlled with CSS (hide off-screen) so the iframe and
 *     its internal state survive focus→break→focus transitions.
 *   • Source is only swapped when the URL truly changes; same URL across
 *     mode switches just calls pause/play, preserving playback position.
 *   • All YT API calls are guarded with try/catch so a flaky API call never
 *     bubbles up and breaks the timer UI.
 */
export function YouTubePlayer({ url, shouldPlay, volume, visible }: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const lastLoadedRef = useRef<string>('');
  const initFailedRef = useRef(false);

  // Init once — player is kept alive across mode switches.
  useEffect(() => {
    let cancelled = false;

    loadYouTubeApi()
      .then(() => {
        if (cancelled || !containerRef.current || !window.YT) return;
        try {
          playerRef.current = new window.YT.Player(containerRef.current, {
            // No initial videoId — we cue/load when the user provides a URL.
            playerVars: {
              autoplay: 0,
              controls: 1,
              modestbranding: 1,
              rel: 0,
              playsinline: 1,
            },
            events: {
              onReady: () => {
                if (cancelled) return;
                setReady(true);
              },
              onError: (e: { data?: number }) => {
                console.warn('[YouTubePlayer] player error', e?.data);
              },
            },
          });
        } catch (err) {
          initFailedRef.current = true;
          console.error('[YouTubePlayer] init failed', err);
        }
      })
      .catch((err) => {
        initFailedRef.current = true;
        console.error('[YouTubePlayer] API load failed', err);
      });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        // ignore — destroying mid-load can throw
      }
      playerRef.current = null;
      setReady(false);
    };
  }, []);

  // Volume sync
  useEffect(() => {
    if (!ready || !playerRef.current) return;
    try {
      playerRef.current.setVolume(Math.round(Math.max(0, Math.min(1, volume)) * 100));
    } catch {
      // ignore
    }
  }, [volume, ready]);

  // Source swap — only when URL actually changes.
  // Use cue* (not load*) so we don't auto-play; the play/pause effect handles playback.
  useEffect(() => {
    if (!ready || !playerRef.current) return;
    if (url === lastLoadedRef.current) return;
    const id = parseYouTubeId(url);
    const playlist = parseYouTubePlaylistId(url);
    try {
      if (playlist) {
        playerRef.current.cuePlaylist({ list: playlist, listType: 'playlist' });
        lastLoadedRef.current = url;
      } else if (id) {
        playerRef.current.cueVideoById(id);
        lastLoadedRef.current = url;
      } else {
        // Invalid URL — leave previous source alone.
      }
    } catch (err) {
      console.warn('[YouTubePlayer] cue failed', err);
    }
  }, [url, ready]);

  // Play / pause
  useEffect(() => {
    if (!ready || !playerRef.current) return;
    try {
      if (shouldPlay) playerRef.current.playVideo();
      else playerRef.current.pauseVideo();
    } catch (err) {
      console.warn('[YouTubePlayer] play/pause failed', err);
    }
  }, [shouldPlay, ready]);

  // Always render the container so the player stays mounted; toggle visibility via CSS.
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
      transition={{ duration: 0.2 }}
      className="fixed bottom-4 right-4 z-30 w-[280px] overflow-hidden rounded-lg border border-border/50 bg-card shadow-lg sm:w-[320px]"
      style={{ pointerEvents: visible ? 'auto' : 'none' }}
      aria-hidden={!visible}
      aria-label="YouTube player"
    >
      <div className="aspect-video w-full">
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </motion.div>
  );
}
