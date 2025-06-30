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
  forcePlayerReset: () => Promise<void>;
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

  // Enhanced recovery function for complete player reinitialization
  const recoverFromAudioSessionConflict = async () => {
    console.log('Attempting to recover from audio session conflict...');
    
    try {
      // Stop any current playback and reset state
      setIsPlaying(false);
      setIsBusy(false);
      setIsPlayerReady(false);
      
      // Try to stop the current player
      try {
        await TrackPlayer.stop();
      } catch (stopErr) {
        console.warn('Stop failed during recovery:', stopErr);
      }
      
      // Reset the player to clear all state
      try {
        await TrackPlayer.reset();
        console.log('Player reset for complete reinitialiation');
      } catch (resetErr) {
        console.warn('Reset failed during recovery:', resetErr);
      }
      
      // Wait for audio session to clear
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reset initialization flag so setupPlayer can run again
      hasInitialized.current = false;
      
      // Completely reinitialize the player
      await setupPlayer();
      
      console.log('Complete player recovery successful');
    } catch (err) {
      console.error('Recovery process failed:', err);
      setIsPlaying(false);
      setIsBusy(false);
      setIsPlayerReady(false);
    }
  };

  // Check if player is in a completely invalid state
  const isPlayerInvalidState = async (): Promise<boolean> => {
    try {
      // Try multiple operations to verify player health
      const state = await TrackPlayer.getState();
      const queue = await TrackPlayer.getQueue();
      
      // If we can get state and queue, player is likely healthy
      return false;
    } catch (err) {
      console.log('Player appears to be in invalid state:', err);
      return true;
    }
  };

  const play = async () => {
    if (!isPlayerReady) {
      console.log('Player not ready, attempting setup...');
      await setupPlayer();
      if (!isPlayerReady) return;
    }
    
    setIsBusy(true);
    try {
      await TrackPlayer.play();
      // Force immediate state sync after play command
      setImmediate(() => syncPlayerState());
    } catch (err) {
      console.error('TrackPlayer.play() failed:', err);
      setIsBusy(false);
      
      // Enhanced error handling for different types of failures
      if (err instanceof Error) {
        const errorMessage = err.message.toLowerCase();
        
        // Check for various types of player state issues
        if (errorMessage.includes('audio session') || 
            errorMessage.includes('interrupted') ||
            errorMessage.includes('not initialized') ||
            errorMessage.includes('player not set up') ||
            errorMessage.includes('invalid state') ||
            errorMessage.includes('playback failed')) {
          
          console.log('Player state issue detected, attempting full recovery...');
          await recoverFromAudioSessionConflict();
        } else {
          // For other errors, just try a basic state sync
          console.log('Unknown play error, syncing state...');
          setImmediate(() => syncPlayerState());
        }
      } else {
        // Non-Error exceptions might indicate player is in completely invalid state
        console.log('Non-standard error during play, attempting recovery...');
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

    // Enhanced app state handling with automatic recovery for long background periods
    const appStateListener = AppState.addEventListener('change', async (nextAppState) => {
      console.log(`App state changed to: ${nextAppState}`);
      
      if (nextAppState === 'active') {
        // App is becoming active - sync state and resume state checking
        startStateSync();
        await syncPlayerState();
        
        // Check if player is in invalid state after potentially long background period
        // But be careful not to interfere with CarPlay usage
        setTimeout(async () => {
          try {
            // Check if player might be actively used (e.g., via CarPlay)
            // If the current isPlaying state is true, assume it's being used and skip recovery
            if (isPlaying) {
              console.log('Player appears to be in use (likely CarPlay) - skipping auto-recovery');
              return;
            }
            
            const playerInvalid = await isPlayerInvalidState();
            
            if (playerInvalid) {
              console.log('Player in invalid state after background - auto-recovering');
              await recoverFromAudioSessionConflict();
            } else {
              // Normal state check for minor audio conflicts
              const currentState = await TrackPlayer.getState();
              const actuallyPlaying = currentState === State.Playing;
              // If we think we should be playing but we're not, sync the UI
              if (isPlaying && !actuallyPlaying) {
                console.log('State mismatch detected on app focus - syncing UI');
                setIsPlaying(false);
                setIsBusy(false);
              }
            }
          } catch (err) {
            console.warn('State check failed on app focus - checking if recovery needed:', err);
            
            // Before doing full recovery, check if we might be interrupting CarPlay
            // If the error is just about getting state but player might be working,
            // be more conservative
            try {
              // Try a simpler operation first
              await TrackPlayer.getQueue();
              console.log('Queue accessible - player might be working via CarPlay, avoiding recovery');
              setIsPlaying(false);
              setIsBusy(false);
            } catch (queueErr) {
              // If we can't even get queue, player is definitely broken
              console.log('Player completely inaccessible - initiating recovery');
              await recoverFromAudioSessionConflict();
            }
          }
        }, 1500); // Slightly longer delay to let the app fully come to foreground
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
        forcePlayerReset: recoverFromAudioSessionConflict,
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
