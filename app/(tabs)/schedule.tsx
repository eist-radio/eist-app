import { ReminderButton } from '@/components/ReminderButton'
import { SelectableThemedText } from '@/components/SelectableThemedText'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useTheme } from '@react-navigation/native'
import { Link } from 'expo-router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  AppState,
  Image,
  Linking,
  Platform,
  RefreshControl,
  SectionList,
  SectionListData,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FormattedShowTitle } from '../../components/FormattedShowTitle'
import { apiKey } from '../../config'
import { useArtistMapping } from '../../hooks/useArtists'
import { useTimezoneChange } from '../../hooks/useTimezoneChange'

const logoImage = require('../../assets/images/eist-logo-header.png')

const STATION_ID = 'eist-radio'
const NUM_DAYS = 7

type RawScheduleItem = {
  id: string
  stationId: string
  title: string
  startDateUtc: string
  endDateUtc: string
  description?: any
  duration: number
  timezone: string
  color?: string
  artistIds?: string[]
  isRecurring: boolean
  media:
    | { type: 'mix'; trackId?: string }
    | { type: 'playlist'; playlistId: string }
    | { type: 'live' }
}

type SectionRow = {
  time: string
  startTime: string
  endTime: string
  title: string
  id: string
  artistIds?: string[]
  artistName?: string
  startDateUtc: string
}

type SectionData = {
  key: string // YYYY-MM-DD
  title: string // localized label
  dayName: string // "Today", "Tomorrow", or weekday
  dateLabel: string // "27 January"
  data: SectionRow[]
}

const BackToTopButton = ({ onPress, visible }: { onPress: () => void; visible: boolean }) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
    }).start()
  }, [visible, animatedValue])

  return (
    <Animated.View
      style={[
        styles.backToTopButton,
        {
          opacity: animatedValue,
          transform: [
            {
              scale: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }),
            },
          ],
        },
      ]}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.backToTopTouchable}>
        <Ionicons name="chevron-up" size={32} color="#AFFC41" style={styles.chevronIcon} />
      </TouchableOpacity>
    </Animated.View>
  )
}

// Live indicator component with pulsing animation
const LiveIndicator = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: Platform.OS !== 'web' }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [pulseAnim])

  return (
    <Animated.View style={[styles.liveIndicator, { opacity: pulseAnim }]}>
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>LIVE</Text>
    </Animated.View>
  )
}

