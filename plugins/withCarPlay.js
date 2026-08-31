const {
  withEntitlementsPlist,
  withInfoPlist,
  withAppDelegate,
  withDangerousMod,
  withXcodeProject,
  IOSConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin: minimal Apple CarPlay support for an audio app.
 *
 * NOT loaded by default. Only added when EXPO_ENABLE_CARPLAY=true (see
 * app.config.ts), since the `com.apple.developer.carplay-audio` entitlement
 * must be approved by Apple and present in the EAS provisioning profile.
 *
 * What this does: shows a single "éist" item in CarPlay and roots there;
 * opening éist in the car (or tapping the item) starts the live stream and
 * pushes the system Now Playing screen (CPNowPlayingTemplate).
 *
 * Why a JS bridge is required: CPNowPlayingTemplate's transport button can only
 * control the app that is ALREADY the active now-playing app. It cannot
 * cold-start audio, so on first open (or on re-entry after another audio app
 * took the now-playing role) the button is inert and nothing reaches JS. Since
 * playback lives in react-native-track-player on the JS side, the CarPlay scene
 * posts a NotificationCenter event that the EistCarPlayBridge RCTEventEmitter
 * forwards to JS (TrackPlayerContext), which calls play(). ensurePlayerSetup
 * makes that play() path initialise the player even on a cold CarPlay launch.
 *
 * Why the phone scene delegate exists: enabling CarPlay makes the app a
 * multi-scene (UIScene) app, and once that's on, UIKit stops using the
 * AppDelegate's hand-made `self.window` — every window must come from a
 * UIWindowScene. So the phone UI needs its own scene delegate too, or you
 * get an orphaned window / black screen on launch. This is required
 * plumbing, not something we can simplify away.
 *
 * `ios/` is gitignored / prebuild-generated, so all of this lives in the
 * plugin — hand-editing ios/ would be wiped on the next prebuild/EAS build.
 */

const CARPLAY_AUDIO_ENTITLEMENT = 'com.apple.developer.carplay-audio';

const CARPLAY_SCENE_DELEGATE_SWIFT = `import CarPlay
import MediaPlayer

// Apple does not allow CPNowPlayingTemplate as an audio app's ROOT template —
// it can only be pushed on top of a browsable root. So we root on a single
// "éist" list item and push Now Playing once playback starts. Now Playing
// mirrors MPNowPlayingInfoCenter (set by react-native-track-player); its
// transport button drives MPRemoteCommandCenter, but that only CONTROLS an
// already-active now-playing app and can't cold-start audio — so playback is
// kicked off via EistCarPlayBridge into JS (see startPlaybackAndShowNowPlaying).
@objc(CarPlaySceneDelegate)
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

  private func makeRootTemplate() -> CPListTemplate {
    let item = CPListItem(text: "éist", detailText: "live")
    item.handler = { [weak self] _, completion in
      // Fallback path: the list is normally skipped (see sceneDidBecomeActive),
      // but if the user backs out to it, tapping still starts playback.
      self?.startPlaybackAndShowNowPlaying(animated: true)
      completion()
    }
    let section = CPListSection(items: [item])
    return CPListTemplate(title: "éist", sections: [section])
  }

  // Post the play request to JS (react-native-track-player, via EistCarPlayBridge)
  // then push Now Playing. Kept together because Now Playing's transport controls
  // only go live once éist is the active now-playing app, which only happens
  // after JS actually starts the stream.
  private func startPlaybackAndShowNowPlaying(animated: Bool) {
    // Set the buffer flag FIRST, then post. If the JS runtime isn't ready yet
    // (cold CarPlay launch), the post is dropped but EistCarPlayBridge replays
    // this flag as soon as JS subscribes — so the play request is never lost.
    EistCarPlayBridge.pendingPlay = true
    NotificationCenter.default.post(name: EistCarPlayBridge.playRequested, object: nil)
    showNowPlaying(animated: animated)
  }

  // Push (never root) the system Now Playing screen. Its play/stop button drives
  // MPRemoteCommandCenter, which react-native-track-player handles in
  // trackPlayerService.js — so tapping play here starts the live stream.
  private func showNowPlaying(animated: Bool) {
    let nowPlaying = CPNowPlayingTemplate.shared
    nowPlaying.isUpNextButtonEnabled = false
    nowPlaying.isAlbumArtistButtonEnabled = false
    if interfaceController?.topTemplate !== nowPlaying {
      interfaceController?.pushTemplate(nowPlaying, animated: animated, completion: nil)
    }
  }
}
`;

// Tiny native → JS bridge so the CarPlay scene can start playback. CarPlay's Now
// Playing template cannot cold-start audio (it only controls the already-active
// now-playing app), and playback lives in react-native-track-player on the JS
// side. This RCTEventEmitter forwards a NotificationCenter post (from
// CarPlaySceneDelegate) to JS, where TrackPlayerContext calls play(). newArch is
// off in this app (app.json newArchEnabled:false), so a classic RCTEventEmitter +
// RCT_EXTERN_MODULE registration is the right shape. The module only exists in
// CarPlay builds; JS guards on NativeModules.EistCarPlayBridge being present.
const EIST_CARPLAY_BRIDGE_SWIFT = `import Foundation
import React

@objc(EistCarPlayBridge)
class EistCarPlayBridge: RCTEventEmitter {
  // Posted by CarPlaySceneDelegate when playback should start.
  static let playRequested = Notification.Name("EistCarPlayPlayRequested")
  // Emitted to JS (listened for in TrackPlayerContext).
  static let playEvent = "EistCarPlayPlay"

  // ── Cold-start race buffer ────────────────────────────────────────────────
  // The CarPlay list/Now Playing UI is drawn NATIVELY by CarPlaySceneDelegate, so
  // it appears and accepts a tap before React Native has finished starting and
  // this module has registered its notification observer. A tap in that window
  // would post into the void and be lost — the "dead play button on first open"
  // symptom. So CarPlaySceneDelegate ALSO sets this static flag on tap, and we
  // replay it the moment JS attaches its listener (startObserving). Static
  // because the flag must survive from "scene tapped" until "module instantiated
  // + JS subscribed", which may span the whole RN cold-launch.
  static var pendingPlay = false

  private var hasListeners = false

  override static func requiresMainQueueSetup() -> Bool { false }

  override func supportedEvents() -> [String]! { [EistCarPlayBridge.playEvent] }

  // RCTEventEmitter calls these when JS adds/removes its first/last listener.
  override func startObserving() {
    hasListeners = true
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handlePlayRequested),
      name: EistCarPlayBridge.playRequested,
      object: nil)
    // Deliver a tap that landed before JS was ready to hear it.
    if EistCarPlayBridge.pendingPlay {
      EistCarPlayBridge.pendingPlay = false
      sendEvent(withName: EistCarPlayBridge.playEvent, body: nil)
    }
  }

  override func stopObserving() {
    hasListeners = false
    NotificationCenter.default.removeObserver(self)
  }

  @objc private func handlePlayRequested() {
    // JS is subscribed, so consume the buffered intent and forward immediately.
    EistCarPlayBridge.pendingPlay = false
    sendEvent(withName: EistCarPlayBridge.playEvent, body: nil)
  }
}
`;

// ObjC registration is required for a Swift RCTEventEmitter to be exported to the
// JS module registry under the old architecture.
const EIST_CARPLAY_BRIDGE_OBJC = `#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(EistCarPlayBridge, RCTEventEmitter)
@end
`;

// Hosts the normal phone UI. CarPlay forces the scene lifecycle, so the phone
// window must be created here (from its UIWindowScene) rather than in the
// AppDelegate. Reuses the RN root view the AppDelegate built at launch.
const PHONE_SCENE_DELEGATE_SWIFT = `import UIKit

@objc(PhoneSceneDelegate)
class PhoneSceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }

    let window = UIWindow(windowScene: windowScene)
    // Brand purple so a moment without the RN view mounted reads as the éist
    // background, not a bare black screen.
    window.backgroundColor = UIColor(red: 71.0 / 255.0, green: 51.0 / 255.0, blue: 255.0 / 255.0, alpha: 1.0)

    let rootViewController = UIViewController()
    rootViewController.view.backgroundColor = window.backgroundColor

    if let appDelegate = UIApplication.shared.delegate as? AppDelegate {
      var rootView = appDelegate.reactRootView
      if rootView == nil {
        rootView = appDelegate.reactNativeFactory?.rootViewFactory.view(
          withModuleName: "main",
          initialProperties: nil,
          launchOptions: nil
        )
        appDelegate.reactRootView = rootView
      }
      if let rootView = rootView {
        rootViewController.view = rootView
      }
    }

    window.rootViewController = rootViewController
    self.window = window
    window.makeKeyAndVisible()
  }
}
`;

function withCarPlayEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    config.modResults[CARPLAY_AUDIO_ENTITLEMENT] = true;
    return config;
  });
}

