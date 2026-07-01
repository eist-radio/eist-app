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
 * NOT loaded by default. It is only added to the plugin list when
 * `EXPO_ENABLE_CARPLAY=true` (see app.config.ts), because the
 * `com.apple.developer.carplay-audio` entitlement it adds must first be:
 *   1. requested from / approved by Apple for the App ID, and
 *   2. present in the EAS signing (provisioning) profile.
 *
 * ── Why this touches the app window (read before editing) ──────────────────
 * CarPlay is a second UIScene living alongside the phone UI, so enabling it
 * forces the whole app onto the iOS *scene* lifecycle (UIScene, iOS 13+). Once
 * `UIApplicationSupportsMultipleScenes` is true, UIKit stops using the
 * AppDelegate's hand-made `self.window`; every window must belong to a
 * UIWindowScene. The previous version of this plugin declared ONLY the CarPlay
 * scene and left the AppDelegate creating its own window — which orphaned the
 * phone window and produced a BLACK SCREEN that never launched on device.
 *
 * The correct setup (per Apple + react-native-carplay) is a full scene
 * conversion of the phone UI:
 *   - Info.plist declares BOTH scene roles: a phone `UIWindowSceneSessionRole-
 *     Application` (PhoneSceneDelegate) and the CarPlay
 *     `CPTemplateApplicationSceneSessionRoleApplication` (CarPlaySceneDelegate).
 *   - AppDelegate builds the React Native root view but no longer creates a
 *     UIWindow (the scene owns it) — see withCarPlayAppDelegate.
 *   - PhoneSceneDelegate creates the phone UIWindow from its UIWindowScene and
 *     hosts the shared RN root view.
 *   - CarPlaySceneDelegate roots CarPlay on a one-item CPListTemplate ("éist
 *     radio") and pushes the system Now Playing template when it's tapped. Apple
 *     forbids CPNowPlayingTemplate as a root template, so it must be pushed.
 *
 * The Now Playing screen (éist logo artwork + play/stop) is driven entirely by
 * the MPNowPlayingInfoCenter / MPRemoteCommandCenter data that
 * react-native-track-player already sets, so there is no second audio engine
 * and no JS bridge on the CarPlay side.
 *
 * NOTE: `ios/` is gitignored / prebuild-generated, so all of this lives in the
 * plugin — editing ios/ by hand would be wiped on the next prebuild/EAS build.
 */

const CARPLAY_AUDIO_ENTITLEMENT = 'com.apple.developer.carplay-audio';

const CARPLAY_SCENE_DELEGATE_SWIFT = `import CarPlay
import MediaPlayer

// ── Why the root is a CPListTemplate, not CPNowPlayingTemplate ──────────────
// Apple does NOT allow CPNowPlayingTemplate as an audio app's ROOT template. Per
// the CarPlay docs/forums it may only be *pushed* on top of a browsable root
// (list/tab/grid), or is auto-pushed by the system once playback starts. The
// previous version set CPNowPlayingTemplate.shared as the root, which is why the
// car screen "didn't work well": metadata painted (it mirrors MPNowPlayingInfo-
// Center, shared with the lock screen) but the template sat in an unsupported
// position with flaky controls and no browse UI.
//
// So we root on a single-item CPListTemplate (mirroring the one "éist radio" item
// Android Auto exposes) and *push* the shared Now Playing template when the item
// is tapped. Artwork + play/stop still come entirely from the MPNowPlayingInfo-
// Center / MPRemoteCommandCenter data react-native-track-player already sets, so
// there's still no second audio engine and no JS bridge on the CarPlay side.
@objc(CarPlaySceneDelegate)
class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
  var interfaceController: CPInterfaceController?

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController
  ) {
    self.interfaceController = interfaceController
    interfaceController.setRootTemplate(makeRootTemplate(), animated: true, completion: nil)
  }

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didDisconnectInterfaceController interfaceController: CPInterfaceController
  ) {
    self.interfaceController = nil
  }

  private func makeRootTemplate() -> CPListTemplate {
    let item = CPListItem(text: "éist", detailText: "live")
    item.handler = { [weak self] _, completion in
      self?.showNowPlaying()
      completion()
    }
    let section = CPListSection(items: [item])
    return CPListTemplate(title: "éist", sections: [section])
  }

  // Push (never root) the system Now Playing screen. Its play/stop button drives
  // MPRemoteCommandCenter, which react-native-track-player handles in
  // trackPlayerService.js — so tapping play here starts the live stream.
  private func showNowPlaying() {
    let nowPlaying = CPNowPlayingTemplate.shared
    nowPlaying.isUpNextButtonEnabled = false
    nowPlaying.isAlbumArtistButtonEnabled = false
    if interfaceController?.topTemplate !== nowPlaying {
      interfaceController?.pushTemplate(nowPlaying, animated: true, completion: nil)
    }
  }
}
`;

// Hosts the normal phone UI. Because CarPlay puts the app on the scene
// lifecycle, the phone window must be created here (from its UIWindowScene)
// rather than in the AppDelegate. It reuses the React Native root view the
// AppDelegate built at launch (AppDelegate.reactRootView).
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
    // Brand purple (#4733FF) so any moment the RN view isn't mounted reads as
    // the éist background, not a bare black screen — and makes a genuine
    // wiring failure diagnosable rather than silent.
    window.backgroundColor = UIColor(red: 71.0 / 255.0, green: 51.0 / 255.0, blue: 255.0 / 255.0, alpha: 1.0)

    let rootViewController = UIViewController()
    rootViewController.view.backgroundColor = window.backgroundColor

    // Reuse the root view the AppDelegate built at launch. Fall back to building
    // it here (and cache it back) if it's missing — e.g. odd launch ordering or
    // a scene reconnect — so the phone UI never comes up empty.
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

    // Declare BOTH scene roles. The phone window role is what keeps the normal
    // app UI alive once multiple scenes are enabled; the CarPlay role adds the
    // car Now Playing screen. $(PRODUCT_MODULE_NAME) is expanded by Xcode at
    // build time, e.g. "eist.PhoneSceneDelegate".
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
 *
 * Fails loudly if the expected code shape isn't found — better a clear build
 * error than silently shipping the old black-screen behaviour.
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

    // Idempotency: skip if we've already patched.
    if (contents.includes('var reactRootView: UIView?')) {
      return config;
    }

    // 1. Expose the RN root view so PhoneSceneDelegate can host it.
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

    // 2. Replace the AppDelegate's window creation + startReactNative(in:) with
    //    root-view creation only. The scene owns the window now.
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
  ];

  // Write the Swift sources into ios/<project>/.
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

  // Register each Swift file with the Xcode target so it compiles.
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
