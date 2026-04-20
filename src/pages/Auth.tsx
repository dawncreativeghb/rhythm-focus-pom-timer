import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const emailSchema = z.string().trim().email({ message: 'Invalid email' }).max(255);
const passwordSchema = z
  .string()
  .min(6, { message: 'Password must be at least 6 characters' })
  .max(72);

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true });
  }, [user, loading, navigate]);

  const validate = () => {
    const e = emailSchema.safeParse(email);
    if (!e.success) {
      toast.error(e.error.issues[0].message);
      return false;
    }
    const p = passwordSchema.safeParse(password);
    if (!p.success) {
      toast.error(p.error.issues[0].message);
      return false;
    }
    return true;
  };

  const handleSignIn = async () => {
    if (!validate()) return;
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) toast.error(error.message);
  };

  const handleSignUp = async () => {
    if (!validate()) return;
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Check your email to confirm your account.');
    }
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error('Google sign-in failed');
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center gradient-focus px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl"
      >
        <h1 className="mb-1 text-center text-2xl font-semibold text-card-foreground">
          Sync your timer
        </h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Sign in to keep your timer in sync across devices.
        </p>

        <Button
          variant="outline"
          className="mb-4 w-full"
          onClick={handleGoogle}
          type="button"
        >
          Continue with Google
        </Button>

        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Tabs defaultValue="signin">
          <TabsList className="mb-4 grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="space-y-3">
            <div>
              <Label htmlFor="email-in">Email</Label>
              <Input
                id="email-in"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="pw-in">Password</Label>
              <Input
                id="pw-in"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleSignIn}
              disabled={submitting}
              type="button"
            >
              Sign in
            </Button>
          </TabsContent>

          <TabsContent value="signup" className="space-y-3">
            <div>
              <Label htmlFor="email-up">Email</Label>
              <Input
                id="email-up"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="pw-up">Password</Label>
              <Input
                id="pw-up"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleSignUp}
              disabled={submitting}
              type="button"
            >
              Create account
            </Button>
          </TabsContent>
        </Tabs>

        <button
          onClick={() => navigate('/')}
          className="mt-6 block w-full text-center text-xs text-muted-foreground hover:underline"
        >
          Continue without signing in
        </button>
      </motion.div>
    </main>
  );
}
