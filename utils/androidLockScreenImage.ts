// utils/androidLockScreenImage.ts

import { Platform } from 'react-native';

// Cache for lock screen images with timestamp for invalidation
interface CacheEntry {
  url: string;
  timestamp: number;
  isValid: boolean;
}

const lockScreenImageCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache duration

export const getLockScreenImage = (artworkUrl?: string): any => {
  if (Platform.OS !== 'android') {
    return artworkUrl || require('../assets/images/eist-logo.png');
  }

  // For Android, use the original logo as fallback
  const fallbackImage = require('../assets/images/eist-logo.png');

  // If no artwork URL provided, use fallback
  if (!artworkUrl) {
    return fallbackImage;
  }

  // If we have a remote URL, validate it first
  if (artworkUrl && typeof artworkUrl === 'string' && artworkUrl.startsWith('http')) {
    // Check if we have it cached and it's still valid
    const cached = lockScreenImageCache.get(artworkUrl);
    const now = Date.now();
    
    if (cached && cached.isValid && (now - cached.timestamp) < CACHE_DURATION) {
      return cached.url;
    }

    // If cache is invalid or expired, return fallback
    if (cached && !cached.isValid) {
      // Remove invalid cache entry
      lockScreenImageCache.delete(artworkUrl);
    }
    
    // Return fallback for invalid/unvalidated URLs
    return fallbackImage;
  }

  // For local URLs or other cases, use fallback
  return fallbackImage;
};

export const preloadLockScreenImage = async (artworkUrl?: string): Promise<boolean> => {
  if (Platform.OS !== 'android' || !artworkUrl || typeof artworkUrl !== 'string' || !artworkUrl.startsWith('http')) {
    return false;
  }

  try {
    console.log('Preloading lock screen image:', artworkUrl);
    
    // Check if we already have a valid cached version
    const cached = lockScreenImageCache.get(artworkUrl);
    const now = Date.now();
    
    if (cached && cached.isValid && (now - cached.timestamp) < CACHE_DURATION) {
      console.log('Using cached lock screen image');
      return true;
    }

    // Validate the URL by making a HEAD request
    const response = await fetch(artworkUrl, { 
      method: 'HEAD'
    });
    
    if (response.ok) {
      // Cache the valid URL
      lockScreenImageCache.set(artworkUrl, {
        url: artworkUrl,
        timestamp: now,
        isValid: true
      });
      console.log('Lock screen image preloaded successfully');
      return true;
    } else {
      // Mark as invalid
      lockScreenImageCache.set(artworkUrl, {
        url: artworkUrl,
        timestamp: now,
        isValid: false
      });
      console.warn('Lock screen image URL returned status:', response.status);
      return false;
    }
  } catch (error) {
    console.warn('Failed to preload lock screen image:', error);
    // Mark as invalid
    lockScreenImageCache.set(artworkUrl, {
      url: artworkUrl,
      timestamp: Date.now(),
      isValid: false
    });
    return false;
  }
};

export const clearLockScreenImageCache = (): void => {
  lockScreenImageCache.clear();
  console.log('Lock screen image cache cleared');
};

export const invalidateLockScreenImage = (artworkUrl: string): void => {
  if (lockScreenImageCache.has(artworkUrl)) {
    const cached = lockScreenImageCache.get(artworkUrl);
    if (cached) {
      cached.isValid = false;
      console.log('Lock screen image invalidated:', artworkUrl);
    }
  }
}; 