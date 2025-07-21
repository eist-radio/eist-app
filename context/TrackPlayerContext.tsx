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
  stop: () => Promise<void>         // still called "stop" in API, but now calls pause()
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

  // Detect stalled stream
  useEffect(() => {
    if (!isPlaying) return
    
    const checkForStalledStream = async () => {
      try {
        const state = await TrackPlayer.getState()
        if (state === State.Buffering) {
          stalledTimeoutRef.current = setTimeout(() => {
            attemptReconnection()
          }, STALLED_TIMEOUT)
        } else if (stalledTimeoutRef.current) {
          clearTimeout(stalledTimeoutRef.current)
          stalledTimeoutRef.current = null
        }
      } catch {
        // ignore
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
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.PausePlayback,
        alwaysPauseOnInterruption: true,
      },
      capabilities: [Capability.Play, Capability.Pause],
      compactCapabilities: [Capability.Play, Capability.Pause],
      notificationCapabilities: [Capability.Play, Capability.Pause],
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

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      if (isInitialized.current) return
      try {
        await setupPlayer()
        isInitialized.current = true
      } catch {
        // ignore
      }
    }
    init()
  }, [setupPlayer])

  const play = useCallback(async () => {
    if (isBusy || isOperationInProgress.current) return
    isOperationInProgress.current = true
    setIsBusy(true)
    try {
      // Reset the stream to get current live content
      await TrackPlayer.reset()
      
      // Add the track back to the queue
      await TrackPlayer.add({
        id: 'radio-stream',
        url: STREAM_URL,
        title: 'éist',
        artist: '',
        isLiveStream: true,
        duration: 0,
      })
      
      await TrackPlayer.play()
      setIsPlaying(true)
      reconnectAttempt.current = 0
    } catch {
      setIsPlaying(false)
    } finally {
      setIsBusy(false)
      isOperationInProgress.current = false
    }
  }, [isBusy])

  // stop() now pauses the stream
  const stop = useCallback(async () => {
    if (isBusy || isOperationInProgress.current) return
    isOperationInProgress.current = true
    setIsBusy(true)
    try {
      if (stalledTimeoutRef.current) {
        clearTimeout(stalledTimeoutRef.current)
        stalledTimeoutRef.current = null
      }
      await TrackPlayer.pause()
      setIsPlaying(false)
    } catch {
      // ignore
    } finally {
      setIsBusy(false)
      isOperationInProgress.current = false
    }
  }, [isBusy])

  const togglePlayStop = useCallback(async () => {
    if (isBusy) return
    isPlaying ? await stop() : await play()
  }, [isBusy, isPlaying, play, stop])

  const attemptReconnection = useCallback(async () => {
    if (reconnectAttempt.current >= MAX_RECONNECT_ATTEMPTS) return
    reconnectAttempt.current++
    const delay = Math.min(10000, 1000 * 2 ** reconnectAttempt.current)
    setTimeout(async () => {
      try {
        await play()
        reconnectAttempt.current = 0
      } catch {
        attemptReconnection()
      }
    }, delay)
  }, [play])

  // Event listeners
  useEffect(() => {
    const sub1 = TrackPlayer.addEventListener(
      Event.PlaybackState,
      ({ state }) => {
        setIsPlaying(state === State.Playing)
        setIsBusy(state === State.Buffering)
      }
    )
    const sub2 = TrackPlayer.addEventListener(
      Event.PlaybackError,
      () => {
        if (isPlaying && !isOperationInProgress.current) {
          reconnectAttempt.current = 0
          attemptReconnection()
        }
      }
    )
    return () => {
      sub1.remove()
      sub2.remove()
    }
  }, [isPlaying, attemptReconnection])

  useEffect(() => {
    const duck = TrackPlayer.addEventListener(
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
    return () => duck.remove()
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
