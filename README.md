# eist-app

A React Native/Expo app for listening to <https://eist.radio/>.

Get [éist on the App Store](https://apps.apple.com/ie/app/%C3%A9ist/id6746519137).

## Development

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   rm -rf node_modules package-lock.json

   npm install

   npx expo install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Colours

```cmd
$eist: #4733FF !default;
$eist-secondary: #AFFC41 !default;
$eist-highlight: #96BFE6 !default;
```

## A hacking we will go 🪓

Download the expo dev app on your device.

Clear previous build instances:

```cmd
npx expo start --tunnel --clear
```

Use the development build, we are using native components so we can't use expo go.

`r` reloads the app.

## Native dev build

First delete previous App store installed éist app. Install the dev build from the App store.

```cmd
eas build --platform ios --profile development
```

Then, start the dev server:

```cmd
npx expo start --tunnel --clear
```

Once complete, install the Dev build via QR code.

**Note**: Ignore `setSleepTimer` warnings, not using this in the app.

**NB**: Use the dev build, not expo.

**NB**: New dev build only needed when new components are added. JS/CSS changes do not need a new build.

Scan the start QR code to build and serve in the dev server

**NB**: be careful with `--clear` it will remove the old build. Duh.

## Build and deploy to App stores

Make changes and uprev the `app.json` version.

### iOS

**Note:** You must have an Apple developer licence.

```cmd
eas credentials --platform ios
```

```cmd
eas build --platform ios
```

```cmd
eas submit --platform ios
```

## Android

Local Android build:

```cmd
eas build --profile development --platform android --local

```

```cmd
eas build --platform android
```

```cmd
eas submit --platform android
```
