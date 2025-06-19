// app/(tabs)/show/[slug].tsx

import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  Text,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useLocalSearchParams, Link } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { apiKey } from '../../../config';
import { ThemedText } from '@/components/ThemedText';
import { stripFormatting } from '../../../utils/stripFormatting';
import { LinearGradient } from 'expo-linear-gradient';
import { SwipeNavigator } from '@/components/SwipeNavigator';

const STATION_ID = 'eist-radio';
const { width: screenWidth } = Dimensions.get('window');

type RawScheduleItem = {
  id: string;
  stationId: string;
  title: string;
  startDateUtc: string;
  endDateUtc: string;
  description?: { content?: any[] };
  duration: number;
  timezone: string;
  color?: string;
  artistIds?: string[];
  isRecurring: boolean;
  media:
    | { type: 'mix'; trackId?: string }
    | { type: 'playlist'; playlistId: string }
    | { type: 'live' };
};

type Artist = { id: string; name?: string };

async function fetchEventById(id: string): Promise<RawScheduleItem> {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 7);

  const startIso = `${today.toISOString().split('T')[0]}T00:00:00Z`;
  const endIso = `${end.toISOString().split('T')[0]}T23:59:59Z`;

  const url =
    `https://api.radiocult.fm/api/station/${STATION_ID}/schedule` +
    `?startDate=${startIso}&endDate=${endIso}`;
  const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
  const json = await res.json();
  const match = (json.schedules || []).find((e: RawScheduleItem) => e.id === id);
  if (!match) throw new Error('Show not found');
  return match;
}

async function fetchHostArtist(artistId: string): Promise<Artist> {
  const url = `https://api.radiocult.fm/api/station/${STATION_ID}/artists/${artistId}`;
  const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
  const json = await res.json();
  if (!json.artist) throw new Error('Artist not found');
  return json.artist;
}

function formatShowTime(start: string, end: string): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const startDate = new Date(start);
  const endDate = new Date(end);

  const startTime = startDate
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: tz,
    })
    .replace(/ (AM|PM)$/, '');

  const endTime = endDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: tz,
  });

  return `${startTime} - ${endTime}`;
}

export default function ShowScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const { colors } = useTheme();

  if (!slug) {
    return (
      <SwipeNavigator>
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
          <Text style={{ color: colors.notification }}>No show selected.</Text>
        </View>
      </SwipeNavigator>
    );
  }

  const { data: event } = useQuery({
    queryKey: ['show', slug],
    queryFn: () => fetchEventById(slug),
    suspense: true,
  });

  const hostId = event.artistIds?.[0];
  const { data: host } = useQuery({
    queryKey: ['artist', hostId],
    queryFn: () => fetchHostArtist(hostId!),
    enabled: Boolean(hostId),
  });

  const plain = stripFormatting(event.description?.content || []);
  const paragraphs = plain
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p);

  const timeString = formatShowTime(event.startDateUtc, event.endDateUtc);

  return (
    <SwipeNavigator>
      <ScrollView
        style={[styles.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
      >
        <View style={styles.bannerContainer}>
          <Image
            source={require('../../../assets/images/schedule.png')}
            style={styles.bannerImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.2)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View style={styles.titleRow}>
          <Ionicons
            name="calendar-clear-outline"
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
            {event.title}
          </ThemedText>
        </View>

        <View style={styles.timeRow}>
          <ThemedText
            type="body"
            style={[styles.timeText, { color: colors.text }]}
          >
            {timeString}
          </ThemedText>
        </View>

        {host?.name && (
          <View style={styles.hostRow}>
            <Link href={`/artist/${encodeURIComponent(host.id)}`}>
              <ThemedText
                type="body"
                style={[styles.hostText, { color: colors.primary }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {host.name}
              </ThemedText>
            </Link>
          </View>
        )}

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
        </View>
      </ScrollView>
    </SwipeNavigator>
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
  bannerContainer: {
    width: screenWidth,
    height: screenWidth,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
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
  timeRow: {
    marginBottom: 6,
    marginHorizontal: 16,
  },
  timeText: {
    fontSize: 18,
    fontStyle: 'italic',
  },
  hostRow: {
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  hostText: {
    fontSize: 19,
    fontWeight: '600',
    lineHeight: 22,
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
});
