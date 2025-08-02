import { Audio } from 'expo-av';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

interface AudioPlayerContextType {
  isPlaying: boolean;
  isPlayerReady: boolean;
  currentTrack: any;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  setupPlayer: () => Promise<void>;
  cleanResetPlayer: () => Promise<void>;
  updateMetadata: (metadata: any) => Promise<void>;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

const STREAM_URL = 'https://eist-radio.radiocult.fm/stream';

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const appStateRef = useRef(AppState.currentState);

  const setupPlayer = async () => {
    try {
      // Request audio permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Audio permission not granted');
        return;
      }

      // Set audio mode for background playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Create sound object
      const { sound } = await Audio.Sound.createAsync(
        { uri: STREAM_URL },
        { shouldPlay: false, isLooping: true }
      );
      
      soundRef.current = sound;
      setIsPlayerReady(true);
      console.log('Audio player setup complete');
    } catch (error) {
      console.error('Failed to setup audio player:', error);
      setIsPlayerReady(false);
    }
  };

  const cleanResetPlayer = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setIsPlaying(false);
      setIsPlayerReady(false);
      setCurrentTrack(null);
    } catch (error) {
      console.error('Failed to clean reset player:', error);
    }
  };

  const play = async () => {
    try {
      if (soundRef.current && isPlayerReady) {
        await soundRef.current.playAsync();
        setIsPlaying(true);
        console.log('Audio playback started');
      }
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  };

  const pause = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        console.log('Audio playback paused');
      }
    } catch (error) {
      console.error('Failed to pause audio:', error);
    }
  };

  const stop = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        setIsPlaying(false);
        console.log('Audio playback stopped');
      }
    } catch (error) {
      console.error('Failed to stop audio:', error);
    }
  };

  const updateMetadata = async (metadata: any) => {
    try {
      setCurrentTrack(metadata);
      console.log('Metadata updated:', metadata);
    } catch (error) {
      console.error('Failed to update metadata:', error);
    }
  };

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App has come to the foreground!');
      } else if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
        console.log('App has gone to the background!');
        // Optionally pause playback when app goes to background
        // pause();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // Setup player on mount
  useEffect(() => {
    setupPlayer();
    return () => {
      cleanResetPlayer();
    };
  }, []);

  const value: AudioPlayerContextType = {
    isPlaying,
    isPlayerReady,
    currentTrack,
    play,
    pause,
    stop,
    setupPlayer,
    cleanResetPlayer,
    updateMetadata,
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
};

export const useAudioPlayer = () => {
  const context = useContext(AudioPlayerContext);
  if (context === undefined) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
}; 