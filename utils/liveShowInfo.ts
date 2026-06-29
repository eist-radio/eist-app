import { apiKey } from '../config'
import { formatClockTime } from './formatTime'

const STATION_ID = 'eist-radio'
const API_BASE = `https://api.radiocult.fm/api/station/${STATION_ID}`
const LIVE_URL = `${API_BASE}/schedule/live`
const ARTIST_URL = `${API_BASE}/artists`

const CACHE_TTL_MS = 60_000

type ArtistInfo = {
  name: string
  artworkUrl?: string
}

export type LiveShowInfo = {
  title: string
  djName: string
  startDateUtc?: string
  endDateUtc?: string
  showTime?: string
  artworkUrl?: string
  artistId?: string
}

let liveCache: {
  fetchedAt: number
  timeZone: string
  startDateUtc?: string
  endDateUtc?: string
  data: LiveShowInfo | null
} | null = null

let inflight: Promise<LiveShowInfo | null> | null = null
const artistCache: Record<string, ArtistInfo> = {}

function resolveTimeZone(timeZone?: string) {
  return timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function formatShowTimeRange(start?: string, end?: string, timeZone?: string) {
  if (!start || !end) return ''
  const tz = resolveTimeZone(timeZone)

  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return ''
  }

  return `${formatClockTime(startDate, tz)}–${formatClockTime(endDate, tz)}`
}

async function fetchArtistInfo(artistId: string, headers: Record<string, string>): Promise<ArtistInfo> {
  if (artistCache[artistId]) {
    return artistCache[artistId]
  }

  const res = await fetch(`${ARTIST_URL}/${encodeURIComponent(artistId)}`, { headers })
  if (!res.ok) {
    throw new Error(`Artist lookup failed (${res.status})`)
  }

  const json = await res.json()
  const artist = json.artist || {}
  const artworkUrl =
    artist.logo?.['1024x1024'] ||
    artist.logo?.['512x512'] ||
    artist.logo?.['256x256'] ||
    undefined

  const info = {
    name: artist.name || '',
    artworkUrl,
  }

  artistCache[artistId] = info
  return info
}

export async function getLiveShowInfo(options?: { timeZone?: string }): Promise<LiveShowInfo | null> {
  const timeZone = resolveTimeZone(options?.timeZone)
  const now = Date.now()

  if (liveCache && now - liveCache.fetchedAt < CACHE_TTL_MS) {
    if (liveCache.data && liveCache.timeZone !== timeZone) {
      const showTime = formatShowTimeRange(liveCache.startDateUtc, liveCache.endDateUtc, timeZone)
      return { ...liveCache.data, showTime }
    }
    return liveCache.data
  }

  if (inflight) {
    return inflight
  }

  inflight = (async () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey) {
      headers['x-api-key'] = apiKey
    }

    const res = await fetch(LIVE_URL, { headers })
    if (!res.ok) {
      throw new Error(`Live schedule fetch failed (${res.status})`)
    }

    const json = await res.json()
    const result = json?.result ?? json
    const status = result?.status

    if (status !== 'schedule') {
      const data: LiveShowInfo = {
        title: 'éist · off air',
        djName: '',
      }
      liveCache = {
        fetchedAt: Date.now(),
        timeZone,
        data,
      }
      return data
    }

    const content = result?.content || {}
    const artistId = content.artistIds?.[0]
    let djName = ''
    let artworkUrl: string | undefined

    if (artistId) {
      try {
        const artistInfo = await fetchArtistInfo(artistId, headers)
        djName = artistInfo.name
        artworkUrl = artistInfo.artworkUrl
      } catch (error) {
        console.warn('Failed to fetch artist info:', error)
      }
    }

    if (!djName) {
      djName = result?.artist || ''
    }

    if (!artworkUrl) {
      artworkUrl = result?.artworkUrl || undefined
    }

    const startDateUtc = content.startDateUtc
    const endDateUtc = content.endDateUtc

    const data: LiveShowInfo = {
      title: content.title || 'éist',
      djName,
      startDateUtc,
      endDateUtc,
      showTime: formatShowTimeRange(startDateUtc, endDateUtc, timeZone),
      artworkUrl,
      artistId,
    }

    liveCache = {
      fetchedAt: Date.now(),
      timeZone,
      startDateUtc,
      endDateUtc,
      data,
    }

    return data
  })()

  try {
    return await inflight
  } finally {
    inflight = null
  }
}
