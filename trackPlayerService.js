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

module.exports = async function() {
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    try {
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
    } catch (error) {
      console.error('Remote play error:', error);
    }
  });

  // Android Auto: fired when the user taps a browse-list item (e.g. "éist radio").
  // Without this handler Android Auto spins on "Getting your selection..." forever.
  TrackPlayer.addEventListener(Event.RemotePlayId, async () => {
    try {
      await startFreshStream();
    } catch (error) {
      console.error('Remote play-id error:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemotePlaySearch, async () => {
    try {
      await startFreshStream();
    } catch (error) {
      console.error('Remote play-search error:', error);
    }
  });

  // For live radio, "pause" means stop while playing. But CarPlay's Now Playing
  // button is a play/pause toggle, and iOS may route a tap-from-stopped through
  // the pause/toggle command (RNTP's toggle handler emits RemotePause from any
  // non-paused state, including .stopped). So make this state-aware: start the
  // stream when nothing is playing, otherwise pause. This keeps the single car
  // button working in both directions regardless of which command iOS sends.
  // We use pause() instead of stop() to keep the Android foreground service alive
  // so the media session survives and play can resume from Android Auto / car OS.
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
        await TrackPlayer.pause();
      }
    } catch (error) {
      console.error('Remote pause error:', error);
      await TrackPlayer.pause().catch(() => {});
    }
  });

  // Disable previous and next controls - they do nothing for live radio
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    // nothing
  });
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    // nothing
  });

  // Use pause() instead of stop() to keep the Android foreground service alive.
  // stop() tears down the service, which kills the MusicService and breaks the
  // MediaBrowserService binding — making it impossible to play again from
  // Android Auto without restarting the app.
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.pause());
};
