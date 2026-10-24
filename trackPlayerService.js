// trackPlayerService.js
import TrackPlayer, { Event, State } from 'react-native-track-player';
import { ensurePlayerSetup } from './utils/ensurePlayerSetup';
import { isRebuildingStream, markStreamRebuild, playIntent } from './utils/playIntent';

const STREAM_URL = 'https://eist-radio.radiocult.fm/stream';

// Start fresh stream
const startFreshStream = async () => {
  // Every remote start goes through here, so this is where the listener's
  // intent to play is recorded for the recovery paths in TrackPlayerContext.
  playIntent.current = true;
  try {
    // CarPlay can reach this without the UI mounting, so make sure the player is set up.
    await ensurePlayerSetup();

    markStreamRebuild();
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
  // Set up the player at service start, so remote commands work without the UI.
  ensurePlayerSetup().catch((e) => console.error('Playback service setup failed:', e));

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

  // CarPlay's toggle can send pause while stopped, so start the stream when nothing is playing, otherwise pause.
  // pause(), not stop(), keeps the Android foreground service alive for Android Auto.
  const NON_PLAYING_STATES = [
    State.Stopped,
    State.Paused,
    State.Ready,
    State.None,
    State.Ended,
    // An errored player has to be rebuilt. pause() leaves it in error, so a
    // headset, knob, or toggle press would never get the stream back.
    State.Error,
  ];
  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    try {
      await ensurePlayerSetup();
      const { state } = await TrackPlayer.getPlaybackState();
      // Still starting up (ready mid-rebuffer, or stopped/none during a rebuild): a pause here means stop.
      const isStartingUp =
        playIntent.current &&
        (state === State.Ready ||
          ((state === State.Stopped || state === State.None) && isRebuildingStream()));
      const willRestart = !isStartingUp && NON_PLAYING_STATES.includes(state);
      if (willRestart) {
        await startFreshStream();
      } else {
        playIntent.current = false;
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

  // pause(), not stop(): stop() kills the foreground service and breaks Android Auto.
  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    playIntent.current = false;
    // A failed setup must not swallow the stop. Pause regardless: on a live
    // player it stops the audio, and on a dead one it is a harmless no-op.
    try {
      await ensurePlayerSetup();
    } catch (error) {
      console.error('Remote stop setup error:', error);
    }
    await TrackPlayer.pause().catch((error) => console.error('Remote stop error:', error));
  });
};
