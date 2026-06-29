const {
  withEntitlementsPlist,
  withInfoPlist,
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
 * Until then, leaving it disabled keeps the current build completely unaffected.
 *
 * What it does when enabled:
 *   - adds the `com.apple.developer.carplay-audio` entitlement
 *   - declares a CarPlay scene in Info.plist (CarPlay role only; the main app
 *     window keeps its existing AppDelegate-managed UIWindow, so RN rendering is
 *     unchanged)
 *   - drops in a small Swift scene delegate that roots CarPlay on the system
 *     Now Playing template
 *
 * The Now Playing screen (éist logo artwork + play/stop) is driven entirely by
 * the MPNowPlayingInfoCenter / MPRemoteCommandCenter data that
 * react-native-track-player already publishes. The play/stop buttons invoke the
 * same MPRemoteCommandCenter commands handled in trackPlayerService.js, so there
 * is no second audio engine and no JS bridge to maintain.
 */

const CARPLAY_AUDIO_ENTITLEMENT = 'com.apple.developer.carplay-audio';

const CARPLAY_SCENE_DELEGATE_SWIFT = `import CarPlay
import MediaPlayer

// Roots CarPlay on the shared Now Playing template. Artwork + transport controls
// come from the MPNowPlayingInfoCenter / MPRemoteCommandCenter data that
// react-native-track-player already sets, so no extra wiring is needed here.
@objc(CarPlaySceneDelegate)
class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
  var interfaceController: CPInterfaceController?

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController
  ) {
    self.interfaceController = interfaceController

    let nowPlaying = CPNowPlayingTemplate.shared
    nowPlaying.isUpNextButtonEnabled = false
    nowPlaying.isAlbumArtistButtonEnabled = false
    interfaceController.setRootTemplate(nowPlaying, animated: true, completion: nil)
  }

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didDisconnectInterfaceController interfaceController: CPInterfaceController
  ) {
    self.interfaceController = nil
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

    // Declare ONLY the CarPlay scene role. We intentionally do not declare a
    // UIWindowSceneSessionRoleApplication role, so the phone app keeps using its
    // AppDelegate-managed window and React Native rendering is untouched.
    infoPlist.UIApplicationSceneManifest = {
      ...existing,
      UIApplicationSupportsMultipleScenes: true,
      UISceneConfigurations: {
        ...(existing.UISceneConfigurations || {}),
        CPTemplateApplicationSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'CarPlay',
            // $(PRODUCT_MODULE_NAME) is expanded by Xcode at build time, e.g.
            // "eist.CarPlaySceneDelegate".
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).CarPlaySceneDelegate',
          },
        ],
      },
    };

    return config;
  });
}

function withCarPlaySceneDelegateFile(config) {
  // Write the Swift source into ios/<project>/.
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
      fs.writeFileSync(
        path.join(iosSourceDir, 'CarPlaySceneDelegate.swift'),
        CARPLAY_SCENE_DELEGATE_SWIFT
      );
      return config;
    },
  ]);

  // Register the Swift file with the Xcode target so it compiles.
  config = withXcodeProject(config, (config) => {
    const projectName = config.modRequest.projectName;
    const filepath = `${projectName}/CarPlaySceneDelegate.swift`;

    if (!config.modResults.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath,
        groupName: projectName,
        project: config.modResults,
      });
    }
    return config;
  });

  return config;
}

function withCarPlay(config) {
  config = withCarPlayEntitlement(config);
  config = withCarPlaySceneManifest(config);
  config = withCarPlaySceneDelegateFile(config);
  return config;
}

module.exports = withCarPlay;
