# App Store listing — Rhythm Focus (DRAFT for review)

Everything App Store Connect will ask for, drafted and ready for your review.
Edit anything in **bold-bracketed** notes. Char limits are Apple's hard limits.

---

## 1. Core text fields

**App Name** (max 30 chars) — 25 used ✅ CONFIRMED
> Rhythm Focus: Music Timer

**Subtitle** (max 30) — 27 used
> Pomodoro cued by your music

**Promotional Text** (max 170 — editable anytime without re-review)
> A Pomodoro timer that uses music as your focus cue. No beeps, no buzz, no fiddling with playlists mid-session. Built for sensitive, overstimulated brains.

**Keywords** (max 100, comma-separated, NO spaces after commas)
> pomodoro,focus,adhd,timer,spotify,study,deep work,neurodivergent,sensitive,productivity,quiet,hsp

*(Tip: don't repeat "focus"/"music" — they're already in the name/subtitle, so they're indexed anyway. Leaves room for other terms.)*

---

## 2. Description (max 4000)

> Rhythm Focus is a Pomodoro timer designed for brains that notice everything — ADHD, autistic, HSP, anxious, or just worn out. It uses music as your focus cue: your playlist starts when you start and pauses on your break, so getting into focus is one tap, not a fiddly setup.
>
> FOUR FOCUS SESSIONS, THEN A LONGER BREAK
> The classic rhythm: four 25-minute focus sessions with 5-minute breaks, then a longer 30-minute break. A calm, counterclockwise ring shows your time draining away, and dots show where you are in the cycle.
>
> MUSIC AS A CUE, NOT AS THERAPY
> Connect Spotify Premium and pick a focus playlist and a break playlist. Rhythm Focus starts your music when you start, pauses it on break, and picks up where you left off. No new "focus sounds" to learn to like — just the music you already love. No Spotify? Add your own audio files instead.
>
> DESIGNED AROUND THE TRANSITIONS
> Sensitive and neurodivergent brains lose the most to task-switching and micro-decisions, not to the work itself. Rhythm Focus swaps your music when you change modes and handles the timing, so you don't have to. A soft, optional break chime — no harsh beeps.
>
> PICKS UP WHERE YOU LEFT OFF, ON ANY DEVICE
> Sign in with email or Google and your timer and settings sync in real time across your devices. Start a session on your laptop and keep watching it on your phone.
>
> SENSORY-GENTLE BY DESIGN
> No streaks-as-shame. No gamified nags. No harsh sounds. Plain language, honest about what it is and isn't. Your data stays yours — Rhythm Focus doesn't track you.
>
> Rhythm Focus works with Spotify Premium today. If you don't connect a service, it still plays the ambient audio you add yourself.

---

## 3. Other required fields

| Field | Value |
|---|---|
| Primary category | Productivity |
| Secondary category | Health & Fitness ✅ CONFIRMED |
| Support URL | https://rhythm-focus-pom-timer.lovable.app/support |
| Marketing URL (optional) | https://rhythm-focus-pom-timer.lovable.app |
| Privacy Policy URL | https://rhythm-focus-pom-timer.lovable.app/privacy |
| Age rating | 4+ (no objectionable content) |
| Copyright | © 2026 Dawn Creative |
| Price | Free to download. One-time **Pro unlock $2.99** = unlimited music. ✅ |

**What's New** (first release):
> First release of Rhythm Focus. Thanks for trying it — feedback welcome via the Support page.

---

## 4. App Privacy answers (Apple's privacy questionnaire)

You'll answer "what data does the app collect." Truthful answers for Rhythm Focus:

- **Contact Info → Email address:** Yes, collected. Used for **App Functionality** (sign-in + sync). Linked to the user's identity. **Not** used for tracking.
- **User Content:** the settings you sync (volume, chosen playlists) are stored to your account for **App Functionality**. Not used for tracking.
- **Identifiers / Usage Data / Location / etc.:** **No.**
- **Tracking:** **No** — the app does not track you across apps or websites.
- Third parties: **Spotify** (only if you connect it) and **Supabase/Lovable Cloud** (the backend that runs sign-in + sync). Note these in the privacy policy.

*(Action: I should double-check the Privacy Policy page text matches these answers before we submit.)*

---

## 5. Screenshots (required — 3 to 10 per device size)

Apple requires screenshots for **iPhone 6.7"** (1290×2796) at minimum; iPad if you support it.
Suggested shots to capture from the app (I can help stage these):

1. The focus timer mid-session (ring draining, "FOCUS", dots) — the hero.
2. A break screen (different color).
3. The Spotify playlist picker in settings.
4. The settings panel (music sources, chime toggle).
5. The sign-in / "sync across devices" screen.
6. *(Optional)* a short caption over each, e.g., "Music as your focus cue."

*(I can't generate real device screenshots here, but I can produce styled marketing frames / help you capture them from your Mac.)*

---

## 6. Monetization — DECIDED

- **Model:** Free app + **one-time $2.99 Pro unlock**. No subscription, no ads.
- **Free tier:** the full timer forever + **music for one round a day** (~150 min
  allowance ≈ 4×25 focus + breaks). After that, music stops but **the timer keeps
  running** (never blocked). Resets at local midnight. A gentle one-time toast
  hands off to Pro.
- **Pro ($2.99 one-time):** unlimited music. Entitlement will live on the user's
  account so it works across devices.
- **Status:** gate logic built & tested (`src/hooks/useMusicQuota.ts`), currently
  **OFF** (`MUSIC_GATE_ENABLED=false`) so nothing is limited pre-launch.
- **Remaining for money to work:** wire the Apple In-App Purchase (StoreKit, in
  the native iOS app) to set the Pro entitlement, then flip the gate on. This is
  the piece that gates the paid launch.

---

## 7. ⚠️ Things to NOT put in the listing (Apple will reject, or they're untrue today)

- ❌ "Apple Watch integration" / "home screen widgets" — **not built yet.** (Lovable's auto-generated project blurb claims these — don't copy that.)
- ❌ "Custom focus and break intervals" — the cycle is fixed 25/5/30 today.
- ❌ "YouTube" in the **iOS** listing — YouTube playback is desktop/web only; it's disabled in the iOS app.
- ❌ "Apple Music," "AI-powered," "scientifically proven," "cure/treat ADHD."
