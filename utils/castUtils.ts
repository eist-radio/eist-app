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
    artist?: string
    images?: Array<{ url: string }>
  }
  customData?: Record<string, any>
}

/**
 * Format title for Cast display - replace "(éist arís)" with repeat symbol
 * Matches the behavior of FormattedShowTitle component in the app
 * Uses Unicode ↻ (U+21BB) which renders as a simple text glyph
 */
function formatCastTitle(title: string): string {
  if (!title) return 'éist'
  // Replace variations of "éist arís" with repeat symbol (↻)
  // Using a simple Unicode arrow that blends with text, not a colorful emoji
  return title
    .replace(/\(éist arís\)/gi, '↻')
    .replace(/\(eist aris\)/gi, '↻')
    .replace(/\(éíst arís\)/gi, '↻')
    .replace(/\(éist aris\)/gi, '↻')
    .replace(/\(eist arís\)/gi, '↻')
    .trim()
}

/**
 * Build MediaInfo object for casting the live radio stream
 */
export function buildCastMediaInfo(
  title: string,
  artist: string,
  artworkUrl?: string,
  showTime?: string,
  customData?: Record<string, any>
): CastMediaInfo {
  const images = artworkUrl ? [{ url: artworkUrl }] : []
  const formattedTitle = formatCastTitle(title)
  const subtitleParts = []
  if (artist) subtitleParts.push(`with ${artist}`)
  if (showTime) subtitleParts.push(showTime)
  const subtitle = subtitleParts.join(' · ')

  return {
    contentUrl: STREAM_URL,
    contentType: 'audio/mpeg',
    streamType: 'live',
    metadata: {
      type: 'generic',
      title: formattedTitle,
      subtitle: subtitle || 'éist · live',
      artist: artist || 'éist',
      images,
    },
    customData,
  }
}

/**
 * Load the live radio stream onto the cast device
 */
export async function loadMediaOnCast(
  title: string,
  artist: string,
  artworkUrl?: string,
  showTime?: string
): Promise<boolean> {
  if (Platform.OS === 'web' || !GoogleCast) {
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

    const formattedTitle = formatCastTitle(title)
    const mediaInfo = buildCastMediaInfo(
      title,
      artist,
      artworkUrl,
      showTime || '',
      {
        showTime: showTime || '',
        djName: artist || '',
        artworkUrl: artworkUrl || '',
      }
    )

    await client.loadMedia({
      mediaInfo,
      autoplay: true,
    })

    try {
      await sendCastMetadataMessage({
        type: 'metadata',
        title: formattedTitle,
        showTime: showTime || '',
        djName: artist || '',
        artworkUrl: artworkUrl || '',
      })
    } catch (messageError) {
      console.warn('Failed to send cast metadata message:', messageError)
    }

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
  artworkUrl?: string,
  showTime?: string
): Promise<boolean> {
  if (Platform.OS === 'web' || !GoogleCast) {
    return false
  }

  try {
    const formattedTitle = formatCastTitle(title)
    return await sendCastMetadataMessage({
      type: 'metadata',
      title: formattedTitle,
      showTime: showTime || '',
      djName: artist || '',
      artworkUrl: artworkUrl || '',
    })
  } catch (error) {
    console.error('Failed to update cast metadata:', error)
    return false
  }
}

const CAST_METADATA_NAMESPACE = 'urn:x-cast:com.eist.metadata'
let castChannel: { sessionId?: string; channel?: any } = {}

async function getCastChannel() {
  if (Platform.OS === 'web' || !GoogleCast) return null

  const sessionManager = GoogleCast.getSessionManager()
  const session = await sessionManager.getCurrentCastSession()
  if (!session) return null

  const sessionId = session.id
  if (castChannel.channel && castChannel.sessionId === sessionId) {
    return castChannel.channel
  }

  if (castChannel.channel) {
    try {
      await castChannel.channel.remove()
    } catch {
      // Ignore channel cleanup errors
    }
  }

  const channel = await session.addChannel(CAST_METADATA_NAMESPACE)
  castChannel = { sessionId, channel }
  return channel
}

async function sendCastMetadataMessage(payload: Record<string, any>) {
  const channel = await getCastChannel()
  if (!channel) return false

  try {
    await channel.sendMessage(payload)
    return true
  } catch (error) {
    console.warn('Failed to send cast metadata message:', error)
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
