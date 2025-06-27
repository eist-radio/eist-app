// trackPlayerService.js
import TrackPlayer, { Event } from 'react-native-track-player';

const playbackService = async () => {
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    console.log('Remote Play event received (CarPlay/Control Center)');
    try {
      // For CarPlay compatibility, ensure we're starting from a clean state
      const state = await TrackPlayer.getState();
      if (state !== 'playing') {
        await TrackPlayer.play();
      }
    } catch (error) {
      console.error('Error in remote play:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    console.log('Remote Stop event received');
    try {
      await TrackPlayer.stop();
    } catch (error) {
      console.error('Error in remote stop:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    console.log('Remote Pause event received - treating as stop for radio');
    try {
      await TrackPlayer.stop();
    } catch (error) {
      console.error('Error in remote pause:', error);
    }
  });

  // Listen for when the stream is ready
  TrackPlayer.addEventListener(Event.PlaybackTrackChanged, () => {
    console.log('Track changed - controls should be enabled');
  });

  // Handle other events if needed
  TrackPlayer.addEventListener(Event.PlaybackError, (error) => {
    console.error('Playback error:', error);
  });
};

export default playbackService;