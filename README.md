# eist-app

A React Native/Expo app for listening to <https://eist.radio/>.

Get [éist on the App Store](https://apps.apple.com/ie/app/%C3%A9ist/id6746519137).

## Getting started

The app uses native modules, so you need a development build, not Expo Go.

```bash
npm install
eas build --platform ios --profile development
npx expo start --tunnel --clear
```

Install the dev build on your device, then scan the QR code from `expo start`.
Press `r` to reload.
You only need a new dev build when native code changes.

## Build and deploy

Bump `version` in `app.json`, then build and submit both platforms:

```bash
eas build --platform all --profile production --auto-submit
```

See `CLAUDE.md` for build profiles, credentials, and CarPlay setup.
