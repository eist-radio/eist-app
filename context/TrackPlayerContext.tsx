// context/TrackPlayerContext.tsx

import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { AppState, Platform } from 'react-native'
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  State,
} from 'react-native-track-player'

const STREAM_URL = 'https://eist-radio.radiocult.fm/stream'

type TrackPlayerContextType = {
  isPlaying: boolean
  isPlayerReady: boolean
  isBusy: boolean
  play: () => Promise<void>
  stop: () => Promise<void>
  togglePlayStop: () => Promise<void>
  setupPlayer: () => Promise<void>
  updateMetadata: (
    title: string,
    artist: string,
    artworkUrl?: string
  ) => Promise<void>
  recoverAudioSession: () => Promise<void>
  forcePlayerReset: () => Promise<void>
}

const TrackPlayerContext = createContext<TrackPlayerContextType | undefined>(
  undefined
)

const runImmediate = (fn: () => void) => {
  if (typeof setImmediate === 'function') {
    // @ts-ignore
    setImmediate(fn)
  } else {
    setTimeout(fn, 0)
  }
}

export const TrackPlayerProvider = ({ children }: { children: ReactNode }) => {
  const isWeb = Platform.OS === 'web'
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const hasInitialized = useRef(false)
  const stateCheckInterval = useRef<NodeJS.Timeout | null>(null)
  const lastKnownState = useRef<State | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isPlayingRef = useRef(isPlaying)
  const wasPlayingBeforeCarConnection = useRef(false)
  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  const syncPlayerState = async () => {
    if (isWeb) return
    try {
      const currentState = await TrackPlayer.getState()
      const playing = currentState === State.Playing
      const stable =
        currentState === State.Playing ||
        currentState === State.Stopped ||
        currentState === State.Paused ||
        currentState === State.Ready

      if (lastKnownState.current !== currentState) {
        lastKnownState.current = currentState
        setIsPlaying(playing)
        if (stable) setIsBusy(false)
      }
    } catch {
      setIsPlaying(false)
      setIsBusy(false)
    }
  }

  const startStateSync = () => {
    if (isWeb || stateCheckInterval.current) return
    stateCheckInterval.current = setInterval(syncPlayerState, 2000)
  }

  const stopStateSync = () => {
    if (stateCheckInterval.current) {
      clearInterval(stateCheckInterval.current)
      stateCheckInterval.current = null
    }
  }

  const setupPlayer = async () => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    if (isWeb) {
      setIsPlayerReady(true)
      return
    }

    try {
      await TrackPlayer.setupPlayer()
      await TrackPlayer.updateOptions({
        alwaysPauseOnInterruption: false,
        stoppingAppPausesPlayback: false,
        android: {
          appKilledPlaybackBehavior:
            AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
          alwaysPauseOnInterruption: false,
        },
        capabilities: [Capability.Play, Capability.Stop],
        compactCapabilities: [Capability.Play, Capability.Stop],
        notificationCapabilities: [Capability.Play, Capability.Stop],
      })
      await TrackPlayer.add({
        id: 'radio-stream',
        url: STREAM_URL,
        title: ' ',
        artist: 'éist',
        isLiveStream: true,
        duration: 0,
      })
      setIsPlayerReady(true)
      startStateSync()
      await syncPlayerState()
    } catch (err) {
      console.error('TrackPlayer setup failed:', err)
    }
  }

  const recoverFromAudioSessionConflict = async () => {
    setIsPlaying(false)
    setIsBusy(false)
    setIsPlayerReady(false)

    if (isWeb) {
      audioRef.current?.pause()
      audioRef.current = null
      setIsPlayerReady(true)
      return
    }

    try {
      await TrackPlayer.stop().catch(() => { })
      await TrackPlayer.reset().catch(() => { })
      await new Promise((r) => setTimeout(r, 1000))
      hasInitialized.current = false
      await setupPlayer()
    } catch (err) {
      console.error('Recovery failed:', err)
      setIsPlaying(false)
      setIsBusy(false)
      setIsPlayerReady(false)
    }
  }

  const isPlayerInvalidState = async (): Promise<boolean> => {
    if (isWeb) return false
    try {
      await TrackPlayer.getState()
      await TrackPlayer.getQueue()
      return false
    } catch {
      return true
    }
  }

  const play = async () => {
    if (!isPlayerReady) {
      await setupPlayer()
      if (!isPlayerReady) return
    }

    setIsBusy(true)

    if (isWeb) {
      if (!audioRef.current) {
        audioRef.current = new Audio(STREAM_URL)
        audioRef.current.crossOrigin = 'anonymous'
      }
      try {
        await audioRef.current.play()
        setIsPlaying(true)
      } catch (err) {
        console.error('Web audio play failed:', err)
      } finally {
        setIsBusy(false)
      }
      return
    }

    try {
      await TrackPlayer.play()
      setIsPlaying(true)
    } catch (err) {
      console.error('Play failed:', err)
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      if (
        msg.includes('audio session') ||
        msg.includes('interrupted') ||
        msg.includes('invalid state')
      ) {
        await recoverFromAudioSessionConflict()
      }
    } finally {
      setIsBusy(false)
      runImmediate(syncPlayerState)
    }
  }

  const stop = async () => {
    if (!isPlayerReady) return
    setIsBusy(true)

    if (isWeb) {
      audioRef.current?.pause()
      setIsPlaying(false)
      setIsBusy(false)
      return
    }

    try {
      await TrackPlayer.stop()
      setIsPlaying(false)
    } catch (err) {
      console.error('Stop failed:', err)
    } finally {
      setIsBusy(false)
      runImmediate(syncPlayerState)
    }
  }

  const togglePlayStop = async () => {
    if (!isPlayerReady || isBusy) return
    if (isPlaying) {
      await stop()
    } else {
      await play()
    }
  }

  const updateMetadata = async (
    title: string,
    artist: string,
    artworkUrl?: string
  ) => {
    if (!isPlayerReady || isWeb) return
    const isDeadAir = title.trim().length === 0
    const metadataArtist = !artist || isDeadAir ? '' : `${artist} · éist`
    try {
      if (isDeadAir) {
        await TrackPlayer.updateMetadataForTrack(0, {
          title,
          artist: '',
          artwork: require('../assets/images/eist_offline.png'),
        })
      } else if (artworkUrl) {
        await TrackPlayer.updateMetadataForTrack(0, {
          title,
          artist: metadataArtist,
          artwork: artworkUrl,
        })
      } else {
        await TrackPlayer.updateMetadataForTrack(0, {
          title,
          artist: metadataArtist,
          artwork: require('../assets/images/eist_online.png'),
        })
      }
    } catch (err) {
      console.error('Metadata update failed:', err)
    }
  }

  useEffect(() => {
    setupPlayer()

    if (!isWeb) {
      const onState = TrackPlayer.addEventListener(
        Event.PlaybackState,
        async ({ state }) => {
          const playing = state === State.Playing
          lastKnownState.current = state
          setIsPlaying(playing)
          
          // When audio session becomes ready and we were playing before car connection
          if (state === State.Ready && wasPlayingBeforeCarConnection.current) {
            console.log('Audio session ready, resuming playback from car connection')
            wasPlayingBeforeCarConnection.current = false
            await play()
          }
          
          if (
            state === State.Playing ||
            state === State.Paused ||
            state === State.Stopped
          ) {
            setIsBusy(false)
          }
        }
      )
      const onError = TrackPlayer.addEventListener(Event.PlaybackError, async (error) => {
        console.log('Playback error:', error)
        // Check if this might be a CarPlay/Android Auto disconnect or audio session interruption
        if (error.message?.includes('interrupted') || 
            error.message?.includes('session') ||
            error.message?.includes('carplay') ||
            error.message?.includes('android auto') ||
            error.message?.includes('bluetooth')) {
          console.log('Possible CarPlay/Android Auto disconnect detected, stopping playback')
          // Remember that we were playing before the disconnect
          wasPlayingBeforeCarConnection.current = isPlayingRef.current
          await stop()
        } else {
          setIsPlaying(false)
          setIsBusy(false)
          runImmediate(syncPlayerState)
        }
      })
      const onQueueEnded = TrackPlayer.addEventListener(
        Event.PlaybackQueueEnded,
        () => {
          setIsPlaying(false)
          setIsBusy(false)
          runImmediate(syncPlayerState)
        }
      )
      const onRemoteStop = TrackPlayer.addEventListener(
        Event.RemoteStop,
        stop
      )
      const onRemotePlay = TrackPlayer.addEventListener(
        Event.RemotePlay,
        async () => {
          console.log('Remote Play event received (CarPlay/Android Auto)')
          // If we were playing before car connection, resume automatically
          if (wasPlayingBeforeCarConnection.current) {
            console.log('Resuming playback that was active before car connection')
            wasPlayingBeforeCarConnection.current = false
            await play()
          } else {
            // Normal play request from car interface
            await play()
          }
        }
      )





      const onAppState = AppState.addEventListener('change', async (next) => {
        if (next === 'active') {
          startStateSync()
          await syncPlayerState()
          
          // Check if we should resume playback after car connection
          setTimeout(async () => {
            if (wasPlayingBeforeCarConnection.current && !isPlayingRef.current) {
              console.log('App became active, resuming playback that was active before car connection')
              wasPlayingBeforeCarConnection.current = false
              await play()
            } else if (!isPlayingRef.current && (await isPlayerInvalidState())) {
              await recoverFromAudioSessionConflict()
            }
          }, 1500)
        }
      })

      return () => {
        onState.remove()
        onError.remove()
        onQueueEnded.remove()
        onRemoteStop.remove()
        onRemotePlay.remove()
        onAppState.remove()
        stopStateSync()
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      stopStateSync()
    }
  }, [])

  return (
    <TrackPlayerContext.Provider
      value={{
        isPlaying,
        isPlayerReady,
        isBusy,
        play,
        stop,
        togglePlayStop,
        setupPlayer,
        updateMetadata,
        recoverAudioSession: recoverFromAudioSessionConflict,
        forcePlayerReset: recoverFromAudioSessionConflict,
      }}
    >
      {children}
    </TrackPlayerContext.Provider>
  )
}

export const useTrackPlayer = (): TrackPlayerContextType => {
  const ctx = useContext(TrackPlayerContext)
  if (!ctx) {
    throw new Error(
      'useTrackPlayer must be used within a TrackPlayerProvider'
    )
  }
  return ctx
}
