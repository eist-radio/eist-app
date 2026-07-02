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
import { useCast } from './CastContext';
import { useNetworkConnectivity } from '../hooks/useNetworkConnectivity';
import { getLockScreenImage, invalidateLockScreenImage, preloadLockScreenImage } from '../utils/androidLockScreenImage';
import { setupTrackPlayer } from '../utils/trackPlayerSetup';
import { getLiveShowInfo } from '../utils/liveShowInfo';
import { resolveIsPlaying } from '../utils/playbackUiState';

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
  play: (options?: { castOnly?: boolean }) => Promise<void>
  stop: () => Promise<void>
  togglePlayStop: () => Promise<void>
  setupPlayer: () => Promise<void>
  updateMetadata: (
    title: string,
    artist: string,
    artworkUrl?: string,
    showTime?: string
  ) => Promise<void>
  recoverAudioSession: () => Promise<void>
  forcePlayerReset: () => Promise<void>
  forceMetadataRefresh: () => Promise<void>
  showTitle: string;
  showArtist: string;
  showArtworkUrl: string | undefined;
  // Cast-related state (exposed from CastContext for convenience)
  isCastConnected: boolean;
  isCastPlaying: boolean;
  castDeviceName: string | null;
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

  // Cast context for Chromecast integration
  const {
    isCastConnected,
    isCastPlaying,
    castDeviceName,
    castPlay,
    castStop,
    updateCastMetadata,
  } = useCast()

  // Store the latest show metadata in state
  const [showTitle, setShowTitle] = useState<string>('éist');
  const [showArtist, setShowArtist] = useState<string>('');
  const [showArtworkUrl, setShowArtworkUrl] = useState<string | undefined>(undefined);
  const showTimeRef = useRef<string>('');
  // End time (ISO) of the current live show, used to schedule the next Now
  // Playing refresh for exactly when the show changes rather than guessing.
  const currentEndDateRef = useRef<string | undefined>(undefined);

  const hasInitialized = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isPlayingRef = useRef(isPlaying)
  // Mirror of isPlayerReady so mount-registered listeners / stale closures
  // (attemptStreamRestart -> play -> setupPlayer) read the LIVE readiness
  // instead of the value captured on first render. Kept in sync synchronously
  // alongside every setIsPlayerReady call below.
  const isPlayerReadyRef = useRef(isPlayerReady)
  const wasPlayingBeforeBackground = useRef(false)

  // Separate user intent tracking from actual playback state
  const userPlay = useRef(false)

  // Unified recovery state - keeps trying as long as user hasn't stopped
  const isRecovering = useRef(false);
  const retryTimeout = useRef<NodeJS.Timeout | null>(null);

  // Deadline-driven metadata refresh timer (fires just after the current show ends)
  const metadataRefreshTimer = useRef<NodeJS.Timeout | null>(null);

  // Network connectivity tracking
  const networkState = useNetworkConnectivity()
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
  // Optional metadata parameter allows passing freshly fetched metadata directly
  // (since React setState is async and state may not be updated yet)
  const cleanResetPlayer = async (metadata?: { title: string; artist: string; artworkUrl?: string }) => {
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
      // Stop current playback but don't reset queue yet
      await TrackPlayer.stop().catch(() => { })

      // Get current queue to preserve metadata
      const currentQueue = await TrackPlayer.getQueue().catch(() => [])
      const currentTrack = currentQueue[0]

      // Reset queue to clear any buffered data
      await TrackPlayer.reset().catch(() => { })

      // Small delay to ensure cleanup
      await new Promise(resolve => setTimeout(resolve, 100))

      // Use passed metadata first, then current track, then state fallbacks
      const trackTitle = metadata?.title || currentTrack?.title || showTitle || 'éist'
      const trackArtist = metadata?.artist || currentTrack?.artist || showArtist || ''
      let artwork = metadata?.artworkUrl || currentTrack?.artwork || showArtworkUrl || require('../assets/images/eist-logo.png')

      // Use the lock screen image utility for proper Android handling
      artwork = getLockScreenImage(artwork)

      const trackToAdd = {
        id: 'radio-stream-' + Date.now(), // Unique ID for fresh track
        url: STREAM_URL,
        title: trackTitle,
        artist: trackArtist,
        album: 'éist',
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

    } catch (err) {
      console.error('Clean reset failed:', err)
      throw err
    }
  }

  const stopLocalPlaybackForCast = async () => {
    if (isWeb) {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      setIsPlaying(false)
      return
    }

    try {
      await TrackPlayer.stop()
    } catch (err) {
      console.error('Failed to stop local playback for cast:', err)
    } finally {
      setIsPlaying(false)
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
        
        // Use the lock screen image utility for proper Android handling
        artwork = getLockScreenImage(artwork)
        
        const trackToAdd = {
          id: 'radio-display-' + Date.now(),
          url: STREAM_URL,
          title: showTitle || 'éist',
          artist: showArtist || '',
          album: 'éist',
          artwork: artwork,
          isLiveStream: true,
          duration: -1, // Live stream indicator
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
    if (hasInitialized.current && isPlayerReadyRef.current) {
      return
    }

    if (isWeb) {
      isPlayerReadyRef.current = true
      setIsPlayerReady(true)
      return
    }

    try {
      // Check if TrackPlayer is already initialized before calling setupTrackPlayer
      try {
        const state = await TrackPlayer.getPlaybackState()
        hasInitialized.current = true
        isPlayerReadyRef.current = true
        setIsPlayerReady(true)
        return
      } catch (checkError) {
        // TrackPlayer not initialized yet, proceed with setup
      }

      if (!hasInitialized.current) {
        // Use the best practice setup function
        await setupTrackPlayer()
        hasInitialized.current = true
      }

      isPlayerReadyRef.current = true
      setIsPlayerReady(true)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message.toLowerCase() : ''
      if (errorMsg.includes('already been initialized')) {
        hasInitialized.current = true
        isPlayerReadyRef.current = true
        setIsPlayerReady(true)
        return
      }

      console.error('Player setup failed:', err)
      hasInitialized.current = false
      isPlayerReadyRef.current = false
      setIsPlayerReady(false)
      throw err
    }
  }

  // Unified restart mechanism that uses user intent instead of current playing state
  const attemptStreamRestart = async (reason: string = 'unknown') => {
    if (isRecovering.current) return
    
    // Use userPlay instead of isPlayingRef.current
    if (!userPlay.current) {
      return
    }

    isRecovering.current = true

    // Clear any existing retry timeout
    if (retryTimeout.current) {
      clearTimeout(retryTimeout.current)
      retryTimeout.current = null
    }

    // Don't change userPlay here - just update UI state
    setIsPlaying(false)

    if (isWeb) {
      try {
        // Clean reset for web
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current.src = ''
          audioRef.current.load()
          audioRef.current = null
        }

        // Wait a moment then restart
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Check userPlay instead of isPlayingRef.current
        if (userPlay.current) {
          await play()
        }
      } catch (err) {
        console.error('Web restart failed:', err)
        scheduleRetry(reason)
      }
      isRecovering.current = false
      return
    }

    try {
      // Reset player state
      isPlayerReadyRef.current = false
      setIsPlayerReady(false)
      hasInitialized.current = false

      // Clean reset
      await cleanResetPlayer()

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Check userPlay instead of isPlayingRef.current
      if (userPlay.current) {
        await setupPlayer()
        await play()
      }
    } catch (err) {
      console.error(`Restart failed after ${reason}:`, err)
      scheduleRetry(reason)
    }
    
    isRecovering.current = false
  }

  // Schedule a retry that respects user intent
  const scheduleRetry = (reason: string) => {
    // Check userPlay instead of isPlayingRef.current
    if (!userPlay.current) return // Don't retry if user stopped

    const retryDelay = Math.min(5000 + Math.random() * 5000, 60000) // 5-10s with max 60s
    
    retryTimeout.current = setTimeout(() => {
      attemptStreamRestart(`retry-${reason}`)
    }, retryDelay)
  }

  // Fetch the latest show metadata from the radiocult API and update state/metadata
  // Returns the fetched metadata for immediate use (since setState is async)
  const fetchAndUpdateShowMetadata = async (): Promise<{ title: string; artist: string; artworkUrl?: string; showTime: string; endDateUtc?: string } | null> => {
    try {
      const liveInfo = await getLiveShowInfo()
      if (!liveInfo) {
        throw new Error('No live show info available')
      }

      const title = liveInfo.title || 'éist'
      const artist = liveInfo.djName || ''
      let artworkUrl = liveInfo.artworkUrl || undefined
      const showTime = liveInfo.showTime || ''
      const endDateUtc = liveInfo.endDateUtc

      // Check if metadata has actually changed
      const hasMetadataChanged =
        title !== showTitle ||
        artist !== showArtist ||
        artworkUrl !== showArtworkUrl ||
        showTime !== showTimeRef.current

      // For Android, invalidate previous artwork cache if URL changed
      if (Platform.OS === 'android' && showArtworkUrl && showArtworkUrl !== artworkUrl) {
        invalidateLockScreenImage(showArtworkUrl)
      }

      // For Android, ensure artwork URL is properly formatted for lock screen
      if (Platform.OS === 'android' && artworkUrl && typeof artworkUrl === 'string') {
        // Ensure the URL is accessible and properly formatted
        try {
          const artworkResponse = await fetch(artworkUrl, { method: 'HEAD' })
          if (!artworkResponse.ok) {
            // If remote artwork fails, fall back to local lock screen image
            artworkUrl = undefined
          }
        } catch (artworkError) {
          console.warn('Artwork URL validation failed, using fallback:', artworkError)
          artworkUrl = undefined
        }
      }

      setShowTitle(title)
      setShowArtist(artist)
      setShowArtworkUrl(artworkUrl)
      showTimeRef.current = showTime
      currentEndDateRef.current = endDateUtc

      // Update track metadata if it changed
      if (hasMetadataChanged) {
        // First update metadata with current state (might use fallback image for Android)
        await updateMetadata(title, artist, artworkUrl, showTime)

        // Then preload the lock screen image for Android and update metadata again if successful
        if (Platform.OS === 'android' && artworkUrl) {
          const imagePreloaded = await preloadLockScreenImage(artworkUrl)
          if (imagePreloaded) {
            // Update metadata again with the validated artwork
            await updateMetadata(title, artist, artworkUrl, showTime)
          }
        }

      }

      // Return the metadata for immediate use
      return { title, artist, artworkUrl, showTime, endDateUtc }
    } catch (err) {
      console.error('Failed to fetch or update show metadata:', err)
      // Fallback to previous state/metadata
      try {
        await updateMetadata(showTitle, showArtist, showArtworkUrl, showTimeRef.current)
      } catch (fallbackErr) {
        console.error('Failed to update fallback metadata:', fallbackErr)
      }
      return null
    }
  }

  const play = useCallback(async (options?: { castOnly?: boolean }) => {
    // Set user intent first
    userPlay.current = true
    const castOnly = options?.castOnly === true

    // Check if casting - either via state or by checking for active session
    let shouldCast = isCastConnected

    // Double-check for active cast session in case state hasn't updated yet
    if (!shouldCast && Platform.OS !== 'web') {
      try {
        const GoogleCast = require('react-native-google-cast').default
        const sessionManager = GoogleCast.getSessionManager()
        const session = await sessionManager.getCurrentCastSession()
        if (session) {
          shouldCast = true
        }
      } catch (e) {
        // Ignore errors - just means no cast session
      }
    }

    // If casting, route playback to cast device instead of local
    if (shouldCast) {
      try {
        await stopLocalPlaybackForCast()
        let castTitle = showTitle || 'éist'
        let castArtist = showArtist || ''
        let castArtwork = showArtworkUrl
        let castShowTime = showTimeRef.current

        try {
          const liveInfo = await getLiveShowInfo()
          if (liveInfo) {
            castTitle = liveInfo.title || castTitle
            castArtist = liveInfo.djName || castArtist
            castArtwork = liveInfo.artworkUrl || castArtwork
            castShowTime = liveInfo.showTime || castShowTime

            setShowTitle(castTitle)
            setShowArtist(castArtist)
            setShowArtworkUrl(castArtwork)
            if (castShowTime) {
              showTimeRef.current = castShowTime
            }
          }
        } catch (liveErr) {
          console.warn('Failed to prefetch live show info for cast:', liveErr)
        }

        const castSuccess = await castPlay(
          castTitle,
          castArtist,
          castArtwork,
          castShowTime
        )
        if (castSuccess) {
          setIsPlaying(true)
          await storeLastPlayedState(true)
          return
        }
        if (castOnly) {
          setIsPlaying(false)
          await storeLastPlayedState(false)
          return
        }
        // Fall through to local playback
      } catch (err) {
        console.error('Cast play failed, falling back to local:', err)
        // Fall through to local playback
      }
    }

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
      }
      return
    }

    try {
      // Ensure player is ready. Read readiness from the ref (not the captured
      // isPlayerReady state) so recovery paths driven by mount-registered
      // listeners see the live value and actually reach TrackPlayer.play().
      if (!isPlayerReadyRef.current) {
        await setupPlayer()
        if (!isPlayerReadyRef.current) {
          await attemptStreamRestart('player-not-ready')
          return
        }
      }

      // Fetch fresh metadata FIRST and pass directly to cleanResetPlayer
      // (React setState is async so state won't be updated yet)
      const metadata = await fetchAndUpdateShowMetadata()

      // Now perform clean reset with fresh metadata passed directly
      await cleanResetPlayer(metadata || undefined)

      // Start playback with muted volume to allow buffering without glitch
      await TrackPlayer.setVolume(0)
      await TrackPlayer.play()
      setIsPlaying(true)
      await storeLastPlayedState(true)
      
      // Wait 2 seconds for proper buffering to avoid startup glitch
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Gradually restore volume to avoid jarring audio start
      await TrackPlayer.setVolume(1)

    } catch (err) {
      console.error('Play failed:', err)
      
      // Ensure volume is restored even if play fails
      try {
        await TrackPlayer.setVolume(1)
      } catch (volumeErr) {
        console.error('Failed to restore volume after play error:', volumeErr)
      }
      
      const msg = err instanceof Error ? err.message.toLowerCase() : ''

      // Use unified restart for all play errors
      await attemptStreamRestart('play-error')
    }
  }, [isPlayerReady, isWeb, setupPlayer, attemptStreamRestart, cleanResetPlayer, fetchAndUpdateShowMetadata, isCastConnected, castPlay, showTitle, showArtist, showArtworkUrl])

  const stop = useCallback(async () => {
    // Clear user intent when manually stopping
    userPlay.current = false

    // Clear any pending retry attempts when user manually stops
    if (retryTimeout.current) {
      clearTimeout(retryTimeout.current)
      retryTimeout.current = null
    }

    // If casting, stop cast playback
    if (isCastConnected || isCastPlaying) {
      try {
        await castStop()
      } catch (err) {
        console.error('Cast stop failed:', err)
      }
    }

    if (isWeb) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current.load()
        audioRef.current = null
      }
      setIsPlaying(false)
      await storeLastPlayedState(false)
      return
    }

    try {

      // Stop playback but preserve metadata for lock screen/CarPlay
      await TrackPlayer.stop()

      // Ensure we have a track in queue for metadata display (stopped state)
      await ensureTrackForDisplay()

      setIsPlaying(false)
      await storeLastPlayedState(false)

    } catch (err) {
      console.error('Stop failed:', err)
      // Force stop even if there's an error
      setIsPlaying(false)
      await storeLastPlayedState(false)
    }
  }, [isWeb, ensureTrackForDisplay, isCastConnected, isCastPlaying, castStop])

  const togglePlayStop = async () => {
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
    artworkUrl?: string,
    showTime?: string
  ) => {
    if (showTime !== undefined) {
      showTimeRef.current = showTime
    }
    const resolvedShowTime = showTime ?? showTimeRef.current

    // Also update cast metadata if casting
    if (isCastConnected || isCastPlaying) {
      try {
        await updateCastMetadata(title, artist, artworkUrl, resolvedShowTime)
      } catch (err) {
        console.error('Failed to update cast metadata:', err)
      }
    }

    if (!isPlayerReady || isWeb) return

    try {
      const queue = await TrackPlayer.getQueue()
      if (!queue || queue.length === 0) {
        return
      }

      // Resolve the live track index instead of assuming 0. The queue can be
      // reset between getQueue() and updateMetadataForTrack() (stream restarts,
      // cleanResetPlayer), so derive the active index and bounds-check it to
      // avoid "The track index is out of bounds".
      const activeIndex = await TrackPlayer.getActiveTrackIndex().catch(() => undefined)
      const trackIndex = typeof activeIndex === 'number' ? activeIndex : 0
      if (trackIndex < 0 || trackIndex >= queue.length) {
        return
      }

      const isDeadAir = title.trim().length === 0

      // Use appropriate artwork for Android lock screen and Android Auto compatibility
      let artworkToUse = artworkUrl || require('../assets/images/eist-logo.png')

      // Use the lock screen image utility for proper Android handling
      artworkToUse = getLockScreenImage(artworkToUse)

      const metadata = {
        title,
        artist: isDeadAir ? '' : (artist || ''),
        album: 'éist',
        artwork: artworkToUse,
        // Enhanced metadata for Android Auto and car OS compatibility
        duration: -1, // Live stream indicator
        genre: 'Radio',
        date: new Date().toISOString(),
        // Additional Android Auto-specific metadata
        isLiveStream: true,
        description: 'éist · live',
        // Force metadata refresh for Android Auto
        _metadata_refresh: Date.now(),
      }
      await TrackPlayer.updateMetadataForTrack(trackIndex, metadata)
    } catch (err) {
      console.error('Metadata update failed:', err)
    }
  }

  // Handle network connectivity changes with proper user intent checking
  useEffect(() => {
    if (!previousNetworkState.current) {
      previousNetworkState.current = networkState
      return
    }

    const previous = previousNetworkState.current
    const current = networkState

    // Auto-restart when network comes back online OR when switching network types
    const shouldRestart = (
      // Network reconnection (disconnected -> connected)
      (!previous.isConnected && current.isConnected) ||
      // Network type change while connected (wifi <-> cellular)
      (previous.isConnected && current.isConnected && previous.type !== current.type) ||
      // Network disconnection while playing (to trigger retry when reconnected)
      (previous.isConnected && !current.isConnected && userPlay.current)
    )

    // Check userPlay instead of isPlaying to handle network disconnection cases
    if (shouldRestart && userPlay.current) {
      
      setTimeout(async () => {
        await attemptStreamRestart(`network-change-${previous.type}-to-${current.type}`)
      }, 2000) // 2 second delay for network stability
    }

    previousNetworkState.current = current
  }, [networkState, attemptStreamRestart, isPlaying]) // Keep isPlaying in deps for logging

  useEffect(() => {
    setupPlayer()

    if (!isWeb) {
      // Seed the Now Playing item at cold launch so CarPlay / the lock screen
      // show the current show and expose a working play control before the
      // phone UI is ever opened. Without this the CarPlay CPNowPlayingTemplate
      // is empty (no metadata, no play target) until the user presses play in
      // the app, which they can't do from the car. ensureTrackForDisplay adds a
      // stopped-state track and fetchAndUpdateShowMetadata populates it.
      ;(async () => {
        try {
          await setupPlayer()
          await ensureTrackForDisplay()
          await fetchAndUpdateShowMetadata()
        } catch (error) {
          console.error('Initial now-playing seed failed:', error)
        }
      })()

      const onState = TrackPlayer.addEventListener(
        Event.PlaybackState,
        async ({ state }: any) => {
          const wasPlaying = isPlayingRef.current
          // Reflect the listening session, not the instantaneous decoder state.
          // RNTP passes through Loading/Buffering/Ready on startup and every
          // mid-stream rebuffer; mapping those to "stopped" flickers the button
          // Stop→Listen→Stop right after play(). Hold steady through them while
          // the user intends to play. See utils/playbackUiState.
          const playing = resolveIsPlaying(state, userPlay.current)
          setIsPlaying(playing)

          // Only clear user intent if the stop was intentional (not due to network/error)
          if (state === State.Stopped && !isRecovering.current) {
            // This was likely an intentional stop, not a network error
            // But don't clear userPlay here as it might be a temporary stop
          }

          // Refresh metadata when starting playback (especially from lock screen)
          if (state === State.Playing && !wasPlaying) {
            try {
              await fetchAndUpdateShowMetadata()
            } catch (error) {
              console.error('Error refreshing metadata on play start:', error)
            }
          }

          // Ensure metadata display is maintained when stopped
          if (state === State.Stopped) {
            try {
              await ensureTrackForDisplay()
            } catch (error) {
              console.error('Error ensuring track for display:', error)
            }
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
          wasPlayingBeforeBackground.current = isPlayingRef.current
          try {
            await stop()
          } catch (stopError) {
            console.error('Error stopping playback after interruption:', stopError)
          }
        } else {
          // Use unified restart for all other playback errors
          await attemptStreamRestart('playback-error')
        }
      })

      const onQueueEnded = TrackPlayer.addEventListener(
        Event.PlaybackQueueEnded,
        async () => {
          // Use userPlay instead of isPlayingRef.current
          if (userPlay.current) {
            await attemptStreamRestart('queue-ended')
          } else {
            setIsPlaying(false)
          }
        }
      )

      const onAppState = AppState.addEventListener('change', async (next) => {
        if (next === 'active') {
          // Check if we should resume playback after returning from background
          setTimeout(async () => {
            if (wasPlayingBeforeBackground.current && !isPlayingRef.current) {
              wasPlayingBeforeBackground.current = false
              // Set user intent before attempting restart
              userPlay.current = true
              await attemptStreamRestart('app-foregrounded')
            }
          }, 1000)
        } else if (next === 'background' || next === 'inactive') {
          // Remember if we were playing before going to background
          wasPlayingBeforeBackground.current = isPlayingRef.current
        }
      })

      // Now Playing refresh while playing is scheduled deadline-driven in a
      // dedicated effect below (keyed on isPlaying), off the current show's
      // actual end time rather than a wall-clock guess.

      return () => {
        onState.remove()
        onError.remove()
        onQueueEnded.remove()
        onAppState.remove()
        
        // Clear retry timeout
        if (retryTimeout.current) {
          clearTimeout(retryTimeout.current)
          retryTimeout.current = null
        }
      }
    }
  }, [])

  // Deadline-driven Now Playing refresh. CarPlay's CPNowPlayingTemplate (and the
  // lock screen / Android Auto) mirror MPNowPlayingInfoCenter, which only
  // changes when we rewrite RNTP metadata. Rather than guessing when the show
  // changes, we schedule the next refresh for the moment the CURRENT show ends —
  // a timestamp the live API already gives us (endDateUtc) — then re-arm off the
  // next show's end time. This stays correct for any show length or start
  // minute. The loop lives exactly as long as playback: background audio keeps
  // the JS run loop alive so it fires in the car with the phone backgrounded,
  // and it's torn down on stop (a fresh fetch runs on the next play — see play()
  // and the PlaybackState → Playing handler).
  useEffect(() => {
    if (isWeb || !isPlaying) return

    // Fire just after the show ends so the backend schedule has rolled over.
    const BUFFER_MS = 20_000
    // Never sooner than the live-info cache TTL, so each refetch returns fresh
    // data and we don't busy-loop when a deadline is already in the past.
    const MIN_MS = 60_000
    // Safety cap so a missing/erroneous end time still refreshes eventually.
    const MAX_MS = 60 * 60_000

    let cancelled = false

    const armFor = (endDateUtc?: string) => {
      let delay = MAX_MS
      if (endDateUtc) {
        const end = new Date(endDateUtc).getTime()
        if (!Number.isNaN(end)) {
          delay = end + BUFFER_MS - Date.now()
        }
      }
      delay = Math.min(MAX_MS, Math.max(MIN_MS, delay))

      metadataRefreshTimer.current = setTimeout(async () => {
        if (cancelled) return
        let nextEnd: string | undefined
        try {
          const meta = await fetchAndUpdateShowMetadata()
          nextEnd = meta?.endDateUtc
        } catch (error) {
          console.error('Scheduled metadata refresh failed:', error)
        }
        if (!cancelled) armFor(nextEnd)
      }, delay)
    }

    // Align the first refresh to the show that's already playing.
    armFor(currentEndDateRef.current)

    return () => {
      cancelled = true
      if (metadataRefreshTimer.current) {
        clearTimeout(metadataRefreshTimer.current)
        metadataRefreshTimer.current = null
      }
    }
  }, [isPlaying, isWeb])

  const forceMetadataRefresh = async () => {
    try {
      await fetchAndUpdateShowMetadata()
    } catch (error) {
      console.error('Force metadata refresh failed:', error)
    }
  }

  // Sync isPlaying state with cast playing state
  useEffect(() => {
    if (isCastConnected && isCastPlaying && !isPlaying) {
      setIsPlaying(true)
    } else if (isCastConnected && !isCastPlaying && isPlaying && userPlay.current) {
      // Cast stopped but user wanted to play - might need to resume locally
      // For now just sync state; user can press play again
      setIsPlaying(false)
    }
  }, [isCastConnected, isCastPlaying, isPlaying])

  // Handle cast disconnection - resume local playback if user was playing
  const previousCastConnected = useRef(isCastConnected)
  useEffect(() => {
    const wasConnected = previousCastConnected.current

    if (!wasConnected && isCastConnected && !isCastPlaying) {
      const castOnly = !userPlay.current && !isPlayingRef.current
      ;(async () => {
        try {
          await play({ castOnly })
        } catch (err) {
          console.error('Failed to start cast playback after connect:', err)
        }
      })()
    }

    if (wasConnected && !isCastConnected && userPlay.current) {
      // Cast disconnected while user wanted to play - resume locally
      // Small delay to let cast session fully end
      setTimeout(async () => {
        if (userPlay.current && !isPlayingRef.current) {
          try {
            await play()
          } catch (err) {
            console.error('Failed to resume local playback after cast disconnect:', err)
          }
        }
      }, 1000)
    }
    previousCastConnected.current = isCastConnected
  }, [isCastConnected, isCastPlaying, play])

  return (
    <TrackPlayerContext.Provider
      value={{
        isPlaying: isPlaying || isCastPlaying,
        isPlayerReady,
        play,
        stop,
        togglePlayStop,
        setupPlayer,
        updateMetadata,
        recoverAudioSession: attemptStreamRestart,
        forcePlayerReset: attemptStreamRestart,
        forceMetadataRefresh,
        showTitle,
        showArtist,
        showArtworkUrl,
        isCastConnected,
        isCastPlaying,
        castDeviceName,
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
