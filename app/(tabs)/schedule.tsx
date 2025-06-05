// app/(tabs)/schedule.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { API_KEY } from '@env';

const STATION_ID = 'eist-radio';
const NUM_DAYS = 7;
const LIVE_POLL_INTERVAL = 60_000; // 60 seconds

// matches the Radiocult API "event" object
type RawScheduleItem = {
  id: string;
  stationId: string;
  title: string;
  startDateUtc: string;
  endDateUtc: string;
  description?: any;
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
    time: string; // e.g. "7:00 – 9:00 PM"
    title: string;
    id: string;
    artistIds?: string[];
  }>;
};

export default function ScheduleScreen() {
  const { colors } = useTheme();

  const [sections, setSections] = useState<SectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [currentShowId, setCurrentShowId] = useState<string | null>(null);

  // Helper to format a Date to "YYYY-MM-DDT" + suffix
  function fmt(d: Date, suffix: string) {
    return d.toISOString().split('T')[0] + 'T' + suffix;
  }

  // Fetch the 7-day schedule once on mount
  useEffect(() => {
    (async () => {
      try {
        // 1) Compute today (00:00:00Z) and seven days ahead (23:59:59Z)
        const today = new Date();
        const endDate = new Date();
        endDate.setDate(today.getDate() + NUM_DAYS);

        const startIso = fmt(today, '00:00:00Z');
        const endIso = fmt(endDate, '23:59:59Z');

        // 2) Fetch the 7-day schedule
        const raw = await fetchSchedule(startIso, endIso);
        setSections(groupByDate(raw.schedules || []));
      } catch (err) {
        console.warn('ScheduleScreen fetch error:', err);
        setError('Could not load schedule.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Poll "/schedule/live" every minute to update currentShowId
  useEffect(() => {
    let isMounted = true;

    // Define a reusable function to fetch live‐show info
    const fetchLiveShow = async () => {
      try {
        const liveRes = await fetch(
          `https://api.radiocult.fm/api/station/${STATION_ID}/schedule/live`,
          {
            headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
          }
        );
        if (!liveRes.ok) {
          throw new Error(`Live fetch error: ${liveRes.statusText}`);
        }
        const liveJson = (await liveRes.json()) as {
          result: { status: string; content: any };
        };

        // If on‐air, Radiocult returns result.status === 'schedule' with content.id
        if (liveJson.result.status === 'schedule') {
          if (isMounted) {
            setCurrentShowId(liveJson.result.content.id);
          }
        } else {
          if (isMounted) {
            setCurrentShowId(null);
          }
        }
      } catch (err) {
        console.warn('Live‐show fetch error:', err);
        if (isMounted) {
          // Optionally, you could setCurrentShowId(null) here if you want to clear indicator on error
        }
      }
    };

    // Immediately fetch live‐show once
    fetchLiveShow();

    // Then set up polling every LIVE_POLL_INTERVAL ms
    const interval = setInterval(fetchLiveShow, LIVE_POLL_INTERVAL);

    // Cleanup on unmount
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Helper to call Radiocult's schedule endpoint
  async function fetchSchedule(startDate: string, endDate: string) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const url =
      `https://api.radiocult.fm/api/station/${STATION_ID}/schedule` +
      `?startDate=${encodeURIComponent(startDate)}` +
      `&endDate=${encodeURIComponent(endDate)}` +
      `&timeZone=${encodeURIComponent(tz)}`;
    const res = await fetch(url, {
      headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(res.statusText);
    return (await res.json()) as { schedules?: RawScheduleItem[] };
  }

  // Group raw schedule items into sections by local date
  function groupByDate(items: RawScheduleItem[]): SectionData[] {
    const todayKey = new Date().toISOString().split('T')[0];
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const buckets: Record<string, RawScheduleItem[]> = {};

    items.forEach((item) => {
      const d = new Date(item.startDateUtc);
      let dateKey = d.toISOString().split('T')[0];

      // If the show starts exactly at midnight UTC, count it as "previous day" locally
      if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) {
        const prev = new Date(d);
        prev.setUTCDate(prev.getUTCDate() - 1);
        dateKey = prev.toISOString().split('T')[0];
      }

      // Only include today or future dates
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
        data: dayItems.map((it) => {
          const startDate = new Date(it.startDateUtc);
          const endDate = new Date(it.endDateUtc);

          // Format times in local timezone
          const startStr = startDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: tz,
          });
          const endStr = endDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: tz,
          });

          const startParts = startStr.split(/\s+/); // e.g. ["7:00", "PM"]
          const endParts = endStr.split(/\s+/);     // e.g. ["9:00", "PM"]

          let timeLabel: string;
          if (
            startParts.length === 2 &&
            endParts.length === 2 &&
            startParts[1] === endParts[1]
          ) {
            // Same meridiem ⇒ "7:00 – 9:00 PM"
            timeLabel = `${startParts[0]} – ${endParts[0]} ${endParts[1]}`;
          } else {
            // Different meridiems ⇒ "7:00 PM – 9:00 AM"
            timeLabel = `${startStr} – ${endStr}`;
          }

          return {
            time: timeLabel,
            title: it.title.trim(),
            id: it.id,
            artistIds: it.artistIds,
          };
        }),
      }))
      .sort((a, b) => {
        // Sort sections by actual date
        return new Date(
          a.title.replace(/,?\s?[A-Za-z]+\s\d+,\s\d{4}$/, '') // strip away locale info if needed
        ).getTime() - new Date(b.title).getTime();
      });
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
                Time
              </Text>
              <Text style={[styles.headerCell, { color: colors.primary }]}>
                Show
              </Text>
            </View>
          </>
        )}
        renderItem={({ item }) => {
          const isCurrent = item.id === currentShowId;

          return (
            <View style={styles.row}>
              <Text
                style={[
                  styles.cell,
                  {
                    color: colors.text,
                    fontWeight: isCurrent ? '700' : '400',
                    fontStyle: isCurrent ? 'italic' : 'normal',
                  },
                ]}
              >
                {item.time}
              </Text>

              <Link
                href={`/show/${encodeURIComponent(item.id)}`}
                style={{ flex: 1 }}
              >
                <View style={styles.showCellContent}>
                  {isCurrent && (
                    <Ionicons
                      name="arrow-forward-outline"
                      size={18}
                      color={colors.primary}
                      style={styles.playIcon}
                    />
                  )}
                  <Text
                    style={[
                      styles.cellText,
                      {
                        color: colors.primary,
                        fontWeight: isCurrent ? '700' : '400',
                        fontStyle: isCurrent ? 'italic' : 'normal',
                      },
                    ]}
                  >
                    {item.title}
                  </Text>
                </View>
              </Link>
            </View>
          );
        }}
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
  showCellContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  playIcon: {
    marginRight: 6,
    alignSelf: 'flex-start',
  },
  cellText: {
    flex: 1,
    fontSize: 18,
    textAlign: 'left',
  },
});
