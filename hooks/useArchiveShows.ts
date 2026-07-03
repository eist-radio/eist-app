// hooks/useArchiveShows.ts

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { EIST_API_ENDPOINTS } from '../config';
import { ArchiveSection, ArchiveShow, ShowsApiResponse } from '../types/archive';

const INITIAL_LIMIT = 75;
const LOAD_MORE_LIMIT = 50;

async function fetchArchiveShowsPage(
  limit: number,
  offset: number,
  q?: string
): Promise<ShowsApiResponse> {
  const params = new URLSearchParams({
    hasArchive: 'true',
    limit: String(limit),
    offset: String(offset),
  });
  // Server-side search: q matches show title or host/artist name (case-insensitive).
  if (q) params.set('q', q);

  const response = await fetch(`${EIST_API_ENDPOINTS.shows}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch archive shows: ${response.status} ${response.statusText}`);
  }

  return response.json();
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

export function useArchiveShows(q?: string) {
  const search = q?.trim() || '';
  const query = useInfiniteQuery({
    queryKey: ['archiveShows', search],
    queryFn: ({ pageParam }) => {
      const offset = pageParam ?? 0;
      const limit = offset === 0 ? INITIAL_LIMIT : LOAD_MORE_LIMIT;
      return fetchArchiveShowsPage(limit, offset, search || undefined);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination.hasMore) return undefined;
      return lastPage.pagination.offset + lastPage.pagination.limit;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Flatten all pages into a single array
  const shows = useMemo(() => {
    return query.data?.pages.flatMap((page) => page.shows) ?? [];
  }, [query.data]);

  // Get pagination info from the last page
  const lastPage = query.data?.pages[query.data.pages.length - 1];
  const total = lastPage?.pagination.total ?? 0;
  const hasMore = lastPage?.pagination.hasMore ?? false;

  const loadMore = useCallback(() => {
    if (hasMore && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [hasMore, query]);

  return {
    shows,
    total,
    hasMore,
    loadMore,
    isLoading: query.isLoading,
    isLoadingMore: query.isFetchingNextPage,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

export function useArchiveShowsByMonth() {
  const { shows, total, hasMore, loadMore, isLoadingMore, ...rest } = useArchiveShows();

  return {
    ...rest,
    sections: shows.length > 0 ? groupShowsByMonth(shows) : [],
    total,
    loaded: shows.length,
    hasMore,
    loadMore,
    isLoadingMore,
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
