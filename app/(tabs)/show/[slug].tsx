// app/(tabs)/show/[slug].tsx

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useLocalSearchParams, Link } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { apiKey } from '../../../config';
import { stripFormatting } from '../../../utils/stripFormatting';

const STATION_ID = 'eist-radio';
const NUM_DAYS = 7;

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

type SectionData = {
  title: string;
  data: Array<{ time: string }>;
};

// Fetch a full week’s schedule
async function fetchSchedule(
  startDate: string,
  endDate: string
  ): Promise<RawScheduleItem[]> {
  const url =
`https://api.radiocult.fm/api/station/${STATION_ID}/schedule` +
`?startDate=${startDate}&endDate=${endDate}`;
const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
if (!res.ok) throw new Error(`Schedule fetch failed: ${res.statusText}`);
const json = (await res.json()) as { schedules?: RawScheduleItem[] };
if (!json.schedules) throw new Error('No schedules returned');
return json.schedules;
}

// Pick out the one event matching our slug
async function fetchEventById(id: string): Promise<RawScheduleItem> {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + NUM_DAYS);

  const startIso = `${today.toISOString().split('T')[0]}T00:00:00Z`;
  const endIso = `${end.toISOString().split('T')[0]}T23:59:59Z`;
  const schedules = await fetchSchedule(startIso, endIso);

  const ev = schedules.find((e) => e.id === id);
  if (!ev) throw new Error('Show not found');
  return ev;
}

// Fetch the host artist by its ID (only if we have one)
async function fetchHostArtist(artistId: string): Promise<Artist> {
  const url =
`https://api.radiocult.fm/api/station/${STATION_ID}/artists/${artistId}`;
const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
if (!res.ok) throw new Error(`Artist fetch failed: ${res.statusText}`);
const json = (await res.json()) as { artist?: Artist };
if (!json.artist) throw new Error('Artist not found');
return json.artist;
}

// Group into sections by local date
function groupByDate(items: RawScheduleItem[]): SectionData[] {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const buckets: Record<string, RawScheduleItem[]> = {};

  items.forEach((item) => {
    const d = new Date(item.startDateUtc);
    if (isNaN(d.getTime())) return;
    let key = d.toISOString().split('T')[0];
    // Handle midnight UTC rolling back into previous local day
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) {
      const p = new Date(d);
      p.setUTCDate(p.getUTCDate() - 1);
      key = p.toISOString().split('T')[0];
    }
    (buckets[key] ||= []).push(item);
  });

  return Object.entries(buckets)
  .map(([dateKey, dayItems]) => ({
    title: new Date(dateKey).toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
    data: dayItems.map((it) => {
      const t = new Date(it.startDateUtc);
      const time = t.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: tz,
      });
      return { time };
    }),
  }))
  .sort((a, b) => {
    const da = Date.parse(a.title);
    const db = Date.parse(b.title);
    return isNaN(da) || isNaN(db) ? 0 : da - db;
  });
}

export default function ShowScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTheme();

  if (!slug) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.notification }}>No show selected.</Text>
      </View>
      );
  }

  // Always suspend on the "show/event" fetch
  const { data: event } = useQuery({
    queryKey: ['show', slug],
    queryFn: () => fetchEventById(slug),
    suspense: true,
  });

  // Only fetch host artist if artistIds[0] exists; no suspense here
  const hostId = event.artistIds?.[0];
  const { data: host } = useQuery({
    queryKey: ['artist', hostId],
    queryFn: () => fetchHostArtist(hostId!),
    enabled: Boolean(hostId),
  });

  const sections = useMemo(() => groupByDate([event]), [event]);
  const plainDesc = stripFormatting(event.description?.content || []);

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.background }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item, idx) => item.time + idx}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            {/* Title row with icon aligned to top */}
            <View style={styles.titleRow}>
              <Ionicons
                name="calendar-clear-outline"
                size={36}
                color={colors.primary}
                style={styles.icon}
              />
              <Text style={[styles.title, { color: colors.primary }]}>
                {event.title}
              </Text>
            </View>

            {/* Host link with title wrapping */}
            {host?.name && (
              <Link
                href={`/artist/${encodeURIComponent(host.id)}`}
                style={styles.hostLinkContainer}
              >
                <Text
                  style={[
                    styles.hostLink,
                    { color: colors.primary },
                    ]}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {host.name}
                  </Text>
                </Link>
                )}

            {plainDesc.length > 0 && (
              <Text style={[styles.description, { color: colors.text }]}>
                {plainDesc}
              </Text>
              )}
          </View>
        }
        renderSectionHeader={({ section: { title } }) => (
          <Text style={[styles.sectionHeader, { color: colors.primary }]}>
            {title}
          </Text>
          )}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={[styles.cell, { color: colors.text }]}>
              {item.time}
            </Text>
          </View>
          )}
      />
    </View>
    );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    marginTop: 72,
    paddingTop: 32,
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start', // icon aligned to top of text
    marginBottom: 8,
  },
  icon: {
    marginRight: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    flexShrink: 1,
    flexWrap: 'wrap', // allow wrapping if too long
    lineHeight: 36,
  },
  hostLinkContainer: {
    marginBottom: 12,
  },
  hostLink: {
    fontSize: 19,
    fontWeight: '600',
    flexShrink: 1,
    flexWrap: 'wrap', // wrap long names
    lineHeight: 22,
  },
  description: {
    fontSize: 18,
    marginBottom: 6,
    lineHeight: 22,
  },
  sectionHeader: {
    fontSize: 17,
    fontStyle: 'italic',
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  cell: {
    flex: 1,
    fontSize: 17,
    fontStyle: 'italic',
    textAlign: 'left',
  },
  list: {
    paddingBottom: 16,
  },
});
