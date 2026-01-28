// hooks/useArchiveShows.ts

import { useQuery } from '@tanstack/react-query';
import { ArchiveSection, ArchiveShow } from '../types/archive';

// For local development, import bundled data
// TODO: Switch to remote fetch when shows.json is hosted
import localShowsData from '../assets/data/shows.json';

// Archive start date - exclude shows before this date (matching website)
const ARCHIVE_START_DATE = '2025-02-01';

// Test broadcast titles to exclude (matching website)
const TEST_BROADCAST_TITLES = [
  'box test',
  'box test 2',
  'playlisting test',
  'mensajito_eist_test',
  'mystery test broadcast',
  'stay tuned...',
];

// Check if show title indicates a repeat broadcast
function isRepeatBroadcast(title: string): boolean {
  if (!title) return false;
  const titleLower = title.toLowerCase();
  const patterns = [
    'éist arís',
    'eist aris',
    'rebroadcast',
    'replay',
    'repeat',
    'from the archives',
  ];
  return patterns.some((p) => titleLower.includes(p));
}

// Check if a show has archived content (Mixcloud or SoundCloud)
function hasArchivedContent(show: ArchiveShow): boolean {
  return !!(show.mixcloud_match || show.soundcloud_match);
}

// Check if a show should be excluded from the archive
function shouldExcludeShow(show: ArchiveShow): boolean {
  const title = show.title || '';

  // Exclude repeat broadcasts
  if (isRepeatBroadcast(title)) {
    return true;
  }

  // Exclude test broadcasts
  if (TEST_BROADCAST_TITLES.includes(title.toLowerCase())) {
    return true;
  }

  // Exclude shows before archive start date
  if (show.start) {
    const showDate = show.start.slice(0, 10); // Extract YYYY-MM-DD
    if (showDate < ARCHIVE_START_DATE) {
      return true;
    }
  }

  // Exclude shows without archived content (matching website default behavior)
  if (!hasArchivedContent(show)) {
    return true;
  }

  return false;
}

async function fetchArchiveShows(): Promise<ArchiveShow[]> {
  // Use bundled local data and filter according to website rules
  const allShows = localShowsData as ArchiveShow[];
  return allShows.filter((show) => !shouldExcludeShow(show));
}

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

export function useArchiveShows() {
  return useQuery({
    queryKey: ['archiveShows'],
    queryFn: fetchArchiveShows,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
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
  const query = useArchiveShows();

  return {
    ...query,
    show: slug ? query.data?.find((s) => s.slug === slug) : undefined,
  };
}

export function useArchiveShowsByArtist(artistSlug: string | undefined, limit?: number) {
  const query = useArchiveShows();

  const shows = artistSlug
    ? query.data?.filter((s) => s.artistSlug === artistSlug) ?? []
    : [];

  return {
    ...query,
    shows: limit ? shows.slice(0, limit) : shows,
  };
}

export function getAvailableMonths(sections: ArchiveSection[]): { key: string; title: string }[] {
  return sections.map((s) => ({ key: s.key, title: s.title }));
}
