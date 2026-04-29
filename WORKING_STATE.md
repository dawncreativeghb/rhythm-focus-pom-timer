# Working State Log

A running log of features the user has **confirmed working**. Before changing
code that touches any of these areas, re-read this file and flag risk to the
user before proceeding.

Format: `YYYY-MM-DD` — Feature ✅ (where the fix lives) — notes

---

## Confirmed working

- **2026-04-22** — YouTube pause on break + resume after break ✅
  - Fix: "Sticky URL" logic in `src/pages/Index.tsx` (`stickyYoutubeUrlRef`)
    + keep-player-alive strategy in `src/components/YouTubePlayer.tsx`
    (player created once, visibility toggled via CSS, source only swapped
    when URL truly changes).
  - Don't: destroy/remount the YouTube player on mode switch; don't swap
    `url` prop to empty string between focus and break.

- **2026-04-22** — YouTube link plays the requested video (not a random
  playlist item) ✅
  - Fix: `parseYouTubeId` is preferred over `parseYouTubePlaylistId` in
    `src/components/YouTubePlayer.tsx` source-swap effect.

- **2026-04-29** — Smooth counterclockwise timer ring animation ✅
  - Fix: `src/components/TimerRing.tsx` + sub-second progress in
    `src/hooks/usePomodoro.ts`.

- **2026-04-29** — Built-in break chime (no upload) ✅
  - Fix: Web Audio synthesized two-tone bell in
    `src/hooks/useAudioPlayer.ts`; on/off switch in
    `src/components/AudioSettingsModal.tsx`.

---

## How to use this file (for the AI agent)

1. Before editing any file listed under a confirmed feature, read this log.
2. If the planned change could affect a confirmed feature, tell the user
   *before* making the change and offer a safer alternative.
3. After the user confirms a new feature works, append an entry here in the
   same session.
4. If a confirmed feature regresses, move its entry to a `## Regressed`
   section with the date and suspected cause, instead of deleting it.
