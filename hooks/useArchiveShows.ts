// hooks/useArchiveShows.ts

import { useQuery } from '@tanstack/react-query';
import { ArchiveSection, ArchiveShow } from '../types/archive';

// For local development, import bundled data
// TODO: Switch to remote fetch when shows.json is hosted
import localShowsData from '../assets/data/shows.json';

async function fetchArchiveShows(): Promise<ArchiveShow[]> {
  // Use bundled local data for now
  return localShowsData as ArchiveShow[];
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
