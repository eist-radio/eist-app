import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DATA_BUCKET: R2Bucket
}

const app = new Hono<{ Bindings: Bindings }>()

// Archive filtering config (matches website/app logic)
const ARCHIVE_START_DATE = '2025-02-01'
const TEST_BROADCAST_TITLES = [
  'box test',
  'box test 2',
  'playlisting test',
  'mensajito_eist_test',
  'mystery test broadcast',
  'stay tuned...',
]

// Check if show title indicates a repeat broadcast
function isRepeatBroadcast(title: string): boolean {
  if (!title) return false
  const titleLower = title.toLowerCase()
  const patterns = ['éist arís', 'eist aris', 'rebroadcast', 'replay', 'repeat', 'from the archives']
  return patterns.some((p) => titleLower.includes(p))
}

// Check if a show has archived content
function hasArchivedContent(show: any): boolean {
  return !!(show.mixcloud_match || show.soundcloud_match)
}

// Compute artist stats from shows data
function computeArtistStats(shows: any[]) {
  const now = new Date()
  const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000)
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  const stats: Record<string, {
    totalArchived: number
    recent40NonRepeat: boolean
    recent3moArchived: boolean
    showCount: number
    latestShow: string | null
  }> = {}

  const artistNames: Record<string, string> = {}

  for (const show of shows) {
    const slug = show.artistSlug
    if (!slug) continue

    // Track artist name
    if (show.artistName && !artistNames[slug]) {
      artistNames[slug] = show.artistName
    }

    if (!stats[slug]) {
      stats[slug] = { totalArchived: 0, recent40NonRepeat: false, recent3moArchived: false, showCount: 0, latestShow: null }
    }

    stats[slug].showCount += 1

    // Track latest show
    if (show.start && (!stats[slug].latestShow || show.start > stats[slug].latestShow)) {
      stats[slug].latestShow = show.start
    }

    const hasArchive = hasArchivedContent(show)
    const isRepeat = isRepeatBroadcast(show.title || '')

    if (hasArchive) {
      stats[slug].totalArchived += 1
      if (show.start) {
        const showDate = new Date(show.start)
        if (showDate > threeMonthsAgo) {
          stats[slug].recent3moArchived = true
        }
      }
    }

    if (show.start && !isRepeat) {
      const showDate = new Date(show.start)
      if (showDate > fortyDaysAgo) {
        stats[slug].recent40NonRepeat = true
      }
    }
  }

  // Convert to array format sorted by totalShows
  const result = Object.entries(stats)
    .map(([slug, s]) => ({
      name: artistNames[slug] || slug,
      slug,
      totalShows: s.showCount,
      showsWithArchive: s.totalArchived,
      latestShow: s.latestShow,
    }))
    .sort((a, b) => b.totalShows - a.totalShows)

  return result
}

// Build artist ID to name/slug mapping
function buildArtistMapping(shows: any[]) {
  const mapping: Record<string, { name: string; slug: string }> = {}

  for (const show of shows) {
    if (show.artistIds && show.artistName && show.artistSlug) {
      for (const id of show.artistIds) {
        if (!mapping[id]) {
          mapping[id] = { name: show.artistName, slug: show.artistSlug }
        }
      }
    }
  }

  return mapping
}

// Load shows.json from R2
async function loadShows(bucket: R2Bucket): Promise<any[]> {
  const object = await bucket.get('shows.json')
  if (!object) {
    console.error('shows.json not found in R2 bucket')
    return []
  }
  const text = await object.text()
  return JSON.parse(text)
}

// Load cache-meta.json from R2
async function loadMeta(bucket: R2Bucket): Promise<any> {
  const object = await bucket.get('cache-meta.json')
  if (!object) {
    return { last_updated: new Date().toISOString() }
  }
  const text = await object.text()
  return JSON.parse(text)
}

// CORS - allow requests from anywhere
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}))

// Health check
app.get('/', async (c) => {
  const shows = await loadShows(c.env.DATA_BUCKET)
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    shows_loaded: shows.length,
  })
})

// GET /api/meta - cache metadata
app.get('/api/meta', async (c) => {
  const [shows, meta] = await Promise.all([
    loadShows(c.env.DATA_BUCKET),
    loadMeta(c.env.DATA_BUCKET),
  ])

  const withArchive = shows.filter(s => s.mixcloud_match || s.soundcloud_match)
  const mapping = buildArtistMapping(shows)

  return c.json({
    ...meta,
    total_shows: shows.length,
    shows_with_archives: withArchive.length,
    artist_count: Object.keys(mapping).length,
    server_time: new Date().toISOString(),
  })
})

// GET /api/shows - all shows (with optional filtering)
app.get('/api/shows', async (c) => {
  const shows = await loadShows(c.env.DATA_BUCKET)
  let results = [...shows]

  // Optional filters
  const artistSlug = c.req.query('artistSlug')
  const hasArchive = c.req.query('hasArchive')
  const since = c.req.query('since')
  const raw = c.req.query('raw')
  const limit = Math.min(parseInt(c.req.query('limit') || '0'), 200)
  const offset = parseInt(c.req.query('offset') || '0')

  // Apply archive filtering by default (unless raw=true)
  if (raw !== 'true') {
    results = results.filter((show) => {
      const title = show.title || ''
      if (isRepeatBroadcast(title)) return false
      if (TEST_BROADCAST_TITLES.includes(title.toLowerCase())) return false
      if (show.start && show.start.slice(0, 10) < ARCHIVE_START_DATE) return false
      return true
    })
  }

  // Filter by artist
  if (artistSlug) {
    results = results.filter(s => s.artistSlug === artistSlug)
  }

  // Filter to only shows with archive content
  if (hasArchive === 'true') {
    results = results.filter(s => s.mixcloud_match || s.soundcloud_match)
  }

  // Filter by date
  if (since) {
    const sinceDate = new Date(since)
    results = results.filter(s => new Date(s.start) >= sinceDate)
  }

  // Sort by date (newest first)
  results.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())

  // Pagination
  const total = results.length
  if (offset > 0) {
    results = results.slice(offset)
  }
  if (limit > 0) {
    results = results.slice(0, limit)
  }

  return c.json({
    shows: results,
    pagination: {
      total,
      limit: limit || total,
      offset,
      hasMore: offset + results.length < total,
    },
  })
})

// GET /api/shows/:slug - single show by slug
app.get('/api/shows/:slug', async (c) => {
  const slug = c.req.param('slug')
  const shows = await loadShows(c.env.DATA_BUCKET)
  const show = shows.find(s => s.slug === slug)

  if (!show) {
    return c.json({ error: 'Show not found' }, 404)
  }

  return c.json(show)
})

// GET /api/artists/mapping - artist ID to name mapping
app.get('/api/artists/mapping', async (c) => {
  const shows = await loadShows(c.env.DATA_BUCKET)
  const mapping = buildArtistMapping(shows)
  return c.json(mapping)
})

// GET /api/artists/stats - artist activity stats
app.get('/api/artists/stats', async (c) => {
  const shows = await loadShows(c.env.DATA_BUCKET)
  const stats = computeArtistStats(shows)
  return c.json(stats)
})

export default app
