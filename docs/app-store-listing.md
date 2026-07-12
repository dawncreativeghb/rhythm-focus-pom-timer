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

## 2. Description (max 4000) ✅ APPROVED

Rhythm Focus is a Pomodoro timer for brains that notice everything — ADHD, autistic, HSP, anxious, or just worn out. It uses music as your cue: your playlist starts when you start and pauses on your break. You don't have to watch a timer or touch anything — the music tells you where you are.

HOW IT WORKS
• Four 25-minute focus sessions, with short breaks between and one longer break at the end
• A calm ring counts down; dots show where you are in the round
• Your music starts, pauses, and resumes on its own as you move through it

THE MUSIC
• Connect Spotify Premium and pick your focus playlist — add break music too, or leave breaks quiet
• No Spotify? Play your own audio files
• A soft, optional chime marks the start of a break — no harsh beeps

WHY IT'S DIFFERENT
• Designed around the transitions — it handles the mode-switching and timing so you don't have to
• Picks up where you left off, on any device — sign in and your timer + settings sync in real time; start on your laptop, keep going on your phone
• No extra gadget — no egg timer to hear, dust, or knock off your desk. Just the devices and playlists you already have
• No streaks, no nags, no shame, no tracking — plain and honest

*(Note: YouTube is a web/desktop feature only — kept out of the App Store text since it's disabled on iOS. Use it in website/marketing copy.)*

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
