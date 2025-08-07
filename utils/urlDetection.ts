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
    console.log('Converted web URL to app URL:', webUrl, '->', appUrl)
    return appUrl
  } catch (error) {
    console.error('Error converting URL to app format:', error)
    return webUrl
  }
}

export const openMixcloudShow = async (webUrl: string): Promise<boolean> => {
  try {
    console.log('Attempting to open Mixcloud show:', webUrl)
    console.log('Platform:', Platform.OS)
    
    // Validate the URL first
    if (!webUrl || typeof webUrl !== 'string') {
      console.error('Invalid URL provided:', webUrl)
      return false
    }
    
    // First try to open in the Mixcloud app
    const appUrl = getMixcloudAppUrl(webUrl)
    console.log('Generated app URL:', appUrl)
    
    try {
      const canOpenApp = await Linking.canOpenURL(appUrl)
      console.log('Can open app URL:', canOpenApp)
      
      if (canOpenApp) {
        console.log('Opening in Mixcloud app...')
        await Linking.openURL(appUrl)
        return true
      }
    } catch (appError) {
      console.error('Error checking/opening app URL:', appError)
    }
    
    // Fallback to web URL
    try {
      const canOpenWeb = await Linking.canOpenURL(webUrl)
      console.log('Can open web URL:', canOpenWeb)
      
      if (canOpenWeb) {
        console.log('Opening in web browser...')
        await Linking.openURL(webUrl)
        return true
      }
    } catch (webError) {
      console.error('Error checking/opening web URL:', webError)
    }
    
    // Try mobile web version
    const mobileUrl = webUrl.replace('https://www.mixcloud.com', 'https://m.mixcloud.com')
    console.log('Trying mobile URL:', mobileUrl)
    
    try {
      const canOpenMobile = await Linking.canOpenURL(mobileUrl)
      console.log('Can open mobile URL:', canOpenMobile)
      
      if (canOpenMobile) {
        console.log('Opening in mobile web browser...')
        await Linking.openURL(mobileUrl)
        return true
      }
    } catch (mobileError) {
      console.error('Error checking/opening mobile URL:', mobileError)
    }
    
    // iOS-specific fallback: try with different URL schemes
    if (Platform.OS === 'ios') {
      console.log('Trying iOS-specific fallbacks...')
      
      // Try with https:// prefix if not present
      if (!webUrl.startsWith('https://') && !webUrl.startsWith('http://')) {
        const httpsUrl = `https://${webUrl}`
        console.log('Trying with https prefix:', httpsUrl)
        
        try {
          const canOpenHttps = await Linking.canOpenURL(httpsUrl)
          console.log('Can open https URL:', canOpenHttps)
          
          if (canOpenHttps) {
            console.log('Opening with https prefix...')
            await Linking.openURL(httpsUrl)
            return true
          }
        } catch (httpsError) {
          console.error('Error with https URL:', httpsError)
        }
      }
      
      // Try opening in Safari specifically
      const safariUrl = webUrl.startsWith('http') ? webUrl : `https://${webUrl}`
      console.log('Trying Safari URL:', safariUrl)
      
      try {
        const canOpenSafari = await Linking.canOpenURL(safariUrl)
        console.log('Can open Safari URL:', canOpenSafari)
        
        if (canOpenSafari) {
          console.log('Opening in Safari...')
          await Linking.openURL(safariUrl)
          return true
        }
      } catch (safariError) {
        console.error('Error with Safari URL:', safariError)
      }
    }
    
    console.log('All URL opening attempts failed')
    return false
  } catch (error) {
    console.error('Error in openMixcloudShow:', error)
    return false
  }
} 