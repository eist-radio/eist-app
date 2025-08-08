// context/TrackPlayerContext.tsx

import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState
} from 'react';
import { AppState, Platform } from 'react-native';
import { useNetworkConnectivity } from '../hooks/useNetworkConnectivity';
import { setupTrackPlayer } from '../utils/trackPlayerSetup';

// Only import TrackPlayer on mobile platforms
let TrackPlayer: any, Event: any, State: any;
if (Platform.OS !== 'web') {
  try {
    const trackPlayerModule = require('react-native-track-player');
    TrackPlayer = trackPlayerModule.default;
    Event = trackPlayerModule.Event;
    State = trackPlayerModule.State;
  } catch (error) {
    console.warn('TrackPlayer not available:', error);
  }
}

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
  showTitle: string;
  showArtist: string;
  showArtworkUrl: string | undefined;
}

const TrackPlayerContext = createContext<TrackPlayerContextType | undefined>(
  undefined
)

// Storage keys for remembering last played state
const LAST_PLAYED_KEY = 'eist_last_played_timestamp'
const WAS_PLAYING_KEY = 'eist_was_playing'

export const TrackPlayerProvider = ({ children }: { children: ReactNode }) => {
  const isWeb = Platform.OS === 'web'
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const [isBusy, setIsBusy] = useState(false)

  // Store the latest show metadata in state
  const [showTitle, setShowTitle] = useState<string>('éist');
  const [showArtist, setShowArtist] = useState<string>('');
  const [showArtworkUrl, setShowArtworkUrl] = useState<string | undefined>(undefined);

  const hasInitialized = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isPlayingRef = useRef(isPlaying)
  const wasPlayingBeforeBackground = useRef(false)

  // Recovery guard to prevent infinite recovery loops
  const maxRecoveryAttempts = 3;
  const recoveryAttempts = useRef(0);
  const isRecovering = useRef(false);

  // Network connectivity tracking
  const networkState = useNetworkConnectivity()
  const wasPlayingBeforeNetworkChange = useRef(false)
  const previousNetworkState = useRef(networkState)

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

  // Clean reset of the stream while preserving metadata display
  const cleanResetPlayer = async () => {
    if (isWeb) {
      // Clean reset for web audio
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current.load()
        audioRef.current = null
      }
      return
    }

    try {
      console.log('Performing clean reset...')

      // Stop current playback but don't reset queue yet
      await TrackPlayer.stop().catch(() => { })

      // Get current queue to preserve metadata
      const currentQueue = await TrackPlayer.getQueue().catch(() => [])
      const currentTrack = currentQueue[0]

      // Reset queue to clear any buffered data
      await TrackPlayer.reset().catch(() => { })

      // Small delay to ensure cleanup
      await new Promise(resolve => setTimeout(resolve, 100))

      // Re-add fresh stream track with preserved metadata if available
      let artwork = currentTrack?.artwork || showArtworkUrl || require('../assets/images/eist-logo.png')
      
      // For Android, prefer HTTP URLs for artwork
      if (Platform.OS === 'android' && showArtworkUrl && typeof showArtworkUrl === 'string' && showArtworkUrl.startsWith('http')) {
        artwork = showArtworkUrl
      }
      
      const trackToAdd = {
        id: 'radio-stream-' + Date.now(), // Unique ID for fresh track
        url: STREAM_URL,
        title: currentTrack?.title || showTitle || 'éist',
        artist: currentTrack?.artist || (showArtist ? `${showArtist} · éist` : 'éist'),
        artwork: artwork,
        isLiveStream: true,
      }
      
      try {
        await TrackPlayer.add(trackToAdd)
      } catch (addError) {
        console.error('TrackPlayer.add failed:', addError)
        // Don't throw the error, just log it to prevent crashes
        return
      }

      console.log('Clean reset completed')
    } catch (err) {
      console.error('Clean reset failed:', err)
      throw err
    }
  }

  // Function to ensure track exists in queue for metadata display
  const ensureTrackForDisplay = async () => {
    if (isWeb) return

    try {
      const queue = await TrackPlayer.getQueue()
      if (!queue || queue.length === 0) {
        // Add a track for display purposes (stopped state)
        let artwork = showArtworkUrl || require('../assets/images/eist-logo.png')
        
        // For Android, prefer HTTP URLs for artwork
        if (Platform.OS === 'android' && showArtworkUrl && typeof showArtworkUrl === 'string' && showArtworkUrl.startsWith('http')) {
          artwork = showArtworkUrl
        }
        
        const trackToAdd = {
          id: 'radio-display-' + Date.now(),
          url: STREAM_URL,
          title: showTitle || 'éist',
          artist: showArtist ? `${showArtist} · éist` : 'éist',
          artwork: artwork,
          isLiveStream: true,
        }

        try {
          await TrackPlayer.add(trackToAdd)
        } catch (addError) {
          console.error('TrackPlayer.add failed in ensureTrackForDisplay:', addError)
        }
      }
    } catch (err) {
      console.error('Ensure track for display failed:', err)
    }
  }

  const setupPlayer = async () => {
    if (hasInitialized.current && isPlayerReady) {
      return
    }

    if (isWeb) {
      setIsPlayerReady(true)
      return
    }

    // Prevent multiple simultaneous setup attempts
    if (isBusy) {
      console.log('Setup blocked: player is busy')
      return
    }

    try {
      console.log('Setting up player...')

      // Check if TrackPlayer is already initialized before calling setupTrackPlayer
      try {
        const state = await TrackPlayer.getPlaybackState()
        console.log('TrackPlayer already initialized, skipping setup')
        hasInitialized.current = true
        setIsPlayerReady(true)
        return
      } catch (checkError) {
        // TrackPlayer not initialized yet, proceed with setup
        console.log('TrackPlayer not initialized, proceeding with setup')
      }

      if (!hasInitialized.current) {
        // Use the best practice setup function
        await setupTrackPlayer()
        hasInitialized.current = true
      }

      setIsPlayerReady(true)
      console.log('Player setup completed')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message.toLowerCase() : ''
      if (errorMsg.includes('already been initialized')) {
        console.log('TrackPlayer already initialized, continuing...')
        hasInitialized.current = true
        setIsPlayerReady(true)
        return
      }

      console.error('Player setup failed:', err)
      hasInitialized.current = false
      setIsPlayerReady(false)
      throw err
    }
  }

  const recoverFromAudioSessionConflict = async () => {
    if (isRecovering.current) return
    isRecovering.current = true

    if (recoveryAttempts.current >= maxRecoveryAttempts) {
      console.error('Max recovery attempts reached. Giving up.')
      setIsPlaying(false)
      setIsBusy(false)
      setIsPlayerReady(false)
      hasInitialized.current = false
      isRecovering.current = false
      return
    }

    recoveryAttempts.current++
    setIsPlaying(false)
    setIsBusy(false)
    setIsPlayerReady(false)

    if (isWeb) {
      audioRef.current?.pause()
      audioRef.current = null
      setIsPlayerReady(true)
      isRecovering.current = false
      return
    }

    try {
      console.log('Recovering from audio session conflict...')

      // Reset initialization flag
      hasInitialized.current = false

      // Perform clean reset
      await cleanResetPlayer()

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 500))

      // Reinitialize player
      await setupPlayer()

      recoveryAttempts.current = 0
      isRecovering.current = false

      console.log('Audio session recovery completed')
    } catch (err) {
      console.error('Recovery failed:', err)
      setIsPlaying(false)
      setIsBusy(false)
      setIsPlayerReady(false)
      hasInitialized.current = false
      isRecovering.current = false
    }
  }

  // Fetch the latest show metadata from the radiocult API and update state/metadata
  const fetchAndUpdateShowMetadata = async () => {
    try {
      const response = await fetch('https://api.radiocult.fm/api/station/eist/schedule/live')
      if (!response.ok) throw new Error('Failed to fetch show metadata')

      const data = await response.json()
      const title = data?.title || 'éist'
      const artist = data?.artist || ''
      const artworkUrl = data?.artworkUrl || undefined

      setShowTitle(title)
      setShowArtist(artist)
      setShowArtworkUrl(artworkUrl)

      await updateMetadata(title, artist, artworkUrl)
    } catch (err) {
      console.error('Failed to fetch or update show metadata:', err)
      // Fallback to previous state/metadata
      try {
        await updateMetadata(showTitle, showArtist, showArtworkUrl)
      } catch (fallbackErr) {
        console.error('Failed to update fallback metadata:', fallbackErr)
      }
    }
  }

  const play = useCallback(async () => {
    if (isBusy) {
      console.log('Play blocked: player is busy')
      return
    }
    setIsBusy(true)

    if (isWeb) {
      // Clean reset for web
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current.load()
      }

      // Create fresh audio element
      audioRef.current = new Audio(STREAM_URL)
      audioRef.current.crossOrigin = 'anonymous'

      try {
        await audioRef.current.play()
        setIsPlaying(true)
        await storeLastPlayedState(true)

        // Fetch fresh metadata after starting stream
        await fetchAndUpdateShowMetadata()
      } catch (err) {
        console.error('Web audio play failed:', err)
      } finally {
        setIsBusy(false)
      }
      return
    }

    try {
      // Ensure player is ready
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

      // Always perform clean reset before playing
      await cleanResetPlayer()

      // Fetch fresh metadata before starting playback
      await fetchAndUpdateShowMetadata()

      // Start playback with fresh stream
      await TrackPlayer.play()
      setIsPlaying(true)
      await storeLastPlayedState(true)

      console.log('Stream started successfully')
    } catch (err) {
      console.error('Play failed:', err)
      const msg = err instanceof Error ? err.message.toLowerCase() : ''

      // More specific error handling for iOS
      if (
        msg.includes('audio session') ||
        msg.includes('interrupted') ||
        msg.includes('invalid state') ||
        msg.includes('not ready') ||
        msg.includes('permission') ||
        msg.includes('unauthorized')
      ) {
        console.log('Audio session issue detected, attempting recovery...')
        
        await recoverFromAudioSessionConflict()

        // Try playing again after recovery
        try {
          console.log('Retrying playback after recovery...')
          await cleanResetPlayer()
          await fetchAndUpdateShowMetadata()
          await TrackPlayer.play()
          setIsPlaying(true)
          await storeLastPlayedState(true)
          console.log('Stream started after recovery')
        } catch (retryErr) {
          console.error('Play failed after recovery:', retryErr)
          setIsPlaying(false)
        }
      } else {
        setIsPlaying(false)
      }
    } finally {
      setIsBusy(false)
    }
  }, [isBusy, isPlayerReady, isWeb, setupPlayer, recoverFromAudioSessionConflict, cleanResetPlayer, fetchAndUpdateShowMetadata])

  const stop = useCallback(async () => {
    if (isBusy) return
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
      console.log('Stopping playback...')

      // Stop playback but preserve metadata for lock screen/CarPlay
      await TrackPlayer.stop()

      // Ensure we have a track in queue for metadata display (stopped state)
      await ensureTrackForDisplay()

      setIsPlaying(false)
      await storeLastPlayedState(false)

      console.log('Stream stopped')
    } catch (err) {
      console.error('Stop failed:', err)
      // Force stop even if there's an error
      setIsPlaying(false)
      await storeLastPlayedState(false)
    } finally {
      setIsBusy(false)
    }
  }, [isBusy, isWeb, ensureTrackForDisplay])

  const togglePlayStop = async () => {
    if (isBusy) {
      console.log('Toggle blocked: player is busy')
      return
    }

    if (isPlaying) {
      try {
        await stop()
      } catch (error) {
        console.error('Error in togglePlayStop (stop):', error)
      }
    } else {
      try {
        await play()
      } catch (error) {
        console.error('Error in togglePlayStop (play):', error)
      }
    }
  }

  const updateMetadata = async (
    title: string,
    artist: string,
    artworkUrl?: string
  ) => {
    if (!isPlayerReady || isWeb) return

    try {
      const queue = await TrackPlayer.getQueue()
      if (!queue || queue.length === 0) {
        return
      }

      const trackIndex = 0

      const isDeadAir = title.trim().length === 0
      const metadataArtist = !artist || isDeadAir ? '' : `${artist} · éist`

      // Use HTTP URL for artwork to ensure Android lock screen compatibility
      // For Android lockscreen, we need to ensure artwork is properly handled
      let artworkToUse = artworkUrl || require('../assets/images/eist-logo.png')

      if (isDeadAir) {
        const metadata = {
          title,
          artist: '',
          artwork: artworkToUse,
        }
        
        // For Android, ensure artwork is properly set
        if (Platform.OS === 'android' && artworkUrl && typeof artworkUrl === 'string' && artworkUrl.startsWith('http')) {
          metadata.artwork = artworkUrl
        }
        
        await TrackPlayer.updateMetadataForTrack(trackIndex, metadata)
      } else {
        const metadata = {
          title,
          artist: metadataArtist,
          artwork: artworkToUse,
        }
        
        // For Android, ensure artwork is properly set
        if (Platform.OS === 'android' && artworkUrl && typeof artworkUrl === 'string' && artworkUrl.startsWith('http')) {
          metadata.artwork = artworkUrl
        }
        
        await TrackPlayer.updateMetadataForTrack(trackIndex, metadata)
      }
    } catch (err) {
      console.error('Metadata update failed:', err)
    }
  }

  // Handle network connectivity changes
  useEffect(() => {
    // Skip if this is the initial load
    if (!previousNetworkState.current) {
      previousNetworkState.current = networkState
      return
    }

    const previous = previousNetworkState.current
    const current = networkState

    // Check if there's a significant network change
    const hasNetworkChanged =
      previous.isConnected !== current.isConnected ||
      previous.type !== current.type ||
      previous.isInternetReachable !== current.isInternetReachable

    if (hasNetworkChanged) {
      // If we were playing and network changed, remember it
      if (isPlayingRef.current) {
        wasPlayingBeforeNetworkChange.current = true
      }

      // If we regained connectivity and were playing before, attempt recovery
      if (current.isConnected && current.isInternetReachable && wasPlayingBeforeNetworkChange.current) {
        // Small delay to ensure network is stable
        setTimeout(async () => {
          if (wasPlayingBeforeNetworkChange.current && !isPlayingRef.current) {
            wasPlayingBeforeNetworkChange.current = false
            try {
              await play() // This will do a clean reset and start fresh
            } catch (playError) {
              console.error('Error resuming playback after network recovery:', playError)
            }
          }
        }, 2000) // 2 second delay to ensure network stability
      }

      // If we lost connectivity while playing, stop playback
      if (!current.isConnected || !current.isInternetReachable) {
        if (isPlayingRef.current) {
          try {
            stop()
          } catch (stopError) {
            console.error('Error stopping playback after network loss:', stopError)
          }
        }
      }

      previousNetworkState.current = current
    }
  }, [networkState, play, stop])

  useEffect(() => {
    setupPlayer()

    if (!isWeb) {
      const onState = TrackPlayer.addEventListener(
        Event.PlaybackState,
        async ({ state }: any) => {
          const playing = state === State.Playing
          setIsPlaying(playing)

          // Ensure metadata display is maintained when stopped
          if (state === State.Stopped) {
            try {
              await ensureTrackForDisplay()
            } catch (error) {
              console.error('Error ensuring track for display:', error)
            }
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

      const onError = TrackPlayer.addEventListener(Event.PlaybackError, async (error: any) => {
        console.error('Playback error:', error)

        if (error.message?.includes('interrupted') ||
          error.message?.includes('session') ||
          error.message?.includes('carplay') ||
          error.message?.includes('android auto') ||
          error.message?.includes('bluetooth')) {
          console.log('Audio session interruption detected, stopping playback')
          wasPlayingBeforeBackground.current = isPlayingRef.current
          try {
            await stop()
          } catch (stopError) {
            console.error('Error stopping playback after interruption:', stopError)
          }
        } else {
          setIsPlaying(false)
          setIsBusy(false)
        }
      })

      const onQueueEnded = TrackPlayer.addEventListener(
        Event.PlaybackQueueEnded,
        () => {
          console.log('Playback queue ended')
          setIsPlaying(false)
          setIsBusy(false)
        }
      )


      const onAppState = AppState.addEventListener('change', async (next) => {
        if (next === 'active') {
          // Check if we should resume playback after returning from background
          setTimeout(async () => {
            if (wasPlayingBeforeBackground.current && !isPlayingRef.current) {
              console.log('App became active, resuming playback with fresh stream')
              wasPlayingBeforeBackground.current = false
              try {
                await play() // This will do a clean reset and start fresh
              } catch (playError) {
                console.error('Error resuming playback after app became active:', playError)
              }
            }
          }, 1000)
        } else if (next === 'background' || next === 'inactive') {
          // Remember if we were playing before going to background
          wasPlayingBeforeBackground.current = isPlayingRef.current
        }
      })

      return () => {
        onState.remove()
        onError.remove()
        onQueueEnded.remove()
        onAppState.remove()
      }
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
        showTitle,
        showArtist,
        showArtworkUrl,
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