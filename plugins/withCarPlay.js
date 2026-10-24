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
 * Expo config plugin: minimal CarPlay audio support. Only loaded with EXPO_ENABLE_CARPLAY=true (needs the carplay-audio entitlement).
 * Adds a one-item "éist" list, a JS play bridge (Now Playing can't cold-start audio), and the phone/CarPlay scene delegates.
 */

const CARPLAY_AUDIO_ENTITLEMENT = 'com.apple.developer.carplay-audio';

const CARPLAY_SCENE_DELEGATE_SWIFT = `import AVFoundation
import CarPlay
import MediaPlayer

// Apple forbids Now Playing as the root template, so root on a one-item list and push Now Playing over it.
// Playback starts through EistCarPlayBridge, because Now Playing can't cold-start audio.
@objc(CarPlaySceneDelegate)
class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
  var interfaceController: CPInterfaceController?
  // sceneDidBecomeActive can fire before the root is set, so it checks this first.
  private var rootTemplateSet = false

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController
  ) {
    self.interfaceController = interfaceController
    interfaceController.setRootTemplate(makeRootTemplate(), animated: false) { [weak self] _, _ in
      guard let self = self else { return }
      self.rootTemplateSet = true
      // Start playback and push Now Playing as soon as the root exists. The list stays underneath.
      self.startPlaybackAndShowNowPlaying(animated: false)
    }
  }

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didDisconnectInterfaceController interfaceController: CPInterfaceController
  ) {
    self.interfaceController = nil
    rootTemplateSet = false
  }

  // Fires on every activation, including return from another app. Never starts playback.
  // If another app is playing, pop to the éist list so play goes to éist, not the other app's Now Playing.
  func sceneDidBecomeActive(_ scene: UIScene) {
    guard rootTemplateSet, AVAudioSession.sharedInstance().isOtherAudioPlaying else { return }
    interfaceController?.popToRootTemplate(animated: false, completion: nil)
  }

  private func makeRootTemplate() -> CPListTemplate {
    let item = CPListItem(text: "éist", detailText: "live")
    item.handler = { [weak self] _, completion in
      // Shown when backing out of Now Playing or returning while another app plays. Tap to start.
      self?.startPlaybackAndShowNowPlaying(animated: true)
      completion()
    }
    let section = CPListSection(items: [item])
    return CPListTemplate(title: "éist", sections: [section])
  }

  // Ask JS to play, then push Now Playing.
  private func startPlaybackAndShowNowPlaying(animated: Bool) {
    // Set the flag before posting: the bridge replays it if JS isn't listening yet.
    EistCarPlayBridge.pendingPlay = true
    NotificationCenter.default.post(name: EistCarPlayBridge.playRequested, object: nil)
    // The play path depends on JS timers, which stall on the display link while
    // the phone screen is off. See syncTimersToPhoneScreen.
    EistCarPlayBridge.syncTimersToPhoneScreen()
    showNowPlaying(animated: animated)
  }

  // Push (never root) Now Playing. Its buttons go through MPRemoteCommandCenter to trackPlayerService.js.
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

// Native to JS bridge: forwards CarPlay play requests to TrackPlayerContext. Only exists in CarPlay builds.
const EIST_CARPLAY_BRIDGE_SWIFT = `import Foundation
import React
import UIKit

@objc(EistCarPlayBridge)
class EistCarPlayBridge: RCTEventEmitter {
  // Posted by CarPlaySceneDelegate when playback should start.
  static let playRequested = Notification.Name("EistCarPlayPlayRequested")
  // Emitted to JS (listened for in TrackPlayerContext).
  static let playEvent = "EistCarPlayPlay"

  // Play requested before JS subscribed (cold launch). Replayed in startObserving.
  static var pendingPlay = false

  private var hasListeners = false

  override static func requiresMainQueueSetup() -> Bool { false }

  override func supportedEvents() -> [String]! { [EistCarPlayBridge.playEvent] }

  // With CarPlay active and the phone screen off, RCTTiming waits on a display link that never ticks, so JS timers stall.
  // Switch RCTTiming to its NSTimer-based background mode whenever no phone scene is on screen.
  private static weak var timing: NSObject?
  private static var timerSyncInstalled = false

  static func syncTimersToPhoneScreen() {
    // Async so this runs after RCTTiming's own handler for the same notification.
    DispatchQueue.main.async {
      guard let timing = EistCarPlayBridge.timing else {
        // Log loudly: a React Native upgrade may rename or remove the Timing module.
        NSLog("[EistCarPlay] RCTTiming module not found, JS timers will stall with the phone screen off")
        return
      }
      let phoneOnScreen = UIApplication.shared.connectedScenes.contains { scene in
        scene is UIWindowScene &&
          (scene.activationState == .foregroundActive || scene.activationState == .foregroundInactive)
      }
      let selector = NSSelectorFromString(phoneOnScreen ? "appDidMoveToForeground" : "appDidMoveToBackground")
      if timing.responds(to: selector) {
        _ = timing.perform(selector)
      } else {
        NSLog("[EistCarPlay] RCTTiming no longer responds to %@, JS timers will stall with the phone screen off", NSStringFromSelector(selector))
      }
    }
  }

  private func installTimerSync() {
    if let timing = bridge?.module(forName: "Timing", lazilyLoadIfNecessary: true) as? NSObject {
      EistCarPlayBridge.timing = timing
    }
    if !EistCarPlayBridge.timerSyncInstalled {
      EistCarPlayBridge.timerSyncInstalled = true
      let names: [Notification.Name] = [
        UIApplication.didBecomeActiveNotification,
        UIApplication.willEnterForegroundNotification,
        UIScene.didActivateNotification,
        UIScene.willDeactivateNotification,
        UIScene.didEnterBackgroundNotification,
      ]
      for name in names {
        NotificationCenter.default.addObserver(forName: name, object: nil, queue: nil) { _ in
          EistCarPlayBridge.syncTimersToPhoneScreen()
        }
      }
    }
    EistCarPlayBridge.syncTimersToPhoneScreen()
  }

  // RCTEventEmitter calls these when JS adds/removes its first/last listener.
  override func startObserving() {
    hasListeners = true
    installTimerSync()
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

// Phone UI scene. With scenes on, the window must come from the UIWindowScene, reusing the AppDelegate's RN root view.
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

    // Declare both scene roles: phone window and CarPlay.
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

/** Patch the generated AppDelegate to expose the RN root view instead of creating a window. Fails loudly on a code shape mismatch. */
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