// components/screens/ListenScreen.tsx
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  AppState,
  Image as RNImage,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { CastButton } from '../CastButton'
import { apiKey } from '../../config'
import { useTrackPlayer } from '../../context/TrackPlayerContext'
import { useTimezoneChange } from '../../hooks/useTimezoneChange'
import { colors, font } from '../../theme/tokens'
import { formatShowTimeRange } from '../../utils/liveShowInfo'
import { FormattedShowTitle } from '../FormattedShowTitle'
import { Eyebrow } from '../ui/Eyebrow'
import { PageScaffold } from '../ui/PageScaffold'
import { PlayDisc } from '../ui/PlayDisc'
import { ShowArtworkBackground } from '../ui/ShowArtworkBackground'

// Only import TrackPlayer on mobile platforms
let TrackPlayer: any, Event: any;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const trackPlayerModule = require('react-native-track-player');
    TrackPlayer = trackPlayerModule.default;
    Event = trackPlayerModule.Event;
  } catch {
    console.warn('TrackPlayer not available');
  }
}

const placeholderArtistImage = require('../../assets/images/eist_online.png')
const placeholderOfflineImage = require('../../assets/images/eist_offline.png')

const stationId = 'eist-radio'
const apiUrl = `https://api.radiocult.fm/api/station/${stationId}`

