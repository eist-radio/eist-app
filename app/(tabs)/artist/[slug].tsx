import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { apiKey } from '../../../config';
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
  tags?: string[];
};

function extractTagValue(tags: string[] | undefined, prefix: string): string | undefined {
  if (!tags) return undefined;
  const found = tags.find((t) => t.startsWith(prefix));
  return found ? found.replace(prefix, '').toLowerCase() : undefined;
}

async function fetchArtistBySlug(slug: string): Promise<RawArtist> {
  const url = `https://api.radiocult.fm/api/station/${STATION_ID}/artists/${encodeURIComponent(slug)}`;
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

  const fallbackImage = require('../../../assets/images/artist.png');
  const [imageFailed, setImageFailed] = useState(false);

  const remoteImage =
    artist.logo?.['1024x1024'] ||
    artist.logo?.['512x512'] ||
    artist.logo?.default;

  const imageSource =
    imageFailed || !remoteImage
      ? fallbackImage
      : { uri: remoteImage };

  const plain = stripFormatting(artist.description?.content);
  const paragraphs = plain
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p);

  const socials = artist.socials ?? {};
  const tags = artist.tags ?? [];

  const entries: Array<[string, string]> = [];

  // Standard social links
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
    entries.push(['SoundCloud', `https://soundcloud.com/${socials.soundcloud}`]);

  // Archive links from tags
  const mcUsername = extractTagValue(tags, 'MC-USERNAME_');
  const scUsername = extractTagValue(tags, 'SC-USERNAME_');
  const hostScPlaylist = extractTagValue(tags, 'HOST-SC-PLAYLIST_');
  const hostMcPlaylist = extractTagValue(tags, 'HOST-MC-PLAYLIST_');
  const eistMcPlaylist = extractTagValue(tags, 'EIST-MC-PLAYLIST_');

  if (scUsername && hostScPlaylist) {
    entries.push([
      'SoundCloud archive',
      `https://soundcloud.com/${scUsername}/sets/${hostScPlaylist}`,
    ]);
  }

  if (eistMcPlaylist) {
    entries.push([
      'éist archive',
      `https://www.mixcloud.com/eistcork/playlists/${eistMcPlaylist}`,
    ]);
  }

  if (mcUsername && hostMcPlaylist) {
    entries.push([
      'Mixcloud archive',
      `https://mixcloud.com/${mcUsername}/playlists/${hostMcPlaylist}`,
    ]);
  }

  const openLink = (url: string) =>
    Linking.canOpenURL(url).then((ok) => ok && Linking.openURL(url));

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.avatarContainer}>
        <Image
          source={imageSource}
          style={styles.fullWidthAvatar}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.4)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

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
          numberOfLines={2}
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
                  <Text style={[styles.linkText, { color: colors.primary }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
                {idx < entries.length - 1 && (
                  <Text style={[styles.separator, { color: colors.text }]}>
                    {' / '}
                  </Text>
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
    flexShrink: 1,
    flexWrap: 'wrap',
    lineHeight: 32,
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
