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
      
      // Capabilities for live radio. Pause is REQUIRED for CarPlay: the system
      // CPNowPlayingTemplate play/pause button is driven by MPRemoteCommandCenter
      // and stays disabled unless BOTH play and pause commands are registered
      // (RNTP also auto-registers togglePlayPause once play+pause are present).
      // We keep the "pause = stop" live-radio behaviour in trackPlayerService.js;
      // enabling Pause here only makes the car/lock-screen button functional.
      capabilities: [
        Capability.Play,
        Capability.Pause,
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