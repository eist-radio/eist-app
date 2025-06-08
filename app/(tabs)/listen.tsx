// app/(tabs)/listen.tsx

import React, { useCallback, useState, useEffect } from 'react'
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Linking,
} from 'react-native'
import { useTheme, useFocusEffect } from '@react-navigation/native'
import { useRouter } from 'expo-router'
import { ThemedText } from '@/components/ThemedText'
import { useTrackPlayer } from '../../context/TrackPlayerContext'
import { Ionicons } from '@expo/vector-icons'
import { apiKey } from '../../config'

const placeholderArtistImage = require('../../assets/images/eist_online.png')
const placeholderOfflineImage = require('../../assets/images/eist_offline.png')
const logoImage = require('../../assets/images/eist-logo-header.png')
const gradientOverlay = require('../../assets/images/gradient.png')

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
  const { width, height } = Dimensions.get('window')
  const router = useRouter()

  const [showTitle, setShowTitle] = useState<string>(' ')
  const [showDescription, setShowDescription] = useState<string>(' ')
  const [artistName, setArtistName] = useState<string>('éist · off air')
  const [artistImage, setArtistImage] = useState<any>(placeholderOfflineImage)
  const [broadcastStatus, setBroadcastStatus] = useState<string>('off air')
  const [nextShowId, setNextShowId] = useState<string | null>(null)
  const [nextShowTitle, setNextShowTitle] = useState<string>(' ')
  const [nextShowTime, setNextShowTime] = useState<string>(' ')
  const [artistId, setArtistId] = useState<string | null>(null)

  // turn rich text blocks into plain text
  const parseDescription = (blocks: any[]): string =>
    blocks
      .map(block => {
        if (!Array.isArray(block.content)) return ''
        return block.content
          .map(child => {
            if (child.type === 'text') return child.text
            if (child.type === 'hardBreak') return '\n'
            return ''
          })
          .join('')
      })
      .filter(Boolean)
      .join('\n\n') || ' '

  // format ISO timestamp to "h:mm AM/PM"
  const formatTime = (isoString: string): string => {
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  // fetch artist name and image by ID
  const getArtistDetails = useCallback(async (id: string | null) => {
    if (!id) {
      return { name: ' ', image: placeholderArtistImage as any }
    }
    try {
      const res = await fetch(`${apiUrl}/artists/${id}`, {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const artist = json.artist || {}
      const imageUrl: string | undefined = artist.logo?.['256x256']
      return {
        name: artist.name || ' ',
        image: imageUrl
          ? ({ uri: imageUrl } as any)
          : (placeholderArtistImage as any),
      }
    } catch (err) {
      console.error('getArtistDetails failed', err)
      return { name: ' ', image: placeholderArtistImage as any }
    }
  }, [])

  // poll API for now-playing and next show
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
        // off air: reset display and fetch next
        setShowTitle(' ')
        setArtistName('éist · off air')
        setArtistImage(placeholderOfflineImage)
        setShowDescription(' ')
        setArtistId(null)
        setNextShowId(null)
        setNextShowTitle(' ')
        setNextShowTime(' ')
        await updateMetadata('éist · off air', '', undefined)

        try {
          const now = new Date().toISOString()
          const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString()
          const nextRes = await fetch(
            `${apiUrl}/schedule?startDate=${encodeURIComponent(
              now
            )}&endDate=${encodeURIComponent(weekAhead)}`,
            {
              headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
            }
          )
          if (!nextRes.ok) throw new Error(`HTTP ${nextRes.status}`)
          const nextJson = await nextRes.json()
          const events: any[] = nextJson.schedules || []
          if (events.length > 0) {
            events.sort(
              (a, b) =>
                new Date(a.startDateUtc).getTime() -
                new Date(b.startDateUtc).getTime()
            )
            const nextEvent = events[0]
            setNextShowId(nextEvent.id)
            setNextShowTitle(nextEvent.title || ' ')
            setNextShowTime(formatTime(nextEvent.startDateUtc))
          }
        } catch (nextErr) {
          console.error('fetchNextShow failed', nextErr)
        }
      } else {
        // on air: update display and metadata
        setShowTitle(content.title || ' ')
        const id = content.artistIds?.[0] ?? null
        setArtistId(id)
        const { name, image } = await getArtistDetails(id)
        setArtistName(name)
        setArtistImage(image)

        let desc = parseDescription(content.description?.content || [])
        if (content.media?.type === 'playlist' && metadata?.title) {
          desc += `\n\nNow playing: ${metadata.title}`
        }
        setShowDescription(desc)

        setNextShowId(null)
        setNextShowTitle(' ')
        setNextShowTime(' ')

        const artworkUri = (image as any).uri
        await updateMetadata(content.title || 'éist', name, artworkUri)
      }
    } catch (err) {
      console.error('fetchNowPlaying failed', err)
      setBroadcastStatus('error')
      setShowTitle(' ')
      setArtistName('éist · off air')
      setArtistImage(placeholderOfflineImage)
      setShowDescription(' ')
      setArtistId(null)
      setNextShowId(null)
      setNextShowTitle(' ')
      setNextShowTime(' ')
      await updateMetadata('éist · off air', '', undefined)
    }
  }, [getArtistDetails, isPlayerReady, updateMetadata])

  // start polling when screen focused and player is ready
  useFocusEffect(
    useCallback(() => {
      if (!isPlayerReady) return
      fetchNowPlaying()
      const interval = setInterval(fetchNowPlaying, 30000)
      return () => clearInterval(interval)
    }, [isPlayerReady, fetchNowPlaying])
  )

  // initialize TrackPlayer on mount
  useEffect(() => {
    setupPlayer()
  }, [setupPlayer])

  const iconName = isPlaying
    ? 'stop-circle-outline'
    : 'play-circle-outline'

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* top half: live image and logo link */}
      <View style={[styles.imageContainer, { height: height / 2 }]}>
        <Image
          source={artistImage}
          style={{ width, height: width }}
          resizeMode="cover"
        />
        <Image
          source={gradientOverlay}
          style={[StyleSheet.absoluteFill, { width, height: width }]}
          resizeMode="stretch"
        />

        <TouchableOpacity
          style={styles.logoContainer}
          activeOpacity={0.7}
          onPress={() => Linking.openURL('https://eist.radio')}
          accessibilityRole="link"
        >
          <Image
            source={logoImage}
            style={{ width: 74, height: 74 }}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>

      {/* bottom half: controls and metadata */}
      <View style={styles.bottom}>
        <View style={styles.controlContainer}>
          <TouchableOpacity
            onPress={togglePlayStop}
            style={styles.playButton}
          >
            <Ionicons
              name={iconName}
              size={56}
              color={colors.primary}
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
              <ThemedText
                type="subtitle"
                style={[styles.nextUp, { color: colors.text }]}
              >
                Next up: {nextShowTitle} at {nextShowTime}
              </ThemedText>
            </TouchableOpacity>
          )}

          <ThemedText
            type="subtitle"
            style={[styles.showTitle, { color: colors.text }]}
          >
            {showTitle}
          </ThemedText>
          <ThemedText
            type="body"
            style={[styles.showDescription, { color: colors.text }]}
          >
            {showDescription}
          </ThemedText>
        </ScrollView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  logoContainer: {
    position: 'absolute',
    top: 36,
    right: 18,
  },
  bottom: {
    flex: 1,
    paddingBottom: 12,
    alignItems: 'flex-start',
  },
  controlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingLeft: 4,
    paddingRight: 4,
  },
  playButton: {
    marginRight: 16,
  },
  artistContainer: {
    flex: 1,
  },
  artistNameWrapped: {
    fontSize: 28,
    fontWeight: '700',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  nowPlayingContainer: {
    flex: 1,
    width: '100%',
  },
  nowPlayingContent: {
    paddingHorizontal: 12,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    marginBottom: 6,
    width: '100%',
  },
  nextIcon: {
    marginRight: 6,
  },
  nextUp: {
    fontSize: 20,
    fontWeight: '400',
    fontStyle: 'italic',
    flex: 1,
    flexWrap: 'wrap',
  },
  showTitle: {
    fontSize: 24,
    fontWeight: '500',
    marginBottom: 6,
  },
  showDescription: {
    fontSize: 18,
    lineHeight: 22,
  },
})
