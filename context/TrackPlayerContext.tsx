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

// Storage keys for remembering last played state
const LAST_PLAYED_KEY = 'eist_last_played_timestamp'
const WAS_PLAYING_KEY = 'eist_was_playing'

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
  const isCarPlayConnected = useRef(false)
  // New state to track if user was playing before app went to background
  const wasPlayingBeforeBackground = useRef(false)
  // Track reconnection attempts to avoid infinite loops
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 7
  const reconnectDelay = 2000 // 2 seconds
  
  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  // Helper functions for storing/retrieving last played state
  const storeLastPlayedState = async (wasPlaying: boolean) => {
    if (isWeb) return
    try {
      const AsyncStorage = await import('@react-native-async-storage/async-storage')
      await AsyncStorage.default.setItem(LAST_PLAYED_KEY, Date.now().toString())
      await AsyncStorage.default.setItem(WAS_PLAYING_KEY, wasPlaying.toString())
    } catch (error) {
      console.error('Failed to store last played state:', error)
    }
  }

  const getLastPlayedState = async (): Promise<{ timestamp: number; wasPlaying: boolean } | null> => {
    if (isWeb) return null
    try {
      const AsyncStorage = await import('@react-native-async-storage/async-storage')
      const timestamp = await AsyncStorage.default.getItem(LAST_PLAYED_KEY)
      const wasPlaying = await AsyncStorage.default.getItem(WAS_PLAYING_KEY)
      
      if (timestamp && wasPlaying) {
        return {
          timestamp: parseInt(timestamp, 10),
          wasPlaying: wasPlaying === 'true'
        }
      }
    } catch (error) {
      console.error('Failed to get last played state:', error)
    }
    return null
  }

  const shouldAutoPlayOnCarPlay = async (): Promise<boolean> => {
    const lastState = await getLastPlayedState()
    if (!lastState) return false
    
    // Check if the app was playing within the last 24 hours
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000)
    return lastState.wasPlaying && lastState.timestamp > twentyFourHoursAgo
  }

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
    // Only start state sync if we're actually playing and app is active
    if (isPlayingRef.current && AppState.currentState === 'active') {
      stateCheckInterval.current = setInterval(syncPlayerState, 10000) // Reduced from 2s to 10s
    }
  }

  const stopStateSync = () => {
    if (stateCheckInterval.current) {
      clearInterval(stateCheckInterval.current)
      stateCheckInterval.current = null
    }
  }

  // Update state sync based on playing status
  useEffect(() => {
    if (isPlaying) {
      startStateSync()
    } else {
      stopStateSync()
    }
  }, [isPlaying])

  // Helper function to check if the stream track exists
  const hasStreamTrack = async (): Promise<boolean> => {
    try {
      const queue = await TrackPlayer.getQueue()
      return queue && queue.length > 0
    } catch {
      return false
    }
  }

  // Helper function to add the stream track
  const addStreamTrack = async () => {
    await TrackPlayer.add({
      id: 'radio-stream',
      url: STREAM_URL,
      title: ' ',
      artist: 'éist',
      isLiveStream: true,
      duration: 0,
    })
  }

  const setupPlayer = async () => {
    if (hasInitialized.current) {
      // Check if player is actually ready, if not, reset and try again
      try {
        const state = await TrackPlayer.getState()
        const hasTrack = await hasStreamTrack()
        if (state && hasTrack) {
          setIsPlayerReady(true)
          return
        }
      } catch (err) {
        hasInitialized.current = false
      }
    }

    hasInitialized.current = true

    if (isWeb) {
      setIsPlayerReady(true)
      return
    }

    try {
      await TrackPlayer.setupPlayer()
      await TrackPlayer.updateOptions({
        alwaysPauseOnInterruption: false,
        stoppingAppPausesPlayback: true,
        android: {
          appKilledPlaybackBehavior:
            AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
          alwaysPauseOnInterruption: false,
        },
        capabilities: [Capability.Play, Capability.Stop],
        compactCapabilities: [Capability.Play, Capability.Stop],
        notificationCapabilities: [Capability.Play, Capability.Stop],
      })
      await addStreamTrack()
      setIsPlayerReady(true)
      // Don't start state sync here - it will start when playing begins
      await syncPlayerState()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message.toLowerCase() : ''
      
      // If the player is already initialized, that's actually okay - we can proceed
      if (errorMsg.includes('already been initialized')) {
        try {
          // Try to add the track and update options even if already initialized
          await TrackPlayer.updateOptions({
            alwaysPauseOnInterruption: false,
            stoppingAppPausesPlayback: true,
            android: {
              appKilledPlaybackBehavior:
                AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
              alwaysPauseOnInterruption: false,
            },
            capabilities: [Capability.Play, Capability.Stop],
            compactCapabilities: [Capability.Play, Capability.Stop],
            notificationCapabilities: [Capability.Play, Capability.Stop],
          })
          
          // Check if track already exists
          const hasTrack = await hasStreamTrack()
          if (!hasTrack) {
            await addStreamTrack()
          }
          
          setIsPlayerReady(true)
          await syncPlayerState()
          return
        } catch (setupErr) {
          console.error('Failed to complete setup after already initialized error:', setupErr)
        }
      }
      
      // For other errors, reset the initialization flag so we can try again
      hasInitialized.current = false
      setIsPlayerReady(false)
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
      // First, check if the player is actually in a bad state
      try {
        const state = await TrackPlayer.getState()
        const hasTrack = await hasStreamTrack()
        
        // If player is in a good state and has the track, we might not need recovery
        if (state && hasTrack) {
          setIsPlayerReady(true)
          return
        }
      } catch (checkErr) {
        // Player state check failed, proceeding with recovery
      }
      
      // Reset the initialization flag first
      hasInitialized.current = false
      
      // Reset the track player service state
      // Note: Service will be reinitialized automatically on next access
      
      // Stop and reset the player
      await TrackPlayer.stop().catch(() => { })
      await TrackPlayer.reset().catch(() => { })
      
      // Wait a bit for the reset to complete
      await new Promise((r) => setTimeout(r, 1000))
      
      // Try to setup the player again
      await setupPlayer()
      
      // If we were playing before the conflict, try to resume
      if (wasPlayingBeforeBackground.current || wasPlayingBeforeCarConnection.current) {
        setTimeout(async () => {
          try {
            await play()
          } catch (err) {
            console.error('Failed to resume playback after recovery:', err)
          }
        }, 500)
      }
    } catch (err) {
      console.error('Recovery failed:', err)
      setIsPlaying(false)
      setIsBusy(false)
      setIsPlayerReady(false)
      // Reset initialization flag on recovery failure
      hasInitialized.current = false
    }
  }

  const isPlayerInvalidState = async (): Promise<boolean> => {
    if (isWeb) return false
    try {
      const state = await TrackPlayer.getState()
      const hasTrack = await hasStreamTrack()
      
      // Check if player is in a valid state
      const validStates = [State.Playing, State.Paused, State.Stopped, State.Ready, State.Buffering]
      const isValidState = validStates.includes(state)
      
      // Only consider invalid if both state and track are problematic
      // This prevents false positives during normal operations
      const isInvalid = !isValidState && !hasTrack
      
      if (isInvalid) {
        console.log('Player invalid state detected:', { state, hasTrack })
      }
      
      return isInvalid
    } catch (err) {
      console.log('Error checking player state:', err)
      // Don't assume invalid state on error, just return false
      return false
    }
  }

  const attemptReconnection = async () => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.log('Max reconnection attempts reached, giving up')
      reconnectAttempts.current = 0
      return
    }

    reconnectAttempts.current++
    console.log(`Attempting reconnection ${reconnectAttempts.current}/${maxReconnectAttempts}`)
    
    try {
      // Wait before attempting reconnection
      await new Promise(resolve => setTimeout(resolve, reconnectDelay))
      
      // Try to play again
      await play()
      
      // If successful, reset the attempt counter
      reconnectAttempts.current = 0
      console.log('Reconnection successful')
    } catch (err) {
      console.error('Reconnection attempt failed:', err)
      
      // If this wasn't the last attempt, try again
      if (reconnectAttempts.current < maxReconnectAttempts) {
        setTimeout(attemptReconnection, reconnectDelay)
      } else {
        console.log('All reconnection attempts failed')
        reconnectAttempts.current = 0
      }
    }
  }

  const play = async () => {
    setIsBusy(true)

    if (isWeb) {
      if (!audioRef.current) {
        audioRef.current = new Audio(STREAM_URL)
        audioRef.current.crossOrigin = 'anonymous'
      }
      try {
        await audioRef.current.play()
        setIsPlaying(true)
        await storeLastPlayedState(true)
      } catch (err) {
        console.error('Web audio play failed:', err)
      } finally {
        setIsBusy(false)
      }
      return
    }

    // Ensure player is ready before attempting to play
    if (!isPlayerReady) {
      await setupPlayer()
      if (!isPlayerReady) {
        await recoverFromAudioSessionConflict()
        if (!isPlayerReady) {
          setIsBusy(false)
          return
        }
      }
    }

    try {
      // Check if track exists before playing
      const hasTrack = await hasStreamTrack()
      if (!hasTrack) {
        await addStreamTrack()
      }
      
      // Check player state before attempting to play
      const currentState = await TrackPlayer.getState()
      if (currentState === State.Playing) {
        setIsPlaying(true)
        setIsBusy(false)
        return
      }
      
      await TrackPlayer.play()
      setIsPlaying(true)
      await storeLastPlayedState(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      
      // Handle "already initialized" error specifically
      if (msg.includes('already been initialized')) {
        try {
          await TrackPlayer.play()
          setIsPlaying(true)
          await storeLastPlayedState(true)
          return
        } catch (retryErr) {
          console.error('Play failed after already initialized error:', retryErr)
        }
      }
      
      // Handle other audio session issues
      if (
        msg.includes('audio session') ||
        msg.includes('interrupted') ||
        msg.includes('invalid state') ||
        msg.includes('not ready')
      ) {
        await recoverFromAudioSessionConflict()
        // Try playing again after recovery
        try {
          await TrackPlayer.play()
          setIsPlaying(true)
          await storeLastPlayedState(true)
        } catch (retryErr) {
          console.error('Play failed after recovery:', retryErr)
        }
      }
    } finally {
      setIsBusy(false)
      runImmediate(syncPlayerState)
    }
  }

  const stop = async () => {
    setIsBusy(true)

    if (isWeb) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current.load()
        audioRef.current = null
      }
      setIsPlaying(false)
      await storeLastPlayedState(false)
      setIsBusy(false)
      return
    }

    try {
      // For live streaming, just stop the playback without resetting
      await TrackPlayer.stop()
      
      // Verify the stream is actually stopped
      const state = await TrackPlayer.getState()
      
      setIsPlaying(false)
      await storeLastPlayedState(false)
    } catch (err) {
      console.error('Stop failed:', err)
      // Force stop even if there's an error
      setIsPlaying(false)
      await storeLastPlayedState(false)
    } finally {
      setIsBusy(false)
      runImmediate(syncPlayerState)
    }
  }

  const togglePlayStop = async () => {
    if (isBusy) return
    
    if (isPlaying) {
      await stop()
    } else {
      // If player is not ready, try to recover first
      if (!isPlayerReady) {
        await recoverFromAudioSessionConflict()
      }
      await play()
    }
  }

  const updateMetadata = async (
    title: string,
    artist: string,
    artworkUrl?: string
  ) => {
    if (!isPlayerReady || isWeb) return
    
    try {
      // Check if the track exists before updating metadata
      const hasTrack = await hasStreamTrack()
      if (!hasTrack) {
        console.log('Stream track not found, skipping metadata update')
        return
      }
      
      const isDeadAir = title.trim().length === 0
      const metadataArtist = !artist || isDeadAir ? '' : `${artist} · éist`
      
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
      // Don't throw the error, just log it and continue
      // This prevents the error from breaking the app flow
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
          console.log('Audio session interruption detected, stopping playback')
          // Remember that we were playing before the interruption
          wasPlayingBeforeCarConnection.current = isPlayingRef.current
          wasPlayingBeforeBackground.current = isPlayingRef.current
          // Always stop on interruption, never pause
          await stop()
        } else {
          // For stream/network errors, attempt reconnection if we were playing
          if (isPlayingRef.current) {
            console.log('Stream error detected, attempting reconnection')
            setIsPlaying(false)
            setIsBusy(false)
            // Reset reconnection attempts for new error
            reconnectAttempts.current = 0
            // Attempt reconnection after a short delay
            setTimeout(attemptReconnection, reconnectDelay)
          } else {
            setIsPlaying(false)
            setIsBusy(false)
            runImmediate(syncPlayerState)
          }
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
          // Only start state sync if we're playing
          if (isPlayingRef.current) {
            startStateSync()
          }
          await syncPlayerState()
          
          // Check if we should resume playback after returning from background
          if (wasPlayingBeforeBackground.current && !isPlayingRef.current) {
            wasPlayingBeforeBackground.current = false
            // This is a more forceful way to ensure playback resumes
            await recoverFromAudioSessionConflict()
          } else if (
            wasPlayingBeforeCarConnection.current &&
            !isPlayingRef.current
          ) {
            wasPlayingBeforeCarConnection.current = false
            await play()
          } else if (!isPlayingRef.current) {
            // Only check for invalid state if we're not playing and player is ready
            if (isPlayerReady) {
              try {
                const isInvalid = await isPlayerInvalidState()
                if (isInvalid) {
                  await recoverFromAudioSessionConflict()
                }
              } catch (err) {
                // Error checking player state, skipping recovery
              }
            }
          }
        } else if (next === 'background') {
          // Remember if we were playing before going to background
          wasPlayingBeforeBackground.current = isPlayingRef.current
          // Stop polling when app goes to background to save battery
          stopStateSync()
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
