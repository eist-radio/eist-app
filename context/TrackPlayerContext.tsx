// context/TrackPlayerContext.tsx

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  State,
} from 'react-native-track-player'

const STREAM_URL = 'https://eist-radio.radiocult.fm/stream'
const STALLED_TIMEOUT = 30000 // 30 seconds
const MAX_RECONNECT_ATTEMPTS = 10

export type TrackPlayerContextType = {
  isPlaying: boolean
  isBusy: boolean
  setupPlayer: () => Promise<void>
  play: () => Promise<void>
  stop: () => Promise<void>
  togglePlayStop: () => Promise<void>
  updateMetadata: (
    title: string,
    artist: string,
    artworkUrl?: string
  ) => Promise<void>
}

const TrackPlayerContext = createContext<TrackPlayerContextType>(
  {} as TrackPlayerContextType
)

export const TrackPlayerProvider = ({
  children,
}: {
  children: ReactNode
}) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const reconnectAttempt = useRef(0)
  const wasInterrupted = useRef(false)
    const stalledTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialized = useRef(false)
  const isOperationInProgress = useRef(false)

  // Stalled stream detection
  useEffect(() => {
    if (!isPlaying) return
    
    const checkForStalledStream = async () => {
      try {
        const state = await TrackPlayer.getState()
        if (state === State.Buffering) {
          // Start stalled timeout
          stalledTimeoutRef.current = setTimeout(() => {
            console.log('Stream appears stalled, attempting reconnection...')
            attemptReconnection()
          }, STALLED_TIMEOUT)
        } else {
          // Clear timeout if not buffering
          if (stalledTimeoutRef.current) {
            clearTimeout(stalledTimeoutRef.current)
            stalledTimeoutRef.current = null
          }
        }
      } catch (error) {
        console.error('Error checking stream state:', error)
      }
    }

    const interval = setInterval(checkForStalledStream, 5000)
    return () => {
      clearInterval(interval)
      if (stalledTimeoutRef.current) {
        clearTimeout(stalledTimeoutRef.current)
      }
    }
  }, [isPlaying])

  const setupPlayer = useCallback(async () => {
    await TrackPlayer.setupPlayer()
    await TrackPlayer.updateOptions({
      alwaysPauseOnInterruption: true,
      stoppingAppPausesPlayback: true,
      android: {
        appKilledPlaybackBehavior:
          AppKilledPlaybackBehavior.PausePlayback,
        alwaysPauseOnInterruption: true,
      },

      capabilities: [Capability.Play, Capability.Stop],
      compactCapabilities: [Capability.Play, Capability.Stop],
      notificationCapabilities: [Capability.Play, Capability.Stop],
    })
    await TrackPlayer.add({
      id: 'radio-stream',
      url: STREAM_URL,
      title: 'éist',
      artist: '',
      isLiveStream: true,
      duration: 0,
    })

  }, [])

  // Initialize TrackPlayer on mount
  useEffect(() => {
    const initPlayer = async () => {
      if (isInitialized.current) return
      try {
        await setupPlayer()
        isInitialized.current = true
      } catch (error) {
        console.error('Failed to initialize TrackPlayer on mount:', error)
      }
    }
    
    initPlayer()
  }, [setupPlayer])

  const play = useCallback(async () => {
    if (isBusy || isOperationInProgress.current) {
      return
    }
    
    isOperationInProgress.current = true
    setIsBusy(true)
    try {
      // Try to reset and setup, but handle initialization errors
      try {
        await TrackPlayer.reset()
        await setupPlayer()
      } catch (error) {
        await TrackPlayer.add({
          id: 'radio-stream',
          url: STREAM_URL,
          title: 'éist',
          artist: '',
          isLiveStream: true,
          duration: 0,
        })
      }
      
      // Always try to play - let TrackPlayer handle the state
      await TrackPlayer.play()
      console.log('Play command successful')
      setIsPlaying(true)
      reconnectAttempt.current = 0
    } catch (error) {
      console.error('Play error:', error)
      setIsPlaying(false)
    } finally {
      setIsBusy(false)
      isOperationInProgress.current = false
    }
  }, [setupPlayer])

  const stop = useCallback(async () => {
    if (isBusy || isOperationInProgress.current) {
      return
    }
    
    isOperationInProgress.current = true
    setIsBusy(true)
    try {
      // Stop playback but keep the track in queue to maintain notification
      await TrackPlayer.stop()
      
      // Re-add the track to keep notification visible in stopped state
      await TrackPlayer.add({
        id: 'radio-stream',
        url: STREAM_URL,
        title: 'éist',
        artist: '',
        isLiveStream: true,
        duration: 0,
      })
      
      console.log('Stop command successful')
    } catch (error) {
      console.error('Stop error:', error)
    } finally {
      setIsPlaying(false)
      setIsBusy(false)
      isOperationInProgress.current = false
    }
  }, [])

  const togglePlayStop = useCallback(async () => {
    if (isBusy) return
    isPlaying ? await stop() : await play()
  }, [isBusy, isPlaying, play, stop])

  const attemptReconnection = useCallback(async () => {
    if (reconnectAttempt.current >= MAX_RECONNECT_ATTEMPTS) {
      return
    }
    
    reconnectAttempt.current++
    const delay = Math.min(10000, 1000 * 2 ** reconnectAttempt.current)

    setTimeout(async () => {
      try {
        await play()
        reconnectAttempt.current = 0
      } catch (error) {
        attemptReconnection()
      }
    }, delay)
  }, [play])

  useEffect(() => {
    const s = TrackPlayer.addEventListener(
      Event.PlaybackState,
      ({ state }) => {
        setIsPlaying(state === State.Playing)
        setIsBusy(state === State.Buffering)
      }
    )
    const e = TrackPlayer.addEventListener(Event.PlaybackError, () => {
      reconnectAttempt.current = 0
      attemptReconnection()
    })
    return () => {
      s.remove()
      e.remove()
    }
  }, [attemptReconnection])

  useEffect(() => {
    const d = TrackPlayer.addEventListener(
      Event.RemoteDuck,
      async ({ paused }) => {
        if (paused) {
          wasInterrupted.current = isPlaying
          await stop()
        } else if (wasInterrupted.current) {
          wasInterrupted.current = false
          await play()
        }
      }
    )
    return () => d.remove()
  }, [isPlaying, play, stop])

  return (
    <TrackPlayerContext.Provider
      value={{
        isPlaying,
        isBusy,
        setupPlayer,
        play,
        stop,
        togglePlayStop,
        updateMetadata: async (title, artist, artworkUrl) => {
          try {
            const queue = await TrackPlayer.getQueue()
            if (!queue.length) return
            const isDead = title.trim().length === 0
            const metaArtist = isDead
              ? ''
              : artist
                ? `${artist} · éist`
                : 'éist'
            await TrackPlayer.updateMetadataForTrack(0, {
              title,
              artist: metaArtist,
              artwork: artworkUrl
                ? artworkUrl
                : require('../assets/images/eist_online.png'),
            })
          } catch {
            // ignore
          }
        },
      }}
    >
      {children}
    </TrackPlayerContext.Provider>
  )
}

export const useTrackPlayer = () => {
  const ctx = useContext(TrackPlayerContext)
  if (!ctx) throw new Error('useTrackPlayer must be within provider')
  return ctx
}