export default function ListenScreen({ isActive }: { pageIndex: number; isActive: boolean }) {
  const {
    isPlaying,
    togglePlayStop,
    updateMetadata,
    isCastConnected,
  } = useTrackPlayer()
  const router = useRouter()
  const currentTimezone = useTimezoneChange()

  const [showTitle, setShowTitle] = useState('')
  const [, setShowDescription] = useState('')
  const [artistName, setArtistName] = useState('éist · off air')
  const [remoteImageUrl, setRemoteImageUrl] = useState<string | null>(null)
  const [imageFailed, setImageFailed] = useState(false)
  // 'loading' is the initial, undetermined state (before the first schedule
  // fetch resolves) — distinct from a real 'off air'/'error' status so we can
  // avoid flashing the offline placeholder before we know anything.
  const [broadcastStatus, setBroadcastStatus] = useState('loading')
  const [nextShowId, setNextShowId] = useState<string | null>(null)
  const [nextShowTitle, setNextShowTitle] = useState('')
  const [artistId, setArtistId] = useState<string | null>(null)
  const [currentShowId, setCurrentShowId] = useState<string | null>(null)
  const [isContentLoading, setIsContentLoading] = useState(false)
  const [artistCache, setArtistCache] = useState<Record<string, { name: string; image: any }>>({})
  const [isCarConnected, setIsCarConnected] = useState(false)
  const carRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null)


  const parseDescription = (blocks: any[]): string =>
    blocks
      .map(block => {
        if (!Array.isArray(block.content)) return ''
        return block.content
          .map((child: any) => {
            if (child.type === 'text') return child.text
            if (child.type === 'hardBreak') return '\n'
            return ''
          })
          .join('')
      })
      .filter(Boolean)
      .join('\n\n') || ''

  // Preload image function
  const preloadImage = useCallback((uri: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!uri) {
        resolve(false)
        return
      }

      // Check if we're on web or native
      if (Platform.OS === 'web') {
        // Web environment - use standard HTML Image preloading
        try {
          const img = new (global as any).Image()
          img.onload = () => {
            resolve(true)
          }
          img.onerror = () => {
            resolve(false)
          }
          img.src = uri
        } catch {
          resolve(true)
        }
      } else {
        // React Native environment
        if (typeof RNImage.prefetch === 'function') {
          RNImage.prefetch(uri)
            .then(() => {
              resolve(true)
            })
            .catch(() => {
              resolve(false)
            })
        } else {
          resolve(true)
        }
      }
    })
  }, [])

  const getArtistDetails = useCallback(async (id: string | null) => {
    if (!id) return { name: '', image: placeholderArtistImage }

    // Check cache first
    if (artistCache[id]) {
      return artistCache[id]
    }

    try {
      const res = await fetch(`${apiUrl}/artists/${id}`, {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const artist = json.artist || {}
      const imageUrl = artist.logo?.['1024x1024'] || artist.logo?.['512x512'] || artist.logo?.['256x256']
      const artistData = {
        name: artist.name || '',
        image: imageUrl ? { uri: imageUrl } : placeholderArtistImage,
      }

      // Cache the result
      setArtistCache(prev => ({ ...prev, [id]: artistData }))
      return artistData
    } catch (err) {
      console.error('Error fetching artist details:', err)
      // Don't let errors propagate - just log them and return fallback
      return { name: '', image: placeholderArtistImage }
    }
  }, [artistCache])

  const clearNowPlayingState = useCallback(async () => {
    setShowTitle('')
    setArtistName('éist · off air')
    setRemoteImageUrl(null)
    setImageFailed(false)
    setShowDescription('')
    setArtistId(null)
    setCurrentShowId(null)
    // Don't clear next show info - it should be preserved when station is off air
    setIsContentLoading(false)
    try {
      await updateMetadata('éist · off air', '', undefined, '')
    } catch {
      // Don't let errors propagate - just log them
    }
  }, [updateMetadata])

  const fetchLiveScheduleOnly = useCallback(async () => {

    try {
      const res = await fetch(`${apiUrl}/schedule/live`, {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const { status, content, metadata } = data.result

      setBroadcastStatus(status)

      if (status !== 'schedule') {
        await clearNowPlayingState()

        try {
          const now = new Date().toISOString()
          const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString()
          const nextRes = await fetch(
            `${apiUrl}/schedule?startDate=${encodeURIComponent(now)}&endDate=${encodeURIComponent(weekAhead)}`,
            {
              headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
            }
          )
          if (!nextRes.ok) throw new Error(`HTTP ${nextRes.status}`)
          const nextJson = await nextRes.json()
          const events: any[] = nextJson.schedules || []
          if (events.length > 0) {
            events.sort((a, b) => new Date(a.startDateUtc).getTime() - new Date(b.startDateUtc).getTime())
            const nextEvent = events[0]
            setNextShowId(nextEvent.id)
            setNextShowTitle(nextEvent.title || '')
          }
        } catch (nextErr) {
          console.error('Error fetching next show information in fetchLiveScheduleOnly:', nextErr)
          // Don't let errors propagate - just log them
        }
        setIsContentLoading(false)
      } else {
        // Update schedule data only
        const newShowTitle = content.title || ''
        const newCurrentShowId = content.id || null
        const newArtistId = content.artistIds?.[0] ?? null
        const showTimeRange = formatShowTimeRange(
          content.startDateUtc,
          content.endDateUtc,
          currentTimezone
        )

        // Prepare description
        let desc = parseDescription(content.description?.content || [])
        if (content.media?.type === 'playlist' && metadata?.title) {
          desc += `\n\nNow playing: ${metadata.title}`
        }

        setShowTitle(newShowTitle)
        setCurrentShowId(newCurrentShowId)
        setShowDescription(desc)

        // Only fetch artist details if artist ID changed
        if (newArtistId !== artistId) {
          setArtistId(newArtistId)
          setIsContentLoading(true)

          const { name, image } = await getArtistDetails(newArtistId)

          // Update artist-related state
          setArtistName(name)

          if (image?.uri) {
            const imageLoaded = await preloadImage(image.uri)

            if (imageLoaded) {
              setRemoteImageUrl(image.uri)
              setImageFailed(false)
              await updateMetadata(newShowTitle || 'éist', name, image.uri, showTimeRange)
            } else {
              setRemoteImageUrl(null)
              setImageFailed(true)
              await updateMetadata(newShowTitle || 'éist', name, undefined, showTimeRange)
            }
          } else {
            setRemoteImageUrl(null)
            setImageFailed(false)
            await updateMetadata(newShowTitle || 'éist', name, undefined, showTimeRange)
          }

          setIsContentLoading(false)
        } else {
          // Artist ID hasn't changed, just update metadata with current artist info
          if (artistId && artistCache[artistId]) {
            const cachedArtist = artistCache[artistId]
            await updateMetadata(
              newShowTitle || 'éist',
              cachedArtist.name,
              cachedArtist.image?.uri || undefined,
              showTimeRange
            )
          } else {
            await updateMetadata(newShowTitle || 'éist', artistName, remoteImageUrl || undefined, showTimeRange)
          }
        }
      }
    } catch {
      setBroadcastStatus('error')
      await clearNowPlayingState()
    }
  }, [artistId, artistCache, artistName, remoteImageUrl, getArtistDetails, updateMetadata, clearNowPlayingState, preloadImage, currentTimezone])

  const fetchNowPlayingWithArtist = useCallback(async () => {

    // Set loading state when starting to fetch new content
    setIsContentLoading(true)

    try {
      const res = await fetch(`${apiUrl}/schedule/live`, {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const { status, content, metadata } = data.result

      setBroadcastStatus(status)

      if (status !== 'schedule') {
        await clearNowPlayingState()

        // Fetch next show information when station is off air
        try {
          const now = new Date().toISOString()
          const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString()
          const nextRes = await fetch(
            `${apiUrl}/schedule?startDate=${encodeURIComponent(now)}&endDate=${encodeURIComponent(weekAhead)}`,
            {
              headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
            }
          )
          if (!nextRes.ok) throw new Error(`HTTP ${nextRes.status}`)
          const nextJson = await nextRes.json()
          const events: any[] = nextJson.schedules || []
          if (events.length > 0) {
            events.sort((a, b) => new Date(a.startDateUtc).getTime() - new Date(b.startDateUtc).getTime())
            const nextEvent = events[0]
            setNextShowId(nextEvent.id)
            setNextShowTitle(nextEvent.title || '')
          }
        } catch (nextErr) {
          console.error('Error fetching next show information:', nextErr)
          // Don't let errors propagate - just log them
        }
        return
      }

      // Prepare new content
      const newShowTitle = content.title || ''
      const newCurrentShowId = content.id || null
      const newArtistId = content.artistIds?.[0] ?? null
      const showTimeRange = formatShowTimeRange(
        content.startDateUtc,
        content.endDateUtc,
        currentTimezone
      )

      const { name, image } = await getArtistDetails(newArtistId)

      // Prepare description
      let desc = parseDescription(content.description?.content || [])
      if (content.media?.type === 'playlist' && metadata?.title) {
        desc += `\n\nNow playing: ${metadata.title}`
      }

      // Update all states
      setShowTitle(newShowTitle)
      setCurrentShowId(newCurrentShowId)
      setArtistId(newArtistId)
      setArtistName(name)
      setShowDescription(desc)

      // Handle image
      if (image?.uri) {
        const imageLoaded = await preloadImage(image.uri)

        if (imageLoaded) {
          setRemoteImageUrl(image.uri)
          setImageFailed(false)
          await updateMetadata(newShowTitle || 'éist', name, image.uri, showTimeRange)
        } else {
          setRemoteImageUrl(null)
          setImageFailed(true)
          await updateMetadata(newShowTitle || 'éist', name, undefined, showTimeRange)
        }
      } else {
        setRemoteImageUrl(null)
        setImageFailed(false)
        await updateMetadata(newShowTitle || 'éist', name, placeholderArtistImage, showTimeRange)
      }

      // Mark loading as finished
      setIsContentLoading(false)
    } catch {
      setBroadcastStatus('error')
      await clearNowPlayingState()
    }
  }, [getArtistDetails, updateMetadata, clearNowPlayingState, preloadImage, currentTimezone])

  // Always resolve the next upcoming show (the most imminent show that starts in
  // the future), independent of whether the station is currently live or off
  // air, so the "Up next" row can show during live broadcasts too.
  const fetchNextShow = useCallback(async () => {
    try {
      const nowMs = Date.now()
      const now = new Date(nowMs).toISOString()
      const weekAhead = new Date(nowMs + 7 * 86400000).toISOString()
      const res = await fetch(
        `${apiUrl}/schedule?startDate=${encodeURIComponent(now)}&endDate=${encodeURIComponent(weekAhead)}`,
        { headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' } }
      )
      if (!res.ok) return
      const json = await res.json()
      const events: any[] = (json.schedules || []).filter(
        (e: any) => new Date(e.startDateUtc).getTime() > nowMs
      )
      events.sort((a, b) => new Date(a.startDateUtc).getTime() - new Date(b.startDateUtc).getTime())
      if (events.length > 0) {
        setNextShowId(events[0].id)
        setNextShowTitle(events[0].title || '')
      }
    } catch (err) {
      console.warn('Up-next fetch failed:', err)
    }
  }, [])

  // Function to calculate time until next 1 minute past the hour
  const getTimeUntilNextRefresh = () => {
    const now = new Date()
    const nextRefresh = new Date(now)
    nextRefresh.setMinutes(1, 0, 0) // Set to 1 minute past the hour
    nextRefresh.setSeconds(0, 0)

    // If we're already past 1 minute, move to next hour
    if (now.getMinutes() >= 1) {
      nextRefresh.setHours(nextRefresh.getHours() + 1)
    }

    return nextRefresh.getTime() - now.getTime()
  }

  // Function to refresh metadata at exactly 1 minute past the hour
  const scheduleCarRefresh = useCallback(() => {
    if (!isCarConnected || !isPlaying) return

    // Clear existing interval
    if (carRefreshIntervalRef.current) {
      clearTimeout(carRefreshIntervalRef.current)
    }

    const timeUntilRefresh = getTimeUntilNextRefresh()

    carRefreshIntervalRef.current = setTimeout(() => {
      // Refresh metadata
      fetchLiveScheduleOnly()

      // Schedule next refresh (every hour)
      carRefreshIntervalRef.current = setInterval(() => {
        if (isCarConnected && isPlaying) {
          fetchLiveScheduleOnly()
        }
      }, 60 * 60 * 1000) // 1 hour
    }, timeUntilRefresh)
  }, [isCarConnected, isPlaying, fetchLiveScheduleOnly])

  // Car connectivity detection
  useEffect(() => {
    let remotePlayListener: any
    let remoteStopListener: any
    let remotePauseListener: any

    const setupCarDetection = async () => {
      if (Platform.OS === 'web' || !TrackPlayer) {
        // Don't set up car detection on web or if TrackPlayer is not available
        return;
      }
      try {
        // Listen for remote events which indicate car connectivity
        remotePlayListener = TrackPlayer.addEventListener(Event.RemotePlay, () => {
          setIsCarConnected(true)
        })

        remoteStopListener = TrackPlayer.addEventListener(Event.RemoteStop, () => {
          setIsCarConnected(true)
        })

        remotePauseListener = TrackPlayer.addEventListener(Event.RemotePause, () => {
          setIsCarConnected(true)
        })
      } catch {
        // Don't let errors propagate - just log them
      }
    }

    setupCarDetection()

    return () => {
      if (remotePlayListener) remotePlayListener.remove()
      if (remoteStopListener) remoteStopListener.remove()
      if (remotePauseListener) remotePauseListener.remove()
    }
  }, [])

  // Schedule car refresh when car connectivity or playing state changes
  useEffect(() => {
    scheduleCarRefresh()

    return () => {
      if (carRefreshIntervalRef.current) {
        clearTimeout(carRefreshIntervalRef.current)
        carRefreshIntervalRef.current = null
      }
    }
  }, [scheduleCarRefresh])

  useEffect(() => {
    if (!isActive) return;
    fetchNowPlayingWithArtist();
    fetchNextShow();
    const interval = setInterval(() => {
      if (isPlaying) fetchLiveScheduleOnly();
      fetchNextShow();
    }, 60000);
    return () => clearInterval(interval);
  }, [isActive, fetchNowPlayingWithArtist, fetchLiveScheduleOnly, fetchNextShow, isPlaying]);

  // Refresh now playing info whenever the app returns to the foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        // Only refresh if we're playing - use lightweight function
        if (isPlaying) {
          fetchLiveScheduleOnly()
        }
      }
    })

    return () => {
      subscription.remove()
    }
  }, [fetchLiveScheduleOnly, isPlaying])

  const handlePlayButtonPress = useCallback(async () => {
    try {
      await togglePlayStop()
    } catch {
      // Show user-friendly error message
      Alert.alert(
        'Playback Error',
        'Unable to start playback. Please try again.',
        [{ text: 'OK' }]
      )
    }
  }, [togglePlayStop])

  // Image priority:
  //  - live with a usable artist image → that image (persists across refreshes)
  //  - live but still resolving the artist → nothing (avoid placeholder flash)
  //  - live with no/failed artist image → eist_online.png default
  //  - off air / error → eist_offline.png
  //  - initial undetermined load → nothing
  let artworkSource: React.ComponentProps<typeof ShowArtworkBackground>['source']
  if (broadcastStatus === 'schedule') {
    artworkSource =
      remoteImageUrl && !imageFailed
        ? { uri: remoteImageUrl }
        : isContentLoading
          ? null
          : placeholderArtistImage
  } else if (broadcastStatus === 'loading') {
    artworkSource = null
  } else {
    artworkSource = placeholderOfflineImage
  }

  // Match the other pages' frozen indicator: green "live now: <DJ>" when live,
  // dimmed "off air" otherwise.
  const isLive = broadcastStatus === 'schedule'
  const liveTint = isLive ? colors.green : colors.textDim
  const liveLabel = isLive ? `live now: ${artistName || 'éist'}` : 'off air'

  return (
    <PageScaffold transparentBg>
      <ShowArtworkBackground
        source={artworkSource}
        onError={() => setImageFailed(true)} />

      <View style={s.onair}><MaterialCommunityIcons name="headphones" size={19} color={colors.green} /><Eyebrow color={liveTint} style={{ flexShrink: 1 }}>{liveLabel}</Eyebrow></View>
      <View style={s.castRow}>
        <CastButton size={31} tintColor={isCastConnected ? colors.green : colors.text} />
      </View>

      <View style={{ flex: 1 }} />
      <Pressable onPress={() => currentShowId && router.push(`/show/${currentShowId}` as any)} disabled={!currentShowId}>
        <FormattedShowTitle
          title={broadcastStatus === 'schedule' && showTitle ? showTitle : 'éist'}
          color={colors.green}
          size={33}
          style={s.title}
          numberOfLines={3}
          adjustsFontSizeToFit
        />
      </Pressable>
      <Pressable onPress={() => artistId && router.push(`/artist/${artistId}` as any)} disabled={!artistId}>
        <Text style={s.artist}>{artistName}</Text>
      </Pressable>

      {nextShowTitle ? (
        <Pressable
          style={s.upNext}
          onPress={() => nextShowId && router.push(`/show/${nextShowId}` as any)}
          disabled={!nextShowId}
        >
          <Eyebrow>up next</Eyebrow>
          <Text style={s.upNextText} numberOfLines={1}>
            {nextShowTitle}
          </Text>
        </Pressable>
      ) : null}

      <View style={s.player}>
        <Pressable onPress={handlePlayButtonPress} accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Stop playback' : 'Start playback'}>
          <PlayDisc playing={isPlaying} size={72} />
        </Pressable>
        <Text style={s.playlabel}>{isPlaying ? 'Stop' : 'Listen now'}</Text>
      </View>
    </PageScaffold>
  );
}

const s = StyleSheet.create({
  // paddingRight matches LiveNowIndicator so the line clears the top-right
  // spinning logo and wraps consistently with the other pages.
  onair: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 96 },
  castRow: { marginTop: 18, marginBottom: 20 },
  title: { fontFamily: font.headingBold, fontWeight: '700', fontSize: 33, lineHeight: 34, letterSpacing: -0.5, color: colors.green },
  artist: { fontFamily: font.body, fontWeight: '500', fontSize: 20, color: colors.green, marginTop: 9 },
  upNext: { marginTop: 22, gap: 6 },
  upNextText: { fontFamily: font.body, fontWeight: '500', fontSize: 16, color: colors.text },
  player: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 30 },
  playlabel: { fontFamily: font.body, fontWeight: '600', fontSize: 20, letterSpacing: 0.2, color: colors.green },
});
