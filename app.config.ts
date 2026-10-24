// app.config.ts
import { ConfigContext, ExpoConfig } from '@expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  // CarPlay needs the Apple-approved carplay-audio entitlement, so it only loads with EXPO_ENABLE_CARPLAY=true.
  const carPlayPlugins =
    process.env.EXPO_ENABLE_CARPLAY === 'true' ? ['./plugins/withCarPlay'] : [];

  return {
  ...config,
  // Plain "eist" so the Xcode scheme isn't "ist". The display name keeps the fada.
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
      // Cast 22.x needs Kotlin 2.2. 21.4.0 is the latest that builds with SDK 53's Kotlin 2.0.21.
      androidPlayServicesCastFrameworkVersion: "21.4.0",
      // Must stay false: the iOS Cast button stays hidden until discovery finds a device.
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
        // Setting CFBundleURLTypes stops Expo adding the app's own scheme, so list it here (eistapp://carplay-log).
        {
          CFBundleURLName: "eistapp",
          CFBundleURLSchemes: ["eistapp"]
        },
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
