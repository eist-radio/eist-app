// utils/trackPlayerSetup.ts

import TrackPlayer, {
    AndroidAudioContentType,
    AppKilledPlaybackBehavior,
    Capability,
    IOSCategory
} from 'react-native-track-player';
import { setupAndroidNotificationChannel } from './androidNotificationSetup';

export const setupTrackPlayer = async () => {
  try {
    // Setup Android notification channel first
    await setupAndroidNotificationChannel();

    // Player setup - Optimized for live radio streaming
    await TrackPlayer.setupPlayer({
      maxBuffer: 8,
      minBuffer: 3,
      playBuffer: 1.5,
      backBuffer: 0,
      iosCategory: IOSCategory.Playback,
      androidAudioContentType: AndroidAudioContentType.Music,
      autoHandleInterruptions: true,
      autoUpdateMetadata: true,
    });

    // Options setup - Enhanced for Android Auto
    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.PausePlayback,
        alwaysPauseOnInterruption: true,
      },
      
      // Capabilities for live radio. Play+Pause is the standard pattern for
      // car/lock-screen: a single toggle button. Stop is intentionally omitted —
      // TrackPlayer.stop() tears down the Android foreground service, which kills
      // the MusicService and breaks the MediaBrowserService binding. Android Auto
      // then can't send play commands and the app appears dead (Google Play
      // rejection: "pressing stop completely stop app"). Pause keeps the service
      // alive; the RemotePause handler in trackPlayerService.js treats
      // pause-while-playing as a live-radio stop, and pause-while-stopped as a
      // fresh-stream start.
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
    console.error('TrackPlayer setup error:', error);
    throw error;
  }
};