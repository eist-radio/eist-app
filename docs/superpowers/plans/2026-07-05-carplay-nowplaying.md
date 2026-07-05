# CarPlay Scene-Activation Auto-Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the éist CarPlay app land on Now Playing and start the stream every time it is opened on the car screen — including after switching to another radio app — instead of showing a list with a dead play button.

**Architecture:** The trigger for "start playback + push Now Playing" moves from `templateApplicationScene(_:didConnect:)` (fires once per scene connection) to `sceneDidBecomeActive(_:)` (fires on every foreground activation). A small flag pair handles the cold-start ordering where activation can fire before the root template is set. On the JS side, the `EistCarPlayPlay` listener gains an already-playing guard so re-entering éist doesn't restart a healthy stream.

**Tech Stack:** Expo config plugin (`plugins/withCarPlay.js`, Swift source embedded as a JS template string), React Native (`context/TrackPlayerContext.tsx`).

**Spec:** `docs/superpowers/specs/2026-07-05-carplay-nowplaying-design.md`

## Global Constraints

- Apple forbids `CPNowPlayingTemplate` as a root template — the one-item `CPListTemplate` root MUST remain; Now Playing is only ever *pushed*.
- `ios/` is gitignored and prebuild-generated. All native changes go in `plugins/withCarPlay.js`. Never edit `ios/` by hand.
- The Swift source lives inside a JS template literal (`CARPLAY_SCENE_DELEGATE_SWIFT`). Any `$` used in Swift string interpolation must be escaped as `\$` — plain `${...}` would be evaluated by JS.
- No test framework exists in this repo (no jest). Verification = `EXPO_ENABLE_CARPLAY=true npx expo prebuild -p ios --no-install` + inspecting the generated Swift, plus `npx tsc --noEmit` and `npm run lint`. Do NOT add a test framework.
- Working branch: `fixcar`. Commit after each task.

---

### Task 1: Move the CarPlay auto-play trigger to scene activation

**Files:**
- Modify: `plugins/withCarPlay.js` (the `CARPLAY_SCENE_DELEGATE_SWIFT` template string, currently lines ~54–133)

**Interfaces:**
- Consumes: `EistCarPlayBridge.pendingPlay` / `EistCarPlayBridge.playRequested` (unchanged, defined in the same file); `startPlaybackAndShowNowPlaying(animated:)` and `showNowPlaying(animated:)` (existing private methods, unchanged).
- Produces: `CarPlaySceneDelegate.sceneDidBecomeActive(_:)` — the sole auto-play trigger. JS behavior contract unchanged: an `EistCarPlayPlay` event may now arrive on every scene activation, not just once per connection (Task 2 handles that).

- [ ] **Step 1: Replace the `didConnect`/`didDisconnect` block of the Swift class**

In `plugins/withCarPlay.js`, inside `CARPLAY_SCENE_DELEGATE_SWIFT`, replace this exact section:

```swift
class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
  var interfaceController: CPInterfaceController?

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController
  ) {
    self.interfaceController = interfaceController
    // Apple forbids CPNowPlayingTemplate as a ROOT template, so we still root on a
    // one-item list — but the user never has to see or tap it. As soon as the
    // CarPlay scene connects we start playback and push Now Playing (un-animated),
    // so opening éist in the car lands straight on the transport screen.
    interfaceController.setRootTemplate(makeRootTemplate(), animated: false) { [weak self] _, _ in
      self?.startPlaybackAndShowNowPlaying(animated: false)
    }
  }

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didDisconnectInterfaceController interfaceController: CPInterfaceController
  ) {
    self.interfaceController = nil
  }
```

with:

```swift
class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
  var interfaceController: CPInterfaceController?
  // Cold-start ordering: sceneDidBecomeActive can fire before setRootTemplate's
  // completion runs, and pushing Now Playing without a root in place fails. So
  // activation only auto-plays once the root is set, and an early activation is
  // parked in pendingAutoPlay for the completion handler to flush.
  private var rootTemplateSet = false
  private var pendingAutoPlay = false

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController
  ) {
    self.interfaceController = interfaceController
    // Apple forbids CPNowPlayingTemplate as a ROOT template, so we root on a
    // one-item list — but the user never has to see or tap it: every scene
    // activation (see sceneDidBecomeActive) starts playback and pushes Now
    // Playing, so opening éist in the car lands straight on the transport screen.
    interfaceController.setRootTemplate(makeRootTemplate(), animated: false) { [weak self] _, _ in
      guard let self = self else { return }
      self.rootTemplateSet = true
      if self.pendingAutoPlay {
        self.pendingAutoPlay = false
        self.startPlaybackAndShowNowPlaying(animated: false)
      }
    }
  }

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didDisconnectInterfaceController interfaceController: CPInterfaceController
  ) {
    self.interfaceController = nil
    rootTemplateSet = false
    pendingAutoPlay = false
  }

  // Fires on EVERY foreground activation of éist on the car screen — cold start,
  // warm start, and returning after another audio app was used. didConnect only
  // fires once per scene connection, so triggering playback there left the app
  // dead on re-entry (list showing, disabled play button): the other app owned
  // the now-playing role and no play request ever reached JS. Auto-playing here
  // reclaims the session every time the user opens éist. The JS side skips the
  // request when the stream is already playing, so glancing at Maps and back
  // does not restart a healthy stream.
  func sceneDidBecomeActive(_ scene: UIScene) {
    if rootTemplateSet {
      startPlaybackAndShowNowPlaying(animated: false)
    } else {
      pendingAutoPlay = true
    }
  }
```

