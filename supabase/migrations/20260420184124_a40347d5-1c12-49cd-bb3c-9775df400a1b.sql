-- Shared timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =====================
-- timer_state
-- =====================
CREATE TABLE public.timer_state (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'focus',
  is_running BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ,
  remaining_seconds INTEGER NOT NULL DEFAULT 1500,
  sessions_completed INTEGER NOT NULL DEFAULT 0,
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.timer_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own timer_state"
ON public.timer_state FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own timer_state"
ON public.timer_state FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own timer_state"
ON public.timer_state FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own timer_state"
ON public.timer_state FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_timer_state_updated_at
BEFORE UPDATE ON public.timer_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.timer_state REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.timer_state;

-- =====================
-- audio_settings
-- =====================
CREATE TABLE public.audio_settings (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audio_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own audio_settings"
ON public.audio_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own audio_settings"
ON public.audio_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own audio_settings"
ON public.audio_settings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own audio_settings"
ON public.audio_settings FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_audio_settings_updated_at
BEFORE UPDATE ON public.audio_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.audio_settings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audio_settings;