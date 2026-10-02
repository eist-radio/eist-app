// utils/withTimeout.ts

// Puts a ceiling on a promise that may never settle.
//
// Why this exists: react-native-track-player resolves TrackPlayer.setupPlayer()
// from MusicModule.onServiceConnected, and that callback only resolves the
// pending promise on the FIRST bind. After the MusicService is destroyed and
// Android rebinds, the promise is left pending forever. An unbounded `await` on
// it poisons whatever cached it (see ensurePlayerSetup) and latches whatever
// guard flag was set before it (see attemptStreamRestart), so playback stayed
// dead until the app was restarted. The bundled RNTP patch fixes that specific
// callback; every await on a native player promise is bounded as well, because a
// promise that goes missing for any other reason must degrade into a retry
// rather than a permanent stall.
//
// The underlying work is abandoned, not cancelled — there is no cancellation in
// the RNTP bridge. A late resolve is harmless: callers treat a timeout as a
// failure and retry, and the player is idempotent about setup and playback.
export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} did not settle within ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export const withTimeout = async <T>(
  work: Promise<T>,
  ms: number,
  label: string
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};
