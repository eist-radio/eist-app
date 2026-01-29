# éist API Integration

This app fetches show and artist data from the éist API, a Cloudflare Worker that serves archived show information.

## API Base URL

```
https://eist-api.johnocallaghan.workers.dev
```

Configuration is in `config/eistApi.ts`.

## Endpoints

### GET /api/shows

Fetch shows with optional filtering.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `hasArchive` | boolean | Only return shows with Mixcloud/SoundCloud archives |
| `artistSlug` | string | Filter by artist slug |
| `limit` | number | Max results (default: 50, max: 200) |
| `offset` | number | Pagination offset |

**Response:**
```json
{
  "shows": [
    {
      "id": "uuid",
      "title": "Show Title",
      "slug": "show-title-2026-01-26",
      "start": "2026-01-26T19:00:00.000Z",
      "end": "2026-01-26T21:00:00.000Z",
      "artistIds": ["uuid"],
      "artistName": "Artist Name",
      "artistSlug": "artist-name",
      "description": { "type": "doc", "content": [...] },
      "mixcloud_match": { "url": "...", "name": "...", "pictures": {...} },
      "soundcloud_match": { "permalink_url": "...", "title": "..." },
      "match_score": 0.95
    }
  ],
  "pagination": {
    "total": 720,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### GET /api/shows/:slug

Fetch a single show by slug. Returns the show object directly (no wrapper).

### GET /api/artists/stats

Fetch artist statistics, sorted by total shows (descending).

**Response:**
```json
[
  {
    "name": "Artist Name",
    "slug": "artist-slug",
    "totalShows": 51,
    "showsWithArchive": 12,
    "latestShow": "2026-01-23T16:00:00.000Z"
  }
]
```

### GET /api/artists/mapping

Fetch artist ID to name/slug mapping.

**Response:**
```json
{
  "artist-uuid": {
    "name": "Artist Name",
    "slug": "artist-slug"
  }
}
```

### GET /api/meta

API health check and statistics.

**Response:**
```json
{
  "last_updated": "2026-01-28T09:09:54.022765",
  "total_shows": 1644,
  "shows_with_archives": 720,
  "mixcloud_matches": 379,
  "soundcloud_matches": 595
}
```

## React Hooks

The app provides React Query hooks for fetching data:

### `hooks/useArchiveShows.ts`
- `useArchiveShows()` - All shows with archives
- `useArchiveShowBySlug(slug)` - Single show by slug
- `useArchiveShowsByArtist(artistSlug)` - Shows by artist

### `hooks/useArtists.ts`
- `useArtistStats()` - Artist statistics
- `useArtistMapping()` - Artist ID → name/slug mapping

## Worker Source

The Cloudflare Worker source is in `~/eist-api/`. Deploy with:

```bash
cd ~/eist-api
npx wrangler deploy
```
