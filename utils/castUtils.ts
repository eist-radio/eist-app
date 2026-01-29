// utils/castUtils.ts

import { Platform } from 'react-native'

const STREAM_URL = 'https://eist-radio.radiocult.fm/stream'

// Only import google-cast on mobile platforms
let GoogleCast: any
if (Platform.OS !== 'web') {
  try {
    GoogleCast = require('react-native-google-cast').default
  } catch (error) {
    console.warn('react-native-google-cast not available:', error)
  }
}

export type CastMediaInfo = {
  contentUrl: string
  contentType: string
  streamType: 'live' | 'buffered' | 'none'
  metadata: {
    type: 'generic' | 'movie' | 'tvShow' | 'musicTrack' | 'photo'
    title: string
    subtitle?: string
    studio?: string
    images?: Array<{ url: string }>
  }
}

/**
 * Build MediaInfo object for casting the live radio stream
 */
export function buildCastMediaInfo(
  title: string,
  artist: string,
  artworkUrl?: string
): CastMediaInfo {
  const images = artworkUrl ? [{ url: artworkUrl }] : []

  return {
    contentUrl: STREAM_URL,
    contentType: 'audio/mpeg',
    streamType: 'live',
    metadata: {
      type: 'musicTrack',
      title: title || 'éist',
      subtitle: artist || 'éist · live',
      studio: 'éist',
      images,
    },
  }
}

/**
 * Load the live radio stream onto the cast device
 */
export async function loadMediaOnCast(
  title: string,
  artist: string,
  artworkUrl?: string
): Promise<boolean> {
  if (Platform.OS === 'web' || !GoogleCast) {
    console.log('Cast not available on this platform')
    return false
  }

  try {
    // Get the session manager and current session
    const sessionManager = GoogleCast.getSessionManager()
    const session = await sessionManager.getCurrentCastSession()

    if (!session) {
      console.error('No cast session available')
      return false
    }

    const client = session.getClient()
    if (!client) {
      console.error('No remote media client available')
      return false
    }

    const mediaInfo = buildCastMediaInfo(title, artist, artworkUrl)

    await client.loadMedia({
      mediaInfo,
      autoplay: true,
    })

    console.log('Media loaded on cast device')
    return true
  } catch (error) {
    console.error('Failed to load media on cast:', error)
    return false
  }
}

/**
 * Update metadata on the currently casting media
 */
export async function updateCastMediaMetadata(
  title: string,
  artist: string,
  artworkUrl?: string
): Promise<boolean> {
  if (Platform.OS === 'web' || !GoogleCast) {
    return false
  }

  try {
    const sessionManager = GoogleCast.getSessionManager()
    const session = await sessionManager.getCurrentCastSession()

    if (!session) {
      return false
    }

    const client = session.getClient()
    if (!client) {
      return false
    }

    // For live streams, we need to reload the media to update metadata
    const mediaInfo = buildCastMediaInfo(title, artist, artworkUrl)

    const mediaStatus = await client.getMediaStatus()
    if (mediaStatus?.playerState === 'playing' || mediaStatus?.playerState === 'buffering') {
      await client.loadMedia({
        mediaInfo,
        autoplay: true,
      })
    }

    return true
  } catch (error) {
    console.error('Failed to update cast metadata:', error)
    return false
  }
}

/**
 * Control playback on the cast device
 */
export async function castPlay(): Promise<boolean> {
  if (Platform.OS === 'web' || !GoogleCast) {
    return false
  }

  try {
    const sessionManager = GoogleCast.getSessionManager()
    const session = await sessionManager.getCurrentCastSession()

    if (!session) {
      return false
    }

    const client = session.getClient()
    if (!client) {
      return false
    }

    await client.play()
    return true
  } catch (error) {
    console.error('Failed to play on cast:', error)
    return false
  }
}

export async function castPause(): Promise<boolean> {
  if (Platform.OS === 'web' || !GoogleCast) {
    return false
  }

  try {
    const sessionManager = GoogleCast.getSessionManager()
    const session = await sessionManager.getCurrentCastSession()

    if (!session) {
      return false
    }

    const client = session.getClient()
    if (!client) {
      return false
    }

    await client.pause()
    return true
  } catch (error) {
    console.error('Failed to pause on cast:', error)
    return false
  }
}

export async function castStop(): Promise<boolean> {
  if (Platform.OS === 'web' || !GoogleCast) {
    return false
  }

  try {
    const sessionManager = GoogleCast.getSessionManager()
    const session = await sessionManager.getCurrentCastSession()

    if (!session) {
      return false
    }

    const client = session.getClient()
    if (!client) {
      return false
    }

    await client.stop()
    return true
  } catch (error) {
    console.error('Failed to stop cast:', error)
    return false
  }
}
