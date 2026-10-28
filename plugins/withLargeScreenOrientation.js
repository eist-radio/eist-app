const { AndroidConfig, withAndroidManifest, withMainActivity } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

// Android 16 ignores manifest orientation locks on large screens, and Play flags them.
// Drop the locks from the manifest and lock portrait at runtime on phones only (smallest width under 600dp).
const MLKIT_SCANNER_ACTIVITY =
  'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';

const PHONE_PORTRAIT_LOCK = `    if (resources.configuration.smallestScreenWidthDp < 600) {
      requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
    }`;

function withLargeScreenOrientation(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
    delete mainActivity.$['android:screenOrientation'];

    // expo-dev-launcher pulls in the ML Kit code scanner, whose activity is locked to portrait.
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    application.activity = application.activity ?? [];
    if (!application.activity.some((a) => a.$['android:name'] === MLKIT_SCANNER_ACTIVITY)) {
      application.activity.push({
        $: {
          'android:name': MLKIT_SCANNER_ACTIVITY,
          'tools:remove': 'android:screenOrientation',
        },
      });
    }
    return config;
  });

  config = withMainActivity(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error('withLargeScreenOrientation expects a Kotlin MainActivity');
    }
    config.modResults.contents = mergeContents({
      tag: 'large-screen-orientation',
      src: config.modResults.contents,
      newSrc: PHONE_PORTRAIT_LOCK,
      anchor: /super\.onCreate\(/,
      offset: 1,
      comment: '//',
    }).contents;
    return config;
  });

  return config;
}

module.exports = withLargeScreenOrientation;