function withCarPlaySceneManifest(config) {
  return withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;
    const existing = infoPlist.UIApplicationSceneManifest || {};

    // Declare both scene roles: the phone window role keeps the normal app UI
    // alive once multiple scenes are enabled, and the CarPlay role adds the
    // car screen. $(PRODUCT_MODULE_NAME) is expanded by Xcode at build time.
    infoPlist.UIApplicationSceneManifest = {
      ...existing,
      UIApplicationSupportsMultipleScenes: true,
      UISceneConfigurations: {
        ...(existing.UISceneConfigurations || {}),
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Phone',
            UISceneClassName: 'UIWindowScene',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).PhoneSceneDelegate',
          },
        ],
        CPTemplateApplicationSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'CarPlay',
            UISceneClassName: 'CPTemplateApplicationScene',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).CarPlaySceneDelegate',
          },
        ],
      },
    };

    return config;
  });
}

/**
 * Patch the (generated) AppDelegate so it no longer creates its own UIWindow
 * and instead exposes the RN root view for PhoneSceneDelegate to display.
 * Fails loudly if the expected code shape isn't found.
 */
function withCarPlayAppDelegate(config) {
  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      throw new Error(
        '[withCarPlay] Expected a Swift AppDelegate; found ' +
          config.modResults.language
      );
    }

    let contents = config.modResults.contents;

    // Idempotency: skip if already patched.
    if (contents.includes('var reactRootView: UIView?')) {
      return config;
    }

    if (!/var window: UIWindow\?/.test(contents)) {
      throw new Error(
        "[withCarPlay] Could not find `var window: UIWindow?` in AppDelegate — " +
          'the generated AppDelegate shape changed; update plugins/withCarPlay.js.'
      );
    }
    contents = contents.replace(
      /var window: UIWindow\?/,
      'var window: UIWindow?\n  // Built in didFinishLaunching; attached to the phone window by\n  // PhoneSceneDelegate (CarPlay forces the scene lifecycle). See withCarPlay.js.\n  var reactRootView: UIView?'
    );

    const windowBootRegex =
      /window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*\n\s*factory\.startReactNative\(\s*withModuleName:\s*"main",\s*in:\s*window,\s*launchOptions:\s*launchOptions\)/;

    if (!windowBootRegex.test(contents)) {
      throw new Error(
        '[withCarPlay] Could not find the AppDelegate window/startReactNative ' +
          'block to convert to scene-based launch; the generated AppDelegate ' +
          'shape changed. Update the regex in plugins/withCarPlay.js.'
      );
    }
    contents = contents.replace(
      windowBootRegex,
      '// CarPlay scene support (plugins/withCarPlay.js): build the RN root view\n' +
        '    // here and let PhoneSceneDelegate attach it to the phone UIWindowScene.\n' +
        '    // The app delegate must NOT create a UIWindow under the scene lifecycle.\n' +
        '    reactRootView = factory.rootViewFactory.view(\n' +
        '      withModuleName: "main",\n' +
        '      initialProperties: nil,\n' +
        '      launchOptions: launchOptions)'
    );

    config.modResults.contents = contents;
    return config;
  });
}

