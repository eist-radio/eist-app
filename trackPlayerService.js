// trackPlayerService.js
import TrackPlayer, { Event, State } from 'react-native-track-player';

const STREAM_URL = 'https://eist-radio.radiocult.fm/stream';

// Start fresh stream
const startFreshStream = async () => {
  try {
    // Stop current playback
    await TrackPlayer.stop().catch(() => {});
    
    // Get current queue to preserve metadata
    const currentQueue = await TrackPlayer.getQueue().catch(() => []);
    const currentTrack = currentQueue[0];
    
    // Reset queue to clear any buffered data
    await TrackPlayer.reset().catch(() => {});
    
    // Small delay to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Re-add fresh stream track with preserved metadata if available
    const trackToAdd = {
      id: 'radio-stream-' + Date.now(), // Unique ID for fresh track
      url: STREAM_URL,
      title: currentTrack?.title || 'éist',
      artist: currentTrack?.artist || '',
      album: 'éist',
      artwork: currentTrack?.artwork || require('./assets/images/eist-logo.png'),
      isLiveStream: true,
    };
    
    await TrackPlayer.add(trackToAdd);
    
    // Start playback with fresh stream
    await TrackPlayer.play();
    
    console.log('Fresh stream started from CarPlay/remote control');
  } catch (error) {
    console.error('Error starting fresh stream:', error);
    // Fallback to regular play if fresh stream fails
    try {
      await TrackPlayer.play();
    } catch (fallbackError) {
      console.error('Fallback play also failed:', fallbackError);
    }
  }
};

// Start the stream and nudge Android Auto / the lock screen to re-read metadata.
const startFreshStreamAndRefreshMetadata = async () => {
  // Always start fresh stream to avoid playing old buffered audio
  await startFreshStream();
  // Force metadata refresh for Android Auto after play
  const queue = await TrackPlayer.getQueue();
  if (queue && queue.length > 0) {
    const currentTrack = queue[0];
    await TrackPlayer.updateMetadataForTrack(0, {
      ...currentTrack,
      _metadata_refresh: Date.now(),
    });
  }
};

module.exports = async function() {
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    try {
      await startFreshStreamAndRefreshMetadata();
    } catch (error) {
      console.error('Remote play error:', error);
    }
  });

  // Android Auto (and Google Assistant voice) start playback by selecting the
  // single playable browse item exposed by MediaBrowserService, which routes to
  // the media session as playFromMediaId / playFromSearch — RNTP forwards these
  // as RemotePlayId / RemotePlaySearch. Without these handlers, tapping "éist
  // radio" in the car does nothing and Android Auto hangs on "Getting your
  // selection...", and there is no way to resume after a Stop. We only stream
  // one live station, so any id/query just starts the stream.
  TrackPlayer.addEventListener(Event.RemotePlayId, async () => {
    try {
      await startFreshStreamAndRefreshMetadata();
    } catch (error) {
      console.error('Remote play-by-id error:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemotePlaySearch, async () => {
    try {
      await startFreshStreamAndRefreshMetadata();
    } catch (error) {
      console.error('Remote play-by-search error:', error);
    }
  });

  // For live radio, "pause" means stop while playing. But CarPlay's Now Playing
  // button is a play/pause toggle, and iOS may route a tap-from-stopped through
  // the pause/toggle command (RNTP's toggle handler emits RemotePause from any
  // non-paused state, including .stopped). So make this state-aware: start the
  // stream when nothing is playing, otherwise stop. This keeps the single car
  // button working in both directions regardless of which command iOS sends.
  const NON_PLAYING_STATES = [
    State.Stopped,
    State.Paused,
    State.Ready,
    State.None,
    State.Ended,
  ];
  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    try {
      const { state } = await TrackPlayer.getPlaybackState();
      if (NON_PLAYING_STATES.includes(state)) {
        await startFreshStream();
      } else {
        await TrackPlayer.stop();
      }
    } catch (error) {
      console.error('Remote pause error:', error);
      await TrackPlayer.stop().catch(() => {});
    }
  });
  
  // Disable previous and next controls - they do nothing for live radio
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    // nothing
  });
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    // nothing
  });
  
  // Stop, but keep the media session alive so Android Auto keeps showing the
  // browse item — tapping it (RemotePlayId, above) restarts the stream. Do NOT
  // reset/destroy here, or the car is left with no way to resume.
  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    try {
      await TrackPlayer.stop();
    } catch (error) {
      console.error('Remote stop error:', error);
    }
  });
};