Everything below (`makeRootTemplate`, `startPlaybackAndShowNowPlaying`, `showNowPlaying`) stays exactly as is — the list item tap handler remains the fallback path.

- [ ] **Step 2: Verify the generated Swift compiles-by-inspection via prebuild**

```bash
EXPO_ENABLE_CARPLAY=true npx expo prebuild -p ios --no-install
grep -n "sceneDidBecomeActive" ios/eist/CarPlaySceneDelegate.swift
grep -n "pendingAutoPlay" ios/eist/CarPlaySceneDelegate.swift
```

Expected: both greps match (one `func sceneDidBecomeActive`, several `pendingAutoPlay` lines). If the generated project directory name differs, find it with `ls ios/*/CarPlaySceneDelegate.swift`. Also confirm no stray `undefined` or unescaped-`${}` damage anywhere in the file: `grep -n "undefined" ios/eist/CarPlaySceneDelegate.swift` should output nothing.

- [ ] **Step 3: Verify the plugin file still parses as JS**

```bash
node -e "require('./plugins/withCarPlay.js'); console.log('plugin OK')"
```

Expected: `plugin OK`

- [ ] **Step 4: Commit**

```bash
git add plugins/withCarPlay.js
git commit -m "fix: trigger CarPlay auto-play on every scene activation

didConnect fires once per scene connection, so returning to éist after
using another radio app never re-sent the play request and the transport
button stayed dead. sceneDidBecomeActive fires on every foreground
activation; a rootTemplateSet/pendingAutoPlay flag pair handles the
cold-start ordering where activation precedes root-template completion."
```

---

### Task 2: Already-playing guard on the CarPlay play listener

**Files:**
- Modify: `context/TrackPlayerContext.tsx` (the `EistCarPlayPlay` effect, currently lines ~790–800)

**Interfaces:**
- Consumes: `EistCarPlayPlay` events from `NativeModules.EistCarPlayBridge` (Task 1 makes these fire on every activation); `isPlayingRef` and `play()` already in scope in the component.
- Produces: nothing new — behavior change only (no-op when the stream is already playing).

- [ ] **Step 1: Add the guard**

In `context/TrackPlayerContext.tsx`, replace:

```tsx
    const emitter = new NativeEventEmitter(bridge)
    const sub = emitter.addListener('EistCarPlayPlay', () => {
      play().catch((error) => console.error('CarPlay play request failed:', error))
    })
    return () => sub.remove()
```

with:

```tsx
    const emitter = new NativeEventEmitter(bridge)
    const sub = emitter.addListener('EistCarPlayPlay', () => {
      // Fired on every CarPlay scene activation, not just once per connection.
      // If the stream is already playing (user glanced at Maps and came back),
      // restarting it would glitch the audio — only start when not playing.
      if (isPlayingRef.current) return
      play().catch((error) => console.error('CarPlay play request failed:', error))
    })
    return () => sub.remove()
```

Also update the comment block directly above this effect (the one beginning `// Start playback when the éist item is tapped in CarPlay.`): replace its first sentence with `// Start playback whenever the éist CarPlay scene becomes active (and as a fallback, when the hidden list item is tapped).` — the rest of the comment stays.

- [ ] **Step 2: Typecheck and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: tsc exits silently; lint reports no new errors in `context/TrackPlayerContext.tsx`.

- [ ] **Step 3: Commit**

```bash
git add context/TrackPlayerContext.tsx
git commit -m "fix: skip CarPlay play request when stream already playing

Scene activation now fires a play request every time éist foregrounds on
the car screen; without this guard, returning from another CarPlay app
would tear down and restart a healthy stream."
```

---

### Task 3: End-to-end verification of the working tree

**Files:**
- None created/modified — verification only.

**Interfaces:**
- Consumes: everything from Tasks 1–2.
- Produces: a clean, committed working tree ready for an `EXPO_ENABLE_CARPLAY=true` EAS build.

- [ ] **Step 1: Full re-verification from a clean generated project**

```bash
rm -rf ios
EXPO_ENABLE_CARPLAY=true npx expo prebuild -p ios --no-install
grep -c "startPlaybackAndShowNowPlaying" ios/eist/CarPlaySceneDelegate.swift
npx tsc --noEmit
npm run lint
git status --porcelain
```

Expected: grep count is `4` (declaration + didConnect completion + sceneDidBecomeActive + list-item fallback); tsc and lint pass; `git status` shows no unstaged source changes (`ios/` is gitignored so it may appear untracked — that's fine).

- [ ] **Step 2: Report device-testing checklist to the user**

On-device testing needs a real head unit and an `EXPO_ENABLE_CARPLAY=true eas build -p ios`. Report these manual test cases (from the spec) as the user's acceptance checklist — do NOT claim them verified:

1. Cold start from the CarPlay éist icon → lands on Now Playing, stream starts.
2. Switch to another radio app, play it, switch back to éist → stream resumes, controls live (the reported bug).
3. Re-open éist while already playing → no restart glitch.
4. Phone app never opened, phone locked → still works.
