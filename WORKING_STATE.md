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

- **2026-04-29** — Built-in break chime (no upload) ✅
  - Fix: Web Audio synthesized two-tone bell in
    `src/hooks/useAudioPlayer.ts`; on/off switch in
    `src/components/AudioSettingsModal.tsx`.

- **2026-04-29** — Full end-to-end browser test passed ✅
  - User confirmed in desktop browser: Spotify playback, YouTube
    playback, pause-on-break, resume-on-focus, smooth timer ring,
    chime on/off all working together.
  - Treat the current state of `src/pages/Index.tsx`,
    `src/components/YouTubePlayer.tsx`, `src/hooks/useSpotify.ts`,
    `src/hooks/usePomodoro.ts`, `src/components/TimerRing.tsx`, and
    `src/hooks/useAudioPlayer.ts` as a known-good baseline.
  - Next milestone: verify on iOS (Capacitor) before adding features.

---

## Regressed

- **2026-06-11** — Smooth counterclockwise timer ring animation (originally
  confirmed 2026-04-29) ❌→🔧
  - User reported the ring draining clockwise (gap opening to the right of
    12 o'clock) instead of counterclockwise.
  - Suspected cause: a `scale(1, -1) translate(...)` mirror in the
    `TimerRing` transform flipped the drain direction.
  - Fixed same day: removed the `scale(1, -1) translate(...)` mirror from the
    `TimerRing` transform (it was flipping the drain direction); transform is
    now just `rotate(-90 ...)`. Also replaced the `motion.circle` with a plain
    `<circle>` using a CSS `stroke-dasharray 1s linear` transition — an
    interim `pathLength` attempt threw a render error and crashed TimerRing
    (no error boundary around it), which reset the timer. Plain circle + CSS
    is crash-proof.
  - Verified by automated test: dash length steadily decreased while the
    timer counted 25:00→24:55 with no remount/crash; freeze-frame screenshot
    confirmed the gap opens counter-clockwise (upper-left). Awaiting Amanda's
    visual re-confirmation before moving back to Confirmed.

---

## How to use this file (for the AI agent)

1. Before editing any file listed under a confirmed feature, read this log.
2. If the planned change could affect a confirmed feature, tell the user
   *before* making the change and offer a safer alternative.
3. After the user confirms a new feature works, append an entry here in the
   same session.
4. If a confirmed feature regresses, move its entry to a `## Regressed`
   section with the date and suspected cause, instead of deleting it.
