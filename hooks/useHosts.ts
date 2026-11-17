// hooks/useHosts.ts

import { useQueries } from '@tanstack/react-query';
import { apiKey } from '../config';

const STATION_ID = 'eist-radio';

export type Host = {
  id: string;
  name?: string;
  logo?: {
    default?: string;
    '256x256'?: string;
    '512x512'?: string;
    '1024x1024'?: string;
  };
};

export async function fetchHost(id: string): Promise<Host> {
  const url = `https://api.radiocult.fm/api/station/${STATION_ID}/artists/${encodeURIComponent(id)}`;
  const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
  if (!res.ok) throw new Error(`Artist fetch failed: ${res.statusText}`);
  const json = (await res.json()) as { artist?: Host };
  if (!json.artist) throw new Error('Artist not found');
  return json.artist;
}

/**
 * Resolves every host on a show, in the order RadioCult lists them.
 * Shares the ['artist', id] cache with the host page.
 */
export function useHosts(ids: string[] | undefined) {
  const hostIds = ids ?? [];
  const results = useQueries({
    queries: hostIds.map((id) => ({
      queryKey: ['artist', id],
      queryFn: () => fetchHost(id),
      enabled: Boolean(id),
      staleTime: 10 * 60 * 1000,
    })),
  });

  const hosts = results
    .map((r) => r.data)
    .filter((h): h is Host => Boolean(h?.name));

  return {
    hosts,
    firstHostPending: Boolean(hostIds[0]) && results[0]?.isLoading === true,
  };
}

export { joinHostNames } from '../utils/hostNames';
