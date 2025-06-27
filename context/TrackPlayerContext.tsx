// context/TrackPlayerContext.tsx

import React, {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import { AppState } from 'react-native';
import TrackPlayer, {
    AppKilledPlaybackBehavior,
    Capability,
    Event,
    State,
} from 'react-native-track-player';

const STREAM_URL = 'https://eist-radio.radiocult.fm/stream';

type TrackPlayerContextType = {
  isPlaying: boolean;
  isPlayerReady: boolean;
  isBusy: boolean;
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
  const [isBusy, setIsBusy] = useState(false);
  const hasInitialized = useRef(false);

  const setupPlayer = async () => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    try {
      await TrackPlayer.setupPlayer();

      await TrackPlayer.updateOptions({
        alwaysPauseOnInterruption: false,
        android: {
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
        },
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

      setIsPlayerReady(true);
    } catch (err) {
      console.error('TrackPlayer setup failed:', err);
    }
  };

  const play = async () => {
    if (!isPlayerReady) return;
    setIsBusy(true);
    try {
      await TrackPlayer.play();
    } catch (err) {
      console.error('TrackPlayer.play() failed:', err);
      setIsBusy(false);
    }
  };

  const stop = async () => {
    if (!isPlayerReady) return;
    setIsBusy(true);
    try {
      await TrackPlayer.stop();
    } catch (err) {
      console.error('TrackPlayer.stop() failed:', err);
      setIsBusy(false);
    }
  };

  const togglePlayStop = async () => {
    if (!isPlayerReady || isBusy) return;
    setIsBusy(true);

    try {
      const currentState = await TrackPlayer.getState();
      if (currentState === State.Playing) {
        await stop();
      } else {
        await play();
      }
    } catch (err) {
      console.error('TrackPlayer.togglePlayStop() failed:', err);
      setIsBusy(false);
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
    const metadataArtist = (!artist || isDeadAir) ? '': `${artist} · éist`;

    try {
      if (isDeadAir) {
        await TrackPlayer.updateMetadataForTrack('radio-stream', {
          title,
          artist: '',
          artwork: require('../assets/images/eist_offline.png'),
        });
      } else if (artworkUrl && typeof artworkUrl === 'string') {
        await TrackPlayer.updateMetadataForTrack('radio-stream', {
          title,
          artist: metadataArtist,
          artwork: { uri: artworkUrl },
        });
      } else {
        await TrackPlayer.updateMetadataForTrack('radio-stream', {
          title,
          artist: metadataArtist,
          artwork: require('../assets/images/eist_online.png'),
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
      ({ state }) => {
        const playing = state === State.Playing;
        setIsPlaying(playing);
        if (state === State.Playing || state === State.Stopped || state === State.Paused) {
          setIsBusy(false);
        }
      }
    );

    const playbackErrorListener = TrackPlayer.addEventListener(
      Event.PlaybackError,
      (error) => {
        console.warn('Playback error:', error);
        setIsPlaying(false);
        setIsBusy(false);
      }
    );

    const appStateListener = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        try {
          const currentState = await TrackPlayer.getState();
          setIsPlaying(currentState === State.Playing);
          if (
            currentState === State.Playing ||
            currentState === State.Stopped ||
            currentState === State.Paused
          ) {
            setIsBusy(false);
          }
        } catch (err) {
          console.error('Failed to get state on app resume:', err);
        }
      }
    });

    return () => {
      playbackStateListener.remove();
      playbackErrorListener.remove();
      appStateListener.remove();
    };
  }, []);

  return (
    <TrackPlayerContext.Provider
      value={{
        isPlaying,
        isPlayerReady,
        isBusy,
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