function withCarPlaySceneDelegateFiles(config) {
  const files = [
    { name: 'CarPlaySceneDelegate.swift', source: CARPLAY_SCENE_DELEGATE_SWIFT },
    { name: 'PhoneSceneDelegate.swift', source: PHONE_SCENE_DELEGATE_SWIFT },
    { name: 'EistCarPlayBridge.swift', source: EIST_CARPLAY_BRIDGE_SWIFT },
    { name: 'EistCarPlayBridge.m', source: EIST_CARPLAY_BRIDGE_OBJC },
  ];

  config = withDangerousMod(config, [
    'ios',
    (config) => {
      const projectName = config.modRequest.projectName;
      const iosSourceDir = path.join(
        config.modRequest.platformProjectRoot,
        projectName
      );
      if (!fs.existsSync(iosSourceDir)) {
        fs.mkdirSync(iosSourceDir, { recursive: true });
      }
      for (const file of files) {
        fs.writeFileSync(path.join(iosSourceDir, file.name), file.source);
      }
      return config;
    },
  ]);

  config = withXcodeProject(config, (config) => {
    const projectName = config.modRequest.projectName;
    for (const file of files) {
      const filepath = `${projectName}/${file.name}`;
      if (!config.modResults.hasFile(filepath)) {
        IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
          filepath,
          groupName: projectName,
          project: config.modResults,
        });
      }
    }
    return config;
  });

  return config;
}

function withCarPlay(config) {
  config = withCarPlayEntitlement(config);
  config = withCarPlaySceneManifest(config);
  config = withCarPlayAppDelegate(config);
  config = withCarPlaySceneDelegateFiles(config);
  return config;
}

module.exports = withCarPlay;