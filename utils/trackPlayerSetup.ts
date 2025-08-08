// utils/trackPlayerSetup.ts

import TrackPlayer, { 
  Capability, 
  IOSCategory, 
  AndroidAudioContentType,
  AppKilledPlaybackBehavior 
} from 'react-native-track-player';

export const setupTrackPlayer = async () => {
  try {
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
        Capability.Pause, 
        Capability.Stop
        //Capability.SeekTo,
        //Capability.SkipToNext,
        //Capability.SkipToPrevious,
      ],
      
      // Compact capabilities
      compactCapabilities: [
        Capability.Play, 
        Capability.Pause, 
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