# Always-visible countdown — surfaces roadmap

The product principle is "don't make me touch my phone to focus." A countdown
you can *glance* at — without opening the app — serves that directly. This doc
tracks where that glanceable countdown lives today and what each future
(native) surface would take.

## Built today

| Surface | What it is | Status |
|---|---|---|
| Browser floating window | Document Picture-in-Picture: ring + time + play/pause floats on top of all windows. Chromium desktop only. | ✅ Shipped |
| Browser extension badge | Live minutes-remaining painted on the toolbar icon (e.g. "24"), teal for focus / amber for break, cleared when paused. | ✅ Shipped (extension v1.1.0, `extension/background.js`) |

## Future (native) surfaces — notes

These are **separate native builds**, not changes to the web app. They are the
brief's post-launch priorities. All of them depend on the same two
prerequisites, so do those first:

- **Prerequisite A — sign-in + cross-device sync.** A widget on a phone/watch
  needs to know the current timer state from a shared source of truth. Today
  state is local-only. Need the planned Google/email sign-in + Supabase (Lovable
  Cloud) sync so a session started on one device shows on another.
- **Prerequisite B — Apple Developer Program** ($99/yr) for any iOS/watchOS/Mac
  shipping, plus the existing Capacitor iOS app as the host.

### 1. iPhone home-screen widget  (post-launch priority)
- **What:** a Home Screen / Lock Screen widget showing the ring + minutes left.
- **Tech:** native **WidgetKit** + SwiftUI extension added to the Capacitor iOS
  app. Widgets can't run a live ticking timer continuously; use WidgetKit's
  `Text(timerInterval:)` / `TimelineProvider` so iOS renders the countdown
  itself from a known end-time. The app writes the end-time to a shared App
  Group container; the widget reads it.
- **Depends on:** Prereqs A + B.
- **Effort:** medium native build (Swift). No equivalent in the web codebase.

### 2. Apple Watch app + complication + haptics  (brief's #1 post-launch)
- **What:** glance at the wrist; a complication on the watch face with minutes
  left; **haptic buzz** at focus-end / break-end (the no-touch payoff).
- **Tech:** watchOS app target + WidgetKit complication. Haptics via
  `WKInterfaceDevice.play(_:)`. Same shared end-time approach as the phone
  widget. Background refresh budget on watchOS is limited — lean on
  system-rendered timer text + scheduled haptics rather than live ticking.
- **Depends on:** Prereqs A + B, ideally the iPhone app first (Watch app is
  paired to it).
- **Effort:** the largest native lift; highest user value for the no-touch promise.

### 3. Android home-screen widget
- **What:** Android home-screen widget with the countdown.
- **Tech:** there is no Android app yet (web + iOS today). Would need an Android
  Capacitor target, then a native **App Widget** (RemoteViews / Glance) reading
  shared state.
- **Depends on:** Android port first (brief's lowest post-launch priority), + Prereq A.
- **Effort:** large (Android port is the gating work, not the widget itself).

### 4. Mac desktop widget
- **What:** a true macOS desktop / Notification Center widget (distinct from the
  browser floating window, which already covers "glance while working in a
  browser").
- **Tech:** native macOS app (Catalyst or SwiftUI) + WidgetKit. The browser
  floating window already delivers ~90% of this for desktop users, so this is
  low priority unless a standalone Mac app is wanted.
- **Depends on:** Prereqs A + B; a Mac app target.
- **Effort:** medium; lowest marginal value given the float exists.

## Suggested sequence
1. Sign-in + sync (Prereq A) — unlocks every native widget and is a launch item anyway.
2. App Store launch of the iOS app (Prereq B in place).
3. Apple Watch (complication + haptics) — highest no-touch value.
4. iPhone home-screen widget.
5. Android port → Android widget.
6. Mac desktop widget (only if a standalone Mac app is wanted).
