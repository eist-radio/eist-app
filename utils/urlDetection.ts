// utils/urlDetection.ts

import { Linking } from 'react-native';

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
    return `mixcloud://${path}`
  } catch (error) {
    return webUrl
  }
}

export const openMixcloudShow = async (webUrl: string): Promise<boolean> => {
  try {
    // First try to open in the Mixcloud app
    const appUrl = getMixcloudAppUrl(webUrl)
    const canOpenApp = await Linking.canOpenURL(appUrl)
    
    if (canOpenApp) {
      await Linking.openURL(appUrl)
      return true
    }
    
    // Fallback to web URL
    const canOpenWeb = await Linking.canOpenURL(webUrl)
    if (canOpenWeb) {
      await Linking.openURL(webUrl)
      return true
    }
    
    // Try mobile web version
    const mobileUrl = webUrl.replace('https://www.mixcloud.com', 'https://m.mixcloud.com')
    const canOpenMobile = await Linking.canOpenURL(mobileUrl)
    if (canOpenMobile) {
      await Linking.openURL(mobileUrl)
      return true
    }
    
    return false
  } catch (error) {
    return false
  }
} 