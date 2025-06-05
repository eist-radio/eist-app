// index.js
import 'react-native-gesture-handler';
import TrackPlayer from 'react-native-track-player';
import playbackService from './trackPlayerService';

// Register the TrackPlayer service before anything else
TrackPlayer.registerPlaybackService(() => playbackService);

// Tell Expo Router to take over from here
import 'expo-router/entry';
