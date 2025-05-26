// context/AudioContext.tsx
// orig implem without lockscreen
import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from 'react'
import {
  useAudioPlayer,
  setAudioModeAsync,
} from 'expo-audio'

// Live stream URL 
const STREAM_URL = 'https://stream-relay-geo.ntslive.net/stream'

// The shape of what the context provides
export type AudioContextType = {
  isPlaying: boolean
  togglePlay: () => void
}

const AudioContext = createContext<AudioContextType | undefined>(undefined)

export const AudioProvider = ({ children }: { children: ReactNode }) => {
  const player = useAudioPlayer({ uri: STREAM_URL })
  const [isPlaying, setIsPlaying] = useState(false)

  // Configure audio mode on initialization
  useEffect(() => {
    const configureAudio = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'duckOthers',
          interruptionModeAndroid: 'duckOthers',
          shouldPlayInBackground: true,
          shouldRouteThroughEarpiece: true,
        })
      } catch (err) {
        console.error('Failed to configure audio mode:', err)
      }
    }
    configureAudio()
  }, [])

  // Play/pause helper, driven by local state
  const togglePlay = () => {
    if (isPlaying) {
      player.pause()
      setIsPlaying(false)
    } else {
      player.play()
      setIsPlaying(true)
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
