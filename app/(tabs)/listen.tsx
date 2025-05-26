// listen.tsx
import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native'
import { useTheme, useFocusEffect } from '@react-navigation/native'
import { API_KEY as apiKey } from '@env'
import { ThemedText } from '@/components/ThemedText'
import { useAudio } from '../../context/AudioContext'
import { Ionicons } from '@expo/vector-icons'

// Local assets & placeholders
const placeholderArtistImage = require('../../assets/images/eist_online.png')
const placeholderOfflineImage = require('../../assets/images/eist_offline.png')
const logoImage = require('../../assets/images/eist-logo-header.png')
const gradientOverlay = require('../../assets/images/gradient.png')

// API constants
const stationId = 'eist-radio'
const apiUrl = `https://api.radiocult.fm/api/station/${stationId}`

export default function ListenScreen() {
  const { colors } = useTheme()
  const { isPlaying, togglePlay } = useAudio()
  const { width, height } = Dimensions.get('window')

  // UI state from API
  const [showTitle, setShowTitle] = useState<string>('—')
  const [showDescription, setShowDescription] = useState<string>(' ')
  const [artistName, setArtistName] = useState<string>('éist · off air')
  const [artistImage, setArtistImage] = useState<any>(placeholderOfflineImage)
  const [broadcastStatus, setBroadcastStatus] = useState<string>('off air')

  // Fetch artist details by ID
  const getArtistDetails = async (artistId: string | null) => {
    if (!artistId) {
      return {
        name: '—',
        bio: ' ',
        image: placeholderArtistImage,
      }
    }
    try {
      const res = await fetch(`${apiUrl}/artists/${artistId}`, {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const artist = json.artist || {}
      return {
        name: artist.name || '—',
        bio:
          artist.description?.content?.[0]?.content?.[0]?.text ||
          'No description available',
        image: artist.logo?.['256x256'] || placeholderArtistImage,
      }
    } catch (err) {
      console.error('getArtistDetails failed', err)
      return {
        name: '—',
        bio: ' ',
        image: placeholderArtistImage,
      }
    }
  }

  // Fetch now‐playing + artist → update state
  const fetchNowPlaying = async () => {
    try {
      const res = await fetch(`${apiUrl}/schedule/live`, {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const { status, content } = data.result
      setBroadcastStatus(status)

      if (status !== 'schedule') {
        // Off air: show offline placeholder
        setShowTitle('—')
        setArtistName('éist · off air')
        setArtistImage(placeholderOfflineImage)
        setShowDescription(' ')
      } else {
        // Live: fetch artist details
        const title = content.title || '—'
        setShowTitle(title)
        const artistId = content.artistIds?.[0] ?? null
        const details = await getArtistDetails(artistId)
        setArtistName(details.name)
        setArtistImage(details.image)
        setShowDescription(details.bio)
      }
    } catch (err) {
      console.error('fetchNowPlaying failed', err)
      // On error: fallback to offline
      setBroadcastStatus('error')
      setShowTitle('—')
      setArtistName('éist · off air')
      setArtistImage(placeholderOfflineImage)
      setShowDescription(' ')
    }
  }

  // Poll every 30s when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchNowPlaying()
      const interval = setInterval(fetchNowPlaying, 30000)
      return () => clearInterval(interval)
    }, [])
  )

  // Play/pause icon
  const iconName = isPlaying ? 'pause-circle' : 'play-circle'

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Top half: artist image (or placeholder) + gradient + logo */}
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
        <View style={styles.logoContainer}>
          <Image
            source={logoImage}
            style={{ width: 112, height: 112 }}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* Bottom half: controls + now-playing info */}
      <View style={styles.bottom}>
        <View style={styles.controlContainer}>
          <TouchableOpacity onPress={togglePlay} style={styles.playButton}>
            <Ionicons name={iconName} size={64} color={colors.primary} />
          </TouchableOpacity>
          <ThemedText
            type="subtitle"
            style={[styles.artistName, { color: colors.text }]}
          >
            {artistName}
          </ThemedText>
        </View>

        <ScrollView
          style={styles.nowPlayingContainer}
          contentContainerStyle={styles.nowPlayingContent}
        >
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
    bottom: 36,
    right: 24,
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
    paddingLeft: 6,
  },
  playButton: {
    marginRight: 16,
  },
  artistName: {
    fontSize: 26,
  },
  nowPlayingContainer: {
    flex: 1,
    width: '100%',
  },
  nowPlayingContent: {
    paddingHorizontal: 12,
  },
  showTitle: {
    fontSize: 20,
    marginBottom: 6,
  },
  showDescription: {
    fontSize: 16,
    lineHeight: 22,
  },
})
