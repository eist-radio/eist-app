// context/CastContext.tsx

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { AppState, Platform } from 'react-native'
import {
  loadMediaOnCast,
  updateCastMediaMetadata,
  castStop as castStopUtil,
} from '../utils/castUtils'

// Only import google-cast on mobile platforms
let GoogleCast: any

if (Platform.OS !== 'web') {
  try {
    GoogleCast = require('react-native-google-cast').default
  } catch (error) {
    console.warn('react-native-google-cast not available:', error)
  }
}

// CastState string values from react-native-google-cast
const CAST_STATE = {
  NO_DEVICES_AVAILABLE: 'noDevicesAvailable',
  NOT_CONNECTED: 'notConnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
}

// A cast media status is "playing" for our purposes while it is actively
// playing or buffering (buffering resolves to playing without user action).
const isPlayingStatus = (status: any): boolean =>
  status?.playerState === 'playing' || status?.playerState === 'buffering'

export type CastSessionState =
  | 'no_devices'
  | 'not_connected'
  | 'connecting'
  | 'connected'

export type CastContextType = {
  isCastAvailable: boolean
  isCastConnected: boolean
  castDeviceName: string | null
  castSessionState: CastSessionState
  isCastPlaying: boolean
  castPlay: (title: string, artist: string, artworkUrl?: string, showTime?: string) => Promise<boolean>
  castStop: () => Promise<void>
  updateCastMetadata: (
    title: string,
    artist: string,
    artworkUrl?: string,
    showTime?: string
  ) => Promise<void>
}

const CastContextValue = createContext<CastContextType | undefined>(undefined)

// Default disabled cast context for web or when cast is unavailable
const disabledCastContext: CastContextType = {
  isCastAvailable: false,
  isCastConnected: false,
  castDeviceName: null,
  castSessionState: 'no_devices',
  isCastPlaying: false,
  castPlay: async () => false,
  castStop: async () => {},
  updateCastMetadata: async () => {},
}

