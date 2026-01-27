// components/ArtistCard.tsx

import { useTheme } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text } from 'react-native';
import { DerivedArtist } from '../types/archive';

const fallbackImage = require('../assets/images/eist_online.png');

interface ArtistCardProps {
  artist: DerivedArtist;
  imageUrl?: string | null;
}

const ArtistCardComponent: React.FC<ArtistCardProps> = ({ artist, imageUrl }) => {
  const { colors } = useTheme();
  const router = useRouter();
  const [imageFailed, setImageFailed] = useState(false);

  const handleImageError = useCallback(() => {
    setImageFailed(true);
  }, []);

  const imageSource =
    imageUrl && !imageFailed ? { uri: imageUrl } : fallbackImage;

  const screenWidth = Dimensions.get('window').width;
  const cardWidth = (screenWidth - 48) / 2; // 16px padding each side + 16px gap
  const imageSize = cardWidth - 16;

  const handlePress = useCallback(() => {
    router.push(`/artist/${encodeURIComponent(artist.slug)}`);
  }, [router, artist.slug]);

  return (
    <Pressable onPress={handlePress} style={[styles.card, { width: cardWidth }]}>
      <Image
        source={imageSource}
        style={[styles.image, { width: imageSize, height: imageSize }]}
        resizeMode="cover"
        onError={handleImageError}
      />
      <Text
        style={[styles.name, { color: colors.primary }]}
        numberOfLines={2}
      >
        {artist.name}
      </Text>
      <Text style={[styles.showCount, { color: colors.text }]}>
        {artist.showCount} {artist.showCount === 1 ? 'show' : 'shows'}
      </Text>
    </Pressable>
  );
};

export const ArtistCard = React.memo(ArtistCardComponent);

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    marginHorizontal: 4,
  },
  image: {
    borderRadius: 8,
    backgroundColor: '#333',
    marginBottom: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  showCount: {
    fontSize: 12,
    opacity: 0.6,
    paddingHorizontal: 4,
  },
});
