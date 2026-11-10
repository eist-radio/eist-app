// utils/trackPlayerSetup.ts

import TrackPlayer, {
    AndroidAudioContentType,
    AppKilledPlaybackBehavior,
    Capability,
    IOSCategory
} from 'react-native-track-player';
import { Platform } from 'react-native';
import { setupAndroidNotificationChannel } from './androidNotificationSetup';

export const setupTrackPlayer = async () => {
  try {
    // Setup Android notification channel first
    await setupAndroidNotificationChannel();

    // Player setup - Optimized for live radio streaming
    await TrackPlayer.setupPlayer({
      // maxBuffer, playBuffer, and backBuffer are Android only.
      maxBuffer: 8,
      // On iOS this is AVPlayerItem.preferredForwardBufferDuration: about 1 MB of the 256 kbps stream to ride out
      // weak signal. Without plugins/withSwiftAudioBuffer.js it would turn off stall waiting and cause tiny skips.
      minBuffer: Platform.OS === 'ios' ? 30 : 3,
      // iOS: keep AVPlayer waiting until it can keep up after a stall, rather than resuming on an empty buffer.
      waitForBuffer: Platform.OS === 'ios' ? true : undefined,
      playBuffer: 1.5,
      backBuffer: 0,
      iosCategory: IOSCategory.Playback,
      androidAudioContentType: AndroidAudioContentType.Music,
      autoHandleInterruptions: true,
      autoUpdateMetadata: true,
    });

    await applyPlayerOptions();
  } catch (error) {
    console.error('TrackPlayer setup error:', error);
    throw error;
  }
};

// Capabilities and Android behaviour. Also re-applied when setupPlayer() reports "already initialized".
export const applyPlayerOptions = async () => {
  try {
    // Options setup - Enhanced for Android Auto
    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.PausePlayback,
        alwaysPauseOnInterruption: true,
      },
      
      // Play+Pause only: stop() kills the Android foreground service. RemotePause handles stop/start for live radio.
      // Governs the lock screen and notification only. Android Auto's buttons come from transportActions() in plugins/withAndroidAuto.js.
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.PlayFromId,
        Capability.PlayFromSearch,
        Capability.SetRating,
      ],

      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
      ],
      
      // Progress update interval
      progressUpdateEventInterval: 1,
    });
  } catch (error) {
    console.error('TrackPlayer options error:', error);
    throw error;
  }
};