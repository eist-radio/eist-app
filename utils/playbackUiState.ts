// utils/playbackUiState.ts
//
// Maps react-native-track-player's instantaneous PlaybackState to the boolean
// the Listen button renders (Stop when true, "Listen now" when false).
//
// Why this isn't just `state === State.Playing`: for a LIVE stream the button
// must reflect the listening *session*, not the decoder's moment-to-moment
// state. Startup emits None → Loading → Buffering → Ready → Playing, and every
// mid-stream rebuffer re-enters Buffering/Loading. Mapping those transient
// states to "stopped" makes the button flicker (Stop → Listen → Stop) as the
// events arrive right after the user pressed play. So while the user intends to
// play, we hold the playing affordance steady through those transient states and
// only clear it on a genuine terminal stop.

// The transient states RNTP passes through while (re)starting a live stream.
// State.Connecting is an alias of State.Loading, so it's covered by 'loading'.
const TRANSIENT_STARTUP_STATES = new Set(['loading', 'buffering', 'ready']);

// The states a stream rebuild (stop, reset, add, play) emits before it starts.
// Held only while a rebuild is in progress. Holding them whenever userPlay was
// set made every stop the app did not issue itself (a CarPlay disconnect, an
// empty queue after a MusicService rebind) show Stop over silence, and hid the
// dead stream from the recovery paths that read isPlayingRef.
const REBUILD_STATES = new Set(['stopped', 'none']);

/**
 * @param state         the raw PlaybackState string from RNTP (State enum value)
 * @param userWantsPlay whether the user currently intends to be playing
 *                      (utils/playIntent.ts)
 * @param rebuilding    whether a stream rebuild is in progress
 *                      (isRebuildingStream in utils/playIntent.ts)
 * @returns whether the play/stop button should show the "playing" (Stop) state
 */
export function resolveIsPlaying(
  state: string,
  userWantsPlay: boolean,
  rebuilding = false
): boolean {
  if (state === 'playing') return true;
  if (!userWantsPlay) return false;
  // Hold steady through startup/rebuffer churn while the user wants playback.
  if (TRANSIENT_STARTUP_STATES.has(state)) return true;
  if (rebuilding && REBUILD_STATES.has(state)) return true;
  // Paused / ended / error, or a stop outside a rebuild → not playing.
  return false;
}
