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
    "expo-web-browser"
  ],
  ios: {
    ...config.ios,
    infoPlist: {
      ...config.ios?.infoPlist,
      UIBackgroundModes: [
        "audio"
      ],
      NSMicrophoneUsageDescription: "This app streams audio and does not record you, but a library we use requires an infoPlist entry to work.",
      ITSAppUsesNonExemptEncryption: false,
    }
  }
});
