import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { lovable } from '@/integrations/lovable';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type BridgeState = 'starting' | 'waiting' | 'sending' | 'done' | 'error';

type ExternalRuntime = {
  sendMessage: (
    extensionId: string,
    message: unknown,
    response?: (response: { ok?: boolean; error?: string } | undefined) => void,
  ) => void;
  lastError?: { message?: string };
};

function getExternalRuntime(): ExternalRuntime | undefined {
  return (window as Window & { chrome?: { runtime?: ExternalRuntime } }).chrome?.runtime;
}

export default function ExtensionAuth() {
  const { session, loading } = useAuth();
  const attemptedRef = useRef(false);
  const [state, setState] = useState<BridgeState>('starting');
  const [message, setMessage] = useState('Preparing secure sign-in…');

  const extensionId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('extensionId')?.trim() ?? '';
  }, []);

  const redirectUri = useMemo(() => {
    const url = new URL(`${window.location.origin}/extension-auth`);
    if (extensionId) url.searchParams.set('extensionId', extensionId);
    return url.toString();
  }, [extensionId]);

  const startGoogleSignIn = async () => {
    setState('starting');
    setMessage('Opening Google sign-in…');

    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: redirectUri,
    });

    if (result.error) {
      setState('error');
      setMessage(result.error.message || 'Google sign-in failed.');
    }
  };

  useEffect(() => {
    if (!extensionId) {
      setState('error');
      setMessage('Missing extension ID. Re-open Google sign-in from the extension.');
      return;
    }

    if (loading) {
      setState('waiting');
      setMessage('Checking your sign-in…');
      return;
    }

    if (!session) {
      if (attemptedRef.current) {
        setState('waiting');
        setMessage('Waiting for Google sign-in to finish…');
        return;
      }

      attemptedRef.current = true;
      void startGoogleSignIn();
      return;
    }

    const sendSessionToExtension = async () => {
      setState('sending');
      setMessage('Sending your session back to the extension…');

      const runtime = getExternalRuntime();
      if (!runtime?.sendMessage) {
        throw new Error('Chrome could not find the extension. Open this from Chrome with the extension installed.');
      }

      const { data } = await supabase.auth.getSession();
      const activeSession = data.session;
      if (!activeSession) {
        throw new Error('No active session found after Google sign-in.');
      }

      await new Promise<void>((resolve, reject) => {
        runtime.sendMessage(
          extensionId,
          {
            type: 'extension-auth-session',
            session: {
              access_token: activeSession.access_token,
              refresh_token: activeSession.refresh_token,
            },
          },
          (response) => {
            const runtimeError = runtime.lastError?.message;
            if (runtimeError) {
              reject(new Error(runtimeError));
              return;
            }
            if (!response?.ok) {
              reject(new Error(response?.error || 'The extension rejected the session.'));
              return;
            }
            resolve();
          },
        );
      });

      setState('done');
      setMessage('Signed in — this window can close now.');
      window.setTimeout(() => window.close(), 500);
    };

    void sendSessionToExtension().catch((error) => {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Failed to connect the extension.');
    });
  }, [extensionId, loading, session, redirectUri]);

  return (
    <main className="gradient-focus flex min-h-[100dvh] items-center justify-center px-4">
      <section className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h1 className="mb-2 text-center text-2xl font-semibold text-card-foreground">Connect extension</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">{message}</p>

        {state === 'error' ? (
          <Button className="w-full" onClick={() => void startGoogleSignIn()} type="button">
            Try Google sign-in again
          </Button>
        ) : (
          <div className="text-center text-xs text-muted-foreground">
            {state === 'done' ? 'You can return to the extension.' : 'This window closes automatically when finished.'}
          </div>
        )}
      </section>
    </main>
  );
}
