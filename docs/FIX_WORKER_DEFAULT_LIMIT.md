# Fix: Worker API Default Limit

## Problem

The Cloudflare Worker at `https://eist-api.johnocallaghan.workers.dev` returns ALL matching shows when no `limit` parameter is specified.

```bash
# Returns 719 shows (1.5MB) instead of a reasonable default
curl "https://eist-api.johnocallaghan.workers.dev/api/shows?hasArchive=true"
```

## Current Code (in ~/eist-worker/src/index.ts)

```typescript
const limit = Math.min(parseInt(c.req.query('limit') || '0'), 200)
// ...
if (limit > 0) {
  results = results.slice(0, limit)
}
```

When no limit is passed, it defaults to `0`, and the `if (limit > 0)` check skips slicing.

## Fix

Change the default from `'0'` to `'50'`:

```typescript
const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200)
```

This ensures:
- Default response is ~117KB instead of 1.5MB
- Mobile app gets reasonable payload by default
- Can still request more with explicit `?limit=200`

## After Fixing

```bash
cd ~/eist-worker
wrangler deploy
```

Then verify:
```bash
curl -s "https://eist-api.johnocallaghan.workers.dev/api/shows?hasArchive=true" | jq '.pagination'
# Should show: "limit": 50, "hasMore": true
```
