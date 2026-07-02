# Rhythm Focus — Desktop widget

A small, always-on-top desktop window that runs Rhythm Focus on your desktop —
no browser to resize, full controls, and it stays current because it loads the
live web app. Sign in inside the window to sync with your phone and other
devices. Works on macOS, Windows, and Linux (one codebase).

## Run it (on your own machine)

Requires Node.js (already used by the main app).

```sh
cd desktop
npm install      # first time only — downloads Electron
npm start        # opens the always-on-top Rhythm Focus window
```

Drag it by its title bar to park it anywhere; it floats above your other
windows. Close it like any window.

## Build installers to share / keep

```sh
cd desktop
npm run build:mac    # → .dmg (run this on a Mac)
npm run build:win    # → .exe installer (run this on Windows)
```

Output lands in `desktop/dist/`. Building the Mac app must be done on a Mac;
the Windows installer must be built on Windows (or via a cloud CI runner).

## Notes / next steps

- **Loads the live site** (`https://rhythm-focus-pom-timer.lovable.app`), so it
  updates automatically whenever we publish. No rebuild needed for app changes.
- **Smooth install (later):** to avoid the "unidentified developer" warning,
  the apps should be code-signed — Apple notarization for the `.dmg`, an
  Authenticode certificate for Windows. Optional while testing.
- **Sleeker frameless look (later):** v1 uses a normal title bar so it's easy to
  move and close. A frameless "sticky-note" look needs the app bundled locally
  (rather than loading the remote site) so we can add a custom drag strip.
- **App icon (later):** add `build/icon.png` (1024×1024, opaque) and
  electron-builder will use it; v1 uses the default Electron icon.
