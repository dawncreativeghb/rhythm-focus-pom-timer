// Lightweight synthesized chimes using the Web Audio API.
// Zero bundle weight, royalty-free by definition, and distinct from each other.
// Three cues:
//   - playStartChime  : warm two-tone bell (break begins)
//   - playWarningChime: single soft mid tone (1 minute remaining)
//   - playEndChime    : bright ascending three-tone (break over / focus resumes)

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (sharedCtx && sharedCtx.state !== 'closed') return sharedCtx;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedCtx = new Ctor();
    return sharedCtx;
  } catch {
    return null;
  }
}

interface ToneOptions {
  freq: number;
  startAt: number; // seconds offset from "now"
  duration: number; // seconds
  volume: number; // 0..1 multiplier
  type?: OscillatorType;
}

function playTone(ctx: AudioContext, masterVolume: number, opts: ToneOptions) {
  const t0 = ctx.currentTime + opts.startAt;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.freq, t0);

  const peak = Math.max(0, Math.min(1, opts.volume * masterVolume));
  // Quick attack, smooth exponential decay (bell-like)
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);

  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + opts.duration + 0.05);
}

async function ensureRunning(ctx: AudioContext) {
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
}

export async function playStartChime(volume = 0.7) {
  const ctx = getCtx();
  if (!ctx) return;
  await ensureRunning(ctx);
  // Soft two-tone bell: E5 → A5
  playTone(ctx, volume, { freq: 659.25, startAt: 0, duration: 1.0, volume: 0.45 });
  playTone(ctx, volume, { freq: 880.0, startAt: 0.18, duration: 1.2, volume: 0.4 });
}

export async function playWarningChime(volume = 0.7) {
  const ctx = getCtx();
  if (!ctx) return;
  await ensureRunning(ctx);
  // Single gentle mid tone (G5) — short, attention without alarm
  playTone(ctx, volume, { freq: 783.99, startAt: 0, duration: 0.55, volume: 0.4 });
  playTone(ctx, volume, { freq: 783.99, startAt: 0.28, duration: 0.55, volume: 0.32 });
}

export async function playEndChime(volume = 0.7) {
  const ctx = getCtx();
  if (!ctx) return;
  await ensureRunning(ctx);
  // Bright ascending three-tone: C5 → E5 → G5 (resolves up — "back to work")
  playTone(ctx, volume, { freq: 523.25, startAt: 0.0, duration: 0.5, volume: 0.4 });
  playTone(ctx, volume, { freq: 659.25, startAt: 0.16, duration: 0.5, volume: 0.4 });
  playTone(ctx, volume, { freq: 783.99, startAt: 0.32, duration: 0.9, volume: 0.45 });
}
