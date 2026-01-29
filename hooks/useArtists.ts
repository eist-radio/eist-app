// hooks/useArtists.ts

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiKey, EIST_API_ENDPOINTS } from '../config';
import { ArtistMapping, ArtistStat, DerivedArtist } from '../types/archive';

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
 * Determine if an artist is "active" based on their stats.
 * An artist is active if:
 * - They have a show within the last 40 days, OR
 * - They have more than 3 archived shows
 */
function isArtistActive(stat: ArtistStat): boolean {
  const now = new Date();
  const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
  const latestShowDate = new Date(stat.latestShow);

  // Rule 1: Had a show in the past 40 days
  if (latestShowDate > fortyDaysAgo) {
    return true;
  }

  // Rule 2: Has more than 3 archived shows
  if (stat.showsWithArchive > 3) {
    return true;
  }

  return false;
}

async function fetchArtistStats(): Promise<Map<string, ArtistStat>> {
  const response = await fetch(EIST_API_ENDPOINTS.artistsStats);

  if (!response.ok) {
    throw new Error(`Failed to fetch artist stats: ${response.status} ${response.statusText}`);
  }

  const stats: ArtistStat[] = await response.json();

  // Convert array to map by slug for easy lookup
  const statsMap = new Map<string, ArtistStat>();
  for (const stat of stats) {
    statsMap.set(stat.slug, stat);
  }

  return statsMap;
}

async function fetchArtists(): Promise<DerivedArtist[]> {
  // Fetch both RadioCult artist profiles and éist API stats in parallel
  const [artistsRes, statsMap] = await Promise.all([
    fetch(ARTISTS_URL, {
      headers: { 'x-api-key': apiKey },
    }),
    fetchArtistStats(),
  ]);

  if (!artistsRes.ok) {
    throw new Error(`Failed to fetch artists: ${artistsRes.statusText}`);
  }

  const data = (await artistsRes.json()) as ArtistsResponse;

  // Deduplicate artists by slug, keeping the one with the most complete profile
  const artistsBySlug = new Map<string, DerivedArtist>();

  for (const artist of data.artists || []) {
    if (!artist.name) continue;

    const slug = normalizeSlug(artist.name);
    const stat = statsMap.get(slug);
    const imageUrl = getArtistImage(artist.logo);

    const derived: DerivedArtist = {
      id: artist.id,
      slug,
      name: artist.name,
      showCount: stat?.totalShows ?? 0,
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

// Fetch artist ID to name/slug mapping for schedule display
async function fetchArtistMapping(): Promise<ArtistMapping> {
  const response = await fetch(EIST_API_ENDPOINTS.artistsMapping);

  if (!response.ok) {
    throw new Error(`Failed to fetch artist mapping: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export function useArtistMapping() {
  return useQuery({
    queryKey: ['artistMapping'],
    queryFn: fetchArtistMapping,
    staleTime: 30 * 60 * 1000, // 30 minutes - rarely changes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
}
