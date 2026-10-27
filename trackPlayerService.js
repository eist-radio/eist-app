// trackPlayerService.js
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import TrackPlayer, { Event, State } from 'react-native-track-player';
import { shouldStartPlaybackForCarPlay } from './utils/carPlayPlayRequest';
import { getLockScreenImage, preloadLockScreenImage } from './utils/androidLockScreenImage';
import { ensurePlayerSetup, probePlaybackState } from './utils/ensurePlayerSetup';
import { getLiveShowInfo } from './utils/liveShowInfo';
import { castPlayback, isRebuildingStream, markStreamRebuild, playIntent } from './utils/playIntent';
import { withTimeout } from './utils/withTimeout';

const STREAM_URL = 'https://eist-radio.radiocult.fm/stream';

// Ceiling on one CarPlay start, so a hung native call releases the in-flight latch.
const CARPLAY_PLAY_TIMEOUT_MS = 30000;

// Show info refresh while playing. Checks just after the show ends, bounded so a bad end time still refreshes.
const SHOW_END_BUFFER_MS = 20000;
const MIN_SHOW_CHECK_MS = 60000;
const MAX_SHOW_CHECK_MS = 15 * 60000;

let nextShowCheckAt = 0;
let lastNowPlayingKey = '';

// Writes the live show to the active track, so CarPlay, Android Auto, and the lock screen show it without the UI.
// TrackPlayerContext does the same, but only while the UI is mounted and its JS timers are running.
const refreshNowPlaying = async () => {
  // Claim the next slot first, so progress events don't pile up requests while this one runs.
  nextShowCheckAt = Date.now() + MIN_SHOW_CHECK_MS;
  try {
    const info = await getLiveShowInfo();
    if (!info) return;

    const end = info.endDateUtc ? new Date(info.endDateUtc).getTime() : NaN;
    const untilEnd = Number.isNaN(end) ? MAX_SHOW_CHECK_MS : end + SHOW_END_BUFFER_MS - Date.now();
    nextShowCheckAt = Date.now() + Math.min(MAX_SHOW_CHECK_MS, Math.max(MIN_SHOW_CHECK_MS, untilEnd));

    // Android only shows remote artwork once it has been checked. A no-op on iOS.
    await preloadLockScreenImage(info.artworkUrl);
    const artwork = getLockScreenImage(info.artworkUrl);

    const queue = await TrackPlayer.getQueue();
    if (!queue || queue.length === 0) return;
    const activeIndex = await TrackPlayer.getActiveTrackIndex().catch(() => undefined);
    const index = typeof activeIndex === 'number' && activeIndex < queue.length ? activeIndex : 0;

    const title = info.title || 'éist';
    const artist = info.djName || '';
    const key = `${queue[index]?.id}\0${title}\0${artist}\0${String(artwork)}`;
    if (key === lastNowPlayingKey) return;

    await TrackPlayer.updateMetadataForTrack(index, {
      title,
      artist,
      album: 'éist',
      artwork,
      duration: -1,
      isLiveStream: true,
    });
    lastNowPlayingKey = key;
  } catch (error) {
    console.warn('Now playing refresh failed:', error);
  }
};

// Start fresh stream. fromCarPlay skips the cleanup delay.
const startFreshStream = async ({ fromCarPlay = false } = {}) => {
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

    // Small delay to ensure cleanup. Not for CarPlay: a JS timer can stall there while the phone screen is off.
    if (!fromCarPlay) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
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

    // TrackPlayerContext ramps volume up from 0 on a timer. Make sure an interrupted ramp can't leave this start silent.
    await TrackPlayer.setVolume(1);

    // Start playback with fresh stream
    await TrackPlayer.play();

    console.log('Fresh stream started from CarPlay/remote control');

    // The queued track only carries the last known show, which is just "éist" on a cold start.
    void refreshNowPlaying();
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

// CarPlay play requests (scene connect or list-item tap) from EistCarPlayBridge. Now Playing can't cold-start audio.
// Handled here, not in TrackPlayerContext, so a CarPlay start doesn't depend on React, the Cast probe, or JS timers.
let carPlayRequestInFlight = false;

const handleCarPlayPlayRequest = async () => {
  // Not while a cast device is playing: a local start would play over it.
  if (castPlayback.playing) {
    return;
  }
  const requestInFlight = carPlayRequestInFlight;
  carPlayRequestInFlight = true;
  try {
    // Decide from the player's real state. See utils/carPlayPlayRequest.ts.
    const state = await probePlaybackState();
    if (!shouldStartPlaybackForCarPlay({ state, requestInFlight })) {
      return;
    }
    await withTimeout(startFreshStream({ fromCarPlay: true }), CARPLAY_PLAY_TIMEOUT_MS, 'carplay-play');
  } catch (error) {
    console.error('CarPlay play request failed:', error);
  } finally {
    // Only the request that claimed the latch releases it.
    if (!requestInFlight) carPlayRequestInFlight = false;
  }
};

// RNTP reruns this function on every MusicService start (setupPlayer, Android Auto cold start).
// Register once, or each remote play would start the stream several times.
let listenersRegistered = false;

module.exports = async function() {
  // Set up the player at service start, so remote commands work without the UI. Memoised, so a rerun is cheap.
  ensurePlayerSetup().catch((e) => console.error('Playback service setup failed:', e));

  if (listenersRegistered) return;
  listenersRegistered = true;

  // Subscribing here, at JS load, also replays a play request that arrived before JS was ready.
  const carPlayBridge = Platform.OS === 'ios' ? NativeModules.EistCarPlayBridge : undefined;
  if (carPlayBridge) {
    new NativeEventEmitter(carPlayBridge).addListener('EistCarPlayPlay', () => {
      void handleCarPlayPlayRequest();
    });
  }

  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    try {
      // startFreshStream refreshes the show info. Rewriting the track from a queue snapshot here could undo that.
      await startFreshStream();
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

  // A native heartbeat while playing (progressUpdateEventInterval), so show changes reach the car with the phone
  // locked or the app in the background, where JS timers stall.
  TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, () => {
    if (Date.now() >= nextShowCheckAt) {
      void refreshNowPlaying();
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
