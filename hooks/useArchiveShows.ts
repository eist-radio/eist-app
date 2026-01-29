// hooks/useArchiveShows.ts

import { useQuery } from '@tanstack/react-query';
import { EIST_API_ENDPOINTS } from '../config';
import { ArchiveSection, ArchiveShow, ShowsApiResponse } from '../types/archive';

async function fetchArchiveShows(): Promise<ArchiveShow[]> {
  // Fetch from éist API - the API already filters for archived shows
  const response = await fetch(`${EIST_API_ENDPOINTS.shows}?hasArchive=true`);

  if (!response.ok) {
    throw new Error(`Failed to fetch archive shows: ${response.status} ${response.statusText}`);
  }

  const data: ShowsApiResponse = await response.json();
  return data.shows;
}

async function fetchShowBySlug(slug: string): Promise<ArchiveShow | null> {
  const response = await fetch(EIST_API_ENDPOINTS.showBySlug(slug));

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch show: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchShowsByArtist(artistSlug: string): Promise<ArchiveShow[]> {
  const response = await fetch(
    `${EIST_API_ENDPOINTS.shows}?hasArchive=true&artistSlug=${encodeURIComponent(artistSlug)}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch artist shows: ${response.status} ${response.statusText}`);
  }

  const data: ShowsApiResponse = await response.json();
  return data.shows;
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
    gcTime: 30 * 60 * 1000, // 30 minutes
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
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useArchiveShowsByArtist(artistSlug: string | undefined, limit?: number) {
  const query = useQuery({
    queryKey: ['archiveShowsByArtist', artistSlug],
    queryFn: () => fetchShowsByArtist(artistSlug!),
    enabled: !!artistSlug,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    ...query,
    shows: limit ? (query.data?.slice(0, limit) ?? []) : (query.data ?? []),
  };
}

export function getAvailableMonths(sections: ArchiveSection[]): { key: string; title: string }[] {
  return sections.map((s) => ({ key: s.key, title: s.title }));
}
