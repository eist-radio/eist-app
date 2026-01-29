# Local Shows API Server Setup

Instructions for setting up a local development API server on a Debian machine to serve `shows.json` and related data. This mimics the Cloudflare Workers + R2 pattern for local development.

## Overview

**Goal**: Serve the éist shows archive data via REST API endpoints that the mobile app can consume. The app will have NO bundled shows.json - it depends entirely on this API for archive data.

**Why local first?**
- Fast iteration during development
- No cloud deployment cycles
- Test API changes before production
- Easy to debug

**Architecture**:
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  éist Website   │────▶│  Debian Server   │◀────│   éist App      │
│  (builds JSON)  │     │  (serves API)    │     │  (API only)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │
        │   scp during dev       │ HTTP :3000
        ▼                        ▼
   shows.json              GET /api/shows
   cache-meta.json         GET /api/shows/:slug
                           GET /api/artists/mapping
                           GET /api/artists/stats
                           GET /api/meta
```

**What stays with RadioCult API** (not replaced):
- `/schedule/live` - Real-time "now playing"
- `/schedule?startDate=...` - Upcoming schedule
- `/artists` - Artist profiles and logos
- `/artists/{id}` - Individual artist details
- Stream URL - Audio playback

**What this API provides** (replaces bundled shows.json):
- Archive shows with Mixcloud/SoundCloud matches
- Show lookup by slug
- Shows filtered by artist
- Artist ID → Name mapping (for schedule display)
- Artist activity stats (for filtering active/inactive)

---

## Prerequisites

On the Debian machine:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20+ (using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # Should be v20+
npm --version
```

---

## Step 1: Create the API Server Project

```bash
# Create project directory
mkdir -p ~/eist-api
cd ~/eist-api

# Initialize project
npm init -y

# Install dependencies
# Using Hono - runs on Node.js AND Cloudflare Workers (easy migration later)
npm install hono @hono/node-server

# For development
npm install -D typescript @types/node tsx
```

---

## Step 2: Create the Server Code

Create `~/eist-api/src/server.ts`:

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'

const app = new Hono()

// Data directory - where shows.json lives
const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data')

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

// Cache for shows data (reloads when file changes)
let showsCache: any[] = []
let showsBySlug: Map<string, any> = new Map()
let artistIdToName: Record<string, string> = {}
let artistStats: Record<string, { showCount: number; isActive: boolean }> = {}
let metaCache: any = {}
let lastLoadTime = 0

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
  }> = {}

  for (const show of shows) {
    const slug = show.artistSlug
    if (!slug) continue

    if (!stats[slug]) {
      stats[slug] = { totalArchived: 0, recent40NonRepeat: false, recent3moArchived: false, showCount: 0 }
    }

    stats[slug].showCount += 1

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

  // Convert to final format with isActive
  const result: Record<string, { showCount: number; isActive: boolean }> = {}
  for (const [slug, s] of Object.entries(stats)) {
    let isActive = false
    if (s.recent40NonRepeat) {
      isActive = true
    } else if (!s.recent3moArchived && s.totalArchived <= 3) {
      isActive = false
    } else {
      isActive = true
    }
    result[slug] = { showCount: s.showCount, isActive }
  }

  return result
}

async function loadData() {
  try {
    const showsPath = join(DATA_DIR, 'shows.json')
    const metaPath = join(DATA_DIR, 'cache-meta.json')

    // Check if file has been modified
    const showsStat = await stat(showsPath).catch(() => null)
    if (!showsStat) {
      console.error('shows.json not found at', showsPath)
      return
    }

    const mtime = showsStat.mtimeMs
    if (mtime <= lastLoadTime) {
      return // No changes
    }

    console.log('Loading shows.json...')
    const showsRaw = await readFile(showsPath, 'utf-8')
    showsCache = JSON.parse(showsRaw)

    // Build slug index
    showsBySlug.clear()
    for (const show of showsCache) {
      if (show.slug) {
        showsBySlug.set(show.slug, show)
      }
    }

    // Build artist ID to name mapping
    artistIdToName = {}
    for (const show of showsCache) {
      if (show.artistIds && show.artistName) {
        for (const id of show.artistIds) {
          if (!artistIdToName[id]) {
            artistIdToName[id] = show.artistName
          }
        }
      }
    }

    // Compute artist stats
    artistStats = computeArtistStats(showsCache)

    // Load meta if exists
    try {
      const metaRaw = await readFile(metaPath, 'utf-8')
      metaCache = JSON.parse(metaRaw)
    } catch {
      metaCache = {
        last_updated: new Date().toISOString(),
        show_count: showsCache.length
      }
    }

    lastLoadTime = mtime
    console.log(`Loaded ${showsCache.length} shows, ${Object.keys(artistIdToName).length} artist mappings`)

  } catch (err) {
    console.error('Failed to load data:', err)
  }
}

