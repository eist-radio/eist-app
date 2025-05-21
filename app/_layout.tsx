// app/_layout.tsx

import React from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { EistLightTheme, EistDarkTheme } from '../themes'
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { AudioProvider } from '../context/AudioContext';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
  const scheme = useColorScheme(); // 'light' | 'dark'
  const theme = scheme === 'dark' 
    ? EistDarkTheme 
    : EistLightTheme;

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  if (!loaded) return null;

  return (
    <AudioProvider>
      <ThemeProvider value={theme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AudioProvider>
  );
}