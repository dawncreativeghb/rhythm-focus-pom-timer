import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';

const STORAGE_KEY = 'spotify-auth';
const STATE_KEY = 'spotify-oauth-state';
const NATIVE_REDIRECT_URI = 'focusflow://spotify-callback';

interface StoredAuth {
  access_token: string;
  refresh_token: string;
  expires_at: number; // ms timestamp
}

interface SpotifyProfile {
  display_name: string;
  product: string; // 'premium' | 'free' | 'open'
}

declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

function getRedirectUri() {
  return `${window.location.origin}/spotify-callback`;
}

function loadAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

function saveAuth(auth: StoredAuth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useSpotify() {
  const [auth, setAuth] = useState<StoredAuth | null>(loadAuth());
  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<any>(null);
  const sdkLoadedRef = useRef(false);

  const isConnected = !!auth;
  const isPremium = profile?.product === 'premium';

  const getValidToken = useCallback(async (): Promise<string | null> => {
    const current = loadAuth();
    if (!current) return null;
    // Refresh if expiring within 60s
    if (current.expires_at - Date.now() > 60_000) {
      return current.access_token;
    }
    try {
      const { data, error } = await supabase.functions.invoke('spotify-auth', {
        body: { action: 'refresh', refresh_token: current.refresh_token },
      });
      if (error || !data?.access_token) {
        console.error('Refresh failed', error, data);
        clearAuth();
        setAuth(null);
        return null;
      }
      const next: StoredAuth = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || current.refresh_token,
        expires_at: Date.now() + (data.expires_in * 1000),
      };
      saveAuth(next);
      setAuth(next);
      return next.access_token;
    } catch (e) {
      console.error('Refresh error', e);
      return null;
    }
  }, []);

  // Fetch profile when authed
  useEffect(() => {
    if (!auth) {
      setProfile(null);
      return;
    }
    (async () => {
      const token = await getValidToken();
      if (!token) return;
      try {
        const res = await fetch('https://api.spotify.com/v1/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setProfile({ display_name: data.display_name, product: data.product });
        }
      } catch (e) {
        console.error('Profile fetch failed', e);
      }
    })();
  }, [auth, getValidToken]);

  // Load Spotify Web Playback SDK once user is connected
  useEffect(() => {
    if (!auth || sdkLoadedRef.current) return;
    sdkLoadedRef.current = true;

    const initPlayer = () => {
      const player = new window.Spotify.Player({
        name: 'Focus Flow Pomodoro',
        getOAuthToken: async (cb: (token: string) => void) => {
          const token = await getValidToken();
          if (token) cb(token);
        },
        volume: 0.5,
      });

      player.addListener('ready', ({ device_id }: { device_id: string }) => {
        console.log('Spotify player ready', device_id);
        setDeviceId(device_id);
        setPlayerReady(true);
      });

      player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
        console.log('Spotify player offline', device_id);
        setPlayerReady(false);
      });

      player.addListener('initialization_error', ({ message }: any) => {
        console.error('Spotify init error', message);
        setError(message);
      });
      player.addListener('authentication_error', ({ message }: any) => {
        console.error('Spotify auth error', message);
        setError('Authentication failed - please reconnect');
        clearAuth();
        setAuth(null);
      });
      player.addListener('account_error', ({ message }: any) => {
        console.error('Spotify account error', message);
        setError('Spotify Premium required for playback');
      });

      player.connect();
      playerRef.current = player;
    };

    if (window.Spotify) {
      initPlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = initPlayer;
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      document.body.appendChild(script);
    }

    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, [auth, getValidToken]);

  const connect = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('spotify-auth', {
        body: { action: 'login', redirect_uri: getRedirectUri() },
      });
      if (error || !data?.url) {
        throw new Error(error?.message || 'Failed to start login');
      }
      sessionStorage.setItem(STATE_KEY, data.state);
      // Break out of preview iframe — Spotify blocks framing with X-Frame-Options: DENY
      const top = window.top ?? window;
      try {
        top.location.href = data.url;
      } catch {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
      setIsLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    playerRef.current?.disconnect();
    playerRef.current = null;
    sdkLoadedRef.current = false;
    clearAuth();
    setAuth(null);
    setProfile(null);
    setDeviceId(null);
    setPlayerReady(false);
  }, []);

  const handleCallback = useCallback(async (code: string, state: string) => {
    const expected = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    if (expected && expected !== state) {
      throw new Error('State mismatch - possible CSRF');
    }
    const { data, error } = await supabase.functions.invoke('spotify-auth', {
      body: { action: 'exchange', code, redirect_uri: getRedirectUri() },
    });
    if (error || !data?.access_token) {
      throw new Error(error?.message || data?.error || 'Token exchange failed');
    }
    const next: StoredAuth = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000),
    };
    saveAuth(next);
    setAuth(next);
  }, []);

  const play = useCallback(
    async (contextUri?: string, options?: { positionMs?: number; offsetUri?: string }) => {
      if (!deviceId) {
        console.warn('[Spotify] play() called but no deviceId yet');
        return;
      }
      const token = await getValidToken();
      if (!token) return;
      try {
        const body: any = {};
        if (contextUri) {
          if (contextUri.includes(':track:')) {
            body.uris = [contextUri];
          } else {
            body.context_uri = contextUri;
            if (options?.offsetUri) {
              body.offset = { uri: options.offsetUri };
            }
          }
          if (options?.positionMs && options.positionMs > 0) {
            body.position_ms = options.positionMs;
          }
        }
        console.log('[Spotify] play', { contextUri, body, deviceId });
        const res = await fetch(
          `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          }
        );
        if (!res.ok && res.status !== 204) {
          const text = await res.text();
          console.error('[Spotify] play failed', res.status, text);
          if (res.status === 403) {
            setError('Spotify Premium required for playback');
          } else if (res.status === 404) {
            setError('Playlist not found — check the link is correct and public');
          }
        }
      } catch (e) {
        console.error('[Spotify] play error', e);
      }
    },
    [deviceId, getValidToken]
  );

  const pause = useCallback(async () => {
    if (!deviceId) return;
    const token = await getValidToken();
    if (!token) return;
    try {
      await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      console.error('Pause error', e);
    }
  }, [deviceId, getValidToken]);

  // Get current playback state — useful for capturing track + position before pausing
  const getCurrentState = useCallback(async () => {
    if (!playerRef.current) return null;
    try {
      const state = await playerRef.current.getCurrentState();
      if (!state) return null;
      return {
        trackUri: state.track_window?.current_track?.uri as string | undefined,
        positionMs: state.position as number,
        contextUri: state.context?.uri as string | undefined,
      };
    } catch (e) {
      console.error('getCurrentState error', e);
      return null;
    }
  }, []);

  const setVolume = useCallback(async (volume: number) => {
    if (!playerRef.current) return;
    try {
      await playerRef.current.setVolume(Math.max(0, Math.min(1, volume)));
    } catch (e) {
      console.error('Volume error', e);
    }
  }, []);

  return {
    isConnected,
    isPremium,
    profile,
    playerReady,
    deviceId,
    isLoading,
    error,
    connect,
    disconnect,
    handleCallback,
    play,
    pause,
    setVolume,
    getCurrentState,
  };
}
