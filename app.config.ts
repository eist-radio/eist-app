// app.config.ts
import { ConfigContext, ExpoConfig } from '@expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'eist-app',
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
      iosStartDiscoveryAfterFirstTapOnCastButton: true,
      iosSuspendSessionsWhenBackgrounded: false
    }],
    "./plugins/withAndroidAuto"
  ],
  ios: {
    ...config.ios,
    infoPlist: {
      ...config.ios?.infoPlist,
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
});
