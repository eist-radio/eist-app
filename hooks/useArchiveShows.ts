// hooks/useArchiveShows.ts
// Fetches archive shows from the éist API (Cloudflare Worker)

import { useQuery } from '@tanstack/react-query';
import { ArchiveSection, ArchiveShow } from '../types/archive';
import { buildShowsUrl, EIST_API_ENDPOINTS } from '../config/eistApi';

// Response format from the API
interface ShowsResponse {
  shows: ArchiveShow[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Fetch all shows with archives from the API
async function fetchArchiveShows(): Promise<ArchiveShow[]> {
  const url = buildShowsUrl({ hasArchive: true });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch archive shows: ${response.status} ${response.statusText}`);
  }

  const data: ShowsResponse = await response.json();
  return data.shows;
}

// Fetch a single show by slug from the API
async function fetchShowBySlug(slug: string): Promise<ArchiveShow> {
  const url = EIST_API_ENDPOINTS.showBySlug(slug);

  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Show not found');
    }
    throw new Error(`Failed to fetch show: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Fetch shows by artist slug from the API
async function fetchShowsByArtist(artistSlug: string): Promise<ArchiveShow[]> {
  const url = buildShowsUrl({ hasArchive: true, artistSlug });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch shows by artist: ${response.status} ${response.statusText}`);
  }

  const data: ShowsResponse = await response.json();
  return data.shows;
}

// Group shows by month for section list display
function groupShowsByMonth(shows: ArchiveShow[]): ArchiveSection[] {
  const buckets: Record<string, ArchiveShow[]> = {};

  shows.forEach((show) => {
    const date = new Date(show.start);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const key = `${year}-${month}`;
    (buckets[key] ||= []).push(show);
  });

  return Object.entries(buckets)
    .map(([key, data]) => {
      const [year, month] = key.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      const title = date.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
      return { key, title, data };
    })
    .sort((a, b) => (b.key < a.key ? -1 : b.key > a.key ? 1 : 0)); // newest first
}

// Check if a show has archived content (Mixcloud or SoundCloud)
export function hasArchivedContent(show: ArchiveShow): boolean {
  return !!(show.mixcloud_match || show.soundcloud_match);
}

export function useArchiveShows() {
  return useQuery({
    queryKey: ['archiveShows'],
    queryFn: fetchArchiveShows,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

export function useArchiveShowsByMonth() {
  const query = useArchiveShows();

  return {
    ...query,
    sections: query.data ? groupShowsByMonth(query.data) : [],
  };
}

export function useArchiveShowBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['archiveShow', slug],
    queryFn: () => fetchShowBySlug(slug!),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

export function useArchiveShowsByArtist(artistSlug: string | undefined, limit?: number) {
  const query = useQuery({
    queryKey: ['archiveShowsByArtist', artistSlug],
    queryFn: () => fetchShowsByArtist(artistSlug!),
    enabled: !!artistSlug,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    ...query,
    shows: limit && query.data ? query.data.slice(0, limit) : query.data ?? [],
  };
}

export function getAvailableMonths(sections: ArchiveSection[]): { key: string; title: string }[] {
  return sections.map((s) => ({ key: s.key, title: s.title }));
}
