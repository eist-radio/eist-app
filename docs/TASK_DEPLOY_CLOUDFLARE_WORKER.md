# Task: Deploy éist API to Cloudflare Workers

## Overview

Migrate the éist shows API from local Node.js server to Cloudflare Workers with R2 storage.

**Worker URL**: `https://eist-api.johnocallaghan.workers.dev`
**R2 Bucket**: `eist-data` (binding name: `DATA_BUCKET`)

---

## Step 1: Install Wrangler CLI

```bash
npm install -g wrangler

# Login to Cloudflare
wrangler login
# This opens a browser - authorize the CLI
```

---

## Step 2: Create Worker Project

```bash
mkdir -p ~/eist-worker
cd ~/eist-worker

# Initialize wrangler project
npm init -y
npm install hono
```

---

## Step 3: Create wrangler.toml

Create `~/eist-worker/wrangler.toml`:

```toml
name = "eist-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# R2 bucket binding
[[r2_buckets]]
binding = "DATA_BUCKET"
bucket_name = "eist-data"
```

---

## Step 4: Create the Worker Code

Create `~/eist-worker/src/index.ts`:

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DATA_BUCKET: R2Bucket
}

const app = new Hono<{ Bindings: Bindings }>()

// Archive filtering config
const ARCHIVE_START_DATE = '2025-02-01'
const TEST_BROADCAST_TITLES = [
  'box test', 'box test 2', 'playlisting test',
  'mensajito_eist_test', 'mystery test broadcast', 'stay tuned...',
]

// In-memory cache (persists for worker lifetime, typically minutes)
let showsCache: any[] | null = null
let showsBySlug: Map<string, any> = new Map()
let artistIdToName: Record<string, { name: string; slug: string }> = {}
let artistStats: any[] = []
let metaCache: any = null
let cacheTime = 0
const CACHE_TTL = 60_000 // 1 minute

function isRepeatBroadcast(title: string): boolean {
  if (!title) return false
  const titleLower = title.toLowerCase()
  return ['éist arís', 'eist aris', 'rebroadcast', 'replay', 'repeat', 'from the archives']
    .some(p => titleLower.includes(p))
}

function hasArchivedContent(show: any): boolean {
  return !!(show.mixcloud_match || show.soundcloud_match)
}

function computeArtistStats(shows: any[]) {
  const now = new Date()
  const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000)

  const statsMap: Record<string, {
    name: string
    slug: string
    totalShows: number
    showsWithArchive: number
    latestShow: string
  }> = {}

  for (const show of shows) {
    const slug = show.artistSlug
    if (!slug) continue

    if (!statsMap[slug]) {
      statsMap[slug] = {
        name: show.artistName || slug,
        slug,
        totalShows: 0,
        showsWithArchive: 0,
        latestShow: show.start
      }
    }

    statsMap[slug].totalShows += 1
    if (hasArchivedContent(show)) {
      statsMap[slug].showsWithArchive += 1
    }
    if (show.start > statsMap[slug].latestShow) {
      statsMap[slug].latestShow = show.start
    }
  }

  return Object.values(statsMap).sort((a, b) => b.totalShows - a.totalShows)
}

async function loadData(bucket: R2Bucket): Promise<boolean> {
  const now = Date.now()
  if (showsCache && (now - cacheTime) < CACHE_TTL) {
    return true
  }

  try {
    const showsObj = await bucket.get('shows.json')
    if (!showsObj) {
      console.error('shows.json not found in R2 bucket')
      return false
    }

    const showsRaw = await showsObj.text()
    showsCache = JSON.parse(showsRaw)

    // Build indexes
    showsBySlug.clear()
    artistIdToName = {}

    for (const show of showsCache!) {
      if (show.slug) {
        showsBySlug.set(show.slug, show)
      }
      if (show.artistIds && show.artistName) {
        for (const id of show.artistIds) {
          if (!artistIdToName[id]) {
            artistIdToName[id] = { name: show.artistName, slug: show.artistSlug }
          }
        }
      }
    }

    artistStats = computeArtistStats(showsCache!)

    // Try to load meta
    const metaObj = await bucket.get('cache-meta.json')
    if (metaObj) {
      metaCache = JSON.parse(await metaObj.text())
    } else {
      metaCache = { last_updated: new Date().toISOString() }
    }

    cacheTime = now
    return true
  } catch (err) {
    console.error('Failed to load data:', err)
    return false
  }
}

// CORS
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}))

// Health check
app.get('/', async (c) => {
  const loaded = await loadData(c.env.DATA_BUCKET)
  return c.json({
    status: loaded ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    shows_loaded: showsCache?.length ?? 0
  })
})

