// utils/playbackUiState.ts
// Maps RNTP's PlaybackState to the Listen button, holding "playing" through startup and rebuffer churn.

// The transient states RNTP passes through while (re)starting a live stream.
// State.Connecting is an alias of State.Loading, so it's covered by 'loading'.
const TRANSIENT_STARTUP_STATES = new Set(['loading', 'buffering', 'ready']);

// States a stream rebuild emits. Held only while the rebuild is in progress.
const REBUILD_STATES = new Set(['stopped', 'none']);

/** Whether the button should show Stop. userWantsPlay and rebuilding come from utils/playIntent.ts. */
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
