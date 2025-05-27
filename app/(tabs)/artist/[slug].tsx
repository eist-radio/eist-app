// app/artist/[slug].tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { API_KEY } from '@env';

const STATION_ID = 'eist-radio';

type RawArtist = {
  name?: string;
  description?: {
    content?: Array<{
      content?: Array<{ text?: string }>;
    }>;
  };
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

export default function ArtistScreen() {
  const { colors } = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const [artist, setArtist] = useState<RawArtist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!slug) {
      setError('No artist specified.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const url = `https://api.radiocult.fm/api/station/${STATION_ID}/artists/${slug}`;
        const res = await fetch(url, {
          headers: { 'x-api-key': API_KEY },
        });
        if (!res.ok) throw new Error(res.statusText);
        const json = await res.json();
        setArtist(json.artist);
      } catch {
        setError('Could not load artist details.');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const renderDescription = (desc?: RawArtist['description']) => {
    if (!desc?.content) return null;
    return desc.content
      .map(block =>
        block.content
          ?.map(node => node.text || '')
          .join('')
          .trim()
      )
      .filter(p => p.length)
      .map((p, i) => (
        <Text key={i} style={[styles.paragraph, { color: colors.text }]}>
          {p}
        </Text>
      ));
  };

  const openLink = (url: string) => {
    Linking.canOpenURL(url).then(ok => ok && Linking.openURL(url));
  };

  const renderLinks = (socials?: RawArtist['socials']) => {
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
      entries.push(['SoundCloud', `https://soundcloud.com/${socials.soundcloud}`]);

    return entries.map(([label, url]) => (
      <TouchableOpacity
        key={label}
        onPress={() => openLink(url)}
        style={styles.linkButton}
      >
        <Text style={[styles.linkText, { color: colors.primary }]}>
          {label}
        </Text>
      </TouchableOpacity>
    ));
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !artist) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.notification }}>
          {error || 'Artist not found.'}
        </Text>
      </View>
    );
  }

  const imageUri =
    artist.logo?.default ||
    artist.logo?.['512x512'] ||
    'https://via.placeholder.com/128';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Image source={{ uri: imageUri }} style={styles.avatar} resizeMode="cover" />
      <Text style={[styles.name, { color: colors.primary }]}>
        {artist.name || 'Unnamed Artist'}
      </Text>
      {renderDescription(artist.description)}
      <View style={styles.links}>{renderLinks(artist.socials)}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 32,
    paddingHorizontal: 16,
  },
  content: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  avatar: {
    width: 128,
    height: 128,
    borderRadius: 64,
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  links: {
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
  },
  linkButton: {
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
