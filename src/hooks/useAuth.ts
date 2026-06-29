import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import type { Session } from '@supabase/supabase-js';

/**
 * Tracks the Supabase auth session. Sign-in is optional — the app is
 * local-first and fully usable signed out; signing in only enables
 * cross-device sync of settings.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Passwordless email: Supabase emails a one-tap sign-in link.
  const signInWithEmail = useCallback(async (email: string) => {
    return supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
  }, []);

  // Google goes through Lovable Cloud's auth helper (not supabase.auth directly),
  // which completes the OAuth and sets the Supabase session for us.
  const signInWithGoogle = useCallback(async () => {
    return lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
  }, []);

  const signOut = useCallback(async () => {
    return supabase.auth.signOut();
  }, []);

  return {
    session,
    user: session?.user ?? null,
    isSignedIn: !!session,
    loading,
    signInWithEmail,
    signInWithGoogle,
    signOut,
  };
}
