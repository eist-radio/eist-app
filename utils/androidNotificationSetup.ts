// utils/androidNotificationSetup.ts

import { Platform } from 'react-native';

export const setupAndroidNotificationChannel = async () => {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    // Import Android-specific modules
    const { NativeModules } = require('react-native');
    const { NotificationManager } = NativeModules;

    if (NotificationManager) {
      // Create notification channel for media playback
      await NotificationManager.createChannel({
        id: 'media-playback',
        name: 'Media Playback',
        description: 'Media playback controls and notifications',
        importance: 4, // IMPORTANCE_HIGH
        showBadge: true,
        enableVibration: false,
        enableLights: false,
        sound: null,
        // Ensure notification is visible on lock screen
        lockscreenVisibility: 1, // VISIBILITY_PUBLIC
      });

      console.log('Android notification channel created successfully');
    }
  } catch (error) {
    console.warn('Failed to create Android notification channel:', error);
  }
}; 