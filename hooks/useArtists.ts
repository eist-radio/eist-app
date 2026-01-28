// hooks/useArtists.ts

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import localShowsData from '../assets/data/shows.json';
import { apiKey } from '../config';
import { ArchiveShow, DerivedArtist } from '../types/archive';

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

type ArtistStats = {
  totalArchived: number;
  recent40NonRepeat: boolean;
  recent3moArchived: boolean;
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
 * Determine which artists are "active" based on show data.
 * An artist is active if:
 * 1. They had a scheduled (non-repeat) show in the past 40 days, OR
 * 2. They have archived shows in the last 3 months, OR
 * 3. They have more than 3 total archived shows
 */
function computeActiveArtists(shows: ArchiveShow[]): Set<string> {
  const now = new Date();
  const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const artistStats = new Map<string, ArtistStats>();

  for (const show of shows) {
    const slug = show.artistSlug;
    if (!slug) continue;

    const hasArchive = !!(show.mixcloud_match || show.soundcloud_match);
    const isRepeat = show.title.toLowerCase().includes('ist ar'); // "éist arís" or "eist aris"

    let stats = artistStats.get(slug);
    if (!stats) {
      stats = { totalArchived: 0, recent40NonRepeat: false, recent3moArchived: false };
      artistStats.set(slug, stats);
    }

    // Count archived shows
    if (hasArchive) {
      stats.totalArchived += 1;
      if (show.start) {
        const showDate = new Date(show.start);
        if (showDate > threeMonthsAgo) {
          stats.recent3moArchived = true;
        }
      }
    }

    // Check for recent non-repeat scheduled shows
    if (show.start && !isRepeat) {
      const showDate = new Date(show.start);
      if (showDate > fortyDaysAgo) {
        stats.recent40NonRepeat = true;
      }
    }
  }

  // Determine active status
  const activeArtists = new Set<string>();
  for (const [slug, stats] of artistStats) {
    // Rule 1: Scheduled non-repeat show in past 40 days = always active
    if (stats.recent40NonRepeat) {
      activeArtists.add(slug);
      continue;
    }

    // Rule 2: No recent scheduled shows AND no archived shows in 3 months AND ≤3 total archived = inactive
    if (!stats.recent3moArchived && stats.totalArchived <= 3) {
      continue; // inactive
    }

    // Rule 3: Has archived shows (not caught by rule 2) = active
    activeArtists.add(slug);
  }

  return activeArtists;
}

async function fetchArtists(): Promise<DerivedArtist[]> {
  const res = await fetch(ARTISTS_URL, {
    headers: { 'x-api-key': apiKey },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch artists: ${res.statusText}`);
  }

  const data = (await res.json()) as ArtistsResponse;

  // Get active artists from local shows data
  const shows = localShowsData as ArchiveShow[];
  const activeArtists = computeActiveArtists(shows);

  return (data.artists || [])
    .filter((artist) => artist.name)
    .map((artist) => {
      const slug = normalizeSlug(artist.name!);
      return {
        id: artist.id,
        slug,
        name: artist.name!,
        showCount: 0,
        imageUrl: getArtistImage(artist.logo),
        isActive: activeArtists.has(slug),
      };
    })
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
