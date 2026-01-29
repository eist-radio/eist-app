// hooks/useArtists.ts
// Fetches artist data from RadioCult API (profiles/images) and éist API (stats)

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiKey } from '../config';
import { EIST_API_ENDPOINTS } from '../config/eistApi';
import { DerivedArtist } from '../types/archive';

const STATION_ID = 'eist-radio';
const ARTISTS_URL = `https://api.radiocult.fm/api/station/${STATION_ID}/artists`;

type ApiArtistLogo = {
  default?: string;
  '256x256'?: string;
  '512x512'?: string;
  '1024x1024'?: string;
};

type ApiArtist = {
  id: string;
  name?: string;
  logo?: ApiArtistLogo;
};

type ArtistsResponse = {
  artists: ApiArtist[];
};

// Stats from éist API
interface ArtistStat {
  name: string;
  slug: string;
  totalShows: number;
  showsWithArchive: number;
  latestShow: string;
}

function getArtistImage(logo?: ApiArtistLogo): string | null {
  if (!logo) return null;
  return logo['1024x1024'] || logo['512x512'] || logo['256x256'] || logo.default || null;
}

function normalizeSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .replace(/-+/g, '-'); // Collapse multiple hyphens
}

/**
 * Determine if an artist is considered "active"
 * An artist is active if:
 * - They have had a show within the last 40 days, OR
 * - They have more than 3 shows with archives
 */
function isArtistActive(stat: ArtistStat): boolean {
  const ACTIVE_DAYS_THRESHOLD = 40;
  const ARCHIVE_COUNT_THRESHOLD = 3;

  const latestShowDate = new Date(stat.latestShow);
  const now = new Date();
  const daysSinceLastShow = Math.floor(
    (now.getTime() - latestShowDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysSinceLastShow <= ACTIVE_DAYS_THRESHOLD || stat.showsWithArchive > ARCHIVE_COUNT_THRESHOLD;
}

// Fetch artist stats from éist API
async function fetchArtistStats(): Promise<ArtistStat[]> {
  const response = await fetch(EIST_API_ENDPOINTS.artistsStats);
  if (!response.ok) {
    throw new Error(`Failed to fetch artist stats: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// Fetch artists from RadioCult API and merge with éist stats
async function fetchArtists(): Promise<DerivedArtist[]> {
  // Fetch both in parallel
  const [artistsRes, stats] = await Promise.all([
    fetch(ARTISTS_URL, { headers: { 'x-api-key': apiKey } }),
    fetchArtistStats(),
  ]);

  if (!artistsRes.ok) {
    throw new Error(`Failed to fetch artists: ${artistsRes.statusText}`);
  }

  const artistsData = (await artistsRes.json()) as ArtistsResponse;

  // Create stats lookup by slug
  const statsMap = new Map<string, ArtistStat>();
  for (const stat of stats) {
    statsMap.set(stat.slug, stat);
  }

  // Deduplicate artists by slug, keeping the one with the most complete profile
  const artistsBySlug = new Map<string, DerivedArtist>();

  for (const artist of artistsData.artists || []) {
    if (!artist.name) continue;

    const slug = normalizeSlug(artist.name);
    const stat = statsMap.get(slug);
    const imageUrl = getArtistImage(artist.logo);

    const derived: DerivedArtist = {
      id: artist.id,
      slug,
      name: artist.name,
      showCount: stat?.showsWithArchive ?? 0,
      imageUrl,
      isActive: stat ? isArtistActive(stat) : false,
    };

    const existing = artistsBySlug.get(slug);
    if (!existing) {
      artistsBySlug.set(slug, derived);
    } else {
      // Keep the artist with more data (prefer one with image)
      if (!existing.imageUrl && derived.imageUrl) {
        artistsBySlug.set(slug, derived);
      }
    }
  }

  return Array.from(artistsBySlug.values())
    .filter((artist) => artist.isActive) // Only show active artists
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function useArtists() {
  const query = useQuery({
    queryKey: ['artists'],
    queryFn: fetchArtists,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    artists: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

export function useFilteredArtists(searchQuery: string) {
  const { artists, ...queryRest } = useArtists();

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return artists;
    const lower = searchQuery.toLowerCase();
    return artists.filter((a) => a.name.toLowerCase().includes(lower));
  }, [artists, searchQuery]);

  return {
    ...queryRest,
    artists: filtered,
  };
}

// Export for use by other components that need artist mapping
export function useArtistMapping() {
  return useQuery({
    queryKey: ['artist-mapping'],
    queryFn: async () => {
      const response = await fetch(EIST_API_ENDPOINTS.artistsMapping);
      if (!response.ok) {
        throw new Error(`Failed to fetch artist mapping: ${response.status}`);
      }
      return response.json() as Promise<Record<string, { name: string; slug: string }>>;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - mapping rarely changes
  });
}
