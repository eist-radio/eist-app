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
  recoverAudioSession: () => Promise<void>;
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
        stoppingAppPausesPlayback: false,
        android: {
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
          alwaysPauseOnInterruption: false,
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
        duration: 0, // Indicates live stream with no duration
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

  // Recovery function for audio session conflicts
  const recoverFromAudioSessionConflict = async () => {
    console.log('Attempting to recover from audio session conflict...');
    
    try {
      // Stop any current playback
      setIsPlaying(false);
      setIsBusy(false);
      
      // Try to stop the current player
      try {
        await TrackPlayer.stop();
      } catch (stopErr) {
        console.warn('Stop failed during recovery:', stopErr);
      }
      
      // Wait a moment for audio session to clear
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Reset the player setup to request audio session
      try {
        await TrackPlayer.setupPlayer();
        
                 // Re-add the stream
         const queue = await TrackPlayer.getQueue();
         if (queue.length === 0) {
           await TrackPlayer.add({
             id: 'radio-stream',
             url: STREAM_URL,
             title: ' ',
             artist: 'éist',
             isLiveStream: true,
             duration: 0, // Indicates live stream with no duration
           });
         }
        
        // Try to play again
        await TrackPlayer.play();
        setIsPlaying(true);
        setIsBusy(false);
        
        console.log('Audio session recovery successful');
      } catch (retryErr) {
        console.error('Audio session recovery failed:', retryErr);
        setIsPlaying(false);
        setIsBusy(false);
      }
    } catch (err) {
      console.error('Recovery process failed:', err);
      setIsPlaying(false);
      setIsBusy(false);
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
      
      // If play failed, it might be due to audio session conflict
      // Try to reset and reinitialize the player
      if (err instanceof Error && (
        err.message.includes('audio session') || 
        err.message.includes('interrupted') ||
        err.message.includes('not initialized')
      )) {
        console.log('Audio session conflict detected, attempting recovery...');
        await recoverFromAudioSessionConflict();
      }
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

    // Add audio interruption handling
    const audioInterruptionListener = TrackPlayer.addEventListener(
      Event.PlaybackQueueEnded,
      () => {
        console.log('Playback queue ended - possible audio interruption');
        setIsPlaying(false);
        setIsBusy(false);
        // Force state sync to ensure UI is consistent
        setImmediate(() => syncPlayerState());
      }
    );

    // Handle CarPlay pause commands as stop (since you can't pause live radio)
    const remotePauseListener = TrackPlayer.addEventListener(
      Event.RemotePause,
      async () => {
        console.log('CarPlay pause received - converting to stop for radio stream');
        await stop();
      }
    );

    // Also handle remote stop commands
    const remoteStopListener = TrackPlayer.addEventListener(
      Event.RemoteStop,
      async () => {
        console.log('CarPlay stop received');
        await stop();
      }
    );

    // Handle remote play commands
    const remotePlayListener = TrackPlayer.addEventListener(
      Event.RemotePlay,
      async () => {
        console.log('CarPlay play received');
        await play();
      }
    );

    // Enhanced app state handling
    const appStateListener = AppState.addEventListener('change', async (nextAppState) => {
      console.log(`App state changed to: ${nextAppState}`);
      
      if (nextAppState === 'active') {
        // App is becoming active - sync state and resume state checking
        startStateSync();
        await syncPlayerState();
        
        // Check if there might be an audio session conflict
        // This happens when user switches from another music app
        setTimeout(async () => {
          try {
            const currentState = await TrackPlayer.getState();
            
            // If we think we should be playing but we're not, or if we get an error,
            // there might be an audio session conflict
            if (isPlaying && currentState !== State.Playing) {
              console.log('Potential audio session conflict detected on app focus');
              // Don't automatically recover here, let the user try to play first
              // Just sync state so UI is accurate
              setIsPlaying(false);
              setIsBusy(false);
            }
          } catch (err) {
            console.warn('State check failed on app focus, possible audio session issue:', err);
            // If we can't even check state, there's likely an audio session problem
            setIsPlaying(false);
            setIsBusy(false);
          }
        }, 1000);
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
      audioInterruptionListener.remove();
      remotePauseListener.remove();
      remoteStopListener.remove();
      remotePlayListener.remove();
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
        recoverAudioSession: recoverFromAudioSessionConflict,
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
