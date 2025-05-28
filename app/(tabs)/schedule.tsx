// app/(tabs)/schedule.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { API_KEY } from '@env';

const STATION_ID = 'eist-radio';
const NUM_DAYS = 7;

// matches the Radiocult API “event” object
type RawScheduleItem = {
  id: string;
  stationId: string;
  title: string;
  startDateUtc: string;
  endDateUtc: string;
  description?: any;       // JSONContent
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

type SectionData = {
  title: string;
  data: Array<{
    time: string;
    title: string;
    id: string;
  }>;
};

export default function ScheduleScreen() {
  const { colors } = useTheme();
  const [sections, setSections] = useState<SectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    (async () => {
      try {
        const today = new Date();
        const endDate = new Date();
        endDate.setDate(today.getDate() + NUM_DAYS);

        const startIso = fmt(today, '00:00:00Z');
        const endIso = fmt(endDate, '23:59:59Z');
        const raw = await fetchSchedule(startIso, endIso);

        setSections(groupByDate(raw.schedules || []));
      } catch {
        setError('Could not load schedule.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
    return res.json();
  }

  function groupByDate(items: RawScheduleItem[]): SectionData[] {
    const todayKey = new Date().toISOString().split('T')[0];
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const buckets: Record<string, RawScheduleItem[]> = {};

    items.forEach(item => {
      const d = new Date(item.startDateUtc);
      let dateKey = d.toISOString().split('T')[0];
      // midnights belong to the previous day
      if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) {
        const prev = new Date(d);
        prev.setUTCDate(prev.getUTCDate() - 1);
        dateKey = prev.toISOString().split('T')[0];
      }
      if (dateKey >= todayKey) {
        (buckets[dateKey] ||= []).push(item);
      }
    });

    return Object.entries(buckets)
      .map(([dateKey, dayItems]) => ({
        title: new Date(dateKey).toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }),
        data: dayItems.map(it => {
          const d = new Date(it.startDateUtc);
          const time = d
            .toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
              timeZone: tz,
            })
            .toLowerCase();
          return {
            time,
            title: it.title.trim(),
            id: it.id,
          };
        }),
      }))
      .sort(
        (a, b) =>
          new Date(a.title).getTime() - new Date(b.title).getTime()
      );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.notification }}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.primary }]}>Schedule</Text>

      <SectionList
        sections={sections}
        keyExtractor={(item, idx) => item.id + idx}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section: { title } }) => (
          <>
            <Text style={[styles.sectionHeader, { color: colors.primary }]}>
              {title}
            </Text>
            <View style={styles.headerRow}>
              <Text style={[styles.headerCell, { color: colors.primary }]}>
                Start
              </Text>
              <Text style={[styles.headerCell, { color: colors.primary }]}>
                Show
              </Text>
            </View>
          </>
        )}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={[styles.cell, { color: colors.text }]}>
              {item.time}
            </Text>
            <Link
              href={`/show/${encodeURIComponent(item.id)}`}
              style={styles.cell}
            >
              <Text style={[styles.cell, { color: colors.primary }]}>
                {item.title}
              </Text>
            </Link>
          </View>
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 32,
    paddingHorizontal: 8,
    marginTop: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  headerCell: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'left',
  },
  list: {
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  cell: {
    flex: 1,
    fontSize: 18,
    textAlign: 'left',
  },
});
