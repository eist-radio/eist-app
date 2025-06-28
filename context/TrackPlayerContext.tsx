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
  const stateCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const lastKnownState = useRef<State | null>(null);

  // Enhanced state synchronization function
  const syncPlayerState = async () => {
    try {
      const currentState = await TrackPlayer.getState();
      const playing = currentState === State.Playing;
      const isStableState = currentState === State.Playing || 
                           currentState === State.Stopped || 
                           currentState === State.Paused ||
                           currentState === State.Ready;

      // Only update if state actually changed to prevent unnecessary re-renders
      if (lastKnownState.current !== currentState) {
        console.log(`State changed from ${lastKnownState.current} to ${currentState}`);
        lastKnownState.current = currentState;
        setIsPlaying(playing);
        
        if (isStableState) {
          setIsBusy(false);
        }
      }
    } catch (err) {
      console.error('Failed to sync player state:', err);
      // If we can't get state, assume we're not playing and not busy
      setIsPlaying(false);
      setIsBusy(false);
    }
  };

  // Start periodic state checking
  const startStateSync = () => {
    if (stateCheckInterval.current) return;
    
    stateCheckInterval.current = setInterval(() => {
      syncPlayerState();
    }, 2000); // Check every 2 seconds
  };

  // Stop periodic state checking
  const stopStateSync = () => {
    if (stateCheckInterval.current) {
      clearInterval(stateCheckInterval.current);
      stateCheckInterval.current = null;
    }
  };

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
      // Start state synchronization once player is ready
      startStateSync();
      // Do initial state sync
      await syncPlayerState();
    } catch (err) {
      console.error('TrackPlayer setup failed:', err);
    }
  };

  const play = async () => {
    if (!isPlayerReady) return;
    setIsBusy(true);
    try {
      await TrackPlayer.play();
      // Force immediate state sync after play command
      setImmediate(() => syncPlayerState());
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
      // Force immediate state sync after stop command
      setImmediate(() => syncPlayerState());
    } catch (err) {
      console.error('TrackPlayer.stop() failed:', err);
      setIsBusy(false);
    }
  };

  const togglePlayStop = async () => {
    if (!isPlayerReady) return;
    
    // If we're already busy, try to sync state first
    if (isBusy) {
      console.log('Player is busy, syncing state before toggle');
      await syncPlayerState();
      // If still busy after sync, don't proceed
      if (isBusy) return;
    }
    
    setIsBusy(true);

    try {
      const currentState = await TrackPlayer.getState();
      console.log(`Toggle: current state is ${currentState}`);
      
      if (currentState === State.Playing) {
        await stop();
      } else {
        await play();
      }
    } catch (err) {
      console.error('TrackPlayer.togglePlayStop() failed:', err);
      setIsBusy(false);
      // Force state sync on error
      setImmediate(() => syncPlayerState());
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
        await TrackPlayer.updateMetadataForTrack(0, {
          title,
          artist: '',
          artwork: require('../assets/images/eist_offline.png'),
        });
      } else if (artworkUrl && typeof artworkUrl === 'string') {
        await TrackPlayer.updateMetadataForTrack(0, {
          title,
          artist: metadataArtist,
          artwork: artworkUrl,
        });
      } else {
        await TrackPlayer.updateMetadataForTrack(0, {
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
        console.log(`PlaybackState event: ${state}`);
        const playing = state === State.Playing;
        lastKnownState.current = state;
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
        // Sync state after error
        setImmediate(() => syncPlayerState());
      }
    );

    // Enhanced app state handling
    const appStateListener = AppState.addEventListener('change', async (nextAppState) => {
      console.log(`App state changed to: ${nextAppState}`);
      
      if (nextAppState === 'active') {
        // App is becoming active - sync state and resume state checking
        startStateSync();
        await syncPlayerState();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App is going to background - we can reduce state checking frequency
        // but don't stop completely as CarPlay might still be active
        console.log('App going to background, continuing state sync for CarPlay');
      }
    });

    // Clean up function
    return () => {
      playbackStateListener.remove();
      playbackErrorListener.remove();
      appStateListener.remove();
      stopStateSync();
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStateSync();
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
