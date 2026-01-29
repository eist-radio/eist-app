// config.ts
import Constants from 'expo-constants';

// In EAS builds this is expoConfig, in Expo Go it's Constants.manifest
const manifestOrConfig = Constants.expoConfig ?? (Constants.manifest as any);
const extra = (manifestOrConfig.extra ?? {}) as Record<string, any>;

export const apiKey = (extra.apiKey) as string;
export const EAS_PROJECT_ID = extra.eas?.projectId as string;

// éist API configuration
export const EIST_API_BASE_URL = 'https://eist-api.johnocallaghan.workers.dev';

export const EIST_API_ENDPOINTS = {
  shows: `${EIST_API_BASE_URL}/api/shows`,
  showBySlug: (slug: string) => `${EIST_API_BASE_URL}/api/shows/${encodeURIComponent(slug)}`,
  artistsMapping: `${EIST_API_BASE_URL}/api/artists/mapping`,
  artistsStats: `${EIST_API_BASE_URL}/api/artists/stats`,
  meta: `${EIST_API_BASE_URL}/api/meta`,
};
