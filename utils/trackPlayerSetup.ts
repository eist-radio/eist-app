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

    // Options setup - IMPORTANT: Use Capability enums!
    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.PausePlayback,
        alwaysPauseOnInterruption: true,
      },
      
      // Capabilities - Use Capability enum, not strings
      capabilities: [
        Capability.Play,
        Capability.Stop
        //Capability.SeekTo,
        //Capability.SkipToNext,
        //Capability.SkipToPrevious,
      ],
      
      // Compact capabilities
      compactCapabilities: [
        Capability.Play, 
        Capability.Stop, 
        Capability.SkipToNext, 
        Capability.SkipToPrevious
      ],
      
      // Progress update interval
      progressUpdateEventInterval: 1,
    });

    console.log('TrackPlayer setup successful');
  } catch (error) {
    console.error('TrackPlayer setup error:', error);
    throw error;
  }
};