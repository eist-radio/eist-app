// context/AudioContext.tsx
import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react'
import { useVideoPlayer } from 'expo-video'
import { setAudioModeAsync } from 'expo-audio'
import { API_KEY as apiKey } from '@env'

// Local placeholders
const placeholderOnlineImage = require('../assets/images/eist_online.png')
const placeholderOfflineImage = require('../assets/images/eist_offline.png')

// Live stream & API constants
const STREAM_URL = 'https://stream-relay-geo.ntslive.net/stream'
const stationId = 'eist-radio'
const apiUrl = `https://api.radiocult.fm/api/station/${stationId}`

export type AudioContextType = {
  isPlaying: boolean
  togglePlay: () => void
}

const AudioContext = createContext<AudioContextType | undefined>(undefined)

export const AudioProvider = ({ children }: { children: ReactNode }) => {
  // Now playing metadata from API
  const [title, setTitle] = useState<string>('Live on éist')
  const [artist, setArtist] = useState<string>('éist')
  const [artwork, setArtwork] = useState<string>(
    '../assets/images/eist_online.png'
  )

  // Fetch artist details by ID
  const getArtistDetails = useCallback(async (artistId: string | null) => {
    if (!artistId) return { name: ' ', image: artwork }
    try {
      const res = await fetch(`${apiUrl}/artists/${artistId}`, {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const artistObj = json.artist || {}
      return {
        name: artistObj.name || ' ',
        image:
          artistObj.logo?.['256x256'] ||
          artwork,
      }
    } catch {
      return { name: ' ', image: artwork }
    }
  }, [artwork])

  // fetch now-playing and update metadata
  const fetchNowPlaying = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/schedule/live`, {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { status, content } = (await res.json()).result

      if (status !== 'schedule') {
        // off-air fallback
        setTitle(' ')
        setArtist('éist · off air')
        setArtwork(artwork)
      } else {
        const showTitle = content.title || ' '
        setTitle(showTitle)

        const artistId = content.artistIds?.[0] ?? null
        const { name, image } = await getArtistDetails(artistId)
        setArtist(name)
        setArtwork(image)
      }
    } catch (err) {
      console.warn('fetchNowPlaying failed', err)
      setTitle(' ')
      setArtist('éist · off air')
      // leave artwork at last known (or placeholder)
    }
  }, [getArtistDetails, artwork])

  // poll every 30 s
  useEffect(() => {
    fetchNowPlaying()
    const iv = setInterval(fetchNowPlaying, 30000)
    return () => clearInterval(iv)
  }, [fetchNowPlaying])

  // rebuild source whenever metadata changes:
  const sourceWithMetadata = useMemo(
    () => ({
      uri: STREAM_URL,
      metadata: {
        title,
        artist,
        artwork,
      },
    }),
    [title, artist, artwork]
  )

  // initialize Expo VideoPlayer with lock-screen / background audio
  const player = useVideoPlayer(sourceWithMetadata, (p) => {
    if (p) {
      p.loop = false
      p.staysActiveInBackground = true
      p.showNowPlayingNotification = true
      p.audioMixingMode = 'doNotMix'
    }
  })

  const [isPlaying, setIsPlaying] = useState(false)

  // configure audio mode on mount
  useEffect(() => {
    setAudioModeAsync({
      shouldPlayInBackground: true,
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
      interruptionModeAndroid: 'doNotMix',
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    }).catch((err) => console.error('Audio mode failed', err))
  }, [])

  // play/pause toggle
  const togglePlay = async () => {
    if (!player) return console.warn('Player not ready')
    try {
      if (isPlaying) {
        await player.pause?.()
        setIsPlaying(false)
      } else {
        await player.play?.()
        setIsPlaying(true)
      }
    } catch (err) {
      console.error('Playback error', err)
    }
  }

  return (
    <AudioContext.Provider value={{ isPlaying, togglePlay }}>
      {children}
    </AudioContext.Provider>
  )
}

export const useAudio = (): AudioContextType => {
  const ctx = useContext(AudioContext)
  if (!ctx) throw new Error('useAudio must be used within AudioProvider')
  return ctx
}