// Reload data periodically (every 60 seconds)
setInterval(loadData, 60_000)

// CORS - allow requests from anywhere during development
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}))

// Health check
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'eist-shows-api',
    endpoints: [
      'GET /api/shows',
      'GET /api/shows/:slug',
      'GET /api/artists/mapping',
      'GET /api/artists/stats',
      'GET /api/meta'
    ]
  })
})

// GET /api/meta - cache metadata
app.get('/api/meta', (c) => {
  return c.json({
    ...metaCache,
    show_count: showsCache.length,
    artist_count: Object.keys(artistIdToName).length,
    server_time: new Date().toISOString()
  })
})

// GET /api/shows - all shows (with optional filtering)
// Default behavior: returns shows suitable for archive display (filtered)
app.get('/api/shows', (c) => {
  let results = [...showsCache]

  // Optional filters
  const artistSlug = c.req.query('artist')
  const hasArchive = c.req.query('hasArchive')
  const since = c.req.query('since') // ISO date string
  const raw = c.req.query('raw') // If 'true', skip archive filtering
  const limit = parseInt(c.req.query('limit') || '0')
  const offset = parseInt(c.req.query('offset') || '0')

  // Apply archive filtering by default (unless raw=true)
  if (raw !== 'true') {
    results = results.filter((show) => {
      const title = show.title || ''

      // Exclude repeat broadcasts
      if (isRepeatBroadcast(title)) return false

      // Exclude test broadcasts
      if (TEST_BROADCAST_TITLES.includes(title.toLowerCase())) return false

      // Exclude shows before archive start date
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

  // Pagination
  const total = results.length
  if (offset > 0) {
    results = results.slice(offset)
  }
  if (limit > 0) {
    results = results.slice(0, limit)
  }

  return c.json({
    total,
    count: results.length,
    offset,
    shows: results
  })
})

// GET /api/shows/:slug - single show by slug
app.get('/api/shows/:slug', (c) => {
  const slug = c.req.param('slug')
  const show = showsBySlug.get(slug)

  if (!show) {
    return c.json({ error: 'Show not found' }, 404)
  }

  return c.json(show)
})

// GET /api/artists/mapping - artist ID to name mapping
// Used by schedule.tsx to display artist names without extra API calls
app.get('/api/artists/mapping', (c) => {
  return c.json(artistIdToName)
})

// GET /api/artists/stats - artist activity stats
// Used by useArtists.ts to determine active/inactive artists and show counts
app.get('/api/artists/stats', (c) => {
  return c.json(artistStats)
})

// Start server
const PORT = parseInt(process.env.PORT || '3000')

// Initial data load, then start server
loadData().then(() => {
  serve({
    fetch: app.fetch,
    port: PORT,
  }, (info) => {
    console.log(`éist Shows API running at http://localhost:${info.port}`)
    console.log(`Data directory: ${DATA_DIR}`)
  })
})
```

---

## Step 3: Create Helper Scripts

Create `~/eist-api/package.json` scripts section:

```json
{
  "name": "eist-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "node --import tsx src/server.ts",
    "build": "tsc",
    "prod": "node dist/server.js"
  }
}
```

Create `~/eist-api/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

---

## Step 4: Set Up Data Directory

The shows.json file will be provided manually during development:

```bash
# Create data directory
mkdir -p ~/eist-api/data

# shows.json will be scp'd here from the dev machine when needed
# Example (run from dev machine):
# scp /home/john/eist/data/shows.json root@omv7.local:~/eist-api/data/
# scp /home/john/eist/data/cache-meta.json root@omv7.local:~/eist-api/data/
```

---

## Step 5: Run the Server

```bash
cd ~/eist-api

# Development mode (auto-reload on changes)
npm run dev

# Production mode
npm run start
```

Test it:
```bash
# Health check
curl http://localhost:3000/

# Get metadata
curl http://localhost:3000/api/meta

# Get archive shows (filtered, with archive content only)
curl "http://localhost:3000/api/shows?hasArchive=true"

# Get single show by slug
curl http://localhost:3000/api/shows/memory-murmurs-2026-01-25

# Get shows by artist
curl "http://localhost:3000/api/shows?artist=macalla&hasArchive=true"

# Get artist ID → name mapping
curl http://localhost:3000/api/artists/mapping

# Get artist activity stats
curl http://localhost:3000/api/artists/stats

# Get raw unfiltered shows (for debugging)
curl "http://localhost:3000/api/shows?raw=true"
```

---

## Step 6: Run as a System Service (Always On)

Create systemd service at `/etc/systemd/system/eist-api.service`:

```ini
[Unit]
Description=éist Shows API Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/scripts/eist-api
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DATA_DIR=/root/scripts/eist-api/data
ExecStart=/usr/bin/node --import tsx src/server.ts
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable eist-api
sudo systemctl start eist-api

# Check status
sudo systemctl status eist-api

# View logs
journalctl -u eist-api -f
```

---

## Step 7: Network Access

The app needs to reach this server over the network:

```bash
# Find the server's local IP
ip addr show | grep "inet " | grep -v 127.0.0.1

# Should show something like 192.168.1.x
```

The API will be accessible at `http://192.168.1.x:3000/api/shows`

**With mDNS (already set up on omv7.local)**:
```
http://omv7.local:3000/api/shows
```

**Firewall (if needed)**:
```bash
sudo ufw allow 3000
```

---

## API Endpoints Summary

| Endpoint | Purpose | Used By |
|----------|---------|---------|
| `GET /api/shows?hasArchive=true` | Archive shows with MC/SC links | `useArchiveShows.ts` |
| `GET /api/shows/:slug` | Single show by slug | Show detail pages |
| `GET /api/shows?artist=slug&hasArchive=true` | Shows by artist | Artist detail pages |
| `GET /api/artists/mapping` | `{ artistId: "Artist Name" }` | `schedule.tsx` |
| `GET /api/artists/stats` | `{ artistSlug: { showCount, isActive } }` | `useArtists.ts` |
| `GET /api/meta` | Cache metadata (last updated, counts) | Health checks |

**Query parameters for /api/shows**:
- `hasArchive=true` - Only shows with Mixcloud or SoundCloud matches
- `artist=slug` - Filter by artist slug
- `since=2025-01-01` - Shows after date
- `limit=50` - Pagination limit
- `offset=0` - Pagination offset
- `raw=true` - Skip archive filtering (include repeats, tests, etc.)

---

## App Integration

The app will need to be updated to fetch from this API instead of using bundled JSON.

**Files that need updating**:
1. `hooks/useArchiveShows.ts` - Fetch from `/api/shows?hasArchive=true`
2. `hooks/useArtists.ts` - Fetch from `/api/artists/stats`
3. `app/(tabs)/schedule.tsx` - Fetch from `/api/artists/mapping`

**Example API URL config**:
```typescript
// config/api.ts
export const EIST_API_URL = __DEV__
  ? 'http://omv7.local:3000'  // Local dev server
  : 'https://api.eist.radio'; // Future production
```

---

## Troubleshooting

**Server won't start**
```bash
# Check if port is in use
sudo lsof -i :3000

# Check Node.js version
node --version  # Must be 20+
```

**Can't access from other devices**
```bash
# Check firewall
sudo ufw status
sudo ufw allow 3000

# Check if server is binding to all interfaces
# The Hono server binds to 0.0.0.0 by default
```

**shows.json not loading**
```bash
# Check file exists and is valid JSON
cat ~/scripts/eist-api/data/shows.json | jq . | head

# Check permissions
ls -la ~/scripts/eist-api/data/
```

**View server logs**
```bash
# If running as systemd service
journalctl -u eist-api -f

# If running manually, logs go to stdout
```

---

## Migration to Cloudflare Workers (Later)

When ready for production, the Hono code runs on Cloudflare Workers with minimal changes:

1. Replace `@hono/node-server` with Cloudflare Workers runtime
2. Replace `fs/promises` file reads with R2 bucket reads
3. Deploy with `wrangler deploy`

The API endpoints and response format stay identical.
