// components/ArchiveShowCard.tsx

import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArchiveShow } from '../types/archive';
import { FormattedShowTitle } from './FormattedShowTitle';

const fallbackImage = require('../assets/images/eist_online.png');

interface ArchiveShowCardProps {
  show: ArchiveShow;
  compact?: boolean;
}

function getShowImage(show: ArchiveShow): string | null {
  // Prefer Mixcloud images
  if (show.mixcloud_match?.pictures) {
    const pics = show.mixcloud_match.pictures;
    return pics['640wx640h'] || pics.extra_large || pics.large || pics.medium || null;
  }
  // Fallback to SoundCloud
  if (show.soundcloud_match?.thumbnail) {
    return show.soundcloud_match.thumbnail;
  }
  return null;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const ArchiveShowCardComponent: React.FC<ArchiveShowCardProps> = ({ show, compact = false }) => {
  const { colors } = useTheme();
  const router = useRouter();
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = getShowImage(show);
  const hasPlayableContent = show.mixcloud_match || show.soundcloud_match;

  const handleImageError = useCallback(() => {
    setImageFailed(true);
  }, []);

  const handlePress = useCallback(() => {
    router.push(`/archive/${encodeURIComponent(show.slug)}`);
  }, [router, show.slug]);

  const imageSource =
    imageUrl && !imageFailed ? { uri: imageUrl } : fallbackImage;

  const screenWidth = Dimensions.get('window').width;
  const cardWidth = compact ? (screenWidth - 48) / 2 : screenWidth - 32;
  const imageSize = compact ? cardWidth - 16 : 80;

  if (compact) {
    return (
      <Pressable onPress={handlePress} style={[styles.compactCard, { width: cardWidth }]}>
        <Image
          source={imageSource}
          style={[styles.compactImage, { width: imageSize, height: imageSize }]}
          resizeMode="cover"
          onError={handleImageError}
        />
        <View style={styles.compactContent}>
          <FormattedShowTitle
            title={show.title}
            color={colors.primary}
            size={14}
            style={styles.compactTitle}
            numberOfLines={2}
          />
          <Text
            style={[styles.compactArtist, { color: colors.text }]}
            numberOfLines={1}
          >
            {show.artistName}
          </Text>
          <Text
            style={[styles.compactDate, { color: colors.text }]}
            numberOfLines={1}
          >
            {formatDate(show.start)}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={handlePress} style={styles.card}>
      <Image
        source={imageSource}
        style={styles.image}
        resizeMode="cover"
        onError={handleImageError}
      />
      <View style={styles.content}>
        <FormattedShowTitle
          title={show.title}
          color={colors.primary}
          size={16}
          style={styles.title}
          numberOfLines={2}
        />
        <Text
          style={[styles.artist, { color: colors.text }]}
          numberOfLines={1}
        >
          {show.artistName}
        </Text>
        <Text
          style={[styles.date, { color: colors.text }]}
          numberOfLines={1}
        >
          {formatDate(show.start)}
        </Text>
      </View>
      {hasPlayableContent && (
        <Ionicons
          name="play-circle-outline"
          size={28}
          color={colors.primary}
          style={styles.playIcon}
        />
      )}
    </Pressable>
  );
};

export const ArchiveShowCard = React.memo(ArchiveShowCardComponent);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  content: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  title: {
    fontWeight: '600',
    marginBottom: 4,
  },
  artist: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 2,
  },
  date: {
    fontSize: 12,
    opacity: 0.6,
  },
  playIcon: {
    marginLeft: 8,
  },
  compactCard: {
    marginBottom: 16,
    marginHorizontal: 4,
  },
  compactImage: {
    borderRadius: 8,
    backgroundColor: '#333',
    marginBottom: 8,
  },
  compactContent: {
    paddingHorizontal: 4,
  },
  compactTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  compactArtist: {
    fontSize: 13,
    opacity: 0.8,
    marginBottom: 2,
  },
  compactDate: {
    fontSize: 11,
    opacity: 0.6,
  },
});
