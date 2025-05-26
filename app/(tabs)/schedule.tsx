// app/(tabs)/schedule.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { API_KEY } from '@env';

const STATION_ID = 'eist-radio';
const NUM_DAYS = 7;

type RawScheduleItem = {
  startDateUtc: string;
  title: string;
};

type SectionData = {
  title: string;
  data: Array<{
    time: string;
    show: string;
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
    const url = `https://api.radiocult.fm/api/station/${STATION_ID}/schedule`
      + `?startDate=${startDate}&endDate=${endDate}&timeZone=${tz}`;
    const res = await fetch(url, { headers: { 'x-api-key': API_KEY } });
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  }

  function groupByDate(items: RawScheduleItem[]): SectionData[] {
    const todayKey = new Date().toISOString().split('T')[0];
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const buckets: Record<string, RawScheduleItem[]> = {};

    // bucket by date (rolling back midnight UTC)
    items.forEach(item => {
      const d = new Date(item.startDateUtc);
      let dateKey = d.toISOString().split('T')[0];
      if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) {
        const prev = new Date(d);
        prev.setUTCDate(prev.getUTCDate() - 1);
        dateKey = prev.toISOString().split('T')[0];
      }
      if (dateKey >= todayKey) {
        (buckets[dateKey] ||= []).push(item);
      }
    });

    // build sections
    return Object.entries(buckets)
      .map(([dateKey, dayItems]) => {
        const header = new Date(dateKey).toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });

        const data = dayItems.map(it => {
          const d = new Date(it.startDateUtc);

          // format without dots in AM/PM
          const raw = d.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: tz,
          });
          const time = raw.toLowerCase(); // e.g. "9:00 am"

          return {
            time,
            show: it.title.trim(),
          };
        });

        return { title: header, data };
      })
      .sort((a, b) => new Date(a.title).getTime() - new Date(b.title).getTime());
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
        keyExtractor={(item, idx) => item.time + idx}
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
            <Text style={[styles.cell, { color: colors.text }]}>
              {item.show}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 32, paddingHorizontal: 8, marginTop: 48 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  headerCell: {
    flex: 1,
    fontWeight: '600',
    textAlign: 'left',
  },
  list: { paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  cell: {
    flex: 1,
    textAlign: 'left',
  },
});