export default function ScheduleScreen() {
  const { colors } = useTheme()
  const currentTimezone = useTimezoneChange()
  const insets = useSafeAreaInsets()

  // Fetch artist mapping from API
  const { data: artistMapping } = useArtistMapping()

  const [sections, setSections] = useState<SectionData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [currentShowId, setCurrentShowId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [isScrollable, setIsScrollable] = useState(false)

  const fadeAnim = useRef(new Animated.Value(1)).current
  const sectionListRef = useRef<SectionList<SectionRow, SectionData>>(null)

  // guards to avoid overlapping fetches from mount + focus + foreground
  const isFetchingSchedule = useRef(false)
  const isFetchingLive = useRef(false)

  function fmt(d: Date, suffix: string) {
    // UTC-day window
    return d.toISOString().split('T')[0] + 'T' + suffix
  }

  const fetchLiveNow = useCallback(async () => {
    if (isFetchingLive.current) return
    isFetchingLive.current = true
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (apiKey) {
        headers['x-api-key'] = apiKey
      }
      const res = await fetch(
        `https://api.radiocult.fm/api/station/${STATION_ID}/schedule/live`,
        {
          headers,
          signal: controller.signal,
        }
      )
      if (!res.ok) throw new Error(`Live fetch error: ${res.status} ${res.statusText}`)
      const json = await res.json()
      const newId = json?.result?.status === 'schedule' ? json?.result?.content?.id : null
      setCurrentShowId(newId || null)
    } catch (err) {
      console.warn('Live-show fetch error:', err)
    } finally {
      clearTimeout(timeoutId)
      isFetchingLive.current = false
    }
  }, [])

  const fetchScheduleData = useCallback(async () => {
    if (isFetchingSchedule.current) return
    isFetchingSchedule.current = true
    try {
      const today = new Date()
      const endDate = new Date()
      endDate.setDate(today.getDate() + NUM_DAYS)

      const startIso = fmt(today, '00:00:00Z')
      const endIso = fmt(endDate, '23:59:59Z')

      const raw = await fetchSchedule(startIso, endIso, currentTimezone)
      const grouped = groupByDate(raw.schedules || [], currentTimezone)
      setSections(grouped)
      setError(undefined)
    } catch (err) {
      console.warn('ScheduleScreen fetch error:', err)
      if (sections.length === 0) setError('Could not load schedule.')
    } finally {
      isFetchingSchedule.current = false
    }
  }, [currentTimezone, sections.length])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([fetchScheduleData(), fetchLiveNow()])
    } catch (err) {
      console.error('Refresh failed:', err)
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchScheduleData, fetchLiveNow])

  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y
    const contentHeight = event.nativeEvent.contentSize.height
    const layoutHeight = event.nativeEvent.layoutMeasurement.height
    const scrollable = contentHeight > layoutHeight + 10
    setIsScrollable(scrollable)
    setShowBackToTop(scrollable && scrollY > 100)
  }

  const scrollToTop = () => {
    sectionListRef.current?.scrollToLocation({
      sectionIndex: 0,
      itemIndex: 0,
      animated: true,
    })
    setTimeout(() => {
      sectionListRef.current?.scrollToLocation({
        sectionIndex: 0,
        itemIndex: 0,
        animated: false,
      })
    }, 100)
  }

  const renderSectionHeader = React.useCallback(
    ({ section }: { section: SectionListData<SectionRow, SectionData> }) => (
      <View style={styles.sectionHeaderContainer}>
        <View style={styles.sectionHeaderContent}>
          <Text style={[styles.sectionDayName, { color: colors.primary }]}>
            {section.dayName}
          </Text>
          <Text style={[styles.sectionDateLabel, { color: colors.text }]}>
            {section.dateLabel}
          </Text>
        </View>
        <View style={[styles.sectionHeaderLine, { backgroundColor: colors.primary + '30' }]} />
      </View>
    ),
    [colors.primary, colors.text]
  )

  const renderItem = React.useCallback(
    ({ item }: { item: SectionRow }) => {
      const isCurrent = item.id === currentShowId
      const artistId = item.artistIds?.[0]
      const artistName = artistId ? artistMapping?.[artistId]?.name : undefined

      return (
        <Animated.View
          style={[
            styles.showCard,
            isCurrent && styles.showCardCurrent,
            isCurrent && { borderLeftColor: colors.primary },
            { opacity: isCurrent ? fadeAnim : 1 },
          ]}
        >
          <View style={styles.showCardRow}>
            <Link href={`/show/${encodeURIComponent(item.id)}`} asChild>
              <TouchableOpacity activeOpacity={0.7} style={styles.showCardLink}>
                <View style={styles.showCardInner}>
                  {/* Time column */}
                  <View style={styles.timeColumn}>
                    <Text style={[styles.startTime, { color: isCurrent ? colors.primary : colors.text }]}>
                      {item.startTime}
                    </Text>
                    <Text style={[styles.endTime, { color: colors.text }]}>
                      {item.endTime}
                    </Text>
                  </View>

                  {/* Content column */}
                  <View style={styles.contentColumn}>
                    <View style={styles.titleRow}>
                      {isCurrent && <LiveIndicator />}
                      <FormattedShowTitle
                        title={item.title}
                        color={colors.primary}
                        size={17}
                        style={[
                          styles.showTitle,
                          isCurrent && styles.showTitleCurrent,
                        ]}
                        numberOfLines={2}
                      />
                    </View>
                    {artistName && (
                      <Text
                        style={[styles.artistName, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {artistName}
                      </Text>
                    )}
                  </View>

                  {/* Chevron */}
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.text + '60'}
                    style={styles.rowChevron}
                  />
                </View>
              </TouchableOpacity>
            </Link>

            {/* Reminder Button - outside Link to handle its own press */}
            {!isCurrent && (
              <ReminderButton
                showId={item.id}
                showTitle={item.title}
                artistName={artistName}
                startDateUtc={item.startDateUtc}
                size={20}
              />
            )}
          </View>
        </Animated.View>
      )
    },
    [currentShowId, colors.text, colors.primary, fadeAnim, artistMapping]
  )

  // pulse the "current" row briefly when it changes
  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.6, duration: 150, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: Platform.OS !== 'web' }),
    ]).start()
  }, [currentShowId, fadeAnim])

  // Initial load
  useEffect(() => {
    ;(async () => {
      try {
        await Promise.all([fetchScheduleData(), fetchLiveNow()])
      } finally {
        setLoading(false)
      }
    })()
  }, [fetchScheduleData, fetchLiveNow])

  // Refresh every time the screen becomes focused (no double-fetch thanks to guards)
  useFocusEffect(
    useCallback(() => {
      ;(async () => {
        await Promise.all([fetchScheduleData(), fetchLiveNow()])
      })()
    }, [fetchScheduleData, fetchLiveNow])
  )

  // Also refresh when app returns to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        Promise.all([fetchScheduleData(), fetchLiveNow()]).catch((e) =>
          console.warn('Foreground refresh failed:', e)
        )
      }
    })
    return () => sub.remove()
  }, [fetchScheduleData, fetchLiveNow])

  if (loading) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.primary }]}>Loading schedule...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SelectableThemedText style={{ color: colors.notification, fontSize: 18 }}>
          {error}
        </SelectableThemedText>
      </View>
    )
  }

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 48 }]}
    >
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
            <Image source={logoImage} style={{ width: 57, height: 57 }} resizeMode="contain" />
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
        removeClippedSubviews
        maxToRenderPerBatch={5}
        windowSize={5}
        initialNumToRender={8}
        updateCellsBatchingPeriod={50}
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
      <BackToTopButton onPress={scrollToTop} visible={showBackToTop && isScrollable} />
    </View>
  )
}

