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
        // Enhanced Android Auto support
        androidAutoSupported: true,
      },
      
      // Enhanced capabilities for live radio - Play/Stop only (no pause for CarPlay)
      capabilities: [
        Capability.Play,
        Capability.Stop,
        Capability.PlayFromId,
        Capability.PlayFromSearch,
        Capability.SetRating,
      ],
      
      // Compact capabilities for notification controls - Play/Stop only
      compactCapabilities: [
        Capability.Play, 
        Capability.Stop, 
      ],
      
      // Progress update interval
      progressUpdateEventInterval: 1,
    });
  } catch (error) {
    console.error('TrackPlayer setup error:', error);
    throw error;
  }
};