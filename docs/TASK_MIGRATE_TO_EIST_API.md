# Task: Migrate App from Bundled shows.json to éist API

## Overview

Replace all usage of the bundled `assets/data/shows.json` file with calls to the new éist API. After this migration, the app will no longer bundle the 2.9MB JSON file - all archive/show data will be fetched from the API.

**Branch**: `feature/use-eist-api-for-shows`

**API Documentation**: See `docs/EIST_API_DETAILS` for endpoint details and response formats.

---

## Step 1: Create API Configuration

Create a new file `config/eistApi.ts`:

```typescript
// Base URL for the éist shows API
// In development, use the Cloudflare tunnel URL
// In production, this will be a stable URL

export const EIST_API_BASE_URL = __DEV__
  ? 'https://countries-animals-carter-eggs.trycloudflare.com'  // Dev (changes often - see docs/EIST_API_DETAILS)
  : 'https://api.eist.radio';  // Production (future)

export const EIST_API_ENDPOINTS = {
  shows: `${EIST_API_BASE_URL}/api/shows`,
  showBySlug: (slug: string) => `${EIST_API_BASE_URL}/api/shows/${slug}`,
  artistsMapping: `${EIST_API_BASE_URL}/api/artists/mapping`,
  artistsStats: `${EIST_API_BASE_URL}/api/artists/stats`,
  meta: `${EIST_API_BASE_URL}/api/meta`,
};
```

---

## Step 2: Update `hooks/useArchiveShows.ts`

**Current behavior**: Imports `assets/data/shows.json`, filters locally for archive-eligible shows.

**New behavior**: Fetch from `GET /api/shows?hasArchive=true`. The API already applies filtering (excludes repeats, tests, pre-2025-02-01).

### Changes Required:

1. Remove the import: `import localShowsData from '../assets/data/shows.json'`
2. Remove local filtering functions (`isRepeatBroadcast`, `shouldExcludeShow`) - API handles this
3. Update `fetchArchiveShows()` to call the API
4. Handle the paginated response format: `{ shows: [...], pagination: { total, limit, offset, hasMore } }`
5. Keep `hasArchivedContent()` if still needed for UI logic

### API Response Format:
```typescript
interface ShowsResponse {
  shows: ArchiveShow[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
```

### Implementation Notes:
- The API returns shows sorted by date (newest first)
- Default limit is 50, max is 200. For initial load, you may want no limit or fetch all pages
- To get all shows at once, don't pass a limit parameter (API returns all matching shows)
- The `useArchiveShowBySlug` hook should use `GET /api/shows/:slug` for single show lookup
- The `useArchiveShowsByArtist` hook should use `GET /api/shows?artistSlug=xxx&hasArchive=true`

---

## Step 3: Update `hooks/useArtists.ts`

**Current behavior**: Imports `assets/data/shows.json`, computes artist stats (showCount, isActive) locally, combines with RadioCult artists API.

**New behavior**: Fetch stats from `GET /api/artists/stats`. Continue using RadioCult API for artist profiles/images.

### Changes Required:

1. Remove the import: `import localShowsData from '../assets/data/shows.json'`
2. Remove `computeArtistShowData()` function - API provides this
3. Add a new query to fetch artist stats from the éist API
4. Merge API stats with RadioCult artist data

### API Response Format (artists/stats):
```typescript
// Array sorted by totalShows descending
interface ArtistStat {
  name: string;
  slug: string;
  totalShows: number;
  showsWithArchive: number;
  latestShow: string;  // ISO date
}
```

### Implementation Notes:
- The API returns an array, not a map. Convert to map by slug for easy lookup
- `isActive` logic: Consider an artist active if they have `latestShow` within the last 40 days OR `showsWithArchive > 3`
- Keep the RadioCult API call for artist images/profiles - just merge with stats from éist API

---

## Step 4: Update `app/(tabs)/schedule.tsx`

**Current behavior**: Imports `assets/data/shows.json`, builds `artistId → artistName` mapping for schedule display.

**New behavior**: Fetch mapping from `GET /api/artists/mapping`.

### Changes Required:

1. Remove the import: `import localShowsData from '../../assets/data/shows.json'`
2. Remove `buildArtistIdToNameMap()` function
3. Fetch the mapping from the API (can be cached aggressively - rarely changes)

### API Response Format (artists/mapping):
```typescript
// Object keyed by artist UUID
interface ArtistMapping {
  [artistId: string]: {
    name: string;
    slug: string;
  };
}
```

### Implementation Notes:
- This mapping is used to display artist names on schedule items without extra API calls
- Cache this aggressively (staleTime: 30+ minutes) - it only changes when new artists are added
- The schedule itself still comes from RadioCult API (real-time data)

---

## Step 5: Delete Bundled JSON

After all hooks are updated and tested:

1. Delete `assets/data/shows.json`
2. Remove any TypeScript module declarations for the JSON file if they exist

This saves ~2.9MB from the app bundle.

---

## Step 6: Update Types (if needed)

Check `types/archive.ts` and ensure types match the API response format. Key differences:

- API wraps shows in `{ shows: [...], pagination: {...} }`
- `soundcloud_match` may have `permalink_url` instead of `url` (verify in API response)
- Single show endpoint returns the show object directly (no wrapper)

---

## Step 7: Error Handling

Unlike bundled JSON, API calls can fail. Ensure:

1. Loading states are shown while fetching
2. Error states are handled gracefully (show retry button or error message)
3. React Query's retry logic is appropriate (default 3 retries is fine)
4. Consider offline behavior - what should happen if API is unreachable?

---

## Testing Checklist

After implementation, verify:

- [ ] Archive tab loads and displays shows correctly
- [ ] Archive shows are sorted by date (newest first)
- [ ] Tapping a show opens the detail page with correct data
- [ ] Mixcloud/SoundCloud links work
- [ ] Artist filtering works (`useArchiveShowsByArtist`)
- [ ] Schedule page displays artist names correctly
- [ ] Artists page shows correct show counts
- [ ] Active/inactive artist filtering works
- [ ] App handles API errors gracefully
- [ ] App handles slow network gracefully (loading states)

---

## API Quick Reference

See `docs/EIST_API_DETAILS` for full documentation. Key endpoints:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/shows?hasArchive=true` | All archived shows |
| `GET /api/shows?hasArchive=true&artistSlug=xxx` | Shows by artist |
| `GET /api/shows/:slug` | Single show by slug |
| `GET /api/artists/mapping` | Artist ID → {name, slug} |
| `GET /api/artists/stats` | Artist activity statistics |
| `GET /api/meta` | API health/stats |

---

## Files Summary

| File | Action |
|------|--------|
| `config/eistApi.ts` | CREATE - API configuration |
| `hooks/useArchiveShows.ts` | MODIFY - Use API instead of JSON |
| `hooks/useArtists.ts` | MODIFY - Use API for stats |
| `app/(tabs)/schedule.tsx` | MODIFY - Use API for artist mapping |
| `assets/data/shows.json` | DELETE - No longer needed |
| `types/archive.ts` | VERIFY - Types match API response |
