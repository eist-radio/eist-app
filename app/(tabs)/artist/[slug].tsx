// app/(tabs)/artist/[slug].tsx

import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Dimensions,
  Text,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiKey } from '../../../config';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { stripFormatting } from '../../../utils/stripFormatting';
import { LinearGradient } from 'expo-linear-gradient';

const STATION_ID = 'eist-radio';
const { width: screenWidth } = Dimensions.get('window');

type RawArtist = {
  id: string;
  name?: string;
  description?: { content?: any[] };
  logo?: {
    default?: string;
    '512x512'?: string;
    '1024x1024'?: string;
  };
  socials?: {
    twitterHandle?: string;
    instagramHandle?: string;
    facebook?: string;
    mixcloud?: string;
    soundcloud?: string;
    site?: string;
  };
};

async function fetchArtistBySlug(slug: string): Promise<RawArtist> {
  const url =
    `https://api.radiocult.fm/api/station/${STATION_ID}/artists/${encodeURIComponent(
      slug
    )}`;
  const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
  if (!res.ok) throw new Error(`Artist fetch failed: ${res.statusText}`);
  const json = (await res.json()) as { artist?: RawArtist };
  if (!json.artist) throw new Error('Artist not found');
  return json.artist;
}

export default function ArtistScreen() {
  const { colors } = useTheme();
  const { slug } = useLocalSearchParams<{ slug?: string }>();

  if (!slug) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.notification }}>
          No artist specified.
        </Text>
      </View>
    );
  }

  const { data: artist } = useQuery({
    queryKey: ['artist', slug],
    queryFn: () => fetchArtistBySlug(slug),
    suspense: true,
  });

  // Flatten rich-text → plain paragraphs
  const plain = stripFormatting(artist.description?.content);
  const paragraphs = plain
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p);

  // Social links
  const socials = artist.socials ?? {};
  const entries: Array<[string, string]> = [];
  if (socials.site) entries.push(['Website', socials.site]);
  if (socials.twitterHandle)
    entries.push(['Twitter', `https://twitter.com/${socials.twitterHandle}`]);
  if (socials.instagramHandle)
    entries.push([
      'Instagram',
      `https://instagram.com/${socials.instagramHandle}`,
    ]);
  if (socials.facebook)
    entries.push(['Facebook', `https://facebook.com/${socials.facebook}`]);
  if (socials.mixcloud)
    entries.push(['Mixcloud', `https://mixcloud.com/${socials.mixcloud}`]);
  if (socials.soundcloud)
    entries.push([
      'SoundCloud',
      `https://soundcloud.com/${socials.soundcloud}`,
    ]);

  const openLink = (url: string) =>
    Linking.canOpenURL(url).then((ok) => ok && Linking.openURL(url));

  // Pick the best available artist image; if none, fall back to local asset
  let imageSource;
  if (artist.logo?.['1024x1024']) {
    imageSource = { uri: artist.logo['1024x1024'] };
  } else if (artist.logo?.['512x512']) {
    imageSource = { uri: artist.logo['512x512'] };
  } else if (artist.logo?.default) {
    imageSource = { uri: artist.logo.default };
  } else {
    // Fallback to bundled image when no artist image is provided
    imageSource = require('../../../assets/images/artist.png');
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Avatar + gradient overlay via LinearGradient */}
      <View style={styles.avatarContainer}>
        <Image
          source={imageSource}
          style={styles.fullWidthAvatar}
          resizeMode="cover"
        />
        <LinearGradient
          // adjust these colors to match your PNG
          colors={['transparent', 'rgba(0,0,0,0.4)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Title row: icon + artist name */}
      <View style={styles.titleRow}>
        <Ionicons
          name="headset-outline"
          size={36}
          color={colors.primary}
          style={styles.icon}
        />
        <ThemedText
          type="subtitle"
          style={[styles.header, { color: colors.primary }]}
          numberOfLines={2}           // limit to two lines
          ellipsizeMode="tail"
        >
          {artist.name || 'Unnamed Artist'}
        </ThemedText>
      </View>

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

        {entries.length > 0 && (
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
        )}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 16,
  },
  icon: {
    marginRight: 8,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    flexShrink: 1,               // allow shrinking
    flexWrap: 'wrap',            // allow wrapping
    lineHeight: 32,              // ensure proper line spacing
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
