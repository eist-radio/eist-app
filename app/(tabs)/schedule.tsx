import { SelectableThemedText } from '@/components/SelectableThemedText';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useFocusEffect } from '@react-navigation/native';
import { Link } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Dimensions,
  Image,
  Linking,
  RefreshControl,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FormattedShowTitle } from '../../components/FormattedShowTitle';
import { apiKey } from '../../config';
import { useTrackPlayer } from '../../context/TrackPlayerContext';
import { useTimezoneChange } from '../../hooks/useTimezoneChange';

const logoImage = require('../../assets/images/eist-logo-header.png')

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

const BackToTopButton = ({ onPress, visible }: { onPress: () => void; visible: boolean }) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start()
  }, [visible, animatedValue])

  return (
    <Animated.View
      style={[
        styles.backToTopButton,
        {
          opacity: animatedValue,
          transform: [{
            scale: animatedValue.interpolate({
              inputRange: [0, 1],
              outputRange: [0.8, 1],
            })
          }]
        }
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={styles.backToTopTouchable}
      >
        <Ionicons
          name="chevron-up"
          size={32}
          color="#AFFC41"
          style={styles.chevronIcon}
        />
      </TouchableOpacity>
    </Animated.View>
  )
}

export default function ScheduleScreen() {
  const { colors } = useTheme();
  const { isPlaying } = useTrackPlayer();
  const currentTimezone = useTimezoneChange();
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  const containerPadding = 32; // 16px on each side
  const availableWidth = screenWidth - containerPadding;
  const maxTitleWidth = availableWidth * 0.6;

  const [sections, setSections] = useState<SectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [currentShowId, setCurrentShowId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const sectionListRef = useRef<SectionList>(null);
  const lastFocusTime = useRef<number>(Date.now());

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
      await Promise.all([
        fetchScheduleData(),
        (async () => {
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

            setCurrentShowId(newId || null);
          } catch (err) {
            console.warn('Live-show fetch error during refresh:', err);
          }
        })()
      ]);
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchScheduleData]);

  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const contentHeight = event.nativeEvent.contentSize.height;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;

    const scrollable = contentHeight > layoutHeight;
    setIsScrollable(scrollable);
    setShowBackToTop(scrollable && scrollY > 100);
  };

  const scrollToTop = () => {
    if (sectionListRef.current) {
      // Use scrollToLocation with a more reliable approach for Android
      sectionListRef.current.scrollToLocation({
        sectionIndex: 0,
        itemIndex: 0,
        animated: true
      });
      
      // Fallback: if the above doesn't work, try without animation
      setTimeout(() => {
        if (sectionListRef.current) {
          sectionListRef.current.scrollToLocation({
            sectionIndex: 0,
            itemIndex: 0,
            animated: false
          });
        }
      }, 100)
    }
  };

  const renderSectionHeader = React.useCallback(({ section }: { section: any }) => (
    <SelectableThemedText style={[styles.sectionHeader, { color: colors.primary }]}>
      {section.title}
    </SelectableThemedText>
  ), [colors.primary]);

  const renderItem = React.useCallback(({ item }: { item: any }) => {
    const isCurrent = item.id === currentShowId;
    const CellWrapper = isCurrent ? Animated.View : View;

    return (
      <CellWrapper style={isCurrent ? { opacity: fadeAnim } : undefined}>
        <View style={styles.row}>
          <SelectableThemedText
            style={[
              styles.cellTime,
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
            style={{ flex: 1, minWidth: 0 }}
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
              <FormattedShowTitle
                title={item.title}
                color={colors.primary}
                size={18}
                style={[
                  styles.cellText,
                  {
                    fontWeight: isCurrent ? '700' : '600',
                    fontStyle: isCurrent ? 'italic' : 'normal',
                    maxWidth: maxTitleWidth,
                  },
                ]}
                numberOfLines={undefined}
              />
            </View>
          </Link>
        </View>
      </CellWrapper>
    );
  }, [currentShowId, colors.text, colors.primary, fadeAnim, maxTitleWidth]);

  useEffect(() => {
    (async () => {
      await fetchScheduleData();
      setLoading(false);
    })();
  }, [fetchScheduleData]);

  // Auto-refresh schedule when page becomes focused after inactivity
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const timeSinceLastFocus = now - lastFocusTime.current;
      const REFRESH_THRESHOLD = 30 * 60 * 1000; // 30 minutes

      // If it's been more than 30 minutes since last focus, refresh the data
      if (timeSinceLastFocus > REFRESH_THRESHOLD) {
        fetchScheduleData().catch(err => {
          console.warn('Failed to auto-refresh schedule on focus:', err);
        });
      }

      lastFocusTime.current = now;

      // Cleanup function when losing focus
      return () => {
        lastFocusTime.current = Date.now();
      };
    }, [fetchScheduleData])
  );

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

        setCurrentShowId((prevId) => {
          if (prevId !== newId) {
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }).start(() => {
              fetchScheduleData().catch(err => {
                console.warn('Failed to refresh schedule on show change:', err);
              });

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
  }, [isPlaying, fadeAnim, fetchScheduleData]);

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

          const formatTime = (timeStr: string) => {
            return timeStr.replace(':00', '');
          };

          const startParts = startStr.split(/\s+/);
          const endParts = endStr.split(/\s+/);

          let timeLabel: string;
          if (startParts.length === 2 && endParts.length === 2) {
            const formattedStart = formatTime(startParts[0]);
            const formattedEnd = formatTime(endStr);
            timeLabel = `${formattedStart}–${formattedEnd}`;
          } else {
            const formattedStart = formatTime(startStr);
            const formattedEnd = formatTime(endStr);
            timeLabel = `${formattedStart}–${formattedEnd}`;
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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SelectableThemedText style={{ color: colors.notification, fontSize: 18 }}>
          {error}
        </SelectableThemedText>
      </View>
    );
  }

  return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 48 }]}>
        <View style={styles.titleContainer}>
          <SelectableThemedText style={[styles.title, { color: colors.primary }]}>
            Schedule
          </SelectableThemedText>
          <TouchableOpacity
            style={styles.logoContainer}
            activeOpacity={0.7}
            onPress={() => Linking.openURL('https://eist.radio/support')}
            accessibilityRole="link"
          >
            <View style={styles.logoBackground}>
              <Image
                source={logoImage}
                style={{ width: 57, height: 57 }}
                resizeMode="contain"
              />
            </View>
          </TouchableOpacity>
        </View>

        <SectionList
          ref={sectionListRef}
          sections={sections}
          keyExtractor={(item, idx) => item.id + idx}
          stickySectionHeadersEnabled={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          removeClippedSubviews={true}
          maxToRenderPerBatch={5}
          windowSize={5}
          initialNumToRender={8}
          updateCellsBatchingPeriod={50}
          getItemLayout={undefined}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.background}
            />
          }
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
        <BackToTopButton
          onPress={scrollToTop}
          visible={showBackToTop && isScrollable}
        />
      </View>
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
  list: {
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    alignItems: 'flex-start',
  },
  cell: {
    flex: 1,
    fontSize: 18,
    textAlign: 'left',
  },
  cellTime: {
    flex: 0.6,
    fontSize: 18,
    textAlign: 'left',
  },
  showCellContent: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  playIcon: {
    marginRight: 6,
    marginTop: 2,
  },
  cellText: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: 18,
    textAlign: 'left',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  logoContainer: {
    position: 'absolute',
    top: -44,
    right: 5,
  },
  logoBackground: {
    borderRadius: 26,
    padding: 6,
  },
  backToTopButton: {
    position: 'absolute',
    bottom: 20,
    left: '45%',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backToTopTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronIcon: {},
});
