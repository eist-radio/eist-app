// index.js
import { Platform, AppRegistry } from 'react-native';
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

// Register TrackPlayer background service
if (Platform.OS !== 'web' && TrackPlayer) {
  TrackPlayer.registerPlaybackService(() => require('./trackPlayerService'));
}

// Tell Expo Router to take over from here
import 'expo-router/entry';
