# éist Apple iOS and Google Android app

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
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

Download the expo go app in the App store on your device.

Clear previous build instances in Expo go app, then:

```cmd
npx expo start --tunnel
```

Press `s` to switch to expo go, and open in app. `r` reloads the app.

## Deploy to App store

Make changes and uprev the `app.json` version.

```cmd
eas build --platform ios
```

```cmd
eas submit --platform ios --latest
```

**TODO**
* Chromecast https://github.com/react-native-google-cast/react-native-google-cast
* Carkit
