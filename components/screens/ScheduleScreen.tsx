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
import { useArtistMapping } from '../../hooks/useArtists'
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

  // Fetch artist mapping from API
  const { data: artistMapping } = useArtistMapping()

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

  const rows = React.useMemo(() => {
    const todaySection = sections.find((sec) => sec.dayName === 'Today')
    if (!todaySection) return [] as { id: string; time: string; isLive: boolean; title: string; artist: string }[]
    return todaySection.data.map((it) => ({
      id: it.id,
      time: it.startTime,
      isLive: it.id === currentShowId,
      title: it.title,
      artist: it.artistIds?.[0] ? (artistMapping?.[it.artistIds[0]]?.name ?? '') : '',
    }))
  }, [sections, currentShowId, artistMapping])

  return (
    <PageScaffold left={<Pills active={pageIndex} />}>
      <Eyebrow>Schedule</Eyebrow>
      <Text style={[type.pagehead, { color: colors.green, marginTop: 8 }]}>Today</Text>
      <ScrollView style={{ marginTop: 32 }} showsVerticalScrollIndicator={false}>
        {rows.map((r) => (
          <Pressable key={r.id} style={s.row} onPress={() => router.push(`/show/${r.id}`)}>
            <Text style={[s.time, { color: r.isLive ? colors.green : colors.lilac }]}>{r.isLive ? 'Now' : r.time}</Text>
            <View style={{ flex: 1 }}>
              <FormattedShowTitle title={r.title} color={colors.green} size={22} style={type.rowTitle} />
              <Text style={[type.rowSub, { color: colors.lilac, marginTop: 4 }]}>{r.artist}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </PageScaffold>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 30 },
  time: { fontFamily: font.body, fontWeight: '600', fontSize: 13, width: 46 },
})
