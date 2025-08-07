// utils/urlDetection.ts

import { Linking, Platform } from 'react-native';

// URL regex pattern that matches various URL formats
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.[a-z]{2,}\/[^\s]*)/gi;

export interface LinkSegment {
  type: 'text' | 'link';
  content: string;
  url?: string;
}

/**
 * Detects URLs in text and returns an array of segments (text and links)
 */
export function detectUrls(text: string): LinkSegment[] {
  if (!text) return [];
  
  const segments: LinkSegment[] = [];
  let lastIndex = 0;
  let match;
  
  // Reset regex state
  URL_REGEX.lastIndex = 0;
  
  while ((match = URL_REGEX.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }
    
    // Process the URL
    let url = match[0];
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    segments.push({
      type: 'link',
      content: match[0],
      url: url
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after the last URL
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }
  
  return segments;
}

/**
 * Validates if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
} 

export const checkMixcloudAppInstalled = async (): Promise<boolean> => {
  try {
    // Check if Mixcloud app is installed by trying to open a mixcloud:// URL
    const canOpenMixcloud = await Linking.canOpenURL('mixcloud://')
    return canOpenMixcloud
  } catch (error) {
    return false
  }
}

export const getMixcloudAppUrl = (webUrl: string): string => {
  // Convert web URL to app URL format
  // Example: https://www.mixcloud.com/eistcork/show-name/ -> mixcloud://eistcork/show-name/
  try {
    const url = new URL(webUrl)
    const path = url.pathname

    // Remove leading slash if present
    const cleanPath = path.startsWith('/') ? path.slice(1) : path

    // Ensure we have a valid path
    if (!cleanPath) {
      console.warn('Invalid path for Mixcloud app URL:', path)
      return webUrl
    }

    const appUrl = `mixcloud://${cleanPath}`
    return appUrl
  } catch (error) {
    return webUrl
  }
}

export const openMixcloudShow = async (webUrl: string): Promise<boolean> => {
  try {
    // Validate the URL first
    if (!webUrl || typeof webUrl !== 'string') {
      return false
    }
    
    // First try to open in the Mixcloud app
    const appUrl = getMixcloudAppUrl(webUrl)

    try {
      const canOpenApp = await Linking.canOpenURL(appUrl)

      if (canOpenApp) {
        await Linking.openURL(appUrl)
        return true
      }
    } catch (appError) {
      console.error('Error checking/opening app URL:', appError)
    }
    
    // Fallback to web URL
    try {
      const canOpenWeb = await Linking.canOpenURL(webUrl)

      if (canOpenWeb) {
        await Linking.openURL(webUrl)
        return true
      }
    } catch (webError) {
      console.error('Error checking/opening web URL:', webError)
    }

    // Try mobile web version
    const mobileUrl = webUrl.replace('https://www.mixcloud.com', 'https://m.mixcloud.com')

    try {
      const canOpenMobile = await Linking.canOpenURL(mobileUrl)

      if (canOpenMobile) {
        await Linking.openURL(mobileUrl)
        return true
      }
    } catch (mobileError) {
      console.error('Error checking/opening mobile URL:', mobileError)
    }
    
    // iOS-specific fallback: try with different URL schemes
    if (Platform.OS === 'ios') {
      
      // Try with https:// prefix if not present
      if (!webUrl.startsWith('https://') && !webUrl.startsWith('http://')) {
        const httpsUrl = `https://${webUrl}`

        try {
          const canOpenHttps = await Linking.canOpenURL(httpsUrl)

          if (canOpenHttps) {
            await Linking.openURL(httpsUrl)
            return true
          }
        } catch (httpsError) {
          console.error('Error with https URL:', httpsError)
        }
      }
      
      // Try opening in Safari specifically
      const safariUrl = webUrl.startsWith('http') ? webUrl : `https://${webUrl}`

      try {
        const canOpenSafari = await Linking.canOpenURL(safariUrl)

        if (canOpenSafari) {
          await Linking.openURL(safariUrl)
          return true
        }
      } catch (safariError) {
        console.error('Error with Safari URL:', safariError)
      }
    }

    return false
  } catch (error) {
    console.error('Error in openMixcloudShow:', error)
    return false
  }
} 