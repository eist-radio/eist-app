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
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { useCast } from './CastContext';
import { useNetworkConnectivity } from '../hooks/useNetworkConnectivity';
import { getLockScreenImage, invalidateLockScreenImage, preloadLockScreenImage } from '../utils/androidLockScreenImage';
import { shouldStartPlaybackForCarPlay } from '../utils/carPlayPlayRequest';
import {
  ensurePlayerSetup,
  isPlayerResponsive,
  probePlaybackState,
  resetPlayerSetup,
} from '../utils/ensurePlayerSetup';
import { getLiveShowInfo } from '../utils/liveShowInfo';
import {
  endStreamRebuild,
  isRebuildingStream,
  markStreamRebuild,
  playIntent,
  STREAM_REBUILD_HOLD_MS,
} from '../utils/playIntent';
import { resolveIsPlaying } from '../utils/playbackUiState';
import { withTimeout } from '../utils/withTimeout';
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

// Grace period after a network change before checking the stream. ExoPlayer usually recovers a handover by itself.
const NETWORK_RECOVERY_GRACE_MS = 8000

// Ceiling on one recovery attempt (setupPlayer + play), so a hung native promise can't latch isRecovering.
const RECOVERY_TIMEOUT_MS = 30000

// States the post-network-change check leaves alone (playing, or still healing).
const HEALTHY_OR_HEALING_STATES = new Set(['playing', 'buffering', 'loading'])

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
  const lastMetadataRef = useRef<string>('')
  // Separate success key for the cast target so a failed/deferred local (RNTP)
  // update never marks cast as done and vice versa. See updateMetadata.
  const lastCastMetadataRef = useRef<string>('')
  const isPlayingRef = useRef(isPlaying)
  // Live mirror of isPlayerReady for mount-registered listeners and stale closures.
  const isPlayerReadyRef = useRef(isPlayerReady)

  // User intent to play, shared with the playback service. See utils/playIntent.ts.
  const userPlay = playIntent

  // Stable ref for play() so the CarPlay bridge listener never re-subscribes
  const playRef = useRef<(options?: { castOnly?: boolean }) => Promise<void>>(async () => {})

  // True while a CarPlay-initiated play is running, to drop duplicate requests. See utils/carPlayPlayRequest.ts.
  const carPlayPlayInFlight = useRef(false)

  // Live cast state for the CarPlay listener. play() while casting reloads the cast media.
  const isCastPlayingRef = useRef(isCastPlaying)
  useEffect(() => { isCastPlayingRef.current = isCastPlaying }, [isCastPlaying])

  // Unified recovery state - keeps trying as long as user hasn't stopped
  const isRecovering = useRef(false);
  // Bumped by every restart and user stop. A stale or timed-out recovery checks it before calling play().
  const restartSession = useRef(0);
  const retryTimeout = useRef<NodeJS.Timeout | null>(null);
  // Deferred post-network-change check. Held in a ref so NetInfo churn during a
  // handover replaces the pending check instead of queueing several racing ones.
  const networkCheckTimer = useRef<NodeJS.Timeout | null>(null);

  // Re-reads the player when a rebuild's hold expires without reaching an active state.
  const rebuildCheckTimer = useRef<NodeJS.Timeout | null>(null);

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

  // Rebuild the stream track, keeping the current metadata. Pass fresh metadata to skip stale state.
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

    markStreamRebuild()
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

  // Stop for good. Android pauses instead, because stop() drops the foreground service and breaks Android Auto.
  const stopLocalPlayer = () =>
    Platform.OS === 'android' ? TrackPlayer.pause() : TrackPlayer.stop()

  const stopLocalPlaybackForCast = async () => {
    if (isWeb) {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      setIsPlaying(false)
      return
    }

    try {
      await stopLocalPlayer()
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
      // Already set up and answering?
      if (await isPlayerResponsive()) {
        hasInitialized.current = true
        isPlayerReadyRef.current = true
        setIsPlayerReady(true)
        return
      }

      // No answer: the MusicService may have died under a live runtime, so drop the stale setup memo.
      resetPlayerSetup()

      // Shared, memoised setup so the UI and the playback service can't double-initialise.
      await ensurePlayerSetup()
      hasInitialized.current = true

      isPlayerReadyRef.current = true
      setIsPlayerReady(true)
    } catch (err) {
      // ensurePlayerSetup already handles "already initialized", so any error here means the player is unusable.
      console.error('Player setup failed:', err)
      hasInitialized.current = false
      isPlayerReadyRef.current = false
      setIsPlayerReady(false)
      throw err
    }
  }

  // Unified restart mechanism that uses user intent instead of current playing state
  const attemptStreamRestart = async (reason: string = 'unknown') => {
    if (isRecovering.current) {
      return
    }

    // Use userPlay instead of isPlayingRef.current
    if (!userPlay.current) {
      return
    }
    isRecovering.current = true
    const session = ++restartSession.current
    const stillCurrent = () => userPlay.current && restartSession.current === session

    // Clear any existing retry timeout
    if (retryTimeout.current) {
      clearTimeout(retryTimeout.current)
      retryTimeout.current = null
    }

    // Keep isPlaying as is: the button reflects the session, not recovery churn.

    // isRecovering gates every recovery path. The timeout guards hung awaits, the finally covers normal exits.
    try {
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

          if (stillCurrent()) {
            await play()
          }
        } catch (err) {
          console.error('Web restart failed:', err)
          scheduleRetry(reason)
        }
        return
      }

      try {
        // Reset player state
        isPlayerReadyRef.current = false
        setIsPlayerReady(false)
        hasInitialized.current = false

        // No cleanResetPlayer() here: play() does one, and doing it twice doubled the teardowns.

        if (stillCurrent()) {
          await withTimeout(
            (async () => {
              await setupPlayer()
              // Setup can take up to 12s. The user may have pressed Stop, or
              // the timeout may have handed over to a retry, in the meantime.
              if (!stillCurrent()) return
              await play()
            })(),
            RECOVERY_TIMEOUT_MS,
            `restart(${reason})`
          )
        }
      } catch (err) {
        // Timeout or failure. stillCurrent() stops the abandoned attempt from calling play() later.
        console.error(`Restart failed after ${reason}:`, err)
        scheduleRetry(reason)
      }
    } finally {
      isRecovering.current = false
    }
  }

  // Schedule a retry that respects user intent
  const scheduleRetry = (reason: string) => {
    // Check userPlay instead of isPlayingRef.current
    if (!userPlay.current) {
      return // Don't retry if user stopped
    }

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
      // Read readiness from the ref so recovery paths see the live value. setupPlayer() throws on failure.
      if (!isPlayerReadyRef.current) {
        await setupPlayer()
      }

      // Start with existing metadata so car controls go live at once. Fresh metadata follows.
      await cleanResetPlayer()

      await TrackPlayer.setVolume(0)
      await TrackPlayer.play()
      setIsPlaying(true)
      await storeLastPlayedState(true)

      // Now fetch fresh metadata and update (non-blocking for playback)
      fetchAndUpdateShowMetadata().catch((err) =>
        console.warn('Post-play metadata fetch failed:', err)
      )

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

      // Inside attemptStreamRestart, rethrow so its catch schedules the retry.
      if (isRecovering.current) {
        throw err
      }

      // Use unified restart for all play errors
      await attemptStreamRestart('play-error')
    }
  }, [isPlayerReady, isWeb, setupPlayer, attemptStreamRestart, cleanResetPlayer, fetchAndUpdateShowMetadata, isCastConnected, castPlay, showTitle, showArtist, showArtworkUrl])

  useEffect(() => { playRef.current = play }, [play])

  const stop = useCallback(async () => {
    // Clear user intent when manually stopping, and invalidate any recovery
    // attempt still running so it cannot restart the stream.
    userPlay.current = false
    restartSession.current++

    // Clear any pending retry attempts when user manually stops
    if (retryTimeout.current) {
      clearTimeout(retryTimeout.current)
      retryTimeout.current = null
    }

    // ...and any pending post-network-change check, so it cannot resurrect
    // playback the user has deliberately stopped.
    if (networkCheckTimer.current) {
      clearTimeout(networkCheckTimer.current)
      networkCheckTimer.current = null
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
      await stopLocalPlayer()

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

    const key = `${title}\0${artist}\0${artworkUrl ?? ''}\0${resolvedShowTime}`

    // Also update cast metadata if casting. Dedup on its own success key so it
    // records only after a successful cast update, independent of the local one.
    if (isCastConnected || isCastPlaying) {
      if (key !== lastCastMetadataRef.current) {
        try {
          // Record the key only on success, so one failure doesn't block retries.
          const castOk = await updateCastMetadata(title, artist, artworkUrl, resolvedShowTime)
          if (castOk) {
            lastCastMetadataRef.current = key
          }
        } catch (err) {
          console.error('Failed to update cast metadata:', err)
        }
      }
    }

    // Read readiness from the ref. The dedup key is only recorded after a successful update.
    if (!isPlayerReadyRef.current || isWeb) return

    // Dedup on the resolved artwork, so Android's fallback-then-real artwork pass still goes through.
    const isDeadAir = title.trim().length === 0
    let artworkToUse = artworkUrl || require('../assets/images/eist-logo.png')
    artworkToUse = getLockScreenImage(artworkToUse)
    try {
      const queue = await TrackPlayer.getQueue()
      if (!queue || queue.length === 0) {
        return
      }

      // Use the active index, bounds-checked. The queue can change between calls.
      const activeIndex = await TrackPlayer.getActiveTrackIndex().catch(() => undefined)
      const trackIndex = typeof activeIndex === 'number' ? activeIndex : 0
      if (trackIndex < 0 || trackIndex >= queue.length) {
        return
      }

      // Include the track id, so a rebuilt track always gets real metadata.
      const localKey = `${queue[trackIndex]?.id}\0${title}\0${artist}\0${String(artworkToUse)}\0${resolvedShowTime}`
      if (localKey === lastMetadataRef.current) return

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
      lastMetadataRef.current = localKey
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
      // A network change triggers a check, not a restart. One pending check at a time.
      if (networkCheckTimer.current) {
        clearTimeout(networkCheckTimer.current)
      }

      networkCheckTimer.current = setTimeout(async () => {
        networkCheckTimer.current = null

        if (!userPlay.current) {
          return
        }

        // Leave it if playing or healing. No answer means restart. Web checks the audio element.
        if (isWeb) {
          if (audioRef.current && !audioRef.current.paused) {
            return
          }
        } else {
          const state = await probePlaybackState()
          if (state !== null && HEALTHY_OR_HEALING_STATES.has(state)) {
            return
          }
        }

        await attemptStreamRestart(`network-change-${previous.type}-to-${current.type}`)
      }, NETWORK_RECOVERY_GRACE_MS)
    }

    previousNetworkState.current = current
  }, [networkState, attemptStreamRestart, isPlaying]) // Keep isPlaying in deps for logging

  // CarPlay play requests (scene connect or list-item tap) from EistCarPlayBridge. Scene re-activation doesn't play.
  // Now Playing can't cold-start audio, so the native side asks JS to run play().
  useEffect(() => {
    if (isWeb || Platform.OS !== 'ios') return
    const bridge = NativeModules.EistCarPlayBridge
    if (!bridge) return

    // Decide from the player's real state, not the sticky UI flag. See utils/carPlayPlayRequest.ts.
    const handleCarPlayPlayRequest = async () => {
      // Not while a cast device is playing: play() would reload its media.
      if (isCastPlayingRef.current) {
        return
      }

      // Claim the latch before any await. Only the claimer releases it.
      const requestInFlight = carPlayPlayInFlight.current
      if (requestInFlight) {
        // Duplicate request: return without touching the latch.
        return
      }
      carPlayPlayInFlight.current = true

      try {
        // No answer counts as not playing. play() runs setupPlayer(), which revives a dead service.
        const state = await probePlaybackState()

        if (!shouldStartPlaybackForCarPlay({ state, requestInFlight })) {
          return
        }

        // Bounded so a play() stuck on a native promise or a stalled JS timer
        // releases the latch instead of holding it for the life of the runtime.
        await withTimeout(playRef.current(), RECOVERY_TIMEOUT_MS, 'carplay-play')
      } catch (error: unknown) {
        console.error('CarPlay play request failed:', error)
      } finally {
        carPlayPlayInFlight.current = false
      }
    }

    const emitter = new NativeEventEmitter(bridge)
    const sub = emitter.addListener('EistCarPlayPlay', () => {
      void handleCarPlayPlayRequest()
    })
    return () => sub.remove()
  }, [isWeb])

  useEffect(() => {
    setupPlayer()

    if (!isWeb) {
      // Seed Now Playing at launch so CarPlay and the lock screen have metadata and a play target.
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
          // Show the listening session, not decoder churn. See utils/playbackUiState.ts.
          const rebuilding = isRebuildingStream()
          const playing = resolveIsPlaying(state, userPlay.current, rebuilding)
          setIsPlaying(playing)

          if (state === State.Playing || state === State.Buffering || state === State.Loading) {
            endStreamRebuild()
          } else if (rebuilding && (state === State.Stopped || state === State.None)) {
            if (rebuildCheckTimer.current) clearTimeout(rebuildCheckTimer.current)
            rebuildCheckTimer.current = setTimeout(async () => {
              rebuildCheckTimer.current = null
              const current = await probePlaybackState()
              if (current !== null) {
                setIsPlaying(resolveIsPlaying(current, userPlay.current, isRebuildingStream()))
              }
            }, STREAM_REBUILD_HOLD_MS + 100)
          }

          // Refresh metadata when starting playback (especially from lock screen)
          if (state === State.Playing && !wasPlaying) {
            try {
              await fetchAndUpdateShowMetadata()
            } catch (error) {
              console.error('Error refreshing metadata on play start:', error)
            }
          }

          // Ensure metadata display is maintained when stopped. Not mid-rebuild:
          // the rebuild is about to add its own track.
          if (state === State.Stopped && !rebuilding) {
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

      // No resume on foreground: the listener presses play. Auto-resume stole audio from other apps.


      return () => {
        onState.remove()
        onError.remove()
        onQueueEnded.remove()
        
        // Clear retry timeout
        if (retryTimeout.current) {
          clearTimeout(retryTimeout.current)
          retryTimeout.current = null
        }

        // Clear pending post-network-change check
        if (networkCheckTimer.current) {
          clearTimeout(networkCheckTimer.current)
          networkCheckTimer.current = null
        }

        if (rebuildCheckTimer.current) {
          clearTimeout(rebuildCheckTimer.current)
          rebuildCheckTimer.current = null
        }
      }
    }
  }, [])

  // Refresh Now Playing just after the current show ends (endDateUtc), then re-arm. Runs only while playing.
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
