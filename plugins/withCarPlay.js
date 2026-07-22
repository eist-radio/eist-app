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
 * What this does: shows a single "éist" item in CarPlay; tapping it pushes
 * the system Now Playing screen (CPNowPlayingTemplate). That screen's
 * play/pause button drives MPRemoteCommandCenter directly, which
 * react-native-track-player already handles — so no JS bridge is needed.
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

// Apple does not allow CPNowPlayingTemplate as an audio app's ROOT template —
// it can only be pushed on top of a browsable root. So we root on a single
// "éist" list item and push Now Playing when it's tapped. Now Playing mirrors
// MPNowPlayingInfoCenter (already set by react-native-track-player) and its
// controls call straight into MPRemoteCommandCenter, so no JS bridge needed.
@objc(CarPlaySceneDelegate)
class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
  var interfaceController: CPInterfaceController?

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController
  ) {
    self.interfaceController = interfaceController
    interfaceController.setRootTemplate(makeRootTemplate(), animated: false, completion: nil)
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
      self?.interfaceController?.pushTemplate(CPNowPlayingTemplate.shared, animated: true, completion: nil)
      completion()
    }
    return CPListTemplate(title: "éist", sections: [CPListSection(items: [item])])
  }
}
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