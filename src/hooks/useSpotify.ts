import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'spotify-auth';
const STATE_KEY = 'spotify-oauth-state';

interface StoredAuth {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface SpotifyProfile {
  display_name: string;
  product: string;
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
        expires_at: Date.now() + data.expires_in * 1000,
      };
      saveAuth(next);
      setAuth(next);
      return next.access_token;
    } catch (e) {
      console.error('Refresh error', e);
      return null;
    }
  }, []);

  const ensureActiveDevice = useCallback(
    async (targetDeviceId?: string) => {
      const resolvedDeviceId = targetDeviceId ?? deviceId;
      if (!resolvedDeviceId) return false;

      try {
        await playerRef.current?.activateElement?.();
      } catch (e) {
        console.warn('[Spotify] activateElement failed', e);
      }

      const token = await getValidToken();
      if (!token) return false;

      try {
        const res = await fetch('https://api.spotify.com/v1/me/player', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            device_ids: [resolvedDeviceId],
            play: false,
          }),
        });

        if (!res.ok && res.status !== 204) {
          const text = await res.text();
          console.error('[Spotify] transfer playback failed', res.status, text);
          return false;
        }

        return true;
      } catch (e) {
        console.error('[Spotify] transfer playback error', e);
        return false;
      }
    },
    [deviceId, getValidToken]
  );

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

  useEffect(() => {
    if (!auth || sdkLoadedRef.current) return;
    sdkLoadedRef.current = true;

    const initPlayer = () => {
      const player = new window.Spotify.Player({
        name: 'Rhythm Focus Web Player',
        getOAuthToken: async (cb: (token: string) => void) => {
          const token = await getValidToken();
          if (token) cb(token);
        },
        volume: 0.5,
      });

      playerRef.current = player;

      player.addListener('ready', ({ device_id }: { device_id: string }) => {
        console.log('Spotify player ready', device_id);
        setDeviceId(device_id);
        setPlayerReady(true);
        setError(null);

        void (async () => {
          await ensureActiveDevice(device_id);
        })();
      });

      player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
        console.log('Spotify player offline', device_id);
        setPlayerReady(false);
        setDeviceId((current) => (current === device_id ? null : current));
      });

      player.addListener('initialization_error', ({ message }: any) => {
        console.error('Spotify init error', message);
        setError(message);
      });

      player.addListener('authentication_error', ({ message }: any) => {
        console.error('Spotify auth error', message);
        setError('Authentication failed — please reconnect');
        clearAuth();
        setAuth(null);
      });

      player.addListener('account_error', ({ message }: any) => {
        console.error('Spotify account error', message);
        setError('Spotify Premium required for playback');
      });

      player.addListener('playback_error', ({ message }: any) => {
        console.error('Spotify playback error', message);
        setError(message || 'Spotify playback failed');
      });

      player.connect();
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
  }, [auth, ensureActiveDevice, getValidToken]);

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
    setError(null);
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
      expires_at: Date.now() + data.expires_in * 1000,
    };
    saveAuth(next);
    setAuth(next);
    setIsLoading(false);
  }, []);

  const play = useCallback(
    async (contextUri?: string, options?: { positionMs?: number; offsetUri?: string }) => {
      if (!deviceId) {
        console.warn('[Spotify] play() called but no deviceId yet');
        setError('Spotify player is still connecting — try again in a second');
        return;
      }

      const token = await getValidToken();
      if (!token) return;

      const buildBody = () => {
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
        return body;
      };

      const callPlay = async () =>
        fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildBody()),
        });

      try {
        // 1. Activate the audio element (needed on mobile / iOS)
        try {
          await playerRef.current?.activateElement?.();
        } catch (e) {
          console.warn('[Spotify] activateElement failed', e);
        }

        // 2. Transfer playback to our web player and give Spotify time to register it
        await ensureActiveDevice(deviceId);
        await new Promise((r) => setTimeout(r, 800));

        // 3. Try play, with up to 3 retries on the "device not found" error
        let res = await callPlay();
        let attempt = 0;
        while ((!res.ok && res.status === 404) && attempt < 3) {
          attempt++;
          console.warn(`[Spotify] device not ready, retry ${attempt}/3`);
          await ensureActiveDevice(deviceId);
          await new Promise((r) => setTimeout(r, 700 * attempt));
          res = await callPlay();
        }

        if (!res.ok && res.status !== 204) {
          const text = await res.text();
          let parsed: any = null;
          try {
            parsed = JSON.parse(text);
          } catch {}
          const message = parsed?.error?.message as string | undefined;
          console.error('[Spotify] play failed', res.status, text);

          if (res.status === 403) {
            setError('Spotify Premium required for playback');
          } else if (res.status === 404 && message?.toLowerCase().includes('device')) {
            setError(
              'Spotify can\'t find this web player. Open the Spotify app once (desktop or phone), play any song for a second, then come back here.'
            );
          } else if (res.status === 404) {
            setError('Playlist not found — check the link is correct and public');
          } else if (res.status === 401) {
            setError('Spotify session expired — please reconnect');
          } else {
            setError(`Spotify error (${res.status}): ${message || 'unknown'}`);
          }
        } else {
          setError(null);
        }
      } catch (e) {
        console.error('[Spotify] play error', e);
      }
    },
    [deviceId, ensureActiveDevice, getValidToken]
  );

  const pause = useCallback(async () => {
    const token = await getValidToken();
    if (!token) return;

    try {
      const res = await fetch('https://api.spotify.com/v1/me/player/pause', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok && res.status !== 204 && res.status !== 404) {
        const text = await res.text();
        console.error('[Spotify] pause failed', res.status, text);
      }
    } catch (e) {
      console.error('Pause error', e);
    }
  }, [getValidToken]);

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
