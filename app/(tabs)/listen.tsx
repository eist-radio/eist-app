// app/(tabs)/listen.tsx

import { SwipeNavigator } from '@/components/SwipeNavigator'
import { ThemedText } from '@/components/ThemedText'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useTheme } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useState } from 'react'
import {
    ActivityIndicator,
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
    View
} from 'react-native'
import { apiKey } from '../../config'
import { useTrackPlayer } from '../../context/TrackPlayerContext'

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
    marginHorizontal: 8,
    marginVertical: 4,
  },
  nextIcon: { marginRight: 6 },
  nextUp: { fontSize: 20, fontWeight: '500', flex: 1, flexWrap: 'wrap' },
  showTitle: { fontSize: 24, fontWeight: '500', marginHorizontal: 2, marginVertical: 2 },
  showDescription: { fontSize: 18, lineHeight: 22, marginHorizontal: 2, marginVertical: 2 },
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
    isPlayerReady,
    setupPlayer,
    updateMetadata,
  } = useTrackPlayer()
  const { width } = Dimensions.get('window')
  const router = useRouter()

  const [showTitle, setShowTitle] = useState('')
  const [showDescription, setShowDescription] = useState('')
  const [artistName, setArtistName] = useState('éist · off air')
  const [artistImage, setArtistImage] = useState<any>(placeholderArtistImage)
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
  const [imageReady, setImageReady] = useState(false)

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

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
            console.log('Image preloaded successfully (web):', uri)
            resolve(true)
          }
          img.onerror = (error: any) => {
            console.log('Image preload failed (web):', error)
            resolve(false)
          }
          img.src = uri
        } catch (error) {
          console.log('Web image preload not supported:', error)
          // Fallback: assume image will load fine
          resolve(true)
        }
      } else {
        // React Native environment
        if (typeof Image.prefetch === 'function') {
          Image.prefetch(uri)
            .then(() => {
              console.log('Image preloaded successfully:', uri)
              resolve(true)
            })
            .catch((error) => {
              console.log('Image preload failed:', error)
              resolve(false)
            })
        } else {
          // Fallback if prefetch is not available
          console.log('Image.prefetch not available, skipping preload')
          resolve(true)
        }
      }
    })
  }, [])

  const getArtistDetails = useCallback(async (id: string | null) => {
    if (!id) return { name: '', image: null }
    try {
      const res = await fetch(`${apiUrl}/artists/${id}`, {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const artist = json.artist || {}
      const imageUrl = artist.logo?.['1024x1024'] || artist.logo?.['512x512'] || artist.logo?.['256x256']
      return {
        name: artist.name || '',
        image: imageUrl ? { uri: imageUrl } : null,
      }
    } catch (err) {
      console.error('getArtistDetails failed', err)
      return { name: '', image: null }
    }
  }, [])

  const clearNowPlayingState = useCallback(async () => {
    setShowTitle('')
    setArtistName('éist · off air')
    setArtistImage(placeholderOfflineImage)
    setRemoteImageUrl(null)
    setImageFailed(false)
    setShowDescription('')
    setArtistId(null)
    setCurrentShowId(null)
    setNextShowId(null)
    setNextShowTitle('')
    setNextShowTime('')
    setIsContentLoading(false)
    setImageReady(true) // Offline images are always "ready"
    await updateMetadata('éist · off air', '', undefined)
  }, [updateMetadata])

  const fetchNowPlaying = useCallback(async () => {
    if (!isPlayerReady) return

    // Set loading state when starting to fetch new content
    setIsContentLoading(true)
    setImageReady(false) // Hide image until new content is ready

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
          console.error('fetchNextShow failed', nextErr)
        }
        // Loading finished for off-air state - clearNowPlayingState already set imageReady
        setIsContentLoading(false)
      } else {
        // Prepare new content
        const newShowTitle = content.title || ''
        const newCurrentShowId = content.id || null
        const id = content.artistIds?.[0] ?? null
        
        const { name, image } = await getArtistDetails(id)
        
        // Prepare description
        let desc = parseDescription(content.description?.content || [])
        if (content.media?.type === 'playlist' && metadata?.title) {
          desc += `\n\nNow playing: ${metadata.title}`
        }

        // If we have a remote image, preload it before updating the UI
        if (image?.uri) {
          console.log('Preloading artist image:', image.uri)
          const imageLoaded = await preloadImage(image.uri)
          
          if (imageLoaded) {
            // Image loaded successfully - update all states together
            setShowTitle(newShowTitle)
            setCurrentShowId(newCurrentShowId)
            setArtistId(id)
            setArtistName(name)
            setRemoteImageUrl(image.uri)
            setArtistImage(image)
            setImageFailed(false)
            setShowDescription(desc)
            
            // Clear next show info
            setNextShowId(null)
            setNextShowTitle('')
            setNextShowTime('')
            
            await updateMetadata(newShowTitle || 'éist', name, image.uri)
          } else {
            // Image failed to preload - use fallback
            setShowTitle(newShowTitle)
            setCurrentShowId(newCurrentShowId)
            setArtistId(id)
            setArtistName(name)
            setRemoteImageUrl(null)
            setArtistImage(placeholderArtistImage)
            setImageFailed(true)
            setShowDescription(desc)
            
            // Clear next show info
            setNextShowId(null)
            setNextShowTitle('')
            setNextShowTime('')
            
            await updateMetadata(newShowTitle || 'éist', name, undefined)
          }
        } else {
          // No remote image - use fallback immediately
          setShowTitle(newShowTitle)
          setCurrentShowId(newCurrentShowId)
          setArtistId(id)
          setArtistName(name)
          setRemoteImageUrl(null)
          setArtistImage(placeholderArtistImage)
          setImageFailed(false)
          setShowDescription(desc)
          
          // Clear next show info
          setNextShowId(null)
          setNextShowTitle('')
          setNextShowTime('')
          
          await updateMetadata(newShowTitle || 'éist', name, undefined)
        }
        
        // Mark image as ready and loading as finished
        setImageReady(true)
        setIsContentLoading(false)
      }
    } catch (err) {
      console.error('fetchNowPlaying failed', err)
      setBroadcastStatus('error')
      await clearNowPlayingState()
    }
  }, [isPlayerReady, getArtistDetails, updateMetadata, clearNowPlayingState, preloadImage])

  useFocusEffect(
    useCallback(() => {
      if (!isPlayerReady) return
      fetchNowPlaying()
      const interval = setInterval(fetchNowPlaying, 30000)
      return () => clearInterval(interval)
    }, [isPlayerReady, fetchNowPlaying])
  )

  useEffect(() => {
    setupPlayer()
  }, [setupPlayer])

  // Refresh now playing info whenever the app returns to the foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        fetchNowPlaying()
      }
    })

    return () => {
      subscription.remove()
    }
  }, [fetchNowPlaying])

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
    console.log('Remote image failed to load, falling back to placeholder')
    setImageFailed(true)
  }

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await fetchNowPlaying()
    } catch (error) {
      console.error('Refresh failed:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchNowPlaying])

  return (
    <SwipeNavigator>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.imageContainer, { height: width }]}>
          {imageReady ? (
            <Image
              key={`${artistId}-${remoteImageUrl || 'fallback'}`}
              source={getImageSource()}
              style={styles.fullWidthImage}
              resizeMode="cover"
              onError={handleImageError}
            />
          ) : (
            <View style={[styles.fullWidthImage, { backgroundColor: colors.card }]} />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.2)']}
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
                style={{ width: 74, height: 74 }}
                resizeMode="contain"
              />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.bottom}>
          <View style={styles.controlContainer}>
            <TouchableOpacity onPress={togglePlayStop} style={styles.playButton}>
              <Ionicons name={iconName} size={56} color={colors.primary} />
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
            style={styles.nowPlayingContainer}
            contentContainerStyle={styles.nowPlayingContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          >
            {broadcastStatus !== 'schedule' && nextShowId && (
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
                  <Text style={{ fontWeight: '400' }}>Next up: </Text>
                  <Text style={{ fontWeight: '700' }}>{nextShowTitle}</Text>
                  <Text style={{ fontWeight: '400' }}> at {nextShowTime}</Text>
                </Text>
              </TouchableOpacity>
            )}

            {currentShowId ? (
              <TouchableOpacity
                onPress={() => router.push(`/show/${currentShowId}`)}
                activeOpacity={0.7}
              >
                <ThemedText
                  type="subtitle"
                  style={[styles.showTitle, { color: colors.primary }]}
                >
                  {showTitle}
                </ThemedText>
              </TouchableOpacity>
            ) : (
              <ThemedText
                type="subtitle"
                style={[styles.showTitle, { color: colors.text }]}
              >
                {showTitle}
              </ThemedText>
            )}
            <ThemedText
              type="default"
              style={[styles.showDescription, { color: colors.text }]}
            >
              {showDescription}
            </ThemedText>
          </ScrollView>
        </View>
      </View>
    </SwipeNavigator>
  )
}
