// config.ts
import Constants from 'expo-constants';

// In EAS builds this is expoConfig, in Expo Go it's Constants.manifest
const manifestOrConfig = Constants.expoConfig ?? (Constants.manifest as any);
const extra = (manifestOrConfig.extra ?? {}) as Record<string, any>;

export const apiKey = (extra.apiKey) as string;
export const EAS_PROJECT_ID = extra.eas?.projectId as string;
