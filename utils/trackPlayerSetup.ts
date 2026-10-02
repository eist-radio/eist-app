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
      // car/lock-screen: a single toggle button. Stop is omitted because
      // TrackPlayer.stop() tears down the Android foreground service, which kills
      // the MusicService and breaks the MediaBrowserService binding. Pause keeps
      // the service alive; the RemotePause handler in trackPlayerService.js
      // treats pause-while-playing as a live-radio stop, and pause-while-stopped
      // as a fresh-stream start.
      //
      // This list governs RNTP's OWN session: the lock screen and notification.
      // It does NOT govern Android Auto, which only ever talks to the proxy
      // MediaSession in plugins/withAndroidAuto.js. The stop button behind the
      // Google Play rejection ("pressing stop completely stop app, unable to
      // play anything afterward") came from that proxy advertising ACTION_STOP,
      // so removing Capability.Stop here never affected it. The car-facing
      // action mask lives in transportActions() in that plugin.
      //
      // Side effect worth knowing: omitting Capability.Stop means RNTP never
      // wires a stop action on its session, so a stop() forwarded to RNTP is
      // silently dropped. The proxy therefore converts stop to pause itself.
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