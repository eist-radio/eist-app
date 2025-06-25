// app/(tabs)/listen.tsx

import { SwipeNavigator } from '@/components/SwipeNavigator'
import { ThemedText } from '@/components/ThemedText'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useTheme } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useState } from 'react'
import {
  Dimensions,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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
  const [broadcastStatus, setBroadcastStatus] = useState('off air')
  const [nextShowId, setNextShowId] = useState<string | null>(null)
  const [nextShowTitle, setNextShowTitle] = useState('')
  const [nextShowTime, setNextShowTime] = useState('')
  const [artistId, setArtistId] = useState<string | null>(null)
  const [currentShowId, setCurrentShowId] = useState<string | null>(null)

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

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

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
    setShowDescription('')
    setArtistId(null)
    setCurrentShowId(null)
    setNextShowId(null)
    setNextShowTitle('')
    setNextShowTime('')
    await updateMetadata('éist · off air', '', undefined)
  }, [updateMetadata])

  const fetchNowPlaying = useCallback(async () => {
    if (!isPlayerReady) return

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
      } else {
        setShowTitle(content.title || '')
        setCurrentShowId(content.id || null)
        const id = content.artistIds?.[0] ?? null
        setArtistId(id)
        const { name, image } = await getArtistDetails(id)
        setArtistName(name)
        setArtistImage(image || placeholderArtistImage)

        let desc = parseDescription(content.description?.content || [])
        if (content.media?.type === 'playlist' && metadata?.title) {
          desc += `\n\nNow playing: ${metadata.title}`
        }
        setShowDescription(desc)

        setNextShowId(null)
        setNextShowTitle('')
        setNextShowTime('')

        const artworkUri = (image || placeholderArtistImage).uri
        await updateMetadata(content.title || 'éist', name, artworkUri)
      }
    } catch (err) {
      console.error('fetchNowPlaying failed', err)
      setBroadcastStatus('error')
      await clearNowPlayingState()
    }
  }, [isPlayerReady, getArtistDetails, updateMetadata, clearNowPlayingState])

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

  const iconName = isPlaying
    ? 'stop-circle-outline'
    : 'play-circle-outline'

  return (
    <SwipeNavigator>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.imageContainer, { height: width }]}>
          <Image
            source={artistImage}
            style={styles.fullWidthImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.2)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
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
