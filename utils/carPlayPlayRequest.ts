// utils/carPlayPlayRequest.ts
// Whether a CarPlay play request should start the stream, based on the player's real state (not the sticky UI flag).

// RNTP State values as strings, so this module doesn't import RNTP.
type PlaybackStateValue = string | null | undefined;

// Already up or coming up. play() rebuilds the stream, so restarting these causes dropouts.
const ALREADY_UNDERWAY = new Set(['playing', 'buffering', 'loading']);

export interface CarPlayPlayRequest {
  /** Player state from getPlaybackState(), or null/undefined if the probe failed. */
  state: PlaybackStateValue;
  /** Whether a CarPlay-initiated play() is still running. */
  requestInFlight: boolean;
}

/** Whether to call play() for this CarPlay request. */
export function shouldStartPlaybackForCarPlay({
  state,
  requestInFlight,
}: CarPlayPlayRequest): boolean {
  // Drop duplicates while our own attempt runs.
  if (requestInFlight) {
    return false;
  }

  // No answer counts as not playing. play() runs setupPlayer(), which revives a dead service.
  if (state == null) {
    return true;
  }

  return !ALREADY_UNDERWAY.has(state);
}
