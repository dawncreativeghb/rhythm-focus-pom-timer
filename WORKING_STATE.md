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

- **2026-06-22** — Counterclockwise timer ring drain ✅
  - (Briefly regressed 2026-06-11: a `scale(1,-1) translate(...)` mirror in
    `TimerRing` flipped the drain clockwise.) Fixed: transform is just
    `rotate(-90 ...)`, rendered as a plain `<circle>` with a CSS
    `stroke-dasharray 1s linear` transition. Do NOT reintroduce a scale/mirror
    transform, and don't use framer-motion `pathLength` here (it threw and
    crashed the un-bounded TimerRing). Amanda visually confirmed.

- **2026-06-22** — Two-step reset + 30-min long break ✅
  - Long break is 30 min (`usePomodoro` `DEFAULT_SETTINGS` + the inline
    settings in `src/pages/Index.tsx`). Reset button is two-step
    (`handleReset` in `Index.tsx`): 1st press rewinds the current focus/break
    (`pomodoro.reset`), 2nd press while already at the interval start restarts
    the whole 4-session cycle (`pomodoro.resetCycle`).

- **2026-06-22** — In-app Spotify playlist picker ✅
  - `fetchPlaylists` in `src/hooks/useSpotify.ts` (needs the
    `playlist-read-private` scope, deployed via Lovable) + `PlaylistPicker` in
    `src/components/AudioSettingsModal.tsx`. Tappable list with cover art;
    "paste a link" remains a fallback (and is required for artists/albums,
    which `/me/playlists` doesn't return). No track-count label (Spotify's
    `tracks.total` came back empty in practice). Connecting needs
    `show_dialog=true` on the authorize URL (in the `spotify-auth` edge
    function) — without it, re-consent after a scope change throws
    `server_error`. Amanda confirmed: connect, pick playlist, playback all work.

- **2026-06-22** — Spotify previous/next track skip buttons ✅
  - `nextTrack`/`previousTrack` (Web Playback SDK) in `useSpotify`, surfaced as
    skip buttons in `src/components/MusicToggle.tsx` (only when Spotify is the
    active, ready source). Amanda confirmed skipping works.

---

## How to use this file (for the AI agent)

1. Before editing any file listed under a confirmed feature, read this log.
2. If the planned change could affect a confirmed feature, tell the user
   *before* making the change and offer a safer alternative.
3. After the user confirms a new feature works, append an entry here in the
   same session.
4. If a confirmed feature regresses, move its entry to a `## Regressed`
   section with the date and suspected cause, instead of deleting it.
