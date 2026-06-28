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
import { Platform } from 'react-native'
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

  // Media status polling interval
  const mediaStatusInterval = useRef<NodeJS.Timeout | null>(null)

  // Initialize cast and set up listeners
  useEffect(() => {
    if (isWeb || !GoogleCast) {
      return
    }

    let castStateSubscription: any
    let sessionStartedSubscription: any
    let sessionEndedSubscription: any
    let diagInterval: ReturnType<typeof setInterval> | undefined

    const initializeCast = async () => {
      try {
        // Get initial cast state
        const currentState = await GoogleCast.getCastState()
        console.log('Initial cast state:', currentState)
        setCastState(currentState)

        // --- TEMP cast discovery diagnostic ---------------------------------
        // Polls the cast state for ~45s after launch. If discovery is working
        // and a device is on the network, the state should move from
        // 'noDevicesAvailable' to 'notConnected'. If it stays
        // 'noDevicesAvailable' the whole time, discovery is finding nothing
        // (most often the iOS Local Network permission was denied, or the
        // device is on a different subnet/VLAN). Remove once cast is verified.
        let polls = 0
        diagInterval = setInterval(async () => {
          polls += 1
          try {
            const s = await GoogleCast.getCastState()
            console.log(`[cast-debug] poll ${polls} (t+${polls * 3}s): castState=${s}`)
          } catch (e) {
            console.log('[cast-debug] poll error:', e)
          }
          if (polls >= 15 && diagInterval) clearInterval(diagInterval)
        }, 3000)
        // --------------------------------------------------------------------

        // Listen for cast state changes
        castStateSubscription = GoogleCast.onCastStateChanged((state: string) => {
          console.log('Cast state changed:', state)
          setCastState(state)
        })

        // Listen for session events via session manager
        const sessionManager = GoogleCast.getSessionManager()

        sessionStartedSubscription = sessionManager.onSessionStarted(async (session: any) => {
          console.log('Cast session started')
          try {
            const device = await session.getCastDevice()
            setCastDeviceName(device?.friendlyName || 'Cast Device')
          } catch (e) {
            setCastDeviceName('Cast Device')
          }
        })

        sessionEndedSubscription = sessionManager.onSessionEnded(() => {
          console.log('Cast session ended')
          setCastDeviceName(null)
          setIsCastPlaying(false)
        })

      } catch (error) {
        console.error('Failed to initialize cast:', error)
      }
    }

    initializeCast()

    return () => {
      if (diagInterval) clearInterval(diagInterval)
      castStateSubscription?.remove?.()
      sessionStartedSubscription?.remove?.()
      sessionEndedSubscription?.remove?.()
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

  // Monitor media status for play state when connected
  useEffect(() => {
    if (!isCastConnected || isWeb || !GoogleCast) {
      setIsCastPlaying(false)
      if (mediaStatusInterval.current) {
        clearInterval(mediaStatusInterval.current)
        mediaStatusInterval.current = null
      }
      return
    }

    const checkMediaStatus = async () => {
      try {
        const sessionManager = GoogleCast.getSessionManager()
        const session = await sessionManager.getCurrentCastSession()
        if (session) {
          const client = session.getClient()
          const status = await client.getMediaStatus()
          const isPlaying =
            status?.playerState === 'playing' || status?.playerState === 'buffering'
          setIsCastPlaying(isPlaying)
        }
      } catch (error) {
        // Silently ignore - client might not be ready
      }
    }

    checkMediaStatus()
    mediaStatusInterval.current = setInterval(checkMediaStatus, 2000)

    return () => {
      if (mediaStatusInterval.current) {
        clearInterval(mediaStatusInterval.current)
        mediaStatusInterval.current = null
      }
    }
  }, [isCastConnected, isWeb])

  const castPlay = useCallback(
    async (title: string, artist: string, artworkUrl?: string, showTime?: string): Promise<boolean> => {
      // Don't rely on isCastConnected state - loadMediaOnCast does its own session check
      // This avoids race conditions where state hasn't updated yet but session exists
      currentMetadata.current = { title, artist, artworkUrl, showTime }

      console.log('Loading media on cast device...')
      const success = await loadMediaOnCast(title, artist, artworkUrl, showTime)
      if (success) {
        console.log('Cast playback started')
        setIsCastPlaying(true)
        return true
      } else {
        console.log('Failed to start cast playback')
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
