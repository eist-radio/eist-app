// app.config.ts
import { ConfigContext, ExpoConfig } from '@expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  // CarPlay is gated behind an env flag: the plugin adds the
  // `com.apple.developer.carplay-audio` entitlement, which Apple must approve on
  // the App ID and which must be in the EAS signing profile before it can build.
  // Until then it stays unloaded, so it cannot affect the current build. To work
  // on it, build with EXPO_ENABLE_CARPLAY=true (see plugins/withCarPlay.js).
  const carPlayPlugins =
    process.env.EXPO_ENABLE_CARPLAY === 'true' ? ['./plugins/withCarPlay'] : [];

  return {
  ...config,
  // Drives the iOS Xcode project/scheme name (sanitized ASCII). Kept as plain
  // "eist" so the scheme is "eist" rather than "ist" (the fada in "éist" gets
  // stripped). The user-facing app name keeps the fada via CFBundleDisplayName.
  name: 'eist',
  slug: config.slug ?? 'eist-app',
  extra: {
    apiKey: process.env.API_KEY,
    eas: {
      projectId: '4f034ae2-70e3-4215-8782-3aec98781aa6',
    },
  },
  "plugins": [
    "expo-audio",
    "expo-router",
    "expo-web-browser",
    "expo-font",
    "expo-video",
    ["expo-notifications", {
      icon: "./assets/images/notification-icon.png",
      color: "#AFFC41"
    }],
    ["react-native-google-cast", {
      receiverAppId: "7A2782C8",
      // Must stay false: the native iOS Cast button hides itself while the
      // state is noDevicesAvailable, so deferring discovery until "first tap"
      // is a catch-22 (you can't tap a hidden button). Autostarting discovery
      // at launch lets the button appear as soon as a device is found.
      iosStartDiscoveryAfterFirstTapOnCastButton: false,
      iosSuspendSessionsWhenBackgrounded: false
    }],
    "./plugins/withAndroidAuto",
    "./plugins/withFmtConstevalFix",
    ...carPlayPlugins
  ],
  ios: {
    ...config.ios,
    infoPlist: {
      ...config.ios?.infoPlist,
      // Keep the branded name (with fada) on the home screen even though the
      // Xcode project/scheme is the plain-ASCII "eist".
      CFBundleDisplayName: "éist",
      UIBackgroundModes: [
        "audio",
        "remote-notification"
      ],
      NSLocalNetworkUsageDescription: "éist uses the local network to discover Cast devices.",
      NSBonjourServices: ["_googlecast._tcp", "_7A2782C8._googlecast._tcp"],
      NSMicrophoneUsageDescription: "This app streams audio and does not record you, but a library we use requires an infoPlist entry to work.",
      ITSAppUsesNonExemptEncryption: false,
      // iOS audio session configuration
      AVAudioSessionCategory: "playback",
      AVAudioSessionMode: "default",
      AVAudioSessionOptions: [
        "allowBluetooth",
        "allowBluetoothA2DP",
        "allowAirPlay",
        "defaultToSpeaker"
      ],
      // Additional audio permissions
      NSAppleMusicUsageDescription: "This app plays audio content and may access your music library for metadata display.",
      // URL schemes for external apps
      CFBundleURLTypes: [
        {
          CFBundleURLName: "mixcloud",
          CFBundleURLSchemes: ["mixcloud"]
        },
        {
          CFBundleURLName: "https",
          CFBundleURLSchemes: ["https"]
        },
        {
          CFBundleURLName: "http",
          CFBundleURLSchemes: ["http"]
        }
      ],
      // LSApplicationQueriesSchemes for checking if Mixcloud app is installed
      LSApplicationQueriesSchemes: [
        "mixcloud",
        "https",
        "http"
      ],
      // Additional URL handling permissions
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
        NSExceptionDomains: {
          "mixcloud.com": {
            NSExceptionAllowsInsecureHTTPLoads: true,
            NSExceptionMinimumTLSVersion: "1.0",
            NSExceptionRequiresForwardSecrecy: false
          }
        }
      }
    },
  },
  android: {
    ...config.android,
    permissions: [
      "android.permission.INTERNET",
      "android.permission.WAKE_LOCK",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
      "android.permission.MODIFY_AUDIO_SETTINGS",
      "android.permission.ACCESS_NETWORK_STATE",
      "android.permission.BLUETOOTH",
      "android.permission.BLUETOOTH_CONNECT",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.SCHEDULE_EXACT_ALARM",
      "android.permission.RECEIVE_BOOT_COMPLETED"
    ]
  },
  // Disable new architecture for problematic packages
  experiments: {
    tsconfigPaths: true,
  }
  };
};
