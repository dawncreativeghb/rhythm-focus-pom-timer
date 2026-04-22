import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { parseYouTubeId, parseYouTubePlaylistId } from '@/lib/platform';

// Minimal YT types we use
type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  setVolume: (v: number) => void;
  loadVideoById: (id: string) => void;
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
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
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
 * Small, visible YouTube player (required by YouTube ToS).
 * Mounts when `visible` is true. Plays/pauses based on `shouldPlay`.
 * Reloads the video only when `url` changes.
 */
export function YouTubePlayer({ url, shouldPlay, volume, visible }: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const lastLoadedRef = useRef<string>('');

  // Init / destroy
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    loadYouTubeApi().then(() => {
      if (cancelled || !containerRef.current || !window.YT) return;
      const id = parseYouTubeId(url);
      const playlist = parseYouTubePlaylistId(url);
      // Need at least an ID or playlist to start; otherwise create empty player
      const startId = id || 'M7lc1UVf-VE'; // placeholder; will be overridden when user pastes URL

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId: startId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          ...(playlist ? { list: playlist, listType: 'playlist' } : {}),
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            setReady(true);
            lastLoadedRef.current = url;
          },
        },
      });
    });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        // ignore
      }
      playerRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Volume sync
  useEffect(() => {
    if (!ready || !playerRef.current) return;
    try {
      playerRef.current.setVolume(Math.round(Math.max(0, Math.min(1, volume)) * 100));
    } catch {
      // ignore
    }
  }, [volume, ready]);

  // URL change → reload
  useEffect(() => {
    if (!ready || !playerRef.current) return;
    if (url === lastLoadedRef.current) return;
    const id = parseYouTubeId(url);
    const playlist = parseYouTubePlaylistId(url);
    try {
      if (playlist) {
        playerRef.current.loadPlaylist({ list: playlist, listType: 'playlist' });
      } else if (id) {
        playerRef.current.loadVideoById(id);
      }
      lastLoadedRef.current = url;
    } catch {
      // ignore
    }
  }, [url, ready]);

  // Play / pause
  useEffect(() => {
    if (!ready || !playerRef.current) return;
    try {
      if (shouldPlay) playerRef.current.playVideo();
      else playerRef.current.pauseVideo();
    } catch {
      // ignore
    }
  }, [shouldPlay, ready]);

  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="fixed bottom-4 right-4 z-30 w-[280px] overflow-hidden rounded-lg border border-border/50 bg-card shadow-lg sm:w-[320px]"
      aria-label="YouTube player"
    >
      <div className="aspect-video w-full">
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </motion.div>
  );
}
