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
const TOGGLE_DEBOUNCE_MS = 500;

type TrackPlayerContextType = {
  isPlaying: boolean;
  isPlayerReady: boolean;
  play: () => Promise<void>;
  stop: () => Promise<void>;
  togglePlayStop: () => Promise<void>;
  setupPlayer: () => Promise<void>;
  updateMetadata: (title: string, artist: string, artworkUrl?: string) => Promise<void>;
};

const TrackPlayerContext = createContext<TrackPlayerContextType | undefined>(undefined);

export const TrackPlayerProvider = ({ children }: { children: ReactNode }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const hasInitialized = useRef(false);
  const isTogglingRef = useRef(false);

  const setupPlayer = async () => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    try {
      await TrackPlayer.setupPlayer();

      await TrackPlayer.updateOptions({
        stopWithApp: false,
        alwaysPauseOnInterruption: true,
        capabilities: [Capability.Play, Capability.Stop],
        compactCapabilities: [Capability.Play, Capability.Stop],
        notificationCapabilities: [Capability.Play, Capability.Stop],
      });

      await TrackPlayer.add({
        id: 'radio-stream',
        url: STREAM_URL,
        title: ' ',
        artist: 'éist',
        isLiveStream: true,
      });

      await TrackPlayer.play();
      await TrackPlayer.stop();

      setIsPlayerReady(true);
    } catch (err) {
      console.error('TrackPlayer setup failed:', err);
    }
  };

  const play = async () => {
    if (!isPlayerReady) return;
    try {
      await TrackPlayer.play();
      setIsPlaying(true);
    } catch (err) {
      console.error('TrackPlayer.play() failed:', err);
      setIsPlaying(false);
    }
  };

  const stop = async () => {
    if (!isPlayerReady) return;
    try {
      await TrackPlayer.stop();
      setIsPlaying(false);
    } catch (err) {
      console.error('TrackPlayer.stop() failed:', err);
    }
  };

  const togglePlayStop = async () => {
    if (!isPlayerReady || isTogglingRef.current) return;

    isTogglingRef.current = true;

    try {
      const currentState = await TrackPlayer.getState();
      if (currentState === State.Playing) {
        await stop();
      } else {
        await play();
      }
    } catch (err) {
      console.error('TrackPlayer.togglePlayStop() failed:', err);
    } finally {
      setTimeout(() => {
        isTogglingRef.current = false;
      }, TOGGLE_DEBOUNCE_MS);
    }
  };

  const updateMetadata = async (
    title: string,
    artist: string,
    artworkUrl?: string
  ) => {
    if (!isPlayerReady) {
      console.warn('Tried to update metadata before TrackPlayer was ready—skipping.');
      return;
    }

    const isDeadAir = title.trim().length === 0;
    const metadataArtist = isDeadAir ? '' : `${artist} · éist`;

    try {
      if (artworkUrl && typeof artworkUrl === 'string') {
        await TrackPlayer.updateMetadataForTrack('radio-stream', {
          title,
          artist: metadataArtist,
          artwork: { uri: artworkUrl },
        });
      } else {
        await TrackPlayer.updateMetadataForTrack('radio-stream', {
          title,
          artist: metadataArtist,
          artwork: require('../assets/images/artist.png'),
        });
      }
    } catch (err) {
      console.error('Failed to update metadata:', err);
    }
  };

  useEffect(() => {
    setupPlayer();

    const playbackStateListener = TrackPlayer.addEventListener(
      Event.PlaybackState,
      (data) => {
        setIsPlaying(data.state === State.Playing);
      }
    );

    const playbackErrorListener = TrackPlayer.addEventListener(
      Event.PlaybackError,
      (error) => {
        console.warn('Playback error:', error);
        setIsPlaying(false);
      }
    );

    return () => {
      playbackStateListener.remove();
      playbackErrorListener.remove();
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
