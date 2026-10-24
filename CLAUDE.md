# CLAUDE.md

Build and deploy notes for the éist radio app (React Native, Expo SDK 53, EAS Build).

## Rules

- Never commit superpower plan docs (`docs/superpowers/`, `.superpowers/`).
- The app uses native modules, so you can't use Expo Go. Use a development build.
- You only need a new development build when native code changes (new native packages, config plugins, `app.config.ts`, patches). JS changes hot reload.

## Local development

```bash
npm install                     # also runs patch-package (patches/)
npx expo start --tunnel --clear # serve JS to the dev build
npm run lint
npx tsc --noEmit                # typecheck
```

`make check` runs lint, typecheck, and `expo-doctor`.

## EAS build profiles (`eas.json`)

- `development`: dev client, internal distribution, CarPlay enabled.
- `preview`: store distribution, iOS simulator build.
- `production`: store distribution, `autoIncrement` build numbers, `API_KEY` from EAS secrets, CarPlay enabled.
- `production-local`: same as `production` but for `--local` builds, so `API_KEY` must be in your local environment.

The RadioCult API key reaches the app through `process.env.API_KEY` in `app.config.ts` (`extra.apiKey`).
Builds without it can't fetch live metadata or schedules.

`.easignore` excludes `ios/` and `android/` so EAS always runs a fresh prebuild.
Don't remove that, a stale local prebuild once dropped the Cast SDK `Info.plist` keys from iOS builds.

## Build and submit

Bump `version` in `app.json` first.
Build numbers are remote (`appVersionSource: remote`) and auto increment.

```bash
eas build --platform all --profile production --auto-submit   # both stores in one go
eas build --platform ios                                      # or one platform at a time
eas submit --platform ios
eas build --platform android
eas submit --platform android
```

Development builds:

```bash
eas build --platform ios --profile development
eas build --platform android --profile development --local
```

## Credentials

- iOS: App Store Connect API key managed by EAS (`eas credentials --platform ios`, then "App Store Connect: Manage your API Key"). `submit.production.ios.ascAppId` is `6746519137`. Bundle ID is `com.oootini.eistapp`.
- Android: `./google-service-account.json` (gitignored and easignored), submits to the `production` track.

## CarPlay

CarPlay is behind `EXPO_ENABLE_CARPLAY=true` (`app.config.ts` adds `plugins/withCarPlay.js`).
The `development`, `production`, and `production-local` profiles set it.
It needs the `com.apple.developer.carplay-audio` entitlement approved for the App ID and included in the EAS provisioning profile (`eas credentials`).
To prebuild locally with it:

```bash
EXPO_ENABLE_CARPLAY=true npx expo prebuild -p ios --clean
```

Android Auto (`plugins/withAndroidAuto.js`) is always on.

## Web preview

`.github/workflows/preview.yml` deploys a web export (`npx expo export --platform web`) to Netlify for every PR.
It needs the `RADIOCULT_API_KEY`, `NETLIFY_AUTH_TOKEN`, and `NETLIFY_SITE_ID` repo secrets.
`make preview` does the same export locally and serves it on port 3000.
