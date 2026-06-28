// components/screens/ScheduleScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { colors, font, type } from '../../theme/tokens'
import { PageScaffold } from '../ui/PageScaffold'
import { Pills } from '../ui/Pills'
import { Eyebrow } from '../ui/Eyebrow'
import { FormattedShowTitle } from '../FormattedShowTitle'
import { apiKey } from '../../config'
import { useArtistMapping, useArtists } from '../../hooks/useArtists'
import { useTimezoneChange } from '../../hooks/useTimezoneChange'

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

async function fetchSchedule(startDate: string, endDate: string, currentTimezone: string) {
  const url =
    `https://api.radiocult.fm/api/station/${STATION_ID}/schedule` +
    `?startDate=${encodeURIComponent(startDate)}` +
    `&endDate=${encodeURIComponent(endDate)}` +
    `&timeZone=${encodeURIComponent(currentTimezone)}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const res = await fetch(url, {
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
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
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = yesterday.toISOString().split('T')[0]

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

    if (dateKey >= yesterdayKey) {
      ;(buckets[dateKey] ||= []).push(item)
    }
  })

  const formatTime = (utcString: string) => {
    const d = new Date(utcString)
    return d
      .toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: currentTimezone,
      })
      .replace(':00 ', ' ') // drop :00 but keep AM/PM
  }

  const getDayName = (dateKey: string): string => {
    if (dateKey === todayKey) return 'Today'
    if (dateKey === tomorrowKey) return 'Tomorrow'
    if (dateKey === yesterdayKey) return 'Yesterday'
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

export default function ScheduleScreen({ pageIndex, isActive }: { pageIndex: number; isActive: boolean }) {
  const router = useRouter()
  const currentTimezone = useTimezoneChange()

  // Artist-name resolution: the curated mapping is incomplete, so fall back to
  // the full RadioCult artist list, then to a lazily-fetched per-id cache.
  const { data: artistMapping } = useArtistMapping()
  const { artists } = useArtists()
  const artistsById = React.useMemo(() => {
    const m: Record<string, string> = {}
    for (const a of artists) m[a.id] = a.name
    return m
  }, [artists])
  const [extraNames, setExtraNames] = useState<Record<string, string>>({})

  const resolveArtistName = useCallback(
    (id?: string) => (id ? (artistMapping?.[id]?.name ?? artistsById[id] ?? extraNames[id] ?? '') : ''),
    [artistMapping, artistsById, extraNames]
  )

  const [sections, setSections] = useState<SectionData[]>([])
  const [, setLoading] = useState(true)
  const [, setError] = useState<string>()
  const [currentShowId, setCurrentShowId] = useState<string | null>(null)

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
      const res = await fetch(
        `https://api.radiocult.fm/api/station/${STATION_ID}/schedule/live`,
        {
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
          },
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
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 1)
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + NUM_DAYS)

      const startIso = fmt(startDate, '00:00:00Z')
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

  // Refresh when isActive (Task 9 pattern)
  useEffect(() => {
    if (!isActive) return
    Promise.all([fetchScheduleData(), fetchLiveNow()]).catch((e) =>
      console.warn('Schedule refresh failed:', e)
    )
  }, [isActive, fetchScheduleData, fetchLiveNow])

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

  // All days (-1 .. +7), each with its rows. Sorted chronologically by groupByDate.
  const days = React.useMemo(
    () =>
      sections.map((sec) => ({
        key: sec.key,
        dayName: sec.dayName,
        rows: sec.data.map((it) => ({
          id: it.id,
          time: it.startTime,
          isLive: it.id === currentShowId,
          title: it.title,
          artist: resolveArtistName(it.artistIds?.[0]),
        })),
      })),
    [sections, currentShowId, resolveArtistName]
  )

  // Lazily fetch names for any schedule artist id that neither the mapping nor
  // the full artist list resolves, so no row is left without a host name.
  useEffect(() => {
    const missing = new Set<string>()
    for (const sec of sections) {
      for (const it of sec.data) {
        const id = it.artistIds?.[0]
        if (id && !artistMapping?.[id]?.name && !artistsById[id] && !extraNames[id]) missing.add(id)
      }
    }
    if (missing.size === 0) return
    let cancelled = false
    ;(async () => {
      const entries = await Promise.all(
        [...missing].map(async (id) => {
          try {
            const res = await fetch(
              `https://api.radiocult.fm/api/station/${STATION_ID}/artists/${encodeURIComponent(id)}`,
              { headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' } }
            )
            if (!res.ok) return [id, ''] as const
            const json = await res.json()
            return [id, json?.artist?.name ?? ''] as const
          } catch {
            return [id, ''] as const
          }
        })
      )
      if (cancelled) return
      const resolved = entries.filter(([, name]) => name)
      if (resolved.length > 0) {
        setExtraNames((prev) => {
          const next = { ...prev }
          for (const [id, name] of resolved) next[id] = name
          return next
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sections, artistMapping, artistsById, extraNames])

  // Big heading reflects the day currently scrolled to the top.
  const scrollRef = useRef<ScrollView>(null)
  const dayOffsets = useRef<Record<string, number>>({})
  // Every row's geometry, keyed by show id (captured on layout regardless of
  // whether it's the live one — currentShowId often arrives after layout).
  const rowOffsets = useRef<Record<string, { day: string; y: number; h: number }>>({})
  const viewportH = useRef(0)
  const [activeDay, setActiveDay] = useState('Today')

  // A centring request stays "pending" until the geometry it needs is
  // available, so it survives the race between data load, row layout and swipe.
  const pending = useRef(false)
  const pendingAnimated = useRef(false)

  // Try to satisfy a pending centring request. Called after every layout event
  // (and from the effects) so it fires the instant the live row is measured.
  const maybeCenter = useCallback(() => {
    if (!pending.current) return
    const animated = pendingAnimated.current
    const id = currentShowId
    if (id) {
      const r = rowOffsets.current[id]
      if (r && dayOffsets.current[r.day] != null) {
        const absY = dayOffsets.current[r.day] + r.y
        const target = Math.max(0, absY - viewportH.current / 2 + r.h / 2)
        scrollRef.current?.scrollTo({ y: target, animated })
        pending.current = false
      }
      return // wait for the live row's geometry
    }
    // Off air: fall back to the top of Today.
    const t = dayOffsets.current['Today']
    if (t != null) {
      scrollRef.current?.scrollTo({ y: t, animated })
      pending.current = false
    }
  }, [currentShowId])

  const requestCenter = useCallback((animated: boolean) => {
    pending.current = true
    pendingAnimated.current = animated
    requestAnimationFrame(maybeCenter)
  }, [maybeCenter])

  // Centre on the current show on first load / whenever it changes, and each
  // time the page is swiped back into view.
  useEffect(() => {
    requestCenter(false)
  }, [currentShowId, requestCenter])

  useEffect(() => {
    if (isActive) requestCenter(true)
  }, [isActive, requestCenter])

  const onScroll = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = e.nativeEvent.contentOffset.y + 8
    let name = days[0]?.dayName ?? 'Today'
    for (const d of days) {
      const off = dayOffsets.current[d.dayName]
      if (off != null && off <= y) name = d.dayName
    }
    if (name !== activeDay) setActiveDay(name)
  }

  return (
    <PageScaffold left={<Pills active={pageIndex} />}>
      <Eyebrow>schedule</Eyebrow>
      <Text style={[type.pagehead, { color: colors.green, marginTop: 8 }]}>{activeDay}</Text>
      <ScrollView
        ref={scrollRef}
        style={{ marginTop: 32 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onLayout={(e) => { viewportH.current = e.nativeEvent.layout.height }}
      >
        {days.map((d) => (
          <View
            key={d.key}
            onLayout={(e) => { dayOffsets.current[d.dayName] = e.nativeEvent.layout.y; maybeCenter() }}
          >
            {d.rows.map((r) => (
              <Pressable
                key={r.id}
                style={s.row}
                onPress={() => router.push(`/show/${r.id}`)}
                onLayout={(e) => { rowOffsets.current[r.id] = { day: d.dayName, y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height }; maybeCenter() }}
              >
                <View style={s.timeCol}>
                  {r.isLive ? (
                    <View style={s.nowChip}><Text style={s.nowChipText}>NOW</Text></View>
                  ) : (
                    <Text style={[s.time, { color: colors.bone }]} numberOfLines={1}>{r.time}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <FormattedShowTitle title={r.title} color={r.isLive ? colors.green : colors.bone} size={22} style={type.rowTitle} />
                  <Text style={[type.rowSub, { color: colors.bone, marginTop: 4 }]}>{r.artist}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </PageScaffold>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 30 },
  timeCol: { width: 64 },
  time: { fontFamily: font.body, fontWeight: '600', fontSize: 15 },
  nowChip: { alignSelf: 'flex-start', backgroundColor: colors.green, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, marginTop: 1 },
  nowChipText: { fontFamily: font.headingBold, fontWeight: '700', fontSize: 13, letterSpacing: 0.4, color: colors.purple },
})
