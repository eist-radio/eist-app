// app/(tabs)/show/[slug].tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useLocalSearchParams, Link } from 'expo-router';
import { API_KEY } from '@env';
import { stripFormatting } from '../../../utils/stripFormatting';

const STATION_ID = 'eist-radio';
const NUM_DAYS = 7;

type RawScheduleItem = {
  id: string;
  stationId: string;
  title: string;
  startDateUtc: string;
  endDateUtc: string;
  description?: {
    type: string;
    content?: Array<{
      type: string;
      text?: string;
      content?: any[];
    }>;
  };
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

type Artist = {
  id: string;
  name?: string;
};

type SectionData = {
  title: string;
  data: Array<{ time: string }>;
};

export default function ShowScreen() {
  // Route & theme
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = params.slug;
  const { colors } = useTheme();

  // State
  const [event, setEvent] = useState<RawScheduleItem | null>(null);
  const [host, setHost] = useState<Artist | null>(null);
  const [sections, setSections] = useState<SectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  // Fetch schedule & pick this event
  useEffect(() => {
    if (!slug) {
      setError('No show selected.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const today = new Date();
        const endDate = new Date();
        endDate.setDate(today.getDate() + NUM_DAYS);

        const startIso = fmt(today, '00:00:00Z');
        const endIso = fmt(endDate, '23:59:59Z');
        const raw = await fetchSchedule(startIso, endIso);

        const all = Array.isArray(raw.schedules)
          ? (raw.schedules as RawScheduleItem[])
          : [];

        const matches = all.filter(e => e.id === slug);
        if (matches.length === 0) {
          throw new Error('No such show');
        }

        setEvent(matches[0]);
        setSections(groupByDate(matches));
      } catch {
        setError('Could not load show details.');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  // Fetch host artist
  useEffect(() => {
    const firstId = event?.artistIds?.[0];
    if (!firstId) return;

    (async () => {
      try {
        const url = `https://api.radiocult.fm/api/station/${STATION_ID}/artists/${firstId}`;
        const res = await fetch(url, { headers: { 'x-api-key': API_KEY } });
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (json?.artist?.id) {
          setHost(json.artist);
        }
      } catch {
        // ignore
      }
    })();
  }, [event]);

  // Loading / error
  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (error || !event) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.notification }}>
          {error ?? 'Unknown error.'}
        </Text>
      </View>
    );
  }

  // Strip formatting to plain text (handles undefined/content safely)
  const plainDescription = stripFormatting(event.description?.content);

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.background }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item, idx) => item.time + idx}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            {/* Show title */}
            <Text style={[styles.title, { color: colors.primary }]}>
              {event.title}
            </Text>

            {/* Host link */}
            {host?.name && host.id && (
              <Link
                href={`/artist/${encodeURIComponent(host.id)}`}
                style={styles.hostLinkContainer}
              >
                <Text style={[styles.hostLink, { color: colors.primary }]}>
                  {host.name}
                </Text>
              </Link>
            )}

            {/* Plain-text description */}
            {plainDescription.length > 0 && (
              <Text style={[styles.description, { color: colors.text }]}>
                {plainDescription}
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

// Helpers

function fmt(d: Date, suffix: string) {
  return d.toISOString().split('T')[0] + 'T' + suffix;
}

async function fetchSchedule(startDate: string, endDate: string) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const url =
    `https://api.radiocult.fm/api/station/${STATION_ID}/schedule` +
    `?startDate=${startDate}&endDate=${endDate}&timeZone=${tz}`;
  const res = await fetch(url, { headers: { 'x-api-key': API_KEY } });
  if (!res.ok) throw new Error(res.statusText);
  return res.json() as Promise<{ schedules?: RawScheduleItem[] }>;
}

function groupByDate(items: RawScheduleItem[]): SectionData[] {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const buckets: Record<string, RawScheduleItem[]> = {};

  items.forEach(item => {
    const d = new Date(item.startDateUtc);
    if (isNaN(d.getTime())) return;
    let dateKey = d.toISOString().split('T')[0];
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) {
      const prev = new Date(d);
      prev.setUTCDate(prev.getUTCDate() - 1);
      dateKey = prev.toISOString().split('T')[0];
    }
    (buckets[dateKey] ||= []).push(item);
  });

  return Object.entries(buckets)
    .map(([dateKey, dayItems]) => ({
      title: new Date(dateKey).toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
      data: dayItems.map(it => {
        const t = new Date(it.startDateUtc);
        const raw = t.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: tz,
        });
        return { time: raw.toLowerCase() };
      }),
    }))
    .sort((a, b) => {
      const da = Date.parse(a.title);
      const db = Date.parse(b.title);
      return isNaN(da) || isNaN(db) ? 0 : da - db;
    });
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    marginTop: 64,
    paddingTop: 32,
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  list: { paddingBottom: 16 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  hostLinkContainer: {
    marginBottom: 12,
  },
  hostLink: {
    fontSize: 16,
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    marginBottom: 6,
    lineHeight: 22,
  },
  sectionHeader: {
    fontSize: 15,
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
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'left',
  },
});
