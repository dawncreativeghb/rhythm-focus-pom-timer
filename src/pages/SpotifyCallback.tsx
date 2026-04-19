import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSpotify } from '@/hooks/useSpotify';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SpotifyCallback = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { handleCallback } = useSpotify();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code = params.get('code');
    const state = params.get('state');
    const err = params.get('error');
    const errDesc = params.get('error_description');

    if (err) {
      setStatus('error');
      setErrorMsg(`${err}${errDesc ? ` — ${errDesc}` : ''}`);
      console.error('Spotify OAuth error:', err, errDesc, 'Full URL:', window.location.href);
      return;
    }
    if (!code || !state) {
      setStatus('error');
      setErrorMsg(`Missing authorization code. URL: ${window.location.search}`);
      return;
    }

    handleCallback(code, state)
      .then(() => {
        setStatus('success');
        setTimeout(() => navigate('/', { replace: true }), 1200);
      })
      .catch((e) => {
        setStatus('error');
        setErrorMsg(e instanceof Error ? e.message : 'Unknown error');
      });
  }, [params, handleCallback, navigate]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6">
      {status === 'loading' && (
        <>
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg text-foreground">Connecting to Spotify…</p>
        </>
      )}
      {status === 'success' && (
        <>
          <CheckCircle2 className="h-12 w-12 text-primary" />
          <p className="text-lg text-foreground">Connected! Redirecting…</p>
        </>
      )}
      {status === 'error' && (
        <>
          <XCircle className="h-12 w-12 text-destructive" />
          <p className="text-lg text-foreground">Connection failed</p>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <Button onClick={() => navigate('/', { replace: true })}>Back to Timer</Button>
        </>
      )}
    </main>
  );
};

export default SpotifyCallback;
