// utils/ensurePlayerSetup.ts

import TrackPlayer from 'react-native-track-player';
import { applyPlayerOptions, setupTrackPlayer } from './trackPlayerSetup';
import { withTimeout } from './withTimeout';

// Idempotent player setup shared by TrackPlayerContext and trackPlayerService.js (CarPlay can start without the UI).
// Memoised and time-bounded. resetPlayerSetup drops the memo when the player stops answering.
const SETUP_TIMEOUT_MS = 10000;
const PROBE_TIMEOUT_MS = 2000;

let setupPromise: Promise<void> | null = null;
let setupInFlight = false;

// The pending native setup call. A retry after a timeout waits on it instead of calling setupPlayer() twice.
let nativeSetup: Promise<void> | null = null;

const runNativeSetup = (): Promise<void> => {
  if (!nativeSetup) {
    const call: Promise<void> = setupTrackPlayer().finally(() => {
      if (nativeSetup === call) nativeSetup = null;
    });
    nativeSetup = call;
  }
  return nativeSetup;
};

// Player state, or null if it doesn't answer within PROBE_TIMEOUT_MS.
export const probePlaybackState = async (): Promise<string | null> => {
  try {
    const playback = await withTimeout(
      TrackPlayer.getPlaybackState(),
      PROBE_TIMEOUT_MS,
      'getPlaybackState'
    );
    // A read that resolves proves the player answers, even without a state.
    return playback?.state ?? 'none';
  } catch {
    return null;
  }
};

// True if the native player answers. "Already initialized" alone survives a dead service.
export const isPlayerResponsive = async (): Promise<boolean> =>
  (await probePlaybackState()) !== null;

// Drop the memo so the next ensurePlayerSetup() genuinely calls setupPlayer()
// again instead of resolving an already-fulfilled promise.
export const resetPlayerSetup = (): void => {
  // Leave an in-flight setup alone, or a second concurrent setupPlayer() could start.
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
        await withTimeout(runNativeSetup(), SETUP_TIMEOUT_MS, 'setupPlayer');
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : '';
        if (msg.includes('already been initialized') || msg.includes('already initialized')) {
          // Trust "already initialized" only if the player answers.
          if (await isPlayerResponsive()) {
            try {
              await withTimeout(applyPlayerOptions(), PROBE_TIMEOUT_MS, 'updateOptions');
              return;
            } catch (optionsErr) {
              // Leave the memo clear so the next caller tries the options again.
              setupPromise = null;
              throw optionsErr;
            }
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
