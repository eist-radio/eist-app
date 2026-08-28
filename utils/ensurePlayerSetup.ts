// utils/ensurePlayerSetup.ts

import { setupTrackPlayer } from './trackPlayerSetup';

// Runtime-wide, idempotent player setup shared by the React UI
// (TrackPlayerContext) and the background playback service (trackPlayerService.js).
//
// Why this exists: TrackPlayer.setupPlayer()/updateOptions() used to run ONLY
// from the React tree, so a CarPlay-initiated session — which can drive the
// playback service without the phone UI ever mounting — reached the remote
// handlers with an uninitialised player. Every TrackPlayer call then no-op'd or
// threw, and the car's play/stop button did nothing while phone playback (which
// mounts the UI and runs setup) worked fine.
//
// Both callers now funnel through here. The single memoised promise dedups the
// UI-vs-service race in the shared JS runtime so setupPlayer() is never called
// twice, and an "already initialized" throw is treated as success.
let setupPromise: Promise<void> | null = null;

export const ensurePlayerSetup = (): Promise<void> => {
  if (!setupPromise) {
    setupPromise = (async () => {
      try {
        await setupTrackPlayer();
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : '';
        if (msg.includes('already been initialized') || msg.includes('already initialized')) {
          return;
        }
        // Genuine failure: clear the memo so the next caller can retry setup
        // rather than being permanently stuck on this rejected promise.
        setupPromise = null;
        throw err;
      }
    })();
  }
  return setupPromise;
};
