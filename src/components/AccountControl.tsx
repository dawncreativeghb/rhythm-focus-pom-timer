import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, LogOut, Mail, X, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { useAuth } from '@/hooks/useAuth';

interface AccountControlProps {
  auth: ReturnType<typeof useAuth>;
}

export function AccountControl({ auth }: AccountControlProps) {
  const { user, isSignedIn, signInWithEmail, signInWithGoogle, signOut } = auth;
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setError(null);
    setSent(false);
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const addr = email.trim();
    if (!addr) return;
    setSending(true);
    setError(null);
    const { error } = await signInWithEmail(addr);
    setSending(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  const handleGoogle = async () => {
    setError(null);
    const res = await signInWithGoogle();
    if (res && 'error' in res && res.error) {
      setError(res.error instanceof Error ? res.error.message : 'Google sign-in failed');
    }
  };

  const initial = (user?.email?.[0] ?? '?').toUpperCase();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] z-10 flex items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1.5 text-xs text-secondary-foreground backdrop-blur-sm transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label={isSignedIn ? 'Account and sync' : 'Sign in to sync across devices'}
      >
        {isSignedIn ? (
          <>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              {initial}
            </span>
            Synced
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Sign in
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
              onClick={close}
            />
            <div
              className="fixed inset-0 z-50 overflow-y-auto overscroll-contain"
              onClick={close}
            >
              <div className="flex min-h-full items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground">
                      {isSignedIn ? 'Your account' : 'Sync across devices'}
                    </h2>
                    <Button variant="ghost" size="icon" onClick={close} aria-label="Close">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>

                  {isSignedIn ? (
                    <div className="flex flex-col gap-4">
                      <p className="text-sm text-muted-foreground">
                        Signed in as <span className="text-foreground">{user?.email}</span>. Your
                        timer and settings sync across your devices in real time.
                      </p>
                      <Button variant="outline" onClick={signOut} className="gap-2">
                        <LogOut className="h-4 w-4" /> Sign out
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <p className="text-sm text-muted-foreground">
                        Optional — the app works fully without it. Sign in so a session you start on
                        one device keeps running on another, and your settings follow you.
                      </p>

                      <Button onClick={handleGoogle} variant="outline" className="gap-2">
                        Continue with Google
                      </Button>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="h-px flex-1 bg-border" />
                        or
                        <span className="h-px flex-1 bg-border" />
                      </div>

                      {sent ? (
                        <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-3 text-sm text-foreground">
                          <Check className="h-4 w-4 shrink-0 text-primary" />
                          Check your email for a one-tap sign-in link.
                        </div>
                      ) : (
                        <form onSubmit={handleEmail} className="flex flex-col gap-2">
                          <Input
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                          <Button type="submit" disabled={sending} className="gap-2">
                            {sending ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Mail className="h-4 w-4" />
                            )}
                            Email me a sign-in link
                          </Button>
                        </form>
                      )}

                      {error && <p className="text-xs text-destructive">{error}</p>}
                    </div>
                  )}
                </motion.div>
              </div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
