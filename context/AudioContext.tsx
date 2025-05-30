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
import { VideoView, useVideoPlayer } from 'expo-video'
import { setAudioModeAsync } from 'expo-audio'
import { API_KEY as apiKey } from '@env'

// Local placeholders
const placeholderOnlineImage = require('../assets/images/eist_online.png')
const placeholderOfflineImage = require('../assets/images/eist_offline.png')

// Live stream & API constants
const STREAM_URL = 'https://eist-radio.radiocult.fm/stream'
const stationId = 'eist-radio'
const apiUrl = `https://api.radiocult.fm/api/station/${stationId}`

export type AudioContextType = {
  isPlaying: boolean
  togglePlay: () => void
}

const AudioContext = createContext<AudioContextType | undefined>(undefined)

export const AudioProvider = ({ children }: { children: ReactNode }) => {
  // ——— Metadata polling (unchanged) ——————————————
  const [title, setTitle] = useState('Live on éist')
  const [artist, setArtist] = useState('éist')
  const [artwork, setArtwork] = useState<string>(
    '../assets/images/eist_online.png'
  )

  const getArtistDetails = useCallback(
    async (artistId: string | null) => {
      if (!artistId) return { name: ' ', image: artwork }
      try {
        const res = await fetch(`${apiUrl}/artists/${artistId}`, {
          headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const { artist: a = {} } = await res.json()
        return {
          name: a.name || ' ',
          image: a.logo?.['256x256'] || artwork,
        }
      } catch {
        return { name: ' ', image: artwork }
      }
    },
    [artwork]
  )

  const fetchNowPlaying = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/schedule/live`, {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { status, content } = (await res.json()).result

      if (status !== 'schedule') {
        setTitle(' ')
        setArtist('éist · off air')
      } else {
        setTitle(content.title || ' ')
        const artistId = content.artistIds?.[0] ?? null
        const { name, image } = await getArtistDetails(artistId)
        setArtist(name)
        setArtwork(image)
      }
    } catch (err) {
      console.warn('fetchNowPlaying failed', err)
      setTitle(' ')
      setArtist('éist · off air')
    }
  }, [getArtistDetails])

  useEffect(() => {
    fetchNowPlaying()
    const iv = setInterval(fetchNowPlaying, 30000)
    return () => clearInterval(iv)
  }, [fetchNowPlaying])

  // ——— Build the source including dynamic metadata ——————————————
  const sourceWithMetadata = useMemo(
    () => ({
      uri: STREAM_URL,
      metadata: {
        title,   // now-playing title
        artist,  // now-playing artist
        artwork, // now-playing artwork
      },
    }),
    [title, artist, artwork]
  )

  // ——— Initialize the player for background & lock-screen ———————————
  const player = useVideoPlayer(sourceWithMetadata, (p) => {
    if (p) {
      p.loop = false
      p.staysActiveInBackground = true
      p.showNowPlayingNotification = true
      p.audioMixingMode = 'doNotMix'
    }
  })

  // ——— Playback state & audio mode ——————————————
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    setAudioModeAsync({
      shouldPlayInBackground: true,
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
      interruptionModeAndroid: 'doNotMix',
    }).catch((err) => console.error('Audio mode failed', err))
  }, [])

  // ——— Play/pause toggle ——————————————
  const togglePlay = async () => {
    if (!player) {
      console.warn('Player not ready')
      return
    }
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

  // ——— Robustness: auto-reconnect on stream errors ————————
  useEffect(() => {
    if (!player) return
    const sub = player.addListener('statusChange', (status) => {
      if ((status as any).error || status.status === 'error') {
        console.warn('Stream error detected:', (status as any).error)
        // quick pause to reset
        player.pause?.().catch(() => {})
        // after 3s try to play again
        setTimeout(() => {
          player
            .play?.()
            .then(() => {
              console.log('Reconnected stream successfully')
              setIsPlaying(true)
            })
            .catch((e) => console.error('Stream reconnect failed', e))
        }, 3000)
      }
    })
    return () => sub.remove()
  }, [player])

  return (
    <AudioContext.Provider value={{ isPlaying, togglePlay }}>
      {children}

      {/* Hidden VideoView for lock-screen and media controls */}
      <VideoView
        style={{
          width: 0,
          height: 0,
          opacity: 0,
          position: 'absolute',
          top: -1000,
          left: -1000,
        }}
        player={player}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        showsTimecodes={false}
        nativeControls={false}
        pointerEvents="none"
      />
    </AudioContext.Provider>
  )
}

export const useAudio = (): AudioContextType => {
  const ctx = useContext(AudioContext)
  if (!ctx) throw new Error('useAudio must be used within AudioProvider')
  return ctx
}
