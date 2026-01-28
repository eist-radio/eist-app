// app/(tabs)/listen.tsx

import { SelectableText } from '@/components/SelectableText'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useTheme } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
    ActivityIndicator,
    Alert,
    Animated,
    AppState,
    Dimensions,
    Image,
    Linking,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FormattedShowTitle } from '../../components/FormattedShowTitle'
import { apiKey } from '../../config'
import { useTrackPlayer } from '../../context/TrackPlayerContext'
import { useTimezoneChange } from '../../hooks/useTimezoneChange'

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

// Live indicator with pulsing animation (matches schedule page and website)
const LiveIndicator = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: Platform.OS !== 'web' }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [pulseAnim])

  return (
    <Animated.View style={[styles.liveIndicator, { opacity: pulseAnim }]}>
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>LIVE</Text>
    </Animated.View>
  )
}

const BackToTopButton = ({ onPress, visible }: { onPress: () => void; visible: boolean }) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
    }).start()
  }, [visible, animatedValue])

  return (
    <Animated.View
      style={[
        styles.backToTopButton,
        {
          opacity: animatedValue,
          transform: [{
            scale: animatedValue.interpolate({
              inputRange: [0, 1],
              outputRange: [0.8, 1],
            })
          }]
        }
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={styles.backToTopTouchable}
      >
        <Ionicons
          name="chevron-up"
          size={32}
          color="#AFFC41"
          style={styles.chevronIcon}
        />
      </TouchableOpacity>
    </Animated.View>
  )
}

const placeholderArtistImage = require('../../assets/images/eist_online.png')
const placeholderOfflineImage = require('../../assets/images/eist_offline.png')
const logoImage = require('../../assets/images/eist-logo-header.png')

const stationId = 'eist-radio'
const apiUrl = `https://api.radiocult.fm/api/station/${stationId}`

export default function ListenScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const {
    isPlaying,
    togglePlayStop,
    updateMetadata,
  } = useTrackPlayer()
  const { width, height } = Dimensions.get('window')
  const router = useRouter()
  const currentTimezone = useTimezoneChange()

  const [showTitle, setShowTitle] = useState('')
  const [showDescription, setShowDescription] = useState('')
  const [artistName, setArtistName] = useState('éist · off air')
  const [remoteImageUrl, setRemoteImageUrl] = useState<string | null>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const [broadcastStatus, setBroadcastStatus] = useState('off air')
  const [nextShowId, setNextShowId] = useState<string | null>(null)
  const [nextShowTitle, setNextShowTitle] = useState('')
  const [nextShowTime, setNextShowTime] = useState('')
  const [artistId, setArtistId] = useState<string | null>(null)
  const [currentShowId, setCurrentShowId] = useState<string | null>(null)
  const [isContentLoading, setIsContentLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [artistCache, setArtistCache] = useState<Record<string, { name: string; image: any }>>({})
  const [isCarConnected, setIsCarConnected] = useState(false)
  const carRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [isScrollable, setIsScrollable] = useState(false)
  const scrollViewRef = useRef<ScrollView>(null)


  const formatTime = useCallback((isoString: string): string => {
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: currentTimezone,
    })
  }, [currentTimezone])

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
        if (typeof Image.prefetch === 'function') {
          Image.prefetch(uri)
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
      await updateMetadata('éist · off air', '', undefined)
    } catch {
      // Don't let errors propagate - just log them
    }
  }, [updateMetadata])

  const clearNextShowInfo = useCallback(() => {
    setNextShowId(null)
    setNextShowTitle('')
    setNextShowTime('')
  }, [])

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
            setNextShowTime(formatTime(nextEvent.startDateUtc))
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

        // Prepare description
        let desc = parseDescription(content.description?.content || [])
        if (content.media?.type === 'playlist' && metadata?.title) {
          desc += `\n\nNow playing: ${metadata.title}`
        }

        setShowTitle(newShowTitle)
        setCurrentShowId(newCurrentShowId)
        setShowDescription(desc)

        // Clear next show info when station is live
        clearNextShowInfo()

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
              await updateMetadata(newShowTitle || 'éist', name, image.uri)
                  } else {
        setRemoteImageUrl(null)
        setImageFailed(true)
        await updateMetadata(newShowTitle || 'éist', name, undefined)
      }
          } else {
            setRemoteImageUrl(null)
            setImageFailed(false)
            await updateMetadata(newShowTitle || 'éist', name, undefined)
          }

          setIsContentLoading(false)
        } else {
          // Artist ID hasn't changed, just update metadata with current artist info
          if (artistId && artistCache[artistId]) {
            const cachedArtist = artistCache[artistId]
            await updateMetadata(newShowTitle || 'éist', cachedArtist.name, cachedArtist.image?.uri || undefined)
          } else {
            await updateMetadata(newShowTitle || 'éist', artistName, remoteImageUrl || undefined)
          }
        }
      }
    } catch {
      setBroadcastStatus('error')
      await clearNowPlayingState()
    }
  }, [artistId, artistCache, artistName, remoteImageUrl, getArtistDetails, updateMetadata, clearNowPlayingState, clearNextShowInfo, preloadImage, formatTime])

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
            setNextShowTime(formatTime(nextEvent.startDateUtc))
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

      // Clear next show info when station is live
      clearNextShowInfo()

      // Handle image
      if (image?.uri) {
        const imageLoaded = await preloadImage(image.uri)

        if (imageLoaded) {
          setRemoteImageUrl(image.uri)
          setImageFailed(false)
          await updateMetadata(newShowTitle || 'éist', name, image.uri)
        } else {
          setRemoteImageUrl(null)
          setImageFailed(true)
          await updateMetadata(newShowTitle || 'éist', name, undefined)
        }
      } else {
        setRemoteImageUrl(null)
        setImageFailed(false)
        await updateMetadata(newShowTitle || 'éist', name, placeholderArtistImage)
      }

      // Mark loading as finished
      setIsContentLoading(false)
    } catch {
      setBroadcastStatus('error')
      await clearNowPlayingState()
    }
  }, [getArtistDetails, updateMetadata, clearNowPlayingState, clearNextShowInfo, preloadImage, formatTime])

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

  useFocusEffect(
    useCallback(() => {
      // Initial load with full artist details
      fetchNowPlayingWithArtist()
      // Only poll when playing - use lightweight function
      if (isPlaying) {
        const interval = setInterval(fetchLiveScheduleOnly, 60000) // Reduced from 30s to 60s
        return () => clearInterval(interval)
      }
    }, [fetchNowPlayingWithArtist, fetchLiveScheduleOnly, isPlaying])
  )

  // Player setup is handled by TrackPlayerContext, no need to call setupPlayer here

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

  const iconName = isPlaying
    ? 'stop-circle-outline'
    : 'play-circle-outline'

  // Determine which image to show based on loading state
  const getImageSource = () => {
    if (broadcastStatus !== 'schedule') {
      return placeholderOfflineImage
    }

    if (imageFailed || !remoteImageUrl) {
      return placeholderArtistImage
    }

    return { uri: remoteImageUrl }
  }

  const handleImageError = () => {
    setImageFailed(true)
  }

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await fetchNowPlayingWithArtist()
    } catch (error) {
      console.error('Error in handleRefresh:', error)
      // Don't let errors propagate - just log them
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchNowPlayingWithArtist])

  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y
    const contentHeight = event.nativeEvent.contentSize.height
    const layoutHeight = event.nativeEvent.layoutMeasurement.height

    // Check if content is scrollable (with a small buffer)
    const scrollable = contentHeight > layoutHeight + 10
    setIsScrollable(scrollable)

    // Show back button when scrolled past 100px AND content is scrollable
    setShowBackToTop(scrollable && scrollY > 100)
  }

  const scrollToTop = () => {
    if (scrollViewRef.current) {
      // Use scrollTo with a more reliable approach
      scrollViewRef.current.scrollTo({ 
        y: 0, 
        animated: true 
      })
      
      // Fallback: if the above doesn't work, try without animation
      setTimeout(() => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ 
            y: 0, 
            animated: false 
          })
        }
      }, 100)
    }
  }

  // Calculate hero height - roughly 55% of screen like website
  const heroHeight = Math.min(height * 0.55, width * 1.1)

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.background}
          />
        }
      >
        {/* Hero Section - Image with gradient overlay like website */}
        <View style={[styles.heroContainer, { height: heroHeight }]}>
          <Image
            key={`${artistId}-${remoteImageUrl || 'fallback'}`}
            source={getImageSource()}
            style={styles.heroImage}
            resizeMode="cover"
            onError={handleImageError}
          />

          {/* Gradient overlay matching website style */}
          <LinearGradient
            colors={[
              'transparent',
              'rgba(71, 51, 255, 0.15)',
              'rgba(71, 51, 255, 0.4)',
              'rgba(71, 51, 255, 0.8)',
              'rgba(71, 51, 255, 0.97)',
              '#4733FF',
            ]}
            locations={[0, 0.2, 0.4, 0.6, 0.8, 1]}
            style={styles.heroGradient}
          />

          {/* Loading overlay */}
          {isContentLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}

          {/* Logo in top right */}
          <TouchableOpacity
            style={[styles.logoContainer, { top: insets.top + 12 }]}
            activeOpacity={0.7}
            onPress={() => Linking.openURL('https://eist.radio/support')}
            accessibilityRole="link"
          >
            <Image
              source={logoImage}
              style={styles.logo}
              resizeMode="contain"
            />
          </TouchableOpacity>

          {/* Hero content at bottom - show title over image */}
          <View style={styles.heroContent}>
            {broadcastStatus === 'schedule' && showTitle && (
              <TouchableOpacity
                onPress={() => currentShowId && router.push(`/show/${currentShowId}`)}
                disabled={!currentShowId}
                activeOpacity={0.8}
              >
                <FormattedShowTitle
                  title={showTitle}
                  color={colors.primary}
                  size={28}
                  style={styles.heroTitle}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.contentSection}>
          {/* Player controls row */}
          <View style={styles.playerRow}>
            <TouchableOpacity
              onPress={handlePlayButtonPress}
              style={styles.playButton}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Stop playback' : 'Start playback'}
            >
              <Ionicons
                name={iconName}
                size={52}
                color={colors.text}
              />
            </TouchableOpacity>

            <View style={styles.statusContainer}>
              {broadcastStatus === 'schedule' ? (
                <View style={styles.liveStatusRow}>
                  <LiveIndicator />
                  <TouchableOpacity
                    onPress={() => artistId && router.push(`/artist/${artistId}`)}
                    disabled={!artistId}
                    style={styles.artistNameContainer}
                  >
                    <Text
                      style={[styles.artistName, { color: colors.text }]}
                      numberOfLines={2}
                    >
                      {artistName}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={[styles.offAirText, { color: colors.text }]}>
                  {artistName}
                </Text>
              )}
            </View>
          </View>

          {/* Description */}
          {showDescription ? (
            <View style={styles.descriptionContainer}>
              <SelectableText
                text={showDescription}
                style={[styles.showDescription, { color: colors.text }]}
                linkStyle={{ color: colors.primary }}
              />
            </View>
          ) : null}

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.primary + '25' }]} />

          {/* Next show section (when off air) */}
          {broadcastStatus !== 'schedule' && nextShowId && (
            <TouchableOpacity
              onPress={() => router.push(`/show/${nextShowId}`)}
              style={styles.nextShowCard}
              activeOpacity={0.7}
            >
              <View style={styles.nextShowHeader}>
                <Text style={[styles.sectionLabel, { color: colors.primary + '99' }]}>
                  COMING UP
                </Text>
              </View>
              <View style={styles.nextShowContent}>
                <View style={styles.nextShowTime}>
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={colors.primary}
                    style={styles.timeIcon}
                  />
                  <Text style={[styles.timeText, { color: colors.primary }]}>
                    {nextShowTime}
                  </Text>
                </View>
                <FormattedShowTitle
                  title={nextShowTitle}
                  color={colors.primary}
                  size={18}
                  style={styles.nextShowTitle}
                />
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.text + '60'}
                style={styles.nextShowChevron}
              />
            </TouchableOpacity>
          )}

          {/* Quick links section */}
          <View style={styles.linksSection}>
            <View style={[styles.divider, { backgroundColor: colors.primary + '25' }]} />
            <View style={styles.quickLinks}>
              <TouchableOpacity
                style={styles.quickLink}
                onPress={() => Linking.openURL('https://discord.gg/4eHnAAUmFN')}
              >
                <Ionicons name="chatbubbles-outline" size={18} color={colors.text + '99'} />
                <Text style={[styles.quickLinkText, { color: colors.text }]}>
                  Join the Discord
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickLink}
                onPress={() => Linking.openURL('https://eist.radio/support')}
              >
                <Ionicons name="heart-outline" size={18} color={colors.text + '99'} />
                <Text style={[styles.quickLinkText, { color: colors.text }]}>
                  Support éist
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      <BackToTopButton
        onPress={scrollToTop}
        visible={showBackToTop && isScrollable}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Hero section (matches website front-hero style)
  heroContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 8,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 20,
  },
  heroTitle: {
    fontWeight: '700',
    lineHeight: 32,
    ...(Platform.OS === 'web'
      ? { textShadow: '0px 4px 30px rgba(0, 0, 0, 0.4)' }
      : {
          textShadowColor: 'rgba(0, 0, 0, 0.4)',
          textShadowOffset: { width: 0, height: 4 },
          textShadowRadius: 30,
        }),
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    position: 'absolute',
    right: 16,
  },
  logo: {
    width: 64,
    height: 64,
  },

  // Content section
  contentSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },

  // Player row
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  playButton: {
    padding: 4,
  },
  statusContainer: {
    flex: 1,
    minWidth: 0,
  },
  liveStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  artistNameContainer: {
    flex: 1,
    minWidth: 0,
  },
  artistName: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  offAirText: {
    fontSize: 22,
    fontWeight: '600',
    opacity: 0.8,
  },

  // Live indicator (matches schedule page and website)
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(175, 252, 65, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#AFFC41',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#AFFC41',
    letterSpacing: 0.8,
  },

  // Description
  descriptionContainer: {
    marginBottom: 16,
  },
  showDescription: {
    fontSize: 15,
    lineHeight: 22,
  },

  // Divider (matches schedule page style)
  divider: {
    height: 1,
    width: '100%',
    marginVertical: 16,
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  // Next show card (when off air)
  nextShowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(175, 252, 65, 0.08)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#AFFC41',
    padding: 12,
    paddingLeft: 14,
  },
  nextShowHeader: {
    position: 'absolute',
    top: -20,
    left: 0,
  },
  nextShowContent: {
    flex: 1,
    gap: 4,
  },
  nextShowTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeIcon: {
    marginRight: 2,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  nextShowTitle: {
    fontWeight: '600',
  },
  nextShowChevron: {
    marginLeft: 8,
  },

  // Quick links section
  linksSection: {
    marginTop: 8,
  },
  quickLinks: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  quickLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  quickLinkText: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.85,
  },

  // Back to top button
  backToTopButton: {
    position: 'absolute',
    bottom: 20,
    left: '45%',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backToTopTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronIcon: {},
})
