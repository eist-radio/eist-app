// app/(tabs)/schedule.tsx

import { SelectableThemedText } from '@/components/SelectableThemedText';
import { SwipeNavigator } from '@/components/SwipeNavigator';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { Link } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  RefreshControl,
  SectionList,
  StyleSheet,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiKey } from '../../config';
import { useTrackPlayer } from '../../context/TrackPlayerContext';
import { useTimezoneChange } from '../../hooks/useTimezoneChange';

const STATION_ID = 'eist-radio';
const NUM_DAYS = 7;
const LIVE_POLL_INTERVAL = 600_000; // Reduced from 5 minutes to 10 minutes

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
  data: {
    time: string;
    title: string;
    id: string;
    artistIds?: string[];
  }[];
};

export default function ScheduleScreen() {
  const { colors } = useTheme();
  const { isPlaying } = useTrackPlayer();
  const currentTimezone = useTimezoneChange();
  const insets = useSafeAreaInsets();

  const [sections, setSections] = useState<SectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [currentShowId, setCurrentShowId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  function fmt(d: Date, suffix: string) {
    return d.toISOString().split('T')[0] + 'T' + suffix;
  }

  const fetchScheduleData = useCallback(async () => {
    try {
      const today = new Date();
      const endDate = new Date();
      endDate.setDate(today.getDate() + NUM_DAYS);

      const startIso = fmt(today, '00:00:00Z');
      const endIso = fmt(endDate, '23:59:59Z');

      const raw = await fetchSchedule(startIso, endIso);
      setSections(groupByDate(raw.schedules || []));
      setError(undefined);
    } catch (err) {
      console.warn('ScheduleScreen fetch error:', err);
      setError('Could not load schedule.');
    }
  }, [currentTimezone]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchScheduleData();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchScheduleData]);

  useEffect(() => {
    (async () => {
      await fetchScheduleData();
      setLoading(false);
    })();
  }, [fetchScheduleData]);

  useEffect(() => {
    let isMounted = true;
    let interval: NodeJS.Timeout | null = null;

    const fetchLiveShow = async () => {
      try {
        const res = await fetch(
          `https://api.radiocult.fm/api/station/${STATION_ID}/schedule/live`,
          {
            headers: {
              'x-api-key': apiKey,
              'Content-Type': 'application/json',
            },
          }
        );
        if (!res.ok) throw new Error(`Live fetch error: ${res.statusText}`);
        const json = await res.json();

        const newId =
          json?.result?.status === 'schedule'
            ? json?.result?.content?.id
            : null;

        if (!isMounted) return;

        // Use a functional update to access the latest value
        setCurrentShowId((prevId) => {
          if (prevId !== newId) {
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }).start(() => {
              Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
              }).start();
            });
            return newId || null;
          }
          return prevId;
        });
      } catch (err) {
        console.warn('Live-show fetch error:', err);
      }
    };

    const startPolling = () => {
      if (isPlaying && AppState.currentState === 'active' && !interval) {
        interval = setInterval(fetchLiveShow, LIVE_POLL_INTERVAL);
      }
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    fetchLiveShow();
    startPolling();

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && isPlaying) {
        startPolling();
      } else if (nextState === 'background' || nextState === 'inactive') {
        stopPolling();
      }
    });

    return () => {
      isMounted = false;
      stopPolling();
      subscription.remove();
    };
  }, [isPlaying, fadeAnim]);

  async function fetchSchedule(startDate: string, endDate: string) {
    const url =
      `https://api.radiocult.fm/api/station/${STATION_ID}/schedule` +
      `?startDate=${encodeURIComponent(startDate)}` +
      `&endDate=${encodeURIComponent(endDate)}` +
      `&timeZone=${encodeURIComponent(currentTimezone)}`;
    const res = await fetch(url, {
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(res.statusText);
    return (await res.json()) as { schedules?: RawScheduleItem[] };
  }

  function groupByDate(items: RawScheduleItem[]): SectionData[] {
    const todayKey = new Date().toISOString().split('T')[0];
    const buckets: Record<string, RawScheduleItem[]> = {};

    items.forEach((item) => {
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

          const startStr = startDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: currentTimezone,
          });
          const endStr = endDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: currentTimezone,
          });

          const startParts = startStr.split(/\s+/);
          const endParts = endStr.split(/\s+/);

          let timeLabel: string;
          if (startParts.length === 2 && endParts.length === 2) {
            // Always show format: "11:00 – 12:00 PM" (no AM on start time)
            timeLabel = `${startParts[0]} – ${endStr}`;
          } else {
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
      .sort((a, b) => new Date(a.title).getTime() - new Date(b.title).getTime());
  }

  if (loading) {
    return (
      <SwipeNavigator>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SwipeNavigator>
    );
  }

  if (error) {
    return (
      <SwipeNavigator>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <SelectableThemedText style={{ color: colors.notification, fontSize: 18 }}>
            {error}
          </SelectableThemedText>
        </View>
      </SwipeNavigator>
    );
  }

  return (
    <SwipeNavigator>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 48 }]}>
        <View style={styles.titleContainer}>
          <SelectableThemedText style={[styles.title, { color: colors.primary }]}>
            Schedule
          </SelectableThemedText>
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(item, idx) => item.id + idx}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          renderSectionHeader={({ section: { title } }) => (
            <>
              <SelectableThemedText style={[styles.sectionHeader, { color: colors.primary }]}>
                {title}
              </SelectableThemedText>
              <View style={styles.headerRow}>
                <SelectableThemedText style={[styles.headerCell, { color: colors.primary }]}>
                  Time
                </SelectableThemedText>
                <SelectableThemedText style={[styles.headerCell, { color: colors.primary }]}>
                  Show
                </SelectableThemedText>
              </View>
            </>
          )}
          renderItem={({ item }) => {
            const isCurrent = item.id === currentShowId;
            const CellWrapper = isCurrent ? Animated.View : View;

            return (
              <CellWrapper style={isCurrent ? { opacity: fadeAnim } : undefined}>
                <View style={styles.row}>
                  <SelectableThemedText
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
                  </SelectableThemedText>

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
                      <SelectableThemedText
                        style={[
                          styles.cellText,
                          {
                            color: colors.primary,
                            fontWeight: isCurrent ? '700' : '600',
                            fontStyle: isCurrent ? 'italic' : 'normal',
                          },
                        ]}
                      >
                        {item.title}
                      </SelectableThemedText>
                    </View>
                  </Link>
                </View>
              </CellWrapper>
            );
          }}
          contentContainerStyle={styles.list}
        />
      </View>
    </SwipeNavigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    paddingTop: 10,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: '600',
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
    fontWeight: '500',
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
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },


});
