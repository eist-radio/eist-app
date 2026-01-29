// config/eistApi.ts
// API configuration for the éist shows API

// Base URL for the éist shows API (Cloudflare Workers)
export const EIST_API_BASE_URL = 'https://eist-api.johnocallaghan.workers.dev';

export const EIST_API_ENDPOINTS = {
  shows: `${EIST_API_BASE_URL}/api/shows`,
  showBySlug: (slug: string) => `${EIST_API_BASE_URL}/api/shows/${encodeURIComponent(slug)}`,
  artistsMapping: `${EIST_API_BASE_URL}/api/artists/mapping`,
  artistsStats: `${EIST_API_BASE_URL}/api/artists/stats`,
  meta: `${EIST_API_BASE_URL}/api/meta`,
};

// Query parameters for the shows endpoint
export interface ShowsQueryParams {
  hasArchive?: boolean;
  artistSlug?: string;
  limit?: number;
  offset?: number;
}

// Build URL with query params
export function buildShowsUrl(params: ShowsQueryParams = {}): string {
  const url = new URL(EIST_API_ENDPOINTS.shows);

  if (params.hasArchive !== undefined) {
    url.searchParams.set('hasArchive', String(params.hasArchive));
  }
  if (params.artistSlug) {
    url.searchParams.set('artistSlug', params.artistSlug);
  }
  if (params.limit !== undefined) {
    url.searchParams.set('limit', String(params.limit));
  }
  if (params.offset !== undefined) {
    url.searchParams.set('offset', String(params.offset));
  }

  return url.toString();
}
