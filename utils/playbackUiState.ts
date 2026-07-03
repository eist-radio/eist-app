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

/**
 * @param state         the raw PlaybackState string from RNTP (State enum value)
 * @param userWantsPlay whether the user currently intends to be playing
 *                      (TrackPlayerContext's `userPlay` intent ref)
 * @returns whether the play/stop button should show the "playing" (Stop) state
 */
export function resolveIsPlaying(state: string, userWantsPlay: boolean): boolean {
  if (state === 'playing') return true;
  // Hold steady through startup/rebuffer churn while the user wants playback.
  if (userWantsPlay && TRANSIENT_STARTUP_STATES.has(state)) return true;
  // Stopped / paused / none / ended / error → genuinely not playing.
  return false;
}
