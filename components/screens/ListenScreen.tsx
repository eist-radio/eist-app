// components/screens/ListenScreen.tsx
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
  // Bumped on every foreground return to force the native Cast button to
  // remount and re-read the live session state — its native view can go stale
  // (shows disconnected while a cast is still active) while JS is suspended in
  // the background.
  const [castButtonNonce, setCastButtonNonce] = useState(0)

  // Live mirrors for async fetch callbacks: they compare against what is
  // currently on screen without needing the state values in their deps
  // (which would churn their identities and re-trigger effects).
  const broadcastStatusRef = useRef(broadcastStatus)
  const remoteImageUrlRef = useRef(remoteImageUrl)
  useEffect(() => {
    broadcastStatusRef.current = broadcastStatus
    remoteImageUrlRef.current = remoteImageUrl
  })


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
              // Preload failed. If this exact image is already displayed (it
              // loaded fine earlier), keep it rather than flashing the
              // placeholder until the next successful poll.
              if (remoteImageUrlRef.current !== image.uri) {
                setRemoteImageUrl(null)
                setImageFailed(true)
              }
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
      // A fetch error is a network blip, not an off-air signal (that arrives
      // as a successful response with status !== 'schedule'). If a live show
      // is on screen, hold it instead of flashing the offline background and
      // swapping back on the next successful poll.
      if (broadcastStatusRef.current !== 'schedule') {
        setBroadcastStatus('error')
        await clearNowPlayingState()
      }
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
          // Same rule as fetchLiveScheduleOnly: don't drop an image that is
          // already on screen just because a re-preload of it failed.
          if (remoteImageUrlRef.current !== image.uri) {
            setRemoteImageUrl(null)
            setImageFailed(true)
          }
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
      setIsContentLoading(false)
      // Same hold-last-known-good rule as fetchLiveScheduleOnly: only a
      // successful off-air response may replace a live show on screen.
      if (broadcastStatusRef.current !== 'schedule') {
        setBroadcastStatus('error')
        await clearNowPlayingState()
      }
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

  // Note: periodic Now Playing refresh for a connected car head unit
  // (CarPlay / Android Auto) is handled centrally in TrackPlayerContext, which
  // is always mounted. This screen no longer schedules its own car refresh.

  // The fetch effects below must run on page activation / a timer ONLY — not
  // whenever isPlaying flips or a fetch callback picks up a new identity
  // (artistCache/artistName/remoteImageUrl churn on every fetch). Re-running
  // the full fetch on those re-renders set isContentLoading(true) each time,
  // which blanked and re-showed the background artwork. Latest callbacks are
  // read through refs so the effects can depend on isActive alone.
  const isPlayingLatest = useRef(isPlaying)
  const fetchNowPlayingWithArtistRef = useRef(fetchNowPlayingWithArtist)
  const fetchLiveScheduleOnlyRef = useRef(fetchLiveScheduleOnly)
  const fetchNextShowRef = useRef(fetchNextShow)
  useEffect(() => {
    isPlayingLatest.current = isPlaying
    fetchNowPlayingWithArtistRef.current = fetchNowPlayingWithArtist
    fetchLiveScheduleOnlyRef.current = fetchLiveScheduleOnly
    fetchNextShowRef.current = fetchNextShow
  })

  useEffect(() => {
    if (!isActive) return;
    fetchNowPlayingWithArtistRef.current();
    fetchNextShowRef.current();
    const interval = setInterval(() => {
      if (isPlayingLatest.current) fetchLiveScheduleOnlyRef.current();
      fetchNextShowRef.current();
    }, 60000);
    return () => clearInterval(interval);
  }, [isActive]);

  // Refresh now playing info whenever the app returns to the foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        // Force the native Cast button to remount so it re-reads the live cast
        // session state (which can go stale while backgrounded).
        setCastButtonNonce((n) => n + 1)
        // Only refresh if we're playing - use lightweight function
        if (isPlayingLatest.current) {
          fetchLiveScheduleOnlyRef.current()
        }
      }
    })

    return () => {
      subscription.remove()
    }
  }, [])

  // The Pager keeps every page mounted, so swiping away from Listen leaves this
  // screen's native Cast button alive but offscreen — where GCKUICastButton can
  // go stale and render grey/disconnected even though the session (and
  // isCastConnected) is still live. Remount it each time Listen becomes the
  // active page so it re-reads the session and re-applies the tint, mirroring
  // the foreground remount above (in-app navigation never backgrounds the app,
  // so that handler alone doesn't cover this path).
  useEffect(() => {
    if (isActive) setCastButtonNonce((n) => n + 1)
  }, [isActive])

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

  return (
    // frozenLiveNow reserves the "live now" slot at the top; the visible line is
    // the Pager's shared fixed overlay (drawn on every page, Listen included),
    // so it stays put during swipes instead of scrolling with this page. Note:
    // that overlay refreshes on its own ~60s clock (getLiveShowInfo), separate
    // from this screen's schedule fetch that drives the artwork/title — so the
    // two can briefly disagree at a show boundary before both settle.
    <PageScaffold transparentBg frozenLiveNow>
      <ShowArtworkBackground
        source={artworkSource}
        onError={() => setImageFailed(true)} />

      <View style={s.castRow}>
        <CastButton
          key={`cast-${castButtonNonce}-${isCastConnected}`}
          size={40}
          tintColor={isCastConnected ? colors.green : colors.text}
        />
      </View>

      <View style={{ flex: 1 }} />
      <Pressable onPress={() => currentShowId && router.push(`/show/${currentShowId}` as any)} disabled={!currentShowId}>
        <FormattedShowTitle
          title={broadcastStatus === 'schedule' && showTitle ? showTitle : 'éist'}
          color={colors.green}
          size={42}
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
          <Eyebrow>up next:</Eyebrow>
          <Text style={s.upNextText} numberOfLines={1}>
            {nextShowTitle}
          </Text>
        </Pressable>
      ) : null}

      <View style={s.player}>
        <Pressable onPress={handlePlayButtonPress} accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Stop playback' : 'Start playback'}>
          <PlayDisc playing={isPlaying} size={68} />
        </Pressable>
        <Text style={s.playlabel}>{isPlaying ? 'Stop' : 'Listen now'}</Text>
      </View>
    </PageScaffold>
  );
}

const s = StyleSheet.create({
  // Spacing follows an ascending φ/Fibonacci rhythm (8 → 21 → 34) so the gaps
  // themselves encode grouping: tight within the title block, wider between
  // info blocks, widest before the play action. Type is a φ ladder anchored on
  // the shared 16px eyebrow: 16 → 26 (×φ) → 42 (×φ²).
  // marginLeft pulls the native cast glyph flush with the content edge (the
  // "live now"/title above): GCKUICastButton centres its glyph inside its size
  // box, so without this it reads as indented from everything else. No marginTop
  // — the frozenLiveNow spacer above already provides the gap.
  castRow: { marginBottom: 21, marginLeft: -6 },
  title: { fontFamily: font.headingBold, fontWeight: '700', fontSize: 42, lineHeight: 43, letterSpacing: -0.8, color: colors.green },
  artist: { fontFamily: font.body, fontWeight: '500', fontSize: 26, color: colors.green, marginTop: 8 },
  upNext: { marginTop: 21, gap: 8 },
  upNextText: { fontFamily: font.body, fontWeight: '500', fontSize: 16, color: colors.text },
  player: { flexDirection: 'row', alignItems: 'center', gap: 21, marginTop: 34 },
  playlabel: { fontFamily: font.body, fontWeight: '600', fontSize: 26, letterSpacing: 0.2, color: colors.green },
});
