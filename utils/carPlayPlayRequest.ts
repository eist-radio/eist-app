// utils/carPlayPlayRequest.ts
//
// Decides whether a play request arriving from the CarPlay scene should start
// the stream.
//
// Why this is its own function rather than a line in the listener: the native
// CarPlaySceneDelegate posts a play request on EVERY foreground activation of
// éist on the car screen (cold start, warm start, and returning after Maps or
// Spotify took the now-playing role). Something has to suppress the requests
// that would tear down a healthy stream, and the signal that job uses has to be
// the player's real state.
//
// The bug this replaces: the listener used to read `isPlayingRef`, which is fed
// by resolveIsPlaying (utils/playbackUiState.ts). That value is a UI affordance,
// deliberately sticky, holding the "playing" label steady through
// loading/buffering/ready/stopped/none for as long as `userPlay` intent is set.
// `userPlay` is only cleared by an explicit user stop. So a CarPlay disconnect
// left the flag latched true with no audio playing, and from then on every car
// play request was discarded by `if (isPlayingRef.current) return`. The car
// showed Now Playing and sat silent, and only a tap on the phone could recover,
// because that cleared the intent flag. Observed symptom: CarPlay works until
// the first disconnect, then never again.
//
// So: ask the player, not the button.

// Values of react-native-track-player's `State` enum. Kept as strings because
// the state arrives as a string at runtime and this module stays importable
// without pulling RNTP (and its native side) into a plain-node test.
type PlaybackStateValue = string | null | undefined;

// States that mean a stream is already up, or on its way up, so a restart would
// do harm rather than good. `play()` begins with cleanResetPlayer(), which
// destroys and rebuilds the player, and doing that to a stream that is mid
// startup is the destroy/create/destroy churn behind past dropouts.
const ALREADY_UNDERWAY = new Set(['playing', 'buffering', 'loading']);

export interface CarPlayPlayRequest {
  /**
   * The player's real state, from TrackPlayer.getPlaybackState(). Pass null or
   * undefined when the probe failed or timed out.
   */
  state: PlaybackStateValue;
  /**
   * Whether a CarPlay-initiated play() is still running. Several activations can
   * land in quick succession, and the first one needs time to reach `playing`
   * before the next is judged.
   */
  requestInFlight: boolean;
}

/**
 * @returns whether to call play() for this CarPlay request.
 */
export function shouldStartPlaybackForCarPlay({
  state,
  requestInFlight,
}: CarPlayPlayRequest): boolean {
  // Our own in-flight attempt is the duplicate suppression the sticky UI flag
  // used to provide, now local to this path and cleared when the attempt ends,
  // so it cannot latch for the life of the runtime.
  if (requestInFlight) {
    return false;
  }

  // A player that will not report its state is not a player that is playing.
  // Starting is the recovery path here: play() runs setupPlayer() first, which
  // is what revives a MusicService that died under a live JS runtime.
  if (state == null) {
    return true;
  }

  return !ALREADY_UNDERWAY.has(state);
}
