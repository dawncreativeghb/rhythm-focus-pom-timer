import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TimerMode } from '@/hooks/usePomodoro';

export interface DebugState {
  mode: TimerMode;
  isRunning: boolean;
  ytReady: boolean;
  ytPlayerState: string;
  ytLastUrl: string;
}

interface DebugPanelProps {
  state: DebugState;
  onSetMode: (mode: TimerMode) => void;
  onToggleRunning: () => void;
  onSimulateCycle: () => void;
}

/**
 * Tiny dev-only panel for verifying YouTube play/pause/resume behavior
 * across Focus ↔ Break transitions WITHOUT touching the real timer
 * (so the timer UI never blanks while we're poking at things).
 *
 * Mounted only when `?debug=1` is in the URL or `localStorage.debug === '1'`.
 */
export function DebugPanel({ state, onSetMode, onToggleRunning, onSimulateCycle }: DebugPanelProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="fixed bottom-4 left-4 z-40 font-mono text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-border/60 bg-card px-2 py-1 text-foreground shadow"
        aria-expanded={open}
      >
        {open ? '▾ debug' : '▸ debug'}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mt-2 w-[260px] space-y-2 rounded-md border border-border/60 bg-card p-3 text-foreground shadow-lg"
          >
            <div className="space-y-1">
              <Row label="mode" value={state.mode} />
              <Row label="running" value={state.isRunning ? 'yes' : 'no'} />
              <Row label="yt.ready" value={state.ytReady ? 'yes' : 'no'} />
              <Row label="yt.state" value={state.ytPlayerState} />
              <Row label="yt.url" value={state.ytLastUrl || '—'} />
            </div>
            <div className="grid grid-cols-2 gap-1 pt-1">
              <Btn onClick={() => onSetMode('focus')} active={state.mode === 'focus'}>
                Focus
              </Btn>
              <Btn onClick={() => onSetMode('break')} active={state.mode === 'break'}>
                Break
              </Btn>
              <Btn onClick={onToggleRunning}>{state.isRunning ? 'Pause' : 'Play'}</Btn>
              <Btn onClick={onSimulateCycle}>Cycle F→B→F</Btn>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Drives YouTube only — real timer untouched.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate">{value}</span>
    </div>
  );
}

function Btn({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-2 py-1 transition-colors ${
        active
          ? 'border-primary bg-primary/20 text-foreground'
          : 'border-border/60 bg-background hover:bg-muted'
      }`}
    >
      {children}
    </button>
  );
}

export function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).get('debug') === '1') return true;
    if (window.localStorage.getItem('debug') === '1') return true;
  } catch {
    // ignore
  }
  return false;
}
