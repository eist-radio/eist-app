// utils/playIntent.ts
// Whether the listener wants the stream playing. Shared by TrackPlayerContext and the playback service.
export const playIntent = { current: false };

// Stream rebuild in progress: its async stopped/none events aren't a real stop.
// Time-bounded, so a failed rebuild can't hold "playing" forever.
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
