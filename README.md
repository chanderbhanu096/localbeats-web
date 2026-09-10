# LocalBeats (web)

The PWA build. A separate native SwiftUI version lives in the private
`LocalBeats` repo — it has real background audio and playlists, but needs Xcode
and weekly re-signing. This one installs from Safari with no toolchain at all.

Offline music player for one iPhone. Your files live in IndexedDB on the phone —
nothing uploads, nothing streams, no account, no backend.

```bash
npm run dev     # local
npm test        # data layer checks
npm run build   # static export to out/
```

Deployment is automatic: push to `main` and GitHub Actions builds and publishes to
GitHub Pages. HTTPS is not optional — iOS refuses to install a PWA or register a
service worker without it.

Pages serves this repo under `/localbeats-web/`, so the build needs `PAGES_BASE_PATH`
(the workflow sets it from the repo name). Every other path in the app is relative
and inherits it. To build the subpath version locally:

```bash
PAGES_BASE_PATH=/localbeats-web npm run build
```

## Getting it on the phone

Open the deployed URL in Safari → Share → **Add to Home Screen** → launch it from
there. It must be launched from the Home Screen icon: standalone mode is what
gives you the full-screen UI and keeps the app out of Safari's tab lifecycle.

Then **Import** and pick your audio files from the Files app. Tags (title, artist,
album, artwork) are read on import; files with unreadable tags fall back to their
filename. Re-importing the same files is a no-op.

## Device checklist

Things no test can cover — verify these on the phone:

1. Launches from the Home Screen with no Safari chrome.
2. Import ~10 tracks, force-quit, reopen — library still there.
3. Play, lock the screen — audio continues, artwork and title on the lock screen.
4. Airplane mode — everything still plays. This is the point of the app.
5. Pause 60s while locked, then resume from the lock screen. **Known-broken on
   iOS.** How bad this is for you is what decides whether Capacitor is worth it.

## Known iOS ceilings

These are platform limits, not bugs to fix here:

- **Background audio is unreliable.** Playback continues while playing, but
  resuming from the lock screen after a long pause often needs the app
  foregrounded. Only a native wrapper fixes this.
- **No haptics.** iOS Safari has no Vibration API.
- **No background GPS**, no step counts, no HealthKit.
- **Storage can be evicted** if the app goes unused for long enough. The app calls
  `navigator.storage.persist()` on launch to ask for an exemption, and warns in
  the library footer if iOS refused.

## The event log

Every track start appends `{type:'play', trackId, at, lat?, lng?}` to the `events`
store in IndexedDB. LocalBeats never reads it back.

It exists because "Memory Radio" (a map of what you played where) and "Life RPG"
(XP aggregated from real activity) are queries over this table, not separate apps.
The log has to start filling now for either to be worth building later.

Location is off by default and opt-in via the toggle in the library footer —
a geolocation prompt fired on someone's first play gets denied, and that denial
sticks.

## If this ever goes native

The web code moves into Capacitor unchanged; only the shell is replaced. Costs:
`sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` (this machine
still points at CommandLineTools), plus either an Xcode rebuild every 7 days or
$99/yr for the Apple Developer Program to get 1-year provisioning profiles.
