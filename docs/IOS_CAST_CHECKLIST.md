# iOS Cast & Bonjour Checklist

Use this list when adding or debugging Google Cast on iOS.

Config alignment
- Receiver App ID is consistent across platforms (Android manifest, iOS AppDelegate, Expo config).
- NSBonjourServices includes:
  - _googlecast._tcp
  - _<RECEIVER_APP_ID>._googlecast._tcp
- NSLocalNetworkUsageDescription is set (required for iOS 14+ local network prompt).

Runtime expectations
- First launch should trigger the iOS Local Network permission prompt.
- If denied, enable it in iOS Settings > [Your App] > Local Network.

Build/prebuild
- If using Expo config plugins, run `npx expo prebuild --platform ios --no-install` after changes.
- Verify `ios/ist/Info.plist` and `ios/ist/AppDelegate.swift` match the Expo config output.

Common pitfalls
- Mismatched receiver ID causes device discovery/connection failures.
- Missing Bonjour entries prevents discovery even if the Cast SDK loads.