async function fetchSchedule(startDate: string, endDate: string, currentTimezone: string) {
  const url =
    `https://api.radiocult.fm/api/station/${STATION_ID}/schedule` +
    `?startDate=${encodeURIComponent(startDate)}` +
    `&endDate=${encodeURIComponent(endDate)}` +
    `&timeZone=${encodeURIComponent(currentTimezone)}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) {
      headers['x-api-key'] = apiKey
    }
    const res = await fetch(url, {
      headers,
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return (await res.json()) as { schedules?: RawScheduleItem[] }
  } finally {
    clearTimeout(timeoutId)
  }
}

function groupByDate(items: RawScheduleItem[], currentTimezone: string): SectionData[] {
  const today = new Date()
  const todayKey = today.toISOString().split('T')[0]
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = tomorrow.toISOString().split('T')[0]

  const buckets: Record<string, RawScheduleItem[]> = {}

  items.forEach((item) => {
    const d = new Date(item.startDateUtc)
    let dateKey = d.toISOString().split('T')[0]

    // Midnight-UTC shows belong to the previous day bucket
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) {
      const prev = new Date(d)
      prev.setUTCDate(prev.getUTCDate() - 1)
      dateKey = prev.toISOString().split('T')[0]
    }

    if (dateKey >= todayKey) {
      ;(buckets[dateKey] ||= []).push(item)
    }
  })

  const formatTime = (utcString: string) => {
    const d = new Date(utcString)
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: currentTimezone,
    }).replace(':00 ', ' ') // drop :00 but keep AM/PM
  }

  const getDayName = (dateKey: string): string => {
    if (dateKey === todayKey) return 'Today'
    if (dateKey === tomorrowKey) return 'Tomorrow'
    return new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })
  }

  const getDateLabel = (dateKey: string): string => {
    return new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
    })
  }

  return Object.entries(buckets)
    .map(([dateKey, dayItems]) => {
      const title = new Date(dateKey).toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
      return {
        key: dateKey,
        title,
        dayName: getDayName(dateKey),
        dateLabel: getDateLabel(dateKey),
        data: dayItems.map((it) => ({
          time: `${formatTime(it.startDateUtc)}–${formatTime(it.endDateUtc)}`,
          startTime: formatTime(it.startDateUtc),
          endTime: formatTime(it.endDateUtc),
          title: it.title.trim(),
          id: it.id,
          artistIds: it.artistIds,
          startDateUtc: it.startDateUtc,
        })),
      }
    })
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}
 
const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8, paddingTop: 10 },
  list: { paddingBottom: 24 },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  logoContainer: { position: 'absolute', top: -44, right: 5 },
  logoBackground: { borderRadius: 26, padding: 6 },

  // Section header styles
  sectionHeaderContainer: {
    marginTop: 20,
    marginBottom: 12,
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 8,
  },
  sectionDayName: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  sectionDateLabel: {
    fontSize: 15,
    opacity: 0.6,
    fontWeight: '500',
  },
  sectionHeaderLine: {
    height: 1,
    width: '100%',
  },

  // Show card styles
  showCard: {
    marginBottom: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  showCardCurrent: {
    borderLeftWidth: 3,
    backgroundColor: 'rgba(175, 252, 65, 0.08)',
  },
  showCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  showCardLink: {
    flex: 1,
    minWidth: 0,
  },
  showCardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 4,
    width: '100%',
  },

  // Time column
  timeColumn: {
    width: 80,
    marginRight: 12,
  },
  startTime: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
    flexWrap: 'nowrap',
  },
  endTime: {
    fontSize: 12,
    opacity: 0.5,
    marginTop: 2,
    flexWrap: 'nowrap',
  },

  // Content column
  contentColumn: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    flexGrow: 1,
    flexBasis: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  showTitle: {
    fontWeight: '600',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  showTitleCurrent: {
    fontWeight: '700',
  },
  artistName: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 4,
    fontWeight: '500',
  },

  // Row chevron
  rowChevron: {
    marginLeft: 8,
  },

  // Live indicator
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(175, 252, 65, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#AFFC41',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#AFFC41',
    letterSpacing: 0.5,
  },

  // Back to top button
  backToTopButton: {
    position: 'absolute',
    bottom: 20,
    left: '45%',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'transparent',
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
})
