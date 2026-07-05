# CarPlay: land on Now Playing and always play

**Date:** 2026-07-05
**Status:** Approved

## Problem

On a real head unit (build including commit `95eb8ae`), the éist CarPlay app:

1. Shows the single-item list page instead of landing on Now Playing.
2. Tapping the item yields a dead/disabled play button and the stream does not start.
3. Works "kind of" if the phone app was already running before connecting, but
   after switching to another radio app in the car and back, éist is
   non-functional.

### Root cause

The "start playback + push Now Playing" trigger lives in
`templateApplicationScene(_:didConnect:)`, which fires **once** per scene
connection. Re-entering éist on the car screen (e.g. after using another radio
app) does not re-fire it. By then the other app owns the system now-playing
role, so éist's `CPNowPlayingTemplate` transport button is disabled and no play
request ever reaches JS.

### Constraint (Apple)

`CPNowPlayingTemplate` **cannot be a root template** — an audio app must root
on a browsable template (list/grid/tab) and *push* Now Playing. Rooting on Now
Playing was tried previously and reverted (broken controls, rejection risk).
Therefore "no list view" is implemented as: the list remains the technical
root, but the user never sees it because every activation immediately lands on
Now Playing.

## Design

### 1. Scene flow — `CarPlaySceneDelegate` (`plugins/withCarPlay.js`)

- `didConnect` keeps only its mandatory job: set the hidden one-item
  `CPListTemplate` root. It no longer triggers playback.
- Implement `sceneDidBecomeActive(_:)` (UIScene lifecycle; fires on cold start,
  warm start, and every return to éist on the car screen). On each activation:
  1. Post the play request via the existing `EistCarPlayBridge`
     (`pendingPlay` flag first, then NotificationCenter post — the cold-start
     buffer is unchanged).
  2. Ensure `CPNowPlayingTemplate.shared` is the top template (push
     un-animated if not already on top).
- The list item's tap handler remains as a fallback path.

### 2. Playback start path — `context/TrackPlayerContext.tsx`

The `EistCarPlayPlay` listener gains an **already-playing guard**:

- If the stream is currently playing (`isPlayingRef.current`), do nothing —
  prevents tearing down a healthy stream when the user glances at another
  CarPlay app (e.g. Maps) and returns.
- Otherwise run the full fresh-stream `play()` path. This reclaims the
  system now-playing role from whichever app took it, which is what re-enables
  the CarPlay transport button.

### 3. Edge cases

- **Another app mid-playback when éist opens:** auto-play takes over the audio
  session. Chosen behavior: opening éist in the car always means "play éist"
  (like turning on a radio).
- **Play fails (no network):** Now Playing shows stopped state; its play
  button still works because `RemotePlay` → `startFreshStream()` in
  `trackPlayerService.js` is independent of the bridge.
- **Non-CarPlay builds:** unchanged; `NativeModules.EistCarPlayBridge` is
  absent and the JS guard already handles it.

### 4. Testing (real car, `EXPO_ENABLE_CARPLAY=true` build)

1. Cold start from the CarPlay éist icon → lands on Now Playing, stream
   starts, transport controls live.
2. Switch to another radio app, play it, switch back to éist → stream
   resumes, controls live (the reported bug).
3. Re-open éist while it is already playing → no restart glitch.
4. Phone app never opened, phone locked → still works (pendingPlay replay).

## Scope

Two files: `plugins/withCarPlay.js` (Swift embedded in the config plugin) and
`context/TrackPlayerContext.tsx`. No new dependencies. Requires a fresh
`EXPO_ENABLE_CARPLAY=true` prebuild/EAS build to take effect.
