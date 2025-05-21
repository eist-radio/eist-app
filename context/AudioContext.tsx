// context/AudioContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { useAudioPlayer } from 'expo-audio';
//const STREAM_URL = 'https://eist-radio.radiocult.fm/stream';
const STREAM_URL = 'https://stream-relay-geo.ntslive.net/stream';

type AudioContextType = {
  isPlaying: boolean;
  togglePlay: () => void;
};

const AudioContext = createContext<AudioContextType | null>(null);

export const AudioProvider = ({ children }: { children: ReactNode }) => {
  // useAudioPlayer will load the stream and keep it alive
  const player = useAudioPlayer({ uri: STREAM_URL });

  // `player.playing` is a boolean
  // `player.play()` and `player.pause()` control playback
  const isPlaying = player.playing;
  const togglePlay = () => {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  return (
    <AudioContext.Provider value={{ isPlaying, togglePlay }}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error('useAudio must be used within AudioProvider');
  return ctx;
};
