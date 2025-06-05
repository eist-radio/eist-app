// context/TrackPlayerContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from 'react';
import TrackPlayer, { Capability, State, Event } from 'react-native-track-player';

const STREAM_URL = 'https://eist-radio.radiocult.fm/stream';

type TrackPlayerContextType = {
  isPlaying: boolean;
  isPlayerReady: boolean;
  play: () => Promise<void>;
  stop: () => Promise<void>;
  togglePlayStop: () => Promise<void>;
  setupPlayer: () => Promise<void>;
  /**
   * Update metadata on the native player (lock/notification). 
   */
  updateMetadata: (title: string, artist: string, artworkUrl?: string) => Promise<void>;
};

const TrackPlayerContext = createContext<TrackPlayerContextType | undefined>(undefined);

export const TrackPlayerProvider = ({ children }: { children: ReactNode }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  // Ensure setupPlayer() only runs once
  const hasInitialized = useRef(false);

  // Initialize TrackPlayer (only once)
  const setupPlayer = async () => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    try {
      // Create the native player instance
      await TrackPlayer.setupPlayer();

      // Configure lock-screen / notification controls to include just Play + Stop
      await TrackPlayer.updateOptions({
        stopWithApp: false,
        alwaysPauseOnInterruption: true,
        capabilities: [Capability.Play, Capability.Stop],
        compactCapabilities: [Capability.Play, Capability.Stop],
        notificationCapabilities: [Capability.Play, Capability.Stop],
      });

      // Add radio-stream with a placeholder title/artist
      await TrackPlayer.add({
        id: 'radio-stream',
        url: STREAM_URL,
        title: ' ',
        artist: 'éist',
        isLiveStream: true,
      });

      // Prime the player to enable controls
      await TrackPlayer.play();
      await TrackPlayer.stop();

      setIsPlayerReady(true);
    } catch (err) {
      console.error('TrackPlayer setup failed:', err);
    }
  };

  // Play track
  const play = async () => {
    if (!isPlayerReady) return;
    try {
      await TrackPlayer.play();
    } catch (err) {
      console.error('TrackPlayer.play() failed:', err);
    }
  };

  // Stop track
  const stop = async () => {
    if (!isPlayerReady) return;
    try {
      await TrackPlayer.stop();
    } catch (err) {
      console.error('TrackPlayer.stop() failed:', err);
    }
  };

  // Toggle between play and stop
  const togglePlayStop = async () => {
    if (!isPlayerReady) return;
    try {
      const currentState = await TrackPlayer.getState();
      if (currentState === State.Playing) {
        await stop();
      } else {
        await play();
      }
    } catch (err) {
      console.error('TrackPlayer.togglePlayStop() failed:', err);
    }
  };

  // Update metadata for lock-screen/notification only
  const updateMetadata = async (
    title: string,
    artist: string,
    artworkUrl?: string
  ) => {
    if (!isPlayerReady) {
      console.warn('Tried to update metadata before TrackPlayer was ready—skipping.');
      return;
    }

    const metadataArtist = artist;

    try {
      if (artworkUrl && typeof artworkUrl === 'string') {
        await TrackPlayer.updateMetadataForTrack('radio-stream', {
          title,
          artist: metadataArtist,
          artwork: { uri: artworkUrl },
        });
      } else {
        // Fallback to a static asset if no artworkUrl is provided
        await TrackPlayer.updateMetadataForTrack('radio-stream', {
          title,
          artist: metadataArtist,
          artwork: require('../assets/images/eist_offline.png'),
        });
      }
    } catch (err) {
      console.error('Failed to update metadata:', err);
    }
  };

  // Listen for playback‐state changes and initialize player on mount
  useEffect(() => {
    setupPlayer();

    const playbackStateListener = TrackPlayer.addEventListener(
      Event.PlaybackState,
      (data) => {
        setIsPlaying(data.state === State.Playing);
      }
    );

    return () => {
      playbackStateListener.remove();
    };
  }, []);

  return (
    <TrackPlayerContext.Provider
      value={{
        isPlaying,
        isPlayerReady,
        play,
        stop,
        togglePlayStop,
        setupPlayer,
        updateMetadata,
      }}
    >
      {children}
    </TrackPlayerContext.Provider>
  );
};

export const useTrackPlayer = (): TrackPlayerContextType => {
  const ctx = useContext(TrackPlayerContext);
  if (!ctx) {
    throw new Error('useTrackPlayer must be used within a TrackPlayerProvider');
  }
  return ctx;
};
