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
import { ThemedText } from '@/components/ThemedText';
import { stripFormatting } from '../../../utils/stripFormatting';

const gradientOverlay = require('../../../assets/images/gradient.png');
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

// Fetch artist by slug
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

  // Flatten rich-text and split into paragraphs
  const plain = stripFormatting(artist.description?.content);
  const paragraphs = plain
    .split('\n')
    .map(p => p.trim())
    .filter(p => p);

  // Build social links array
  const socials = artist.socials ?? {};
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

  const openLink = (url: string) =>
    Linking.canOpenURL(url).then(ok => ok && Linking.openURL(url));

  const imageUri =
    artist.logo?.default ||
    artist.logo?.['512x512'] ||
    'https://via.placeholder.com/512';

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Avatar + gradient overlay */}
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
  header: {
    fontSize: 28,
    fontWeight: '700',
    marginVertical: 16,
    paddingHorizontal: 16,
    textAlign: 'left',
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
