// app/(tabs)/listen.tsx

import { SelectableText } from '@/components/SelectableText'
import { SwipeNavigator } from '@/components/SwipeNavigator'
import { ThemedText } from '@/components/ThemedText'
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

const BackToTopButton = ({ onPress, visible }: { onPress: () => void; visible: boolean }) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  imageContainer: { width: '100%', position: 'relative', overflow: 'hidden' },
  fullWidthImage: { width: '100%', height: '100%' },
  logoContainer: { position: 'absolute', top: 36, right: 18 },
  logoBackground: {
    borderRadius: 37,
    padding: 8,
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
  bottom: { flex: 1, paddingBottom: 12, alignItems: 'flex-start' },
  controlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 16,
  },
  playButton: { marginRight: 8 },
  artistContainer: { flex: 1 },
  artistNameWrapped: {
    fontSize: 28,
    fontWeight: '700',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  nowPlayingContainer: { flex: 1, width: '100%' },
  nowPlayingContent: { paddingHorizontal: 16 },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  nextIcon: { marginRight: 6 },
  nextUp: { fontSize: 20, fontWeight: '500', flex: 1, flexWrap: 'wrap' },
  showTitle: { fontSize: 24, fontWeight: '500', marginHorizontal: 2, marginVertical: 2 },
  showDescription: { fontSize: 18, lineHeight: 22, marginHorizontal: 2, marginVertical: 2 },
  backToTopButton: {
    position: 'absolute',
    bottom: 20,
    left: '45%',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backToTopTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronIcon: {
    // No specific style needed, icon will handle its own size and color
  },
})

const placeholderArtistImage = require('../../assets/images/eist_online.png')
const placeholderOfflineImage = require('../../assets/images/eist_offline.png')
const logoImage = require('../../assets/images/eist-logo-header.png')

const stationId = 'eist-radio'
const apiUrl = `https://api.radiocult.fm/api/station/${stationId}`

export default function ListenScreen() {
  const { colors } = useTheme()
  const {
    isPlaying,
    togglePlayStop,
    updateMetadata,
    isBusy,
  } = useTrackPlayer()
  const { width } = Dimensions.get('window')
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
    if (!id) return { name: '', image: null }

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
        image: imageUrl ? { uri: imageUrl } : null,
      }

      // Cache the result
      setArtistCache(prev => ({ ...prev, [id]: artistData }))
      return artistData
    } catch (err) {
      console.error('Error fetching artist details:', err)
      // Don't let errors propagate - just log them and return fallback
      return { name: '', image: null }
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
            await updateMetadata(newShowTitle || 'éist', cachedArtist.name, cachedArtist.image?.uri)
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
        await updateMetadata(newShowTitle || 'éist', name, undefined)
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

    // Check if content is scrollable
    const scrollable = contentHeight > layoutHeight
    setIsScrollable(scrollable)

    // Show back button when scrolled past 100px AND content is scrollable
    setShowBackToTop(scrollable && scrollY > 100)
  }

  const scrollToTop = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ 
        y: 0, 
        animated: true 
      })
    }
  }

  return (
    <SwipeNavigator>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.imageContainer, { height: width }]}>
          <Image
            key={`${artistId}-${remoteImageUrl || 'fallback'}`}
            source={getImageSource()}
            style={styles.fullWidthImage}
            resizeMode="cover"
            onError={handleImageError}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.1)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {isContentLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
          <TouchableOpacity
            style={styles.logoContainer}
            activeOpacity={0.7}
            onPress={() => Linking.openURL('https://eist.radio/support')}
            accessibilityRole="link"
          >
            <View style={styles.logoBackground}>
              <Image
                source={logoImage}
                style={{ width: 81.4, height: 81.4 }}
                resizeMode="contain"
              />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.bottom}>
          <View style={styles.controlContainer}>
            <TouchableOpacity 
              onPress={handlePlayButtonPress} 
              style={styles.playButton}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Stop playback' : 'Start playback'}
            >
              <Ionicons 
                name={iconName} 
                size={56} 
                color={isBusy ? colors.text + '40' : colors.primary} 
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => artistId && router.push(`/artist/${artistId}`)}
              disabled={!artistId}
              style={styles.artistContainer}
            >
              <ThemedText
                type="subtitle"
                style={[styles.artistNameWrapped, { color: colors.text }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {artistName}
              </ThemedText>
            </TouchableOpacity>
          </View>



          <ScrollView
            ref={scrollViewRef}
            style={styles.nowPlayingContainer}
            contentContainerStyle={styles.nowPlayingContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          >
            {(() => {
              return broadcastStatus !== 'schedule' && nextShowId
            })() && (
                <TouchableOpacity
                  onPress={() => router.push(`/show/${nextShowId}`)}
                  style={styles.nextRow}
                >
                  <Ionicons
                    name="calendar-clear-outline"
                    size={20}
                    color={colors.text}
                    style={styles.nextIcon}
                  />
                  <Text style={[styles.nextUp, { color: colors.text }]}>
                    <Text style={{ fontWeight: '400' }}>Next: </Text>
                    <FormattedShowTitle
                      title={nextShowTitle}
                      color={colors.text}
                      size={20}
                      style={{ fontWeight: '700' }}
                      asContent={true}
                    />
                    <Text style={{ fontWeight: '400' }}> at {nextShowTime}</Text>
                  </Text>
                </TouchableOpacity>
              )}

            {currentShowId ? (
              <TouchableOpacity
                onPress={() => router.push(`/show/${currentShowId}`)}
                activeOpacity={0.7}
              >
                <FormattedShowTitle
                  title={showTitle}
                  color={colors.primary}
                  size={24}
                  style={styles.showTitle}
                />
              </TouchableOpacity>
            ) : (
              <FormattedShowTitle
                title={showTitle}
                color={colors.text}
                size={24}
                style={styles.showTitle}
              />
            )}
            <SelectableText
              text={showDescription}
              style={[styles.showDescription, { color: colors.text }]}
              linkStyle={{ color: colors.primary }}
            />
          </ScrollView>
        </View>
        <BackToTopButton
          onPress={scrollToTop}
          visible={showBackToTop && isScrollable}
        />
      </View>
    </SwipeNavigator>
  )
}
