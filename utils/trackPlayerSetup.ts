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

    // Player setup
    await TrackPlayer.setupPlayer({
      maxBuffer: 50,
      minBuffer: 15,
      playBuffer: 2.5,
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
      
      // Enhanced capabilities for Android Auto
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.Stop,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        // Add rating capability for better Android Auto integration
        Capability.SetRating,
      ],
      
      // Compact capabilities for notification controls
      compactCapabilities: [
        Capability.Play, 
        Capability.Pause,
        Capability.Stop, 
        Capability.SkipToNext, 
        Capability.SkipToPrevious
      ],
      
      // Progress update interval
      progressUpdateEventInterval: 1,
    });

    console.log('TrackPlayer setup successful with Android Auto support');
  } catch (error) {
    console.error('TrackPlayer setup error:', error);
    throw error;
  }
};