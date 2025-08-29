// trackPlayerService.js
import TrackPlayer, { Event } from 'react-native-track-player';

const STREAM_URL = 'https://eist-radio.radiocult.fm/stream';

// Function to start fresh stream instead of resuming from buffer
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
      artist: currentTrack?.artist || 'éist',
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
  // Enhanced play/pause for lock screen and Android Auto controls
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    try {
      await TrackPlayer.play();
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
  
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  
  // Disable previous and next controls - they do nothing for live radio
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    // nothing
  });
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    // nothing
  });
  
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => TrackPlayer.seekTo(event.position));
  
  TrackPlayer.addEventListener(Event.RemoteJumpForward, async (event) => {
    const position = await TrackPlayer.getPosition();
    await TrackPlayer.seekTo(position + (event.interval || 10));
  });
  
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (event) => {
    const position = await TrackPlayer.getPosition();
    await TrackPlayer.seekTo(Math.max(0, position - (event.interval || 10)));
  });
};