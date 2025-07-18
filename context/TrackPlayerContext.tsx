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
import { Platform } from 'react-native'
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  State,
} from 'react-native-track-player'

const STREAM_URL = 'https://eist-radio.radiocult.fm/stream'
const LAST_TS = 'eist_last_ts'
const LAST_PLAY = 'eist_last_play'

export type TrackPlayerContextType = {
  isPlaying: boolean
  isPlayerReady: boolean
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
  const isWeb = Platform.OS === 'web'
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const reconnectAttempt = useRef(0)
  const wasInterrupted = useRef(false)

  const storeLast = useCallback(
    async (playing: boolean) => {
      if (isWeb) return
      const { default: A } = await import(
        '@react-native-async-storage/async-storage'
      )
      await A.setItem(LAST_TS, Date.now().toString())
      await A.setItem(LAST_PLAY, playing.toString())
    },
    [isWeb]
  )

  const getLast = useCallback(async () => {
    if (isWeb) return null
    const { default: A } = await import(
      '@react-native-async-storage/async-storage'
    )
    const t = await A.getItem(LAST_TS)
    const p = await A.getItem(LAST_PLAY)
    return t && p ? { ts: parseInt(t, 10), play: p === 'true' } : null
  }, [isWeb])

  // Web preload + events
  useEffect(() => {
    if (!isWeb) return
    const audio = new Audio(STREAM_URL)
    audio.crossOrigin = 'anonymous'
    audio.preload = 'auto'
    audio.load()
    audio.onwaiting = () => setIsBusy(true)
    audio.onplaying = () => {
      setIsBusy(false)
      setIsPlaying(true)
    }
    audio.onended = () => setIsPlaying(false)
    audioRef.current = audio
  }, [isWeb])

  // Auto‑resume last session
  useEffect(() => {
    if (isWeb) return
    getLast().then(last => {
      if (last?.play && last.ts > Date.now() - 24 * 3600 * 1000) {
        play()
      }
    })
  }, [getLast])

  // Setup player
  const setupPlayer = useCallback(async () => {
    if (isWeb) {
      setIsPlayerReady(true)
      return
    }
    try {
      await TrackPlayer.setupPlayer()
      await TrackPlayer.updateOptions({
        alwaysPauseOnInterruption: true,
        stoppingAppPausesPlayback: true,
        android: {
          appKilledPlaybackBehavior:
            AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
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
      setIsPlayerReady(true)
    } catch {
      // ignore
    }
  }, [isWeb])

  // Play with retry
  const play = useCallback(async () => {
    setIsBusy(true)
    if (isWeb) {
      const audio = audioRef.current!
      try {
        await audio.play()
        await storeLast(true)
      } catch {
        audio.load()
        await audio.play()
        await storeLast(true)
      } finally {
        setIsBusy(false)
      }
      return
    }
    try {
      if (!isPlayerReady) await setupPlayer()
      await TrackPlayer.play()
      setIsPlaying(true)
      await storeLast(true)
      reconnectAttempt.current = 0
    } catch {
      await TrackPlayer.reset()
      setIsPlayerReady(false)
      await setupPlayer()
      try {
        await TrackPlayer.play()
        setIsPlaying(true)
        await storeLast(true)
      } catch {
        // give up
      }
    } finally {
      setIsBusy(false)
    }
  }, [isWeb, isPlayerReady, setupPlayer, storeLast])

  // Stop
  const stop = useCallback(async () => {
    setIsBusy(true)
    if (isWeb) {
      const audio = audioRef.current!
      audio.pause()
      setIsPlaying(false)
      await storeLast(false)
      setIsBusy(false)
      return
    }
    try {
      await TrackPlayer.stop()
      setIsPlaying(false)
      await storeLast(false)
    } catch {
      setIsPlaying(false)
      await storeLast(false)
    } finally {
      setIsBusy(false)
    }
  }, [isWeb, storeLast])

  const togglePlayStop = useCallback(async () => {
    if (isBusy) return
    isPlaying ? await stop() : await play()
  }, [isBusy, isPlaying, play, stop])

  // Exponential back‑off
  const attemptReconnection = useCallback(async () => {
    if (reconnectAttempt.current++ >= 5) return
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

  // Native playback state & error
  useEffect(() => {
    if (isWeb) return
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
  }, [isWeb, attemptReconnection])

  // RemoteDuck: phone calls & other audio
  useEffect(() => {
    if (isWeb) return
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
  }, [isWeb, isPlaying, play, stop])

  return (
    <TrackPlayerContext.Provider
      value={{
        isPlaying,
        isPlayerReady,
        isBusy,
        setupPlayer,
        play,
        stop,
        togglePlayStop,
        updateMetadata: async (title, artist, artworkUrl) => {
          if (isWeb || !isPlayerReady) return
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
