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
