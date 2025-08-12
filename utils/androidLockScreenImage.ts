// utils/androidLockScreenImage.ts

import { Platform } from 'react-native';

// Cache for lock screen images to ensure they're properly loaded
const lockScreenImageCache = new Map<string, any>();

export const getLockScreenImage = (artworkUrl?: string): any => {
  if (Platform.OS !== 'android') {
    return artworkUrl || require('../assets/images/eist-logo.png');
  }

  // For Android, prioritize the lock screen specific image
  if (!artworkUrl) {
    return require('../assets/images/eist-logo.png');
  }

  // If we have a remote URL, validate it first
  if (artworkUrl && typeof artworkUrl === 'string' && artworkUrl.startsWith('http')) {
    // Check if we have it cached
    if (lockScreenImageCache.has(artworkUrl)) {
      return lockScreenImageCache.get(artworkUrl);
    }

    // For now, use the remote URL but fall back to local image if needed
    lockScreenImageCache.set(artworkUrl, artworkUrl);
    return artworkUrl;
  }

  // Fall back to the lock screen specific image
  return require('../assets/images/eist-logo.png');
};

export const preloadLockScreenImage = async (artworkUrl?: string): Promise<void> => {
  if (Platform.OS !== 'android' || !artworkUrl || typeof artworkUrl !== 'string' || !artworkUrl.startsWith('http')) {
    return;
  }

  try {
    // Preload the image to ensure it's available for lock screen
    const response = await fetch(artworkUrl);
    if (response.ok) {
      lockScreenImageCache.set(artworkUrl, artworkUrl);
    }
  } catch (error) {
    console.warn('Failed to preload lock screen image:', error);
  }
}; 