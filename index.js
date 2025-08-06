// index.js
import { Platform } from 'react-native';
import 'react-native-gesture-handler';

// Only import TrackPlayer on mobile platforms
let TrackPlayer;
if (Platform.OS !== 'web') {
  try {
    TrackPlayer = require('react-native-track-player').default;
  } catch (error) {
    console.warn('TrackPlayer not available:', error);
  }
}

import playbackService from './trackPlayerService';

// Register the TrackPlayer service before anything else
// Add error handling for native module initialization
const initializeTrackPlayer = async () => {
  // Skip on web platform
  if (Platform.OS === 'web') {
    console.log('TrackPlayer not needed on web platform');
    return;
  }

  try {
    // Check if TrackPlayer is available
    if (!TrackPlayer) {
      console.warn('TrackPlayer is not available');
      return;
    }

    // Wait a bit for native module to be ready
    await new Promise(resolve => setTimeout(resolve, 100));

    // Register the service with error handling
    TrackPlayer.registerPlaybackService(() => playbackService);
    console.log('TrackPlayer service registered successfully');
  } catch (error) {
    console.error('Failed to register TrackPlayer service:', error);
    // Continue with app initialization even if TrackPlayer fails
  }
};

// Initialize TrackPlayer asynchronously
initializeTrackPlayer();

// Tell Expo Router to take over from here
import 'expo-router/entry';
