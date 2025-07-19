// trackPlayerService.js
import TrackPlayer, { Event } from 'react-native-track-player';

// Storage keys for remembering last played state
const LAST_PLAYED_KEY = 'eist_last_played_timestamp'
const WAS_PLAYING_KEY = 'eist_was_playing'

// Flag to prevent duplicate event listeners
let listenersInitialized = false

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

// Function to reset the service state (for recovery scenarios)
export const resetTrackPlayerService = () => {
  listenersInitialized = false
  console.log('TrackPlayer service reset')
}

const playbackService = async () => {
  // Prevent duplicate event listeners
  if (listenersInitialized) {
    return
  }
  
  listenersInitialized = true

  // Handle CarPlay connection and autoplay
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    try {
      // Only autoplay if we have a clear indication of car connectivity
      // and the user was previously playing within 24 hours
      const shouldAutoPlay = await shouldAutoPlayOnCarPlay()
      
      if (shouldAutoPlay) {
        // For CarPlay compatibility, ensure we're starting from a clean state
        const state = await TrackPlayer.getState();
        if (state !== 'playing') {
          await TrackPlayer.play();
          // Store that we're now playing
          await storeLastPlayedState(true)
        }
      }
    } catch (error) {
      console.error('Error in remote play:', error);
    }
  });

  // Handle remote stop events - always stop, never pause
  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    try {
      await TrackPlayer.stop();
      // Store that we stopped playing
      await storeLastPlayedState(false)
    } catch (error) {
      console.error('Error in remote stop:', error);
    }
  });

  // Handle remote pause events by stopping instead of pausing
  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    try {
      await TrackPlayer.stop();
      // Store that we stopped playing
      await storeLastPlayedState(false)
    } catch (error) {
      console.error('Error in remote pause/stop:', error);
    }
  });

  // Listen for when the stream is ready
  TrackPlayer.addEventListener(Event.PlaybackTrackChanged, () => {
    // Track changed - controls should be enabled
  });

  // Handle playback state changes for CarPlay and audio session recovery
  TrackPlayer.addEventListener(Event.PlaybackState, async ({ state }) => {
    // Remove the automatic autoplay on ready state - this was causing the issue
    // The app should only autoplay when there's explicit user interaction or car connectivity
  });

  // Handle playback errors and audio session interruptions - always stop on interruption
  TrackPlayer.addEventListener(Event.PlaybackError, async (error) => {
    console.error('Playback error:', error);
    
    // Check if this is an audio session interruption
    if (error.message?.includes('interrupted') || 
        error.message?.includes('session') ||
        error.message?.includes('audio') ||
        error.message?.includes('conflict')) {
      // Stop playback on interruption instead of pausing
      try {
        await TrackPlayer.stop();
        await storeLastPlayedState(false)
      } catch (stopErr) {
        console.error('Error stopping playback on interruption:', stopErr)
      }
    }
  });
};

export default playbackService;