export const CastProvider = ({ children }: { children: ReactNode }) => {
  const isWeb = Platform.OS === 'web'
  const [castState, setCastState] = useState<string | null>(null)
  const [castDeviceName, setCastDeviceName] = useState<string | null>(null)
  const [isCastPlaying, setIsCastPlaying] = useState(false)

  // Track metadata for when cast connects
  const currentMetadata = useRef<{
    title: string
    artist: string
    artworkUrl?: string
    showTime?: string
  }>({
    title: 'éist',
    artist: '',
  })

  // Pending cast-state resync timers scheduled on foreground return (see below).
  const resyncTimeouts = useRef<NodeJS.Timeout[]>([])

  // Initialize cast and set up listeners
  useEffect(() => {
    if (isWeb || !GoogleCast) {
      return
    }

    let castStateSubscription: any
    let sessionStartedSubscription: any
    let sessionResumedSubscription: any
    let sessionEndedSubscription: any
    let appStateSubscription: any

    // Re-read the authoritative cast state from the SDK and reconcile our
    // React state with it. Cheap native call; setState bails out when the
    // value is unchanged, so polling this does not cause needless re-renders.
    const syncCastState = async () => {
      try {
        const currentState = await GoogleCast.getCastState()
        setCastState(currentState)

        if (currentState === CAST_STATE.CONNECTED) {
          // Make sure the device name AND play state reflect the live session.
          // Both can be lost if the onSessionStarted / onSessionResumed and
          // onMediaStatusUpdated events were missed while JS was suspended in
          // the background.
          try {
            const sessionManager = GoogleCast.getSessionManager()
            const session = await sessionManager.getCurrentCastSession()
            if (session) {
              const device = await session.getCastDevice()
              setCastDeviceName(device?.friendlyName || 'Cast Device')

              try {
                const client = session.getClient()
                const status = await client?.getMediaStatus()
                setIsCastPlaying(isPlayingStatus(status))
              } catch {
                // Client not ready yet — the media-status effect will catch up.
              }
            }
          } catch (e) {
            // Session not ready yet — leave the existing name in place.
          }
        }
      } catch (error) {
        // Silently ignore transient SDK errors; next poll will retry.
      }
    }

    const initializeCast = async () => {
      try {
        // Get initial cast state
        await syncCastState()

        // Listen for cast state changes
        castStateSubscription = GoogleCast.onCastStateChanged((state: string) => {
          setCastState(state)
        })

        // Listen for session events via session manager. A session becomes
        // active either freshly (onSessionStarted) or by being resumed after
        // the app was backgrounded/suspended or relaunched (onSessionResumed).
        // iOS delivers the return-from-background case as a *resume*, not a
        // fresh start, so both must be handled or the device name / play state
        // never comes back when the app returns.
        const sessionManager = GoogleCast.getSessionManager()

        const handleSessionActive = async (session: any) => {
          try {
            const device = await session.getCastDevice()
            setCastDeviceName(device?.friendlyName || 'Cast Device')
          } catch (e) {
            setCastDeviceName('Cast Device')
          }
          // Reconcile derived state (button tint) and play state with the
          // now-active session.
          syncCastState()
        }

        sessionStartedSubscription = sessionManager.onSessionStarted(handleSessionActive)
        sessionResumedSubscription = sessionManager.onSessionResumed(handleSessionActive)

        sessionEndedSubscription = sessionManager.onSessionEnded(() => {
          setCastDeviceName(null)
          setIsCastPlaying(false)
        })

        // Resync whenever the app returns to the foreground. onCastStateChanged
        // events that fire while JS is suspended are dropped, and getCastState()
        // can be briefly stale right as iOS wakes the app, so resync immediately
        // and retry a couple of times to settle on the true session state.
        appStateSubscription = AppState.addEventListener('change', (next) => {
          if (next === 'active') {
            syncCastState()
            resyncTimeouts.current.forEach(clearTimeout)
            resyncTimeouts.current = [
              setTimeout(syncCastState, 600),
              setTimeout(syncCastState, 1500),
            ]
          }
        })
      } catch (error) {
        console.error('Failed to initialize cast:', error)
      }
    }

    initializeCast()

    return () => {
      castStateSubscription?.remove?.()
      sessionStartedSubscription?.remove?.()
      sessionResumedSubscription?.remove?.()
      sessionEndedSubscription?.remove?.()
      appStateSubscription?.remove?.()
      resyncTimeouts.current.forEach(clearTimeout)
      resyncTimeouts.current = []
    }
  }, [isWeb])

  // Derive cast availability and connection state
  const isCastAvailable = castState !== CAST_STATE.NO_DEVICES_AVAILABLE && castState !== null
  const isCastConnected = castState === CAST_STATE.CONNECTED

  // Map cast state to our session state enum
  const getCastSessionState = (): CastSessionState => {
    if (!castState || castState === CAST_STATE.NO_DEVICES_AVAILABLE) {
      return 'no_devices'
    }
    if (castState === CAST_STATE.CONNECTED) {
      return 'connected'
    }
    if (castState === CAST_STATE.CONNECTING) {
      return 'connecting'
    }
    return 'not_connected'
  }

  // Monitor media status for play state while connected. Idiomatic RNGC:
  // subscribe to the client's onMediaStatusUpdated event (this is what the
  // library's own useMediaStatus hook does) rather than polling — the receiver
  // pushes status changes, so this stays accurate without a timer. The
  // foreground resync (syncCastState) re-seeds this after a background gap,
  // where in-background events would have been dropped.
  useEffect(() => {
    if (!isCastConnected || isWeb || !GoogleCast) {
      setIsCastPlaying(false)
      return
    }

    let cancelled = false
    let statusSubscription: any

    const subscribe = async () => {
      try {
        const sessionManager = GoogleCast.getSessionManager()
        const session = await sessionManager.getCurrentCastSession()
        if (!session || cancelled) return

        const client = session.getClient()
        if (!client) return

        // Seed the current status, then subscribe for pushes.
        try {
          const status = await client.getMediaStatus()
          if (!cancelled) setIsCastPlaying(isPlayingStatus(status))
        } catch {
          // Client not ready yet — the event subscription will deliver it.
        }

        statusSubscription = client.onMediaStatusUpdated((status: any) => {
          setIsCastPlaying(isPlayingStatus(status))
        })
      } catch (error) {
        // Silently ignore - session/client might not be ready
      }
    }

    subscribe()

    return () => {
      cancelled = true
      statusSubscription?.remove?.()
    }
  }, [isCastConnected, isWeb])

  const castPlay = useCallback(
    async (title: string, artist: string, artworkUrl?: string, showTime?: string): Promise<boolean> => {
      // Don't rely on isCastConnected state - loadMediaOnCast does its own session check
      // This avoids race conditions where state hasn't updated yet but session exists
      currentMetadata.current = { title, artist, artworkUrl, showTime }

      const success = await loadMediaOnCast(title, artist, artworkUrl, showTime)
      if (success) {
        setIsCastPlaying(true)
        return true
      } else {
        return false
      }
    },
    []
  )

  const castStop = useCallback(async () => {
    const success = await castStopUtil()
    if (success) {
      setIsCastPlaying(false)
    }
  }, [])

  const updateCastMetadataFn = useCallback(
    async (title: string, artist: string, artworkUrl?: string, showTime?: string) => {
      if (!isCastConnected || !isCastPlaying) {
        // Just store metadata for when cast starts
        currentMetadata.current = { title, artist, artworkUrl, showTime }
        return
      }

      currentMetadata.current = { title, artist, artworkUrl, showTime }
      await updateCastMediaMetadata(title, artist, artworkUrl, showTime)
    },
    [isCastConnected, isCastPlaying]
  )

  // For web or when cast is not available, return disabled context
  if (isWeb || !GoogleCast) {
    return (
      <CastContextValue.Provider value={disabledCastContext}>
        {children}
      </CastContextValue.Provider>
    )
  }

  return (
    <CastContextValue.Provider
      value={{
        isCastAvailable,
        isCastConnected,
        castDeviceName,
        castSessionState: getCastSessionState(),
        isCastPlaying,
        castPlay,
        castStop,
        updateCastMetadata: updateCastMetadataFn,
      }}
    >
      {children}
    </CastContextValue.Provider>
  )
}

export const useCast = (): CastContextType => {
  const ctx = useContext(CastContextValue)
  if (!ctx) {
    throw new Error('useCast must be used within a CastProvider')
  }
  return ctx
}
