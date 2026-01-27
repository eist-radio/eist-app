// hooks/useArtists.ts

import { useMemo } from 'react';
import { ArchiveShow, DerivedArtist } from '../types/archive';
import { useArchiveShows } from './useArchiveShows';

function getShowImage(show: ArchiveShow): string | null {
  if (show.mixcloud_match?.pictures) {
    const pics = show.mixcloud_match.pictures;
    return pics['640wx640h'] || pics.extra_large || pics.large || pics.medium || null;
  }
  if (show.soundcloud_match?.artwork_url) {
    return show.soundcloud_match.artwork_url.replace('-large', '-t500x500');
  }
  return null;
}

export function useArtists() {
  const query = useArchiveShows();

  const artists = useMemo<DerivedArtist[]>(() => {
    if (!query.data) return [];

    const artistMap = new Map<string, { name: string; count: number; imageUrl: string | null }>();

    query.data.forEach((show) => {
      if (show.artistSlug && show.artistName) {
        const existing = artistMap.get(show.artistSlug);
        if (existing) {
          existing.count += 1;
          // Update image if we don't have one yet
          if (!existing.imageUrl) {
            existing.imageUrl = getShowImage(show);
          }
        } else {
          artistMap.set(show.artistSlug, {
            name: show.artistName,
            count: 1,
            imageUrl: getShowImage(show),
          });
        }
      }
    });

    return Array.from(artistMap.entries())
      .map(([slug, { name, count, imageUrl }]) => ({
        slug,
        name,
        showCount: count,
        imageUrl,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [query.data]);

  return {
    ...query,
    artists,
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
