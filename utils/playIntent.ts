// utils/playIntent.ts
//
// Whether the listener currently wants the stream playing. Shared by the React
// UI (TrackPlayerContext) and the background playback service
// (trackPlayerService.js), which run in the same JS runtime.
//
// Why this is a module and not a ref inside TrackPlayerContext: remote commands
// from the lock screen, notification, CarPlay, and Android Auto are handled by
// the playback service, which could not see the context's ref. A stream
// started from the car left the intent false, so every recovery path (network
// change, playback error, queue ended) skipped it and a dead zone killed the
// stream for the rest of the drive. A pause from the lock screen left it true,
// so the next network change resumed audio the listener had paused.
//
// Shaped like a ref so the context can keep using `userPlay.current`.
export const playIntent = { current: false };

// A stream rebuild (stop, reset, add, play) is in progress. Both rebuild paths,
// cleanResetPlayer in TrackPlayerContext and startFreshStream in the playback
// service, emit `stopped` and `none` events that arrive asynchronously, often
// after play() has returned. Those must not read as a genuine stop.
//
// Time-bounded rather than cleared by the caller: an add() that fails and is
// swallowed leaves the player stopped with no further events, and a flag only
// an active state could clear would then hold "playing" over silence for good.
export const STREAM_REBUILD_HOLD_MS = 5000;

let rebuildUntil = 0;

export const markStreamRebuild = (): void => {
  rebuildUntil = Date.now() + STREAM_REBUILD_HOLD_MS;
};

// Called once the rebuilt stream reaches an active state.
export const endStreamRebuild = (): void => {
  rebuildUntil = 0;
};

export const isRebuildingStream = (): boolean => Date.now() < rebuildUntil;
