// context/AudioContext.tsx
import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { setAudioModeAsync } from 'expo-audio';
import { API_KEY as apiKey } from '@env';

// Local placeholders
const placeholderOnlineImage = require('../assets/images/eist_online.png');
const placeholderOfflineImage = require('../assets/images/eist_offline.png');

// Live stream & API constants
const STREAM_URL = 'https://eist-radio.radiocult.fm/stream';
const stationId = 'eist-radio';
const apiUrl = `https://api.radiocult.fm/api/station/${stationId}`;

export type AudioContextType = {
  isPlaying: boolean;
  togglePlay: () => void;
};

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider = ({ children }: { children: ReactNode }) => {
  // Fetch metadata
  const [title, setTitle] = useState('Live on éist');
  const [artist, setArtist] = useState('éist');
  const [artwork, setArtwork] = useState<string>(
    '../assets/images/eist_online.png'
  );

  const getArtistDetails = useCallback(
    async (artistId: string | null) => {
      if (!artistId) {
        return { name: ' ', image: artwork };
      }
      try {
        const res = await fetch(`${apiUrl}/artists/${artistId}`, {
          headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { artist: a = {} } = await res.json();
        return {
          name: a.name || ' ',
          image: a.logo?.['256x256'] || artwork,
        };
      } catch {
        return { name: ' ', image: artwork };
      }
    },
    [artwork]
  );

  const fetchNowPlaying = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/schedule/live`, {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { status, content } = (await res.json()).result;

      if (status !== 'schedule') {
        setTitle(' ');
        setArtist('éist · off air');
        setArtwork(require('../assets/images/eist_offline.png'));
      } else {
        setTitle(content.title || ' ');
        const artistId = content.artistIds?.[0] ?? null;
        const { name, image } = await getArtistDetails(artistId);
        setArtist(name);
        setArtwork(image);
      }
    } catch (err) {
      console.warn('fetchNowPlaying failed', err);
      setTitle(' ');
      setArtist('éist · off air');
      setArtwork(require('../assets/images/eist_offline.png'));
    }
  }, [getArtistDetails]);

  useEffect(() => {
    // Fetch now‐playing immediately, then every 30s
    fetchNowPlaying();
    const iv = setInterval(fetchNowPlaying, 30000);
    return () => clearInterval(iv);
  }, [fetchNowPlaying]);

  // Build source with metadata
  const sourceWithMetadata = useMemo(
    () => ({
      uri: STREAM_URL,
      metadata: {
        title,   // now‐playing title
        artist,  // now‐playing artist
        artwork, // now‐playing artwork
        duration: null, // live stream
      },
    }),
    [title, artist, artwork]
  );

  // Set up VideoPlayer for background
  const player = useVideoPlayer(sourceWithMetadata, (p) => {
    if (p) {
      // These flags tell the OS & lock‐screen how to handle live audio:
      p.loop = false;
      p.staysActiveInBackground = true;
      p.showNowPlayingNotification = true;
      p.audioMixingMode = 'doNotMix';
      p.allowsExternalPlayback = true;
    }
  });

  useEffect(() => {
    setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      interruptionModeIOS: 'doNotMix',
      staysActiveInBackground: true,
      interruptionModeAndroid: 'doNotMix',
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch((err) => console.error('Audio mode failed', err));
  }, []);

  // Playback state & toggle
  const [isPlaying, setIsPlaying] = useState(false);
  // A ref so we can remember "did the user want it playing?"" even if AppState kills it briefly
  const wasPlayingRef = useRef(false);
  // Track current AppState to detect foreground/background transitions
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const togglePlay = async () => {
    if (!player) {
      console.warn('Player not ready');
      return;
    }
    try {
      if (isPlaying) {
        await player.pause?.();
        setIsPlaying(false);
        wasPlayingRef.current = false;
      } else {
        await player.play?.();
        setIsPlaying(true);
        wasPlayingRef.current = true;
      }
    } catch (err) {
      console.error('Playback error', err);
    }
  };

  // Auto-reconnect on stream errors
  useEffect(() => {
    if (!player) return;
    const sub = player.addListener('statusChange', (status) => {
      // If the stream errors out, pause then try to re-play after 3s
      if (
        (status as any).error ||
        (status.status && status.status === 'error')
      ) {
        console.warn('Stream error detected:', (status as any).error);
        player
          .pause?.()
          .catch(() => {
            /* ignore */
          })
          .finally(() => {
            setTimeout(() => {
              player
                .play?.()
                .then(() => {
                  console.log('Reconnected stream successfully');
                  setIsPlaying(true);
                  wasPlayingRef.current = true;
                })
                .catch((e) => console.error('Stream reconnect failed', e));
            }, 3000);
          });
      }
    });
    return () => sub.remove();
  }, [player]);

  // Sync isPlaying with player status
  useEffect(() => {
    if (!player) return;
    const sub = player.addListener('statusChange', (status) => {
      if (status.status === 'readyToPlay' || status.status === 'loading') {
        // ignore
      } else if (status.status === 'idle') {
        // if the player went idle, reflect that in state
        setIsPlaying(false);
        wasPlayingRef.current = false;
      }
    });
    return () => sub.remove();
  }, [player]);

  // App state listener to wake audio on resume
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      async (nextAppState: AppStateStatus) => {
        // If we are coming from background/inactive > active
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          // If the user had pressed “play” before sleeping, re-kick the player
          if (wasPlayingRef.current && player) {
            try {
              // Check if it is not already playing
              const status = await player.getStatusAsync();
              if (!status.isPlaying && status.isLoaded) {
                await player.play?.();
                setIsPlaying(true);
              }
            } catch (e) {
              console.warn('Error re-resuming on AppState active', e);
            }
          }
        }
        appStateRef.current = nextAppState;
      }
    );
    return () => subscription.remove();
  }, [player]);

  // RENDER & HIDDEN VideoView
  return (
    <AudioContext.Provider value={{ isPlaying, togglePlay }}>
      {children}

      {/* 
        The “invisible” VideoView is what actually holds the native player 
        so that lock‐screen/media‐controls work. We keep it off‐screen. 
      */}
      <VideoView
        style={{
          width: 0,
          height: 0,
          opacity: 0,
          position: 'absolute',
          top: -1000,
          left: -1000,
        }}
        player={player}
        nativeControls={false}
      />
    </AudioContext.Provider>
  );
};

export const useAudio = (): AudioContextType => {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error('useAudio must be used within AudioProvider');
  return ctx;
};