// GET /api/meta
app.get('/api/meta', async (c) => {
  await loadData(c.env.DATA_BUCKET)

  const withArchives = showsCache?.filter(s => s.mixcloud_match || s.soundcloud_match).length ?? 0
  const mcMatches = showsCache?.filter(s => s.mixcloud_match).length ?? 0
  const scMatches = showsCache?.filter(s => s.soundcloud_match).length ?? 0
  const both = showsCache?.filter(s => s.mixcloud_match && s.soundcloud_match).length ?? 0

  return c.json({
    ...metaCache,
    total_shows: showsCache?.length ?? 0,
    shows_with_archives: withArchives,
    mixcloud_matches: mcMatches,
    soundcloud_matches: scMatches,
    both_platforms: both
  })
})

// GET /api/shows
app.get('/api/shows', async (c) => {
  await loadData(c.env.DATA_BUCKET)
  if (!showsCache) {
    return c.json({ error: 'Data not loaded' }, 500)
  }

  let results = [...showsCache]

  // Query params
  const artistSlug = c.req.query('artistSlug')
  const hasArchive = c.req.query('hasArchive')
  const limit = Math.min(parseInt(c.req.query('limit') || '0'), 200)
  const offset = parseInt(c.req.query('offset') || '0')

  // Filter: exclude repeats, tests, old shows
  results = results.filter(show => {
    const title = show.title || ''
    if (isRepeatBroadcast(title)) return false
    if (TEST_BROADCAST_TITLES.includes(title.toLowerCase())) return false
    if (show.start && show.start.slice(0, 10) < ARCHIVE_START_DATE) return false
    return true
  })

  if (artistSlug) {
    results = results.filter(s => s.artistSlug === artistSlug)
  }

  if (hasArchive === 'true') {
    results = results.filter(s => s.mixcloud_match || s.soundcloud_match)
  }

  // Sort by date descending (newest first)
  results.sort((a, b) => (b.start || '').localeCompare(a.start || ''))

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
      hasMore: offset + results.length < total
    }
  })
})

// GET /api/shows/:slug
app.get('/api/shows/:slug', async (c) => {
  await loadData(c.env.DATA_BUCKET)

  const slug = c.req.param('slug')
  const show = showsBySlug.get(slug)

  if (!show) {
    return c.json({ error: 'Show not found' }, 404)
  }

  return c.json(show)
})

// GET /api/artists/mapping
app.get('/api/artists/mapping', async (c) => {
  await loadData(c.env.DATA_BUCKET)
  return c.json(artistIdToName)
})

// GET /api/artists/stats
app.get('/api/artists/stats', async (c) => {
  await loadData(c.env.DATA_BUCKET)
  return c.json(artistStats)
})

export default app
```

---

## Step 5: Upload shows.json to R2

```bash
# Upload shows.json to R2 bucket
wrangler r2 object put eist-data/shows.json --file=/root/scripts/eist-api/data/shows.json

# Upload cache-meta.json if it exists
wrangler r2 object put eist-data/cache-meta.json --file=/root/scripts/eist-api/data/cache-meta.json
```

---

## Step 6: Deploy the Worker

```bash
cd ~/eist-worker
wrangler deploy
```

---

## Step 7: Test the Deployed API

```bash
# Health check
curl https://eist-api.johnocallaghan.workers.dev/

# Meta
curl https://eist-api.johnocallaghan.workers.dev/api/meta

# Shows with archives
curl "https://eist-api.johnocallaghan.workers.dev/api/shows?hasArchive=true&limit=2"

# Single show
curl https://eist-api.johnocallaghan.workers.dev/api/shows/memory-murmurs-2026-01-25

# Artist mapping
curl https://eist-api.johnocallaghan.workers.dev/api/artists/mapping

# Artist stats
curl https://eist-api.johnocallaghan.workers.dev/api/artists/stats
```

---

## Step 8: Update App Configuration

Once deployed and tested, update the app's API config to use the production URL:

```typescript
// config/eistApi.ts
export const EIST_API_BASE_URL = 'https://eist-api.johnocallaghan.workers.dev';
```

---

## Updating shows.json

When the website rebuilds shows.json, upload the new version:

```bash
wrangler r2 object put eist-data/shows.json --file=/path/to/shows.json
```

The Worker will pick up the new data within 1 minute (cache TTL).

---

## Troubleshooting

**Worker not deploying:**
```bash
wrangler whoami  # Check you're logged in
wrangler deploy --dry-run  # Test without deploying
```

**R2 permission issues:**
- Ensure the R2 bucket binding in wrangler.toml matches the bucket name exactly
- Check the bucket exists in Cloudflare dashboard

**Data not loading:**
```bash
# List R2 bucket contents
wrangler r2 object list eist-data

# Check if shows.json exists
wrangler r2 object get eist-data/shows.json --file=/tmp/test.json
```
