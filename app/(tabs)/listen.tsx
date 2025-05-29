// app/(tabs)/listen.tsx

import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  ImageSourcePropType,
} from 'react-native';
import { useTheme, useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { useAudio } from '../../context/AudioContext';
import { Ionicons } from '@expo/vector-icons';
import { apiKey } from '../../config';

// Local assets & placeholders
const placeholderArtistImage = require('../../assets/images/eist_online.png');
const placeholderOfflineImage = require('../../assets/images/eist_offline.png');
const logoImage = require('../../assets/images/eist-logo-header.png');
const gradientOverlay = require('../../assets/images/gradient.png');

// API constants
const stationId = 'eist-radio';
const apiUrl = `https://api.radiocult.fm/api/station/${stationId}`;

export default function ListenScreen() {
  const { colors } = useTheme();
  const { isPlaying, togglePlay } = useAudio();
  const { width, height } = Dimensions.get('window');
  const router = useRouter();              // ← useRouter, not useNavigation

  // UI state from API
  const [showTitle, setShowTitle] = useState<string>(' ');
  const [showDescription, setShowDescription] = useState<string>(' ');
  const [artistName, setArtistName] = useState<string>('éist · off air');
  const [artistImage, setArtistImage] = useState<ImageSourcePropType>(
    placeholderOfflineImage
  );
  const [broadcastStatus, setBroadcastStatus] = useState<string>('off air');

  // Keep current artist ID for navigation
  const [artistId, setArtistId] = useState<string | null>(null);

  // Helper: flatten Rich Text blocks
  const parseDescription = (blocks: any[]): string =>
    blocks
      .map(block => {
        if (!Array.isArray(block.content)) return '';
        return block.content
          .map(child => {
            if (child.type === 'text') return child.text;
            if (child.type === 'hardBreak') return '\n';
            return '';
          })
          .join('');
      })
      .filter(Boolean)
      .join('\n\n') || ' ';

  // Fetch artist details by ID
  const getArtistDetails = useCallback(async (id: string | null) => {
    if (!id) {
      return {
        name: ' ',
        image: placeholderArtistImage as ImageSourcePropType,
      };
    }
    try {
      const res = await fetch(`${apiUrl}/artists/${id}`, {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const artist = json.artist || {};
      const imageUrl: string | undefined = artist.logo?.['256x256'];
      return {
        name: artist.name || ' ',
        image: imageUrl
          ? ({ uri: imageUrl } as ImageSourcePropType)
          : (placeholderArtistImage as ImageSourcePropType),
      };
    } catch (err) {
      console.error('getArtistDetails failed', err);
      return {
        name: ' ',
        image: placeholderArtistImage as ImageSourcePropType,
      };
    }
  }, []);

  // Fetch now‐playing + artist → update state
  const fetchNowPlaying = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/schedule/live`, {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const { status, content, metadata } = data.result;

      setBroadcastStatus(status);

      if (status !== 'schedule') {
        setShowTitle(' ');
        setArtistName('éist · off air');
        setArtistImage(placeholderOfflineImage);
        setShowDescription(' ');
        setArtistId(null);
      } else {
        setShowTitle(content.title || ' ');
        const id = content.artistIds?.[0] ?? null;
        setArtistId(id);
        const { name, image } = await getArtistDetails(id);
        setArtistName(name);
        setArtistImage(image);

        let desc = parseDescription(content.description?.content || []);
        if (content.media?.type === 'playlist' && metadata?.title) {
          desc += `\n\nNow playing: ${metadata.title}`;
        }
        setShowDescription(desc);
      }
    } catch (err) {
      console.error('fetchNowPlaying failed', err);
      setBroadcastStatus('error');
      setShowTitle(' ');
      setArtistName('éist · off air');
      setArtistImage(placeholderOfflineImage);
      setShowDescription(' ');
      setArtistId(null);
    }
  }, [getArtistDetails]);

  // Poll every 30s when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchNowPlaying();
      const interval = setInterval(fetchNowPlaying, 30000);
      return () => clearInterval(interval);
    }, [fetchNowPlaying])
  );

  const iconName = isPlaying ? 'pause-circle' : 'play-circle';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Top half */}
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
            style={{ width: 74, height: 74 }}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* Bottom half */}
      <View style={styles.bottom}>
        <View style={styles.controlContainer}>
          <TouchableOpacity onPress={togglePlay} style={styles.playButton}>
            <Ionicons name={iconName} size={64} color={colors.primary} />
          </TouchableOpacity>

          {/* use router.push, not navigation.navigate */}
          <TouchableOpacity
            onPress={() => artistId && router.push(`/artist/${artistId}`)}
            disabled={!artistId}
          >
            <ThemedText
              type="subtitle"
              style={[styles.artistNameWrapped, { color: colors.text }]}
            >
              {artistName}
            </ThemedText>
          </TouchableOpacity>
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
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  imageContainer: { width: '100%', position: 'relative', overflow: 'hidden' },
  logoContainer: { position: 'absolute', top: 36, right: 18 },
  bottom: { flex: 1, paddingBottom: 12, alignItems: 'flex-start' },
  artistNameWrapped: { fontSize: 28, fontWeight: '700', flexShrink: 1, flexWrap: 'wrap' },
  controlContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingLeft: 6 },
  playButton: { marginRight: 16 },
  nowPlayingContainer: { flex: 1, width: '100%' },
  nowPlayingContent: { paddingHorizontal: 12 },
  showTitle: { fontSize: 24, fontWeight: '500', marginBottom: 6 },
  showDescription: { fontSize: 18, lineHeight: 22 },
});
