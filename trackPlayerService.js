// trackPlayerService.js
import TrackPlayer, { Event } from 'react-native-track-player';

// Storage keys for remembering last played state
const LAST_PLAYED_KEY = 'eist_last_played_timestamp'
const WAS_PLAYING_KEY = 'eist_was_playing'

// Helper functions for storing/retrieving last played state
const storeLastPlayedState = async (wasPlaying) => {
  try {
    const AsyncStorage = await import('@react-native-async-storage/async-storage')
    await AsyncStorage.default.setItem(LAST_PLAYED_KEY, Date.now().toString())
    await AsyncStorage.default.setItem(WAS_PLAYING_KEY, wasPlaying.toString())
  } catch (error) {
    console.error('Failed to store last played state:', error)
  }
}

const getLastPlayedState = async () => {
  try {
    const AsyncStorage = await import('@react-native-async-storage/async-storage')
    const timestamp = await AsyncStorage.default.getItem(LAST_PLAYED_KEY)
    const wasPlaying = await AsyncStorage.default.getItem(WAS_PLAYING_KEY)
    
    if (timestamp && wasPlaying) {
      return {
        timestamp: parseInt(timestamp, 10),
        wasPlaying: wasPlaying === 'true'
      }
    }
  } catch (error) {
    console.error('Failed to get last played state:', error)
  }
  return null
}

const shouldAutoPlayOnCarPlay = async () => {
  const lastState = await getLastPlayedState()
  if (!lastState) return false
  
  // Check if the app was playing within the last 24 hours
  const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000)
  return lastState.wasPlaying && lastState.timestamp > twentyFourHoursAgo
}

const playbackService = async () => {
  // Handle CarPlay connection and autoplay
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    console.log('Remote Play event received (CarPlay/Control Center)');
    try {
      // Check if we should autoplay based on last played state
      const shouldAutoPlay = await shouldAutoPlayOnCarPlay()
      if (shouldAutoPlay) {
        console.log('CarPlay autoplay: App was last played within 24 hours, starting playback')
      }
      
      // For CarPlay compatibility, ensure we're starting from a clean state
      const state = await TrackPlayer.getState();
      if (state !== 'playing') {
        await TrackPlayer.play();
        // Store that we're now playing
        await storeLastPlayedState(true)
      }
    } catch (error) {
      console.error('Error in remote play:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    console.log('Remote Stop event received');
    try {
      await TrackPlayer.stop();
      // Store that we stopped playing
      await storeLastPlayedState(false)
    } catch (error) {
      console.error('Error in remote stop:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    console.log('Remote Pause event received - treating as stop for radio');
    try {
      await TrackPlayer.stop();
      // Store that we stopped playing
      await storeLastPlayedState(false)
    } catch (error) {
      console.error('Error in remote pause:', error);
    }
  });

  // Listen for when the stream is ready
  TrackPlayer.addEventListener(Event.PlaybackTrackChanged, () => {
    console.log('Track changed - controls should be enabled');
  });

  // Handle playback state changes for CarPlay
  TrackPlayer.addEventListener(Event.PlaybackState, async ({ state }) => {
    console.log('Playback state changed:', state);
    
    // If playback becomes ready and we should autoplay on CarPlay
    if (state === 'ready') {
      try {
        const shouldAutoPlay = await shouldAutoPlayOnCarPlay()
        if (shouldAutoPlay) {
          console.log('Playback ready, checking for CarPlay autoplay')
          // Small delay to ensure CarPlay is fully connected
          setTimeout(async () => {
            try {
              const currentState = await TrackPlayer.getState()
              if (currentState === 'ready') {
                console.log('Auto-playing on CarPlay connection')
                await TrackPlayer.play()
                await storeLastPlayedState(true)
              }
            } catch (error) {
              console.error('Error during CarPlay autoplay:', error)
            }
          }, 1000)
        }
      } catch (error) {
        console.error('Error checking CarPlay autoplay:', error)
      }
    }
  });

  // Handle other events if needed
  TrackPlayer.addEventListener(Event.PlaybackError, (error) => {
    console.error('Playback error:', error);
  });
};

export default playbackService;