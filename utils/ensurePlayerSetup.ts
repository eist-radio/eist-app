// utils/ensurePlayerSetup.ts

import TrackPlayer from 'react-native-track-player';
import { setupTrackPlayer } from './trackPlayerSetup';
import { withTimeout } from './withTimeout';

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
// twice, and an "already initialized" throw is treated as success WHEN the
// player can be shown to be alive.
//
// Two hazards this memo has to defend against, because both produced stream
// dropouts that survived until the app was restarted:
//
//  1. A setup that never settles. RNTP resolves setupPlayer() from
//     MusicModule.onServiceConnected, which left the promise pending on a
//     rebind. Caching a pending promise meant every later caller — the context,
//     and startFreshStream on every CarPlay / Android Auto / lock-screen
//     command — awaited it forever. Hence the timeout.
//  2. A fulfilled memo outliving the player it set up. The MusicService can be
//     destroyed under a live JS runtime (OS reclaim, foreground-service
//     limits), and onDestroy tears down its ExoPlayer. The memo then reported
//     "set up" forever while every call ran against a dead player, so the
//     retry loop re-ran a no-op setup every few seconds and never recovered.
//     Hence resetPlayerSetup, which callers use once they have evidence the
//     player stopped answering.
const SETUP_TIMEOUT_MS = 10000;
const PROBE_TIMEOUT_MS = 2000;

let setupPromise: Promise<void> | null = null;
let setupInFlight = false;

// Does the native player actually answer? RNTP's "already initialized" only
// means its module still believes a service is bound, which stays true after the
// service is destroyed. A playback-state read that resolves is the cheapest
// proof the player is really there.
const isPlayerResponsive = async (): Promise<boolean> => {
  try {
    await withTimeout(TrackPlayer.getPlaybackState(), PROBE_TIMEOUT_MS, 'getPlaybackState');
    return true;
  } catch {
    return false;
  }
};

// Drop the memo so the next ensurePlayerSetup() genuinely calls setupPlayer()
// again instead of resolving an already-fulfilled promise.
export const resetPlayerSetup = (): void => {
  // A setup that is still running is left alone. Deduping concurrent setup is
  // this memo's other job: the React UI and the playback service race to be
  // first in a shared runtime, and clearing an in-flight promise would let the
  // loser start a second, concurrent TrackPlayer.setupPlayer(). Only a settled
  // memo can be stale, which is the case this exists for.
  if (setupInFlight) {
    return;
  }
  setupPromise = null;
};

export const ensurePlayerSetup = (): Promise<void> => {
  if (!setupPromise) {
    setupInFlight = true;
    setupPromise = (async () => {
      try {
        await withTimeout(setupTrackPlayer(), SETUP_TIMEOUT_MS, 'setupPlayer');
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : '';
        if (msg.includes('already been initialized') || msg.includes('already initialized')) {
          // Trust the claim only if the player backs it up. If it doesn't, fall
          // through and report failure so the caller retries rather than
          // driving a player that isn't there.
          if (await isPlayerResponsive()) {
            return;
          }
        }
        // Genuine failure: clear the memo so the next caller can retry setup
        // rather than being permanently stuck on this rejected promise.
        setupPromise = null;
        throw err;
      } finally {
        setupInFlight = false;
      }
    })();
  }
  return setupPromise;
};
