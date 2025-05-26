// context/AudioContext.tsx
import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useMemo,
} from 'react'
import { useVideoPlayer } from 'expo-video'
import { setAudioModeAsync } from 'expo-audio'

// Live stream URL 
const STREAM_URL = 'https://stream-relay-geo.ntslive.net/stream'

// The shape of what the context provides
export type AudioContextType = {
  isPlaying: boolean
  togglePlay: () => void
}

const AudioContext = createContext<AudioContextType | undefined>(undefined)

export const AudioProvider = ({ children }: { children: ReactNode }) => {
  // Enrich source with metadata for lock screen display
  const sourceWithMetadata = useMemo(() => ({
    uri: STREAM_URL,
    metadata: {
      title: "Live on éist", // TODO: Replace with API data
      artist: "Aidan", // TODO: Replace with API data
      artwork: "https://d4mt18vwj73wk.cloudfront.net/artistImage/2025-01-23T11:00:08Z-1024x1024.jpeg", // TODO: Replace with API data
    },
  }), [])

  // Initialize the VideoPlayer (audio-only) with lock screen support
  const player = useVideoPlayer(sourceWithMetadata, (p) => {
    if (p) {
      p.loop = false
      p.staysActiveInBackground = true
      p.showNowPlayingNotification = true
      p.audioMixingMode = "doNotMix"
    }
  })

  const [isPlaying, setIsPlaying] = useState(false)

  // Configure audio mode on initialization
  useEffect(() => {
    const configureAudio = async () => {
      try {
        await setAudioModeAsync({
          shouldPlayInBackground: true,
          playsInSilentMode: true,
          interruptionMode: "doNotMix",
          interruptionModeAndroid: "doNotMix",
          allowsRecording: false,
          shouldRouteThroughEarpiece: false,
        })
      } catch (err) {
        console.error('Failed to configure audio mode:', err)
      }
    }
    configureAudio()
  }, [])

  // Play/pause helper, driven by local state
  const togglePlay = async () => {
    if (!player) {
      console.warn('Player not available')
      return
    }
    
    try {
      if (isPlaying) {
        if (player.pause) {
          await player.pause()
        }
        setIsPlaying(false)
      } else {
        if (player.play) {
          await player.play()
        }
        setIsPlaying(true)
      }
    } catch (err) {
      console.error('Playback error:', err)
    }
  }

  return (
    <AudioContext.Provider value={{ isPlaying, togglePlay }}>
      {children}
    </AudioContext.Provider>
  )
}

// Custom hook for consuming the audio context — top‐level export
export const useAudio = (): AudioContextType => {
  const ctx = useContext(AudioContext)
  if (!ctx) {
    throw new Error('useAudio must be used within AudioProvider')
  }
  return ctx
}