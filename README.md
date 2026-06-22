# Rhythm Focus

A Pomodoro timer that uses music as your focus cue — built for sensitive, overstimulated brains (ADHD, autistic, HSP, anxious) who don't want to touch their phone to work.

**Live app:** https://rhythm-focus-pom-timer.lovable.app

## What it does

- **25/5/30 Pomodoro cycle** — four 25-minute focus sessions; 5-minute breaks after the first three, a 30-minute long break after the fourth. Session dots show where you are in the cycle.
- **Counterclockwise drain timer** — the ring empties as time runs out, like a visual hourglass.
- **Music as a cue** — your focus playlist starts when you start and pauses on break. Separate playlists for focus and break, each resuming where it left off.
- **Sources:** Spotify (Premium), YouTube, or local audio files. Works with no music too.
- **Sensory-gentle:** optional soft break chime (can be turned off), no streaks, no gamification, no notification spam.
- **Two-step reset:** one press rewinds the current focus/break; a second press restarts the whole cycle.

## Surfaces

| Surface | Where |
|---|---|
| Web app | this repo (`npm run dev`) |
| Chrome extension | `extension/` — popup timer, also downloadable in-app at `/install-extension` |
| iOS app | Capacitor (`capacitor.config.ts`, app id `com.dawncreative.rhythmfocus`) |

## Development

Requires Node.js and npm.

```sh
npm install     # install dependencies
npm run dev     # dev server at http://localhost:8080
npm run lint    # lint
npx vitest run  # tests
npm run build   # production build to dist/
```

## Project conventions

- **Read `WORKING_STATE.md` before changing timer or playback code.** It logs user-confirmed-working features and the fixes behind them; don't regress them.
- Local-first: full app works offline; Supabase is for sync/auth only. No third-party analytics.
- All animations should respect the system Reduce Motion setting.

## Architecture overview

- `src/hooks/usePomodoro.ts` — timer state machine (modes, sessions, reset/skip)
- `src/components/TimerRing.tsx` — counterclockwise SVG ring animation
- `src/hooks/useSpotify.ts` / `src/components/YouTubePlayer.tsx` — music integrations (see WORKING_STATE.md before touching)
- `src/hooks/useAudioPlayer.ts` — local audio + synthesized break chime
- `src/pages/Index.tsx` — main screen wiring it all together
- `supabase/` — backend config (auth + cross-device sync, in progress)
