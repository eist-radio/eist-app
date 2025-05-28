// app/(tabs)/artist/[slug].tsx
import React, { useState, useEffect, ReactElement } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
  TouchableOpacity,
  Linking,
  Dimensions,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { API_KEY } from '@env';
import { ThemedText } from '@/components/ThemedText';
import { stripFormatting } from '../../../utils/stripFormatting';

// Assets
const gradientOverlay = require('../../../assets/images/gradient.png');

const STATION_ID = 'eist-radio';
const { width: screenWidth } = Dimensions.get('window');

type RawArtist = {
  name?: string;
  description?: {
    content?: Array<{
      type: string;
      content?: Array<{ type: string; text?: string }>;
    }>;
  };
  logo?: { default?: string; '512x512'?: string; '1024x1024'?: string };
  socials?: {
    twitterHandle?: string;
    instagramHandle?: string;
    facebook?: string;
    mixcloud?: string;
    soundcloud?: string;
    site?: string;
  };
};

export default function ArtistScreen(): ReactElement {
  const { colors } = useTheme();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug?: string }>();

  const [artist, setArtist] = useState<RawArtist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  // Fetch artist data
  useEffect(() => {
    if (!slug) {
      setError('No artist specified.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `https://api.radiocult.fm/api/station/${STATION_ID}/artists/${encodeURIComponent(
            slug
          )}`,
          { headers: { 'x-api-key': API_KEY } }
        );
        if (!res.ok) throw new Error(res.statusText);
        const json = await res.json();
        if (json?.artist) {
          setArtist(json.artist);
        } else {
          throw new Error();
        }
      } catch {
        setError('Could not load artist details.');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const openLink = (url: string) =>
    Linking.canOpenURL(url).then(ok => ok && Linking.openURL(url));

  const renderLinks = (socials?: RawArtist['socials']): ReactElement | null => {
    if (!socials) return null;

    const entries: Array<[string, string]> = [];
    if (socials.site) entries.push(['Website', socials.site]);
    if (socials.twitterHandle)
      entries.push(['Twitter', `https://twitter.com/${socials.twitterHandle}`]);
    if (socials.instagramHandle)
      entries.push(['Instagram', `https://instagram.com/${socials.instagramHandle}`]);
    if (socials.facebook)
      entries.push(['Facebook', `https://facebook.com/${socials.facebook}`]);
    if (socials.mixcloud)
      entries.push(['Mixcloud', `https://mixcloud.com/${socials.mixcloud}`]);
    if (socials.soundcloud)
      entries.push([
        'SoundCloud',
        `https://soundcloud.com/${socials.soundcloud}`,
      ]);

    if (entries.length === 0) return null;

    return (
      <View style={styles.linkRow}>
        {entries.map(([label, url], idx) => (
          <React.Fragment key={label}>
            <TouchableOpacity onPress={() => openLink(url)}>
              <ThemedText
                type="body"
                style={[styles.linkText, { color: colors.primary }]}
              >
                {label}
              </ThemedText>
            </TouchableOpacity>
            {idx < entries.length - 1 && (
              <ThemedText
                type="body"
                style={[styles.separator, { color: colors.text }]}
              >
                {' '} /{' '}
              </ThemedText>
            )}
          </React.Fragment>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !artist) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ThemedText type="body" style={{ color: colors.notification }}>
          {error ?? 'Artist not found.'}
        </ThemedText>
      </View>
    );
  }

  // Flatten rich-text into plain paragraphs
  const plain = stripFormatting(artist.description?.content);
  const paragraphs = plain
    .split('\n')
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const imageUri =
    artist.logo?.default ||
    artist.logo?.['512x512'] ||
    'https://via.placeholder.com/512';

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Avatar + Gradient */}
      <View style={styles.avatarContainer}>
        <Image
          source={{ uri: imageUri }}
          style={styles.fullWidthAvatar}
          resizeMode="cover"
        />
        <Image
          source={gradientOverlay}
          style={[StyleSheet.absoluteFill, styles.fullWidthAvatar]}
          resizeMode="stretch"
        />
      </View>

      <ThemedText
        type="subtitle"
        style={[styles.header, { color: colors.primary }]}
      >
        {artist.name || 'Unnamed Artist'}
      </ThemedText>

      <View style={styles.textContainer}>
        {paragraphs.map((p, i) => (
          <ThemedText
            key={i}
            type="body"
            style={[styles.bodyText, { color: colors.text }]}
          >
            {p}
          </ThemedText>
        ))}

        {renderLinks(artist.socials)}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 0,
  },
  content: {
    alignItems: 'flex-start',
    paddingBottom: 24,
  },
  avatarContainer: {
    width: screenWidth,
    height: screenWidth,
    position: 'relative',
  },
  fullWidthAvatar: {
    width: '100%',
    height: '100%',
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    marginVertical: 16,
    textAlign: 'left',
    paddingHorizontal: 16,
  },
  textContainer: {
    width: '100%',
    maxWidth: 600,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
  },
  bodyText: {
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 12,
    textAlign: 'left',
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 18,
    fontWeight: '600',
  },
  separator: {
    fontSize: 18,
    fontWeight: '600',
  },
});